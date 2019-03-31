/*jshint devel:true*/
define([
    'jquery',
    'lodash'
], function(
    $,
    _
) {
    'use strict';

    var me;

    me = function(method, params) {
        if (me.wrappers[method]) {
            return me.wrappers[method](params);
        }
        return me.run(method, params);
    };

    $.extend(me, {
        id: 0,
        clientHandleId: 0,

        // FIXME move to JsonRpcHelper
        wrappers: {},

        // Exposes API functions
        api: {
            // MAAPI database settings
            READ_DB: 'running',
            WRITE_DB: 'candidate'
        },

        noSession: undefined,
        raw: undefined,
        makeOnCallDone: undefined,
        onCallError: undefined,
        makeOnCallFail: undefined
    });

    me.noSession = function() {
        window.location.assign('login.html');
    };

    me.run = function(method, params, timeout) {
        var deferred = $.Deferred();

        me.id = me.id + 1;

        $.ajax({
            type: 'POST',
            url: '/jsonrpc/' + method,
            contentType: 'application/json',
            timeout : timeout,

            data: JSON.stringify({
                jsonrpc: '2.0',
                id: me.id,
                method: method,
                params: params
            }),
            dataType: 'json'
        })
              .then(me.makeOnCallDone(method, params, deferred))
              .fail(me.makeOnCallFail(method, params, deferred));
        return deferred.promise();
    };

    me.makeOnCallDone = function(method, params, deferred) {
        return function(reply/*, status, xhr*/) {
            if (reply.error) {
                return me.onCallError(method, params, deferred, reply);
            }
            deferred.resolve(reply.result);
        };
    };

    me.onCallError = function(method, params, deferred, reply) {
        var error = $.extend(new Error(reply.error.message), {
            type: reply.error.type,
            code: reply.error.code,
            message: reply.error.message,
            data: reply.error.data
        });
        if(error.type === 'session.invalid_sessionid') {
            me.noSession();
        }

        deferred.reject(error);
    };

    me.makeOnCallFail = function(method, params, deferred) {
        return function(xhr, status, errorMessage) {
            var error;

            error = $.extend(new Error(errorMessage), {
                type: 'ajax.response.error',
                detail: JSON.stringify({method: method, params: params}),
                originalError : {
                    xhr          : xhr,
                    status       : status,
                    errorMessage : errorMessage
                }
            });

            deferred.reject(error);
        };
    };

    return me;
});

// Local Variables:
// mode: js
// js-indent-level: 4
// End:
