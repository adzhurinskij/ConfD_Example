(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], function() {
            if(typeof window !== 'undefined' && 'document' in window) {
                return factory(window.document);
            } else {
                return factory({});
            }
        });
    } else if (typeof exports === 'object') {
        // Node, CommonJS-like
        if(typeof window !== 'undefined' && 'document' in window) {
            module.exports = factory(window.document);
        } else {
            module.exports = factory({});
        }
    } else {
        // Browser globals (root is window)
        module.exports = factory();
    }
}(this, function (global) {
    var id = 0;

    var baseurl  = '';

    var thWrite;
    var thRead;
    var pendingThWrite;
    global.listenerIx = 0;
    global.listeners = {};

    function log(type, msg) {
        //TODO: add logger
    }

    function JsonRpcError(error) {
        this.message = error.message;
        this.type = error.type;
        this.code = error.code;
        this.data = error.data;
        this.stack = (new Error()).stack;
    }
    JsonRpcError.prototype = new Error;

    function HttpError(method, params, xhr)  {
        this.type = 'http.error';
        this.details = JSON.stringify({method: method, params: params});
        this.status = xhr.status;
        this.statusText = xhr.statusText;
        this.errorMessage = xhr.responseText;
        this.stack = (new Error()).stack;
    }

    HttpError.prototype = new Error;

    function getRequest(method, params) {
        id += 1;
        return JSON.stringify({jsonrpc: '2.0', id: id, method: method, params: params});
    }

    function noSession() {
        window.location.assign('login.html');
    }

    function jsonrpc(method, params) {
        var xhr = new XMLHttpRequest();

        return new Promise(function(resolve, reject) {
            xhr.onload = function() {
                if(xhr.readyState === (xhr.DONE || 4)) {
                    log('jsonrpc.response', xhr.responseText);
                    if(xhr.status !== 200) return reject(new HttpError(method, params, xhr));

                    var resp = JSON.parse(xhr.responseText);

                    if('error' in resp && resp.error.type === 'session.invalid_sessionid') {
                        return reject(noSession());
                    }

                    if('error' in resp) return reject(new JsonRpcError(resp.error));

                    resolve(resp.result);
                }
            }

            var req = getRequest(method, params);
            log('jsonrpc.request', req);

            xhr.open('POST', baseurl + '/jsonrpc/' + method);
            xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");

            xhr.send(req);
        });
    }

    function findTrans(trans, mode, db) {
        return trans.reduce(function(acc, cur) {
            if(cur.db === db && cur.mode === mode) {
                acc.push(cur);
            }
            return acc;
        }, []);
    }

    function read(db) {
        db = db || 'running';

        if(_getThWrite() !== undefined) {
            return Promise.resolve(_getThWrite());
        }

        if(_getThRead() !== undefined) {
            return Promise.resolve(_getThRead());
        }

        return jsonrpc('get_trans').then(function(res) {
            var readWriteTrans = findTrans(res.trans, 'read_write', db);
            var readTrans = findTrans(res.trans, 'read', db);

            if(readWriteTrans.length > 0) {
                sendToListeners('global-write-th', {
                    action : 'created',
                    type   : 'existing'
                });

                return Promise.resolve(_setThWrite(readWriteTrans[0].th));
            }

            if(readTrans.length > 0) {
                return Promise.resolve(_setThRead(readTrans[0].th));
            }

            return jsonrpc('new_trans', {db: db, mode: 'read'}).then(function(res) {
                return _setThRead(res.th);
            });
        });
    }

    function delayPromise(ms) {
        return function() {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve();
                }, ms);
            });
        }
    }

    var maxWaitTime = 1000;
    var singleWaitTime = 50;

    function range(n) {
        return Array.apply(null, Array(n)).map(function (_, i) {return i;});
    }

    function checkPending() {
        var waitCountLimit = maxWaitTime / singleWaitTime;

        return range(waitCountLimit).reduce(function(acc, cur) {
            return acc.then(delayPromise(singleWaitTime)).then(function(res) {
                if(_getThWrite() !== undefined) {
                    _setPendingThWrite(false);
                    return Promise.resolve(_getThWrite());
                }

                if(cur === waitCountLimit-1) {
                    return Promise.reject('write : Pending write transaction failed');
                }
            });
        }, Promise.resolve());
    }

    function write(db, mode) {
        db = db || 'running';
        mode = mode || 'private';

        if(_getThWrite() !== undefined) {
            return Promise.resolve(_getThWrite());
        }

        if(_isPendingThWrite()) {
            return checkPending();
        }

        _setPendingThWrite(true);
        return jsonrpc('new_trans', {db: db, conf_mode: mode, mode: 'read_write'}).then(function(res) {
            _setThWrite(res.th);
            _setPendingThWrite(false);

            sendToListeners('global-write-th', {
                action : 'created',
                type   : 'new'
            });

            return _getThWrite();
        });

    }

    function addListener(name, cb) {
        global.listenerIx += 1;

        global.listeners[global.listenerIx] = {
            name: name,
            callback: cb
        };

        return global.listenerIx;
    }

    function deleteListener(id) {
        delete global.listeners[id];
    }

    function sendToListeners(name, args) {
        for(var id in global.listeners) {
            if(global.listeners.hasOwnProperty(id)) {
                var listener = global.listeners[id];
                if(listener.name === name) {
                    listener.callback(args);
                }
            }
        }
    }

    function _setThRead(th) {
        return _setProp('thRead', th);
    }

    function _getThRead() {
        return _getProp('thRead');
    }

    function _setThWrite(th) {
        return _setProp('thWrite', th);
    }

    function _getThWrite() {
        return _getProp('thWrite');
    }

    function _setPendingThWrite(state) {
        return _setProp('pendingThWrite', state);
    }

    function _isPendingThWrite() {
        return _getProp('pendingThWrite');
    }


    // FIXME: Using window.document as a glue between XWT and React
    // We need to share transactions and listeners
    function _getProp(name) {
        return global[name];
    }

    function _setProp(name, value) {
        return global[name] = value;
    }


    function _setBaseurl(url) {
        baseurl = url
    }

    return {
        jsonrpc: jsonrpc,
        read: read,
        write: write,
        addListener: addListener,
        deleteListener: deleteListener,

        _sendToListeners: sendToListeners,

        _setThRead: _setThRead,
        _getThRead: _getThRead,
        _getThWrite: _getThWrite,
        _setThWrite: _setThWrite,
        _isPendingThWrite: _isPendingThWrite,
        _setPendingThWrite: _setPendingThWrite,
        _getRequest: getRequest,
        _setBaseurl: _setBaseurl,

        _delayPromise: delayPromise,
        _checkPending: checkPending
    };
}));
