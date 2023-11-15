let wsclient;
let url = '';
let ctr = 0;
let callBacks = {};
let listeners = {};
let defaultListener;
let user = '';
let passwd = '';
let timeout;
let pingInterval;

function addListener(path, f) {
    if (path !== undefined) listeners[path] = f;
    else defaultListener = f;
}


function connectWs({domain, port, path = '/ws', username = '', password = ''}) {
    if (domain === undefined) domain = window.location.host;
    if (port === undefined) port = window.location.port;
    if (port === undefined || port === '') port = window.location.href.startsWith('https') ? 443 : 80;

    let idx = domain.indexOf(':');
    if (idx > -1) domain = domain.substring(0, idx);

    user = username;
    passwd = password;
    url = ((port === 443) ? 'wss' : 'ws') + '://' + domain + ':' + port + '/' + path;


    ///Attach pings every 10 seconds
    if (pingInterval !== undefined) clearInterval(pingInterval);
    pingInterval = setInterval(async function () {
        let res = await sendWSAsync('ping', {});
        return res;
    }, 10000);
}

function _attachWs(url) {
    //Clear callbacks on connect
    callBacks = {};
    if (user !== null && user !== '' && passwd !== null && passwd !== '') {
        //Reconnect websocket
        let key = btoa(JSON.stringify({'u': user, 'p': passwd})).replace('=', '');
        //Will make header: "Sec-WebSocket-Protocol: key"
        wsclient = new WebSocket(url, [null, key]);
    } else wsclient = new WebSocket(url);


    wsclient.onclose = function (ev) {
        if (ev.wasClean) console.log(`WS connection closed clean ${ev.code}/${ev.reason}`);
        else console.log('WS connection error!');

        clearTimeout(timeout);
        timeout = setTimeout(function () {
            wsclient = _attachWs(url);
        }, 3000)
    };

    wsclient.onmessage = function (msg) {
        let data = JSON.parse(msg.data);
        let ccnum = data['n'];
        if (ccnum > 0 && callBacks[ccnum] !== undefined) {
            callBacks[ccnum](data['m']);
            callBacks[ccnum] = undefined;
        } else if (listeners[data['c']] !== undefined) {
            listeners[data['c']](data['m']);
        } else if (defaultListener !== undefined) defaultListener(data['m']);
        else console.log('No such listener for ' + data['c'] + '!');
    };

    return wsclient;
}


function sendWS(path, data, callBack) {
    let cctr = ++ctr;
    let msg = {'n': cctr, 'c': path, 'm': data};
    let toSend = JSON.stringify(msg);

    if (wsclient !== undefined) {
        if (wsclient.readyState === 1) wsclient.send(toSend);
    } else {
        wsclient = _attachWs(url);
        wsclient.onopen = function (_) {
            wsclient.send(toSend);
        };
    }
    callBacks[cctr] = callBack;
}

function sendWSAsync(path, data) {
    return new Promise(function (success, fail) {
        let to = setTimeout(fail, 3000);
        sendWS(path, data, function (data) {
            success(data);
            clearTimeout(to);
        });
    });
}
