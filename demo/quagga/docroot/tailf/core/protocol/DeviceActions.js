// FIXME : Move to tailf/core/protocol/ncs/DeviceActions
define('tailf/core/protocol/DeviceActions', [
    'jquery',
    '../logger',
    './JsonRpc'
], function($, logger, JsonRpc) {

function _trace() {
    logger.tracePrefix('core/protocol/DeviceActions : ', arguments);
}


function _assertEqual(value, expected) {
    if (value !== expected) {
        logger.error('ASSERT : value=', value);
        logger.error('ASSERT : expected=', expected);
        throw 'ASSERTION : Expected ' + value + ' === ' + expected;
    }
}

function _devicePath(deviceName) {
    return '/ncs:devices/device{"' + deviceName + '"}';
}

function _action(th, path, format, params) {
    format = format ? format : 'normal';
    params = params ? params : {};

    return JsonRpc('run_action', {
        th : th,
        path : path,
        format : format,
        params : params
    });
}

function m_ping(th, deviceName, format) {
    var deferred = $.Deferred();

    var path = _devicePath(deviceName) + '/ping';

    _action(th, path, format).done(function(result) {
        _assertEqual(result.length, 1);
        _assertEqual(result[0].name, 'result');

        result = result[0].value;
        deferred.resolve(result);
    }).fail(function(err) {
        deferred.reject(err);
    });

    return deferred.promise();
}

/*
 * PING 127.0.101.1 (127.0.101.1): 56 data bytes

--- 127.0.101.1 ping statistics ---
1 packets transmitted, 0 packets received, 100.0% packet loss

 *
 * PING 127.0.0.1 (127.0.0.1): 56 data bytes
64 bytes from 127.0.0.1: icmp_seq=0 ttl=64 time=0.031 ms

--- 127.0.0.1 ping statistics ---
1 packets transmitted, 1 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 0.031/0.031/0.031/0.000 ms
 */


// FIXME : Ping result parsing, probably not ok in the generic case.
function m_pingBooleanResult(th, deviceName) {
    var deferred = $.Deferred();

    m_ping(th, deviceName, 'normal').done(function(result) {
        if (result.indexOf('0 packets received') >= 0) {
            deferred.resolve(false);
        } else {
            deferred.resolve(true);
        }
    }).fail(function(err) {
        deferred.reject(err);
    });

    return deferred.promise();
}

function m_connect(th, deviceName, format) {
    var deferred = $.Deferred();

    var path = _devicePath(deviceName) + '/connect';

    _action(th, path, format).done(function(result) {
        _trace('m_connect : result=', result);

        _assertEqual(result.length, 2);
        _assertEqual(result[0].name, 'result');
        _assertEqual(result[1].name, 'info');


        _trace('m_connect : result[0].value=', result[0].value);
        _trace('m_connect : result[1].value=', result[1].value);

        //result = result[0].value;

        var stat = {
            connected : null,
            info      : result[1].value
        };

        if (result[0].value === 'true') {
            stat.connected = true;
        } else if (result[1].value === 'false') {
            stat.connected = false;
        }

        deferred.resolve(stat);
    }).fail(function(err) {
        deferred.reject(err);
    });

    return deferred.promise();
}


return {
    ping              : m_ping,
    pingBooleanResult : m_pingBooleanResult,

    connect           : m_connect
};

});
