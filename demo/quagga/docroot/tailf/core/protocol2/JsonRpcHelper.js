define([
    'bluebird',
    'tailf/core/protocol/JsonRpcHelper',
], function(
    bluebird,
    jsonRpcHelper
) {
    function m_read(db) {
        return new Promise(function(resolve, reject) {
            jsonRpcHelper.read(db).then(function(res) {
                resolve(res);
            }).fail(function(err) {
                reject(err);
            });
        });
    }

    function m_write(db, mode) {
        return new Promise(function(resolve, reject) {
            jsonRpcHelper.write(db, mode).then(function(res) {
                resolve(res);
            }).fail(function(err) {
                reject(err);
            });
        });
    }

    // FIXME : Need json-rpc delete with allow non exist semantics
    function m_deleteAllowNonExist(th, keypath) {
        return new Promise(function(resolve, reject) {
            jsonRpcHelper.deleteAllowNonExist(th, keypath).then(function(res) {
                resolve(res);
            }).fail(function(err) {
                reject(err);
            });
        });
    }

    // FIXME : Need json-rpc create with allow exist semantics
    function m_createAllowExist(th, keypath) {
        return new Promise(function(resolve, reject) {
            jsonRpcHelper.createAllowExist(th, keypath).then(function(res) {
                resolve(res);
            }).fail(function(err) {
                reject(err);
            });
        });
    }

    function m_getSchema(th, namespace, path, levels, insertValues, evaluateWhenEntries) {
        return new Promise(function(resolve, reject) {
            jsonRpcHelper.getSchema(th, namespace, path, levels,
                                    insertValues, evaluateWhenEntries).then(function(res) {
                resolve(res);
            }).fail(function(err) {
                reject(err);
            });
        });
    }

    return {
        read  : m_read,
        write : m_write,

        getSchema            : m_getSchema,
        deleteAllowNonExist  : m_deleteAllowNonExist,
        createAllowExist     : m_createAllowExist
    };
});
