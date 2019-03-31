/*jshint devel:true*/
define([
    'jquery',
    'lodash',
    'Class',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/global'
], function(
    $,
    _,
    Class,
    logger,
    jsonRpc,
    tailfGlobal
) {

'use strict';

var CometChannel = Class.extend({
    init: function(params) {
        params = params || {};
        this.jsonRpc = params.jsonRpc;
        this.comet_id = params.comet_id;
        this.onError = params.onError;

        if (!this.jsonRpc) {
            this.jsonRpc = jsonRpc;
        }

        if (!this.comet_id) {
            this.comet_id = 'main-1.' + String(Math.random()).substring(2);
        }

        this.polling = false;
        this.callbacks = {};
    },

    start : function() {
        this._poll();
        return $.Deferred().resolve().promise();
    },

    stop : function() {
        var me = this;

        var deferred = $.Deferred();
        if (this.polling) {
            var whenArgs = [];

            _.each(this.callbacks, function(cb, handle) {
                whenArgs.push(me.jsonRpc('unsubscribe', {
                    handle : handle
                }));
            });

            $.when.apply($, whenArgs).done(function() {
                deferred.resolve();
            }).fail(function(err) {
                deferred.reject(err);
            }).always(function() {
                me.polling = false;
                me.callbacks = {};
            });
        } else {
            deferred.resolve();
        }

        return deferred.promise();
    },

    setCallback : function(handle, cb) {
        if (this.callbacks[cb]) {
            throw new Error('Callback handler for comet_id "' + this.comet_id +
                    ' : handle ' + handle + ' already set!');
        }

        this.callbacks[handle] = cb;
    },

    removeCallback : function(handle) {
        if (!this.callbacks[handle]) {
            throw new Error('No callback handler for comet_id "' + this.comet_id +
                    ' : handle ' + handle + ' was set!');
        }

        delete this.callbacks[handle];
    },

    _poll : function() {
        var me = this;

        if (this.polling) {
            return;
        }

        this.polling = true;

        this.jsonRpc.run('comet', {
            comet_id : this.comet_id
        }).done(function(notifications) {
            me._onPollDone(notifications);
        }).fail(function(err) {
            me._onPollErr(err);
        }).always(function() {
            me.polling = false;
        });

    },

    _onPollDone : function(notifications) {
        var me = this;

        if (!me.polling) {
            //logger.error('_onPollDone : But polling was cancelled : notifications=', JSON.stringify(notifications));
            return;
        }

        _.each(notifications, function(n) {
            var handle = n.handle;
            var message = n.message;
            var cb = me.callbacks[handle];

            if (!cb) {
                if (!message || (message.stopped !== true)) {
                    logger.error('No callback handler for comet_id "' + me.comet_id + '" : event handle ' + handle);
                }
            } else {
                cb(message);
           }
        });

        _.defer(function() {
            me._poll();
        });
     },

    _onPollErr : function(err) {
        var me = this;

        if (_.isFunction(me.onError)) {
            me.onError(err);

            setTimeout(function() {
                me._poll();
            }, 10 * 1000);
        } else  {
            if (err.type === 'ajax.response.error') {
                tailfGlobal.messages().error('Service Unavailable');
            }
            var errType = '';
            if(err.type) {
                errType = '(' + err.type + ')';
            }
            var errorString = '_onPollErr' + errType + ' comet_id = ' + me.comet_id + ' : err=' + err;
            logger.error(errorString);
        }
    }
});

return {
    create : function(args) {
        return new CometChannel(args);
    }
};
});

