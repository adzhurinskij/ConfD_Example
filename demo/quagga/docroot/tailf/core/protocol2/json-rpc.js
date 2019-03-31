/*jshint es5:true*/
define([
], function(
) {

'use strict';

var _ajax = function(me, method, params, timeout) {
    throw new Error('Ajax-support not detected');
};

var _setCurrentUserTag = function(userTag) {
    throw new Error('Set current user is *NOT* supported for this configuration');
};

var _getUserTags = function() {
    throw new Error('Get current user tags is *NOT* supported for this configuration');
};

var _removeAllUserSessions = function() {
    throw new Error('Remove all user sessions is *NOT* supported for this configuration');
};

// -----------------------------------------------------------------------------
// NodeJS support
// -----------------------------------------------------------------------------

var _nodejs = {
    http           : undefined,

    currentUserTag : undefined,
    users          : {},

    setup : {
        type     : 'http',
        hostname : 'localhost',
        port     : 8080
    }
};

function _nodeSetCurrentUserTag(userTag) {
    _nodejs.currentUserTag = userTag;
}

function _nodeGetUserTags() {
    return Object.keys(_nodejs.users);
}

function _nodeRemoveAllUserSessions() {
    _nodejs.currentUserTag = undefined;
    _nodejs.users = {};
}

/*
 * args = {
 *  method  : 'POST'
 *  path    : ....
 *  headers : object
 *  data    : string | json
 *
 * }
 *
 */
function _nodeAjax(args, _tag) {
    var promise = new Promise(function(resolve, reject) {
        var http = _nodejs.http || (_nodejs._http = require('http'));
        var data = args.data;
        var headers = args.headers || {};

        if (typeof data === 'object') {
            data = JSON.stringify(data);
        }

        if (_nodejs.currentUserTag !== undefined) {
            var userState = _nodejs.users[_nodejs.currentUserTag];

            if ((userState !== undefined) && (userState.sessionId !== undefined)) {
                headers['Cookie'] = userState.sessionName + '=' + userState.sessionId;
            }
        }

        if (data !== undefined) {
            headers['Content-Length'] = data.length;
        }

        var options = {
            hostname : _nodejs.setup.hostname,
            port     : _nodejs.setup.port,
            path     : args.path,
            method   : args.method,
            headers  : headers
        };

        var isLogin = false;
        var isLogout = false;

        if (args.data.method === 'login') {
            isLogin = true;
        } else if (args.data.method === 'logout') {
            isLogout = true;
        }

        var req = http.request(options, function(res) {
            var headers = res.headers;
            if (headers['set-cookie']) {
                var cookie = headers['set-cookie'][0];
                var tmp = cookie.split(';')[0];
                var sessionName = 'sessionid';
                var sessionId = tmp.split('sessionid=')[1];

                if (sessionId === undefined) {
                    // New sessionid_<port number>= format
                    var items = tmp.split(/(sessionid_\d+)\=/);
                    sessionName = items[1];
                    sessionId = items[2];
                }

                if (sessionId === 'deleted') {
                    sessionId = undefined;
                }

                if (isLogin) {
                   var tag = args.data.params.user;
                    if (_tag !== undefined) {
                        tag = _tag;
                    }

                    _nodejs.currentUserTag = tag;
                    _nodejs.users[tag] = {
                        sessionName : sessionName,
                        sessionId : sessionId
                    };
                } else if (isLogout) {
                    delete _nodejs.users[_nodejs.currentUserTag];
                    _nodejs.currentUserTag = undefined;
                }
            }

            res.on('data', function (chunk) {
                var ret = JSON.parse(chunk);

                if (ret.error) {
                    reject(ret);
                } else {
                    resolve(ret);
                }
          });
        });

        req.on('error', function(e) {
          reject(e);
        });

        if (data !== undefined) {
            req.write(data);
        }
        req.end();
    });


    return promise;
}

// -----------------------------------------------------------------------------

try {
    new XMLHttpRequest();
} catch(e) {
    // Assume node.js
    _ajax = _nodeAjax;
    _setCurrentUserTag = _nodeSetCurrentUserTag;
    _getUserTags = _nodeGetUserTags;
    _removeAllUserSessions = _nodeRemoveAllUserSessions;
}


// -----------------------------------------------------------------------------
// Protocol implementation
// -----------------------------------------------------------------------------



var jr = function(method, params) {
    return jr._run(method, params);
};

jr.id = 0;

jr.login = function(user, password, tag) {
    return new Promise(function(resolve, reject) {
        jr._run('login', {
            user   : user,
            passwd : password
        }, undefined, tag).then(function(result) {
            resolve(result);
        }).catch(function(e) {
            reject(e);
        });
    });
};

jr.logout = function(tag) {
    return new Promise(function(resolve, reject) {
        jr._run('logout', {
        }, undefined, tag).then(function(result) {
            resolve(result);
        }).catch(function(e) {
            reject(e);
        });
    });
};

jr.setCurrentUserTag = function(userTag) {
    _setCurrentUserTag(userTag);
};

jr.getUserTags = function() {
    return _getUserTags();
};

jr.removeAllUserSessions = function() {
    return _removeAllUserSessions();
};

jr._run = function(method, params, timeout, _tag) {
    var promise = new Promise(function(resolve, reject) {
        jr.id += 1;
        var id = jr.id;

        _ajax({
            method : 'POST',
            path   : '/jsonrpc/' + method,
            headers: {
                'Content-Type': 'application/json'
            },
            data   : {
                jsonrpc : '2.0',
                id      : jr.id,
                method  : method,
                params  : params
            },

        }, _tag)
            .then(function(result) {
                if (result.id === id) {
                    resolve(result.result);
                } else {
                    throw new Error('Expected json-rpc id=' + id + ', was ' + result.id);
                }
            })
            .catch(function(reason) {
                if (reason.error) {
                    reject(reason.error);
                } else {
                    reject(reason);
                }
            });
    });

    return promise;
};




return jr;

});

