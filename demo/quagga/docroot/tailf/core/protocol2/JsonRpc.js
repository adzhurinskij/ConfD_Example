/*jshint devel:true*/
define([
    'bluebird',
    'tailf/core/protocol/JsonRpc'

], function(
    bluebird,
    jsonRpc
) {
    var me = function(method, params) {
        return new Promise(function(resolve, reject) {
            jsonRpc(method, params).then(function(res) {
                resolve(res);
            }).fail(function(err) {
                reject(err);
            });
        });
    }

    return me;
});

