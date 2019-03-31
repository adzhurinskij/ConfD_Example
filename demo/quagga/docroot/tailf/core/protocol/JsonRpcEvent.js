define([
    'jquery',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/comet'
], function(
    $,
    logger,
    jsonRpc, comet
) {

function _startSubscription(deferred, handle) {
    jsonRpc('start_subscription', {
        handle : handle
    }).done(function() {
        deferred.resolve(handle);
    }).fail(function(err) {
        // FIXME : Unregister subscription?
        logger.error('_startSubscription : err=', err);
        deferred.reject(err);
    });
}

function Event(cometId, onError) {
    this.cometId = cometId;

    this.comet = comet.create({
        comet_id : cometId,
        jsonRpc  : jsonRpc,
        onError  : onError
    });
}

Event.prototype.start = function() {
    return this.comet.start();
};

Event.prototype.stop = function() {
    return this.comet.stop();
};


Event.prototype.subscribeChanges = function(args) {
    var me = this;
    var deferred = $.Deferred();

    jsonRpc('subscribe_changes', {
        comet_id : me.cometId,
        path : args.path,
        skip_local_changes : args.skip_local_changes,
        leaf_list_as_leaf: true
    }).done(function(result) {
        var handle = result.handle;
        me.comet.setCallback(handle, args.callback);

        _startSubscription(deferred, handle);
   }).fail(function(err) {
        deferred.reject(err);
   });

    return deferred.promise();
};

Event.prototype.subscribeCdbOper = function(args) {
    var me = this;
    var deferred = $.Deferred();

    jsonRpc('subscribe_cdboper', {
        comet_id : me.cometId,
        path     : args.path,
        handle   : args.handle
    }).done(function(result) {
        var handle = result.handle;
        me.comet.setCallback(handle, args.callback);

        _startSubscription(deferred, handle);
   }).fail(function(err) {
        deferred.reject(err);
   });

    return deferred.promise();
};

Event.prototype.subscribeBatch = function(args) {
    var me = this;
    var deferred = $.Deferred();

    var _args = {
        comet_id : me.cometId
    };

    if (args.handle !== undefined) {
        _args.handle = args.handle;
    }

    jsonRpc('subscribe_jsonrpc_batch', _args).done(function(result) {
        var handle = result.handle;
        me.comet.setCallback(handle, args.callback);

        _startSubscription(deferred, handle);
   }).fail(function(err) {
        deferred.reject(err);
    });

    return deferred.promise();
};

Event.prototype.subscribeMessages = function(args) {
    var me = this;
    var deferred = $.Deferred();

    var _args = {
        comet_id : me.cometId
    };

    if (args.handle !== undefined) {
        _args.handle = args.handle;
    }

    jsonRpc('subscribe_messages', _args).done(function(result) {
        var handle = result.handle;
        me.comet.setCallback(handle, args.callback);

        //_startSubscription(deferred, handle);
        deferred.resolve();
   }).fail(function(err) {
        deferred.reject(err);
   });

    return deferred.promise();
};



Event.prototype.unsubscribe = function(handle) {
    this.comet.removeCallback(handle);

    return jsonRpc('unsubscribe', {
        handle : handle
    });
};

return {
    createChannel : function(cometId, onError) {
        return new Event(cometId, onError);
    }
};

});
