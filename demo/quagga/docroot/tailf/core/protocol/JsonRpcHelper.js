define([
    'jquery',
    'lodash',

    'tailf/core/protocol/json-rpc',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcErr',

    'tailf/core/happy',
    'tailf/core/yang/schema/Schema',
    'tailf/core/yang/schema/Module',
    'tailf/core/yang/schema/List'
], function($, _, JR, jsonRpc, jsonRpcErr, happy, Schema, Module, List) {

    var _pendingThWrite = false;

    // Listeners:
    //
    // global-write-th : {
    //      action : 'created', 'removed'
    //      type   : 'new', 'existing', undefined
    //   }

    var _listenerIx = 0;
    var _listeners = {};

    function _whenArray(whenArgs, resultDataCallback) {
        var deferred = $.Deferred();

        $.when.apply(null, whenArgs).done(function() {
            var res = arguments;

            if (resultDataCallback !== undefined) {
                res = resultDataCallback(arguments);
            }

            deferred.resolve(res);
        }).fail(function(err) {
            deferred.reject(err);
        });

        return deferred.promise();
    }

    /*
     * args = {
     *      th             : ...
     *      xpath_expr     : ...
     *      selection      : [...],
     *      context_node   : ...
     *      initial_offset : ..., // One-based start index
     *      chunk_size     : ..., // Number of items to fetch
     * }
     */
    function m_query(params) {
        var deferred = $.Deferred();

        params = $.extend({
            result_as: 'string'
        }, params);

        jsonRpc('start_query', params).done(function(result) {
            jsonRpc('run_query', {qh : result.qh}).done(function(result) {
                deferred.resolve(result);
            }).fail(function(err) {
                deferred.reject(err);
            }).always(function() {
                jsonRpc('stop_query', {qh : result.qh}).done(function() {
                });
            });
        }).fail(function(err) {
            deferred.reject(err);
        });

        return deferred.promise();
    }

    function m_addListener(name, args) {
        return JR.addListener(name, args);
    }

    function m_deleteListener(id) {
        return JR.deleteListener(id);
    }


    function m_read(db) {
        var deferred = $.Deferred();

        if (db === undefined) {
            db = 'running';
        }

        // FIXME : Must match db as well
        if (JR._getThWrite() !== undefined) {
            deferred.resolve(JR._getThWrite());
        } else if (JR._getThRead() !== undefined) {
            deferred.resolve(JR._getThRead());
        } else {
            return _readTrans(db);
        }

        return deferred.promise();
    }

    function _readTrans(db) {
        function _read(trans) {
            var t = _.find(trans, {db: db});

            if (t === undefined) {
                return jsonRpc('new_trans', {db:db, mode: 'read'}).then(function(th) {
                    JR._setThRead(th.th);
                    return JR._getThRead();
                });
            } else {
                JR._setThRead(t.th);
                return JR._getThRead();
            }
        }

        return jsonRpc('get_trans').then(function(res) {
            var writeTrans = _.filter(res.trans, {mode: 'read_write'});
            var readTrans = _.filter(res.trans, {mode: 'read'});

            if (writeTrans.length === 0) {
                // No write transaction yet, use read
                return _read(readTrans);
            } else {
                // Write transaction, global variable not set yet.
                JR._setThWrite(writeTrans[0].th);

                JR._sendToListeners('global-write-th', {
                    action : 'created',
                    type   : 'existing'
                });

                return JR._getThWrite();
            }
        }).fail(function(err) {
            console.error('getWriteTrans : err=', err);
        });
    }


    function m_hasWriteTransaction() {
        return JR._getThWrite() !== undefined;
    }

    function m_write(db, mode) {
        var deferred = $.Deferred();

        var maxWaitTime    = 1000;
        var singleWaitTime = 50;
        var waitCountLimit = maxWaitTime / singleWaitTime;
        var waitCount = 0;

        function _checkPending() {
            waitCount += 1;

            if (waitCount >= waitCountLimit) {
                console.error('jsonRpcHelper.write : Pending write transaction failed');
                deferred.reject('write : Pending write transaction failed');
            } else if (JR._getThWrite() !== undefined) {
                deferred.resolve(JR._getThWrite());
            } else {
                setTimeout(function() {
                    _checkPending();
                }, singleWaitTime);
            }
        }

        if (db === undefined) {
            db = 'running';
        }

        if (mode === undefined) {
            mode = 'private';
        }

        // FIXME : Must match db and mode as well
        if (JR._getThWrite() !== undefined) {
            deferred.resolve(JR._getThWrite());
        } else {

            if (_pendingThWrite) {
                // May happen if two or more items in a list is removed at once
                // FIXME : Not bulletproof since I'm using a fixed timeout,

               _checkPending();
            } else {
                _pendingThWrite = true;

                return jsonRpc('new_trans', {db: db, conf_mode: mode, mode: 'read_write'}).then(function(th) {
                    JR._setThWrite(th.th);

                    _pendingThWrite = false;

                    JR._sendToListeners('global-write-th', {
                        action : 'created',
                        type   : 'new'
                    });

                    return JR._getThWrite();
                });
            }
        }

        return deferred.promise();
    }

    // Simplified commit, a'la the capi apply
    function m_apply(th, flags) {
        var deferred = $.Deferred();

        var flagArr = [];

        if(flags && 'no-out-of-sync-check' in flags && flags['no-out-of-sync-check']) {
            flagArr.push('no-out-of-sync-check');
        }

        jsonRpc('validate_commit', {th: th}).done(function() {
            var params = {th: th};
            if(flagArr.length > 0) {
                params.flags = flagArr;
            }

            jsonRpc('commit', params).done(function() {
                // Now the write transaction handle is invalid
                JR._setThWrite(undefined);

                JR._sendToListeners('global-write-th', {
                    action : 'removed'
                });

                deferred.resolve();
            }).fail(function(err) {
                deferred.reject(err);
            });
        }).fail(function(err) {
            deferred.reject(err);
        });

        return deferred.promise();
    }

    function m_commitDryRun(th, outputFormat) {
        return jsonRpc('validate_commit', {th: th}).then(function() {
            return jsonRpc('commit', {th: th, flags: ['dry-run=' + outputFormat]});
        });
    }

    function m_revert() {
        var deferred = $.Deferred();

        if (JR._getThWrite() === undefined) {
            deferred.resolve();
        } else {
            jsonRpc('delete_trans', {th: JR._getThWrite()}).done(function() {
                JR._setThWrite(undefined);

                JR._sendToListeners('global-write-th', {
                    action   : 'removed',
                    specific : 'reverted'
                });

                deferred.resolve();
            }).fail(function(err) {
                deferred.reject(err);
            });
        }

        return deferred.promise();
    }

    function m_getValues(th, keypath, leafs) {
        return jsonRpc('get_values', {
            th    : th,
            path  : keypath,
            leafs : leafs
        });
    }

    function m_getValuesAsObject(th, keypath, leafs) {
        var deferred = $.Deferred();

        jsonRpc('get_values', {
            th    : th,
            path  : keypath,
            leafs : leafs
        }).done(function(result) {
            var res = {};

            _.each(result.values, function(v, ix) {
                res[leafs[ix]] = v.value;
            });

            deferred.resolve(res);
        }).fail(function(err) {
            deferred.reject(err);
        });

        return deferred.promise();
    }


    // FIXME: We need a json-rpc set_values
    function m_setValues(th, keypath, values) {

        var wa = [];

        _.each(values, function(value, key) {
            var kp = keypath + '/' + key;
            wa.push( jsonRpc('set_value', {
                        th    : th,
                        path  : kp,
                        value : value}));
        });

        return _whenArray(wa);
    }

    // FIXME: We need a json-rpc create_values
    function m_createValues(th, keypath, values) {
        var wa = [];

        _.each(values, function(key) {
            var kp = keypath + '/' + key;
            wa.push(m_createAllowExist(th, kp));
        });

        return _whenArray(wa);
    }


    // FIXME: We need a json-rpc delete_values
    function m_deleteValues(th, keypath, values) {
        var wa = [];

        _.each(values, function(key) {
            var kp = keypath + '/' + key;
            wa.push(m_deleteAllowNonExist(th, kp));
        });

        return _whenArray(wa);
    }

    function m_exists(th, keypath) {
        return jsonRpc('exists', {th: th, path: keypath}).then(function(result) {
            return result.exists;
        });
    }

    // FIXME : Need json-rpc delete with allow non exist semantics
    function m_deleteAllowNonExist(th, keypath) {
        return jsonRpc('exists', {th: th, path: keypath}).then(function(result) {
            if (result.exists) {
                return jsonRpc('delete', {th: th, path: keypath});
            }
        });
    }

    // FIXME : Need json-rpc create with allow exist semantics
    function m_createAllowExist(th, keypath) {
        return jsonRpc('exists', {th: th, path: keypath}).then(function(result) {
            if (result.exists) {
                return { created : false };
            } else {
                return jsonRpc('create', {th: th, path: keypath}).then(function() {
                    return { created : true };
                });
            }
        });
    }

    function _getModule(th, namespace) {
        var deferred = $.Deferred();

        jsonRpc('get_schema', {
            th            : th,
            namespace     : namespace,
            levels        : 1,
            insert_values : false
        }).done(function(result) {
            var ret = new Module(result);
            deferred.resolve(ret);
        }).fail(function(err) {
            deferred.reject(err);
        });

        return deferred.promise();
    }

    // Get top 'modules' that will be visible in the UI
    // FIXME : Better name
    function m_getVisibleTopModules(th, namespaces) {
       var whenArgs = [];

        _.each(namespaces, function(ns) {
            whenArgs.push(_getModule(th, ns));
        });

        return _whenArray(whenArgs, function(result) {
            var ret = [];

            _.each(result, function(m) {
                if (m.hasChildren()) {
                    ret.push(m);
                }
            });

            return ret;
        });
     }

    function m_getSchema(th, namespace, path, levels, insertValues, evaluateWhenEntries) {
        var deferred = $.Deferred();

        insertValues = insertValues === true ? true : false;
        evaluateWhenEntries = evaluateWhenEntries === true ? true : false;

        if (insertValues) {
            console.warn('insertValue === true : Are you really really sure!!!!!!');
        }

        jsonRpc('get_schema', {
            th            : th,
            namespace     : namespace,
            path          : path,
            levels        : levels,
            insert_values : insertValues,
            evaluate_when_entries : evaluateWhenEntries
        }).done(function(result) {
            var ret = new Schema(result);
            deferred.resolve(ret);
        }).fail(function(err) {
            deferred.reject(err);
        });

        return deferred.promise();
    }

// DEPRECATED: Use getListKey2 instead
function m_getListKeys(th, path, keysAsList) {
    var deferred = $.Deferred();

    m_getSchema(th, '', path, 1, false).done(function(schema) {
        var keys = schema.getKeyNames();

        if (keys.length > 1) {
            keysAsList = true;
        }

        var contextNode = schema.getParentKeypath();
        var xpathExpr = schema.getName();

        m_query({
            th             : th,
            context_node   : contextNode, //'/ncs:devices',
            xpath_expr     : xpathExpr,   // 'device',
            selection      : keys,
            chunk_size     : 1000000,
            initial_offset : 1
        }).done(function(result) {
            var items = [];

            _.each(result.results, function(res) {
                if (keysAsList) {
                    var item = [];
                    _.each(keys, function(key, ix) {
                        item.push(res[ix]);
                    });

                    items.push(item);
                } else {
                    items.push(res[0]);
                }
            });

            deferred.resolve(items);
        }).fail(function(err) {
            deferred.reject(err);
        });

    }).fail(function(err) {
        deferred.reject(err);
    });

    return deferred.promise();
}

function m_getListKeys2(th, path, keysAsList) {
    var deferred = $.Deferred();

    jsonRpc('get_list_keys', {
        th : th,
        path : path,
        chunk_size : 1000000
    }).done(function(result) {
        var keys = result.keys;
        var ret;

        if (!keysAsList && (keys.length > 0) && (keys[0].length === 1)) {
            ret = [];
            _.each(keys, function(key) {
                ret.push(key[0]);
            });
        } else {
            ret = keys;
        }

        deferred.resolve(ret);
    }).fail(function(err) {
        deferred.reject(err);
    });

    return deferred.promise();
}


/*
 * Get all items in a (one key) list.
 *
 * args = {
 *      th    : ...
 *      path  : ... list keypath,
 *
 *      item  : function(item) {
 *          return promise;
 *      },
 *
 *      debug : { // Optional
 *          readyKey : function(stopWatch) ... // Called when all keys are fetched
 *          ready    : function(stopWatch) ... // Called when all items are fetched
 *      }
 * }
 *
 */
function m_getAllListItemsSingleKey(args) {
    var deferred = $.Deferred();

    m_getListKeys(args.th, args.path).done(function(keys) {
        var whenArgs = [];
        _.each(keys, function(key) {
            whenArgs.push(args.item(key));
        });

        _whenArray(whenArgs).done(function(result) {
            deferred.resolve(result);
        }).fail(function(err) {
            deferred.reject(err);
        });
    });

    return deferred.promise();
}

/*
 * Get specified items
 *
 * args = {
 *      items : [item],
 *      item  : function(item) {
 *          return promise;
 *      },
 *
 *      debug : {
 *          ready : function(stopWatch) { // Called when all items are fetched
 *          }
 *      }
 * }
 *
 */
 function m_getItems(args) {
    var deferred = $.Deferred();

    var th = args.th;
    var items = args.items;

    var whenArgs = [];
    _.each(items, function(item) {
        whenArgs.push(args.item(item));
    });

    _whenArray(whenArgs).done(function(result) {
        deferred.resolve(result);
    }).fail(function(err) {
        deferred.reject(err);
    });

    return deferred.promise();
}


function m_getBackpointers(th, path) {
    return happy(jsonRpc.call, 'get_attrs', {
        th    : th,
        path  : path,
        names : ['backpointer']
    });
}

function m_addLeafListValue(th, path, value) {
    var deferred = $.Deferred();

    function _add(values, newValue) {
        values.push(newValue);
        jsonRpc('set_value', {
            th    : th,
            path  : path,
            value : values
        }).done(function() {
            deferred.resolve();
        }).fail(function(err) {
            deferred.reject(err);
        });
    }

    jsonRpc('get_value', {
        th : th,
        path : path
    }).done(function(result) {
        _add(result.value, value);
    }).fail(function(err) {
        if (jsonRpcErr.isDataNotFoundErr(err)) {
            _add([], value);
        } else {
            deferred.reject(err);
        }
    });

    return deferred.promise();
}

function m_deleteLeafListValue(th, path, value) {
    var me = this;
    var deferred = $.Deferred();

    jsonRpc('get_value', {
        th   : th,
        path : path
    }).done(function(result) {
        var newValue = [];

        _.each(result.value, function(v) {
            if (v !==  value) {
                newValue.push(v);
            }
        });

        if (newValue.length === result.value.length) {
            deferred.resolve('not-found');
        } else {
            jsonRpc('set_value', {
                th    : th,
                path  : path,
                value : newValue
            }).done(function() {
                deferred.resolve('deleted');
            }).fail(function(err) {
                deferred.reject(err);
            });
        }
    }).fail(function(err) {
        if (jsonRpcErr.isDataNotFoundErr(err)) {
            deferred.resolve('not-found');
        } else {
            console.error('m_deleteListValue : Failed to get value : err=', err);
            deferred.reject(err);
        }
    });

    return deferred.promise();
}

function m_runAction(params) {
    // TODO: Global disable of actions?
    return jsonRpc('run_action', params).always(function() {
        // TODO: Global enable of actions?
    });
}

return {
    whenArray : _whenArray,

    addListener : m_addListener,
    deleteListener : m_deleteListener,

    read  : m_read,
    write : m_write,
    apply : m_apply,
    revert : m_revert,

    hasWriteTransaction : m_hasWriteTransaction,

    getValues         : m_getValues,
    getValuesAsObject : m_getValuesAsObject,
    setValues         : m_setValues,
    createValues      : m_createValues,
    deleteValues      : m_deleteValues,

    query: m_query,

    getVisibleTopModules : m_getVisibleTopModules,
    getSchema            : m_getSchema,
    getModule            : _getModule,
    getListKeys          : m_getListKeys,
    getListKeys2         : m_getListKeys2,
    exists               : m_exists,
    deleteAllowNonExist  : m_deleteAllowNonExist,
    createAllowExist     : m_createAllowExist,

    getAllListItemsSingleKey : m_getAllListItemsSingleKey,
    getItems                 : m_getItems,

    getBackpointers : m_getBackpointers,

    addLeafListValue    : m_addLeafListValue,
    deleteLeafListValue : m_deleteLeafListValue,

    runAction: m_runAction,
    commitDryRun: m_commitDryRun
};
});
