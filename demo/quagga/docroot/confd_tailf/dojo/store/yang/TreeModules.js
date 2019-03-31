// Based on dojo/store/JsonRest.js

define([
    'lodash',

    'dojo/_base/declare',
    'dojo/_base/Deferred',
    'dojo/store/util/QueryResults',

    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper'

], function(
    _,

    declare, Deferred, QueryResults,
    logger, JsonRpc, JsonRpcHelper
) {

// No base class, but for purposes of documentation, the base class is dojo/store/api/Store
var base = null;
/*===== base = Store; =====*/

function _trace() {
    logger.tracePrefix('TreeModules . ', arguments);
}

return declare('tailf.dojo.store.yang.TreeModules', base, {

    schema : null,
    fields : [],

    topId  : 'world',

    // namespaces and models from JsonRpc('get_system_setting') call
    namespaces : undefined,
    models     : undefined,

    constructor : function(options) {
        declare.safeMixin(this, options);

        if (this.namespaces === undefined) {
            throw new Error('namespaces not set');
        }

        if (this.models === undefined) {
            throw new Error('models not set');
        }
    },

    query : function(query, options) {
        var me = this;

        var deferred = new Deferred();

        var items = [
            {id: this.topId, label: 'YANG Modules', children: []}
        ];

        JsonRpcHelper.read().done(function(th) {
            me._read(th, deferred, me.topId, items);
        });

        return QueryResults(deferred);
    },

    _read : function(th, deferred, parentId, items) {
        var me = this;

        JsonRpcHelper.getVisibleTopModules(th, me.namespaces).done(function(modules) {
            var children = items[0].children;

            _.each(modules, function(module) {
                var item = me._getModuleItem(parentId, module);
                children.push(item);
            });

            deferred.resolve(items);
        });
    },

    _getModelName : function(namespace, prefix) {
        var ret;

        _.each(this.models, function(model) {
            if (model.namespace === namespace) {
                ret = model.name;
                return false;
            }
        });

        if (!ret) {
            logger.error('Didn\'t find module name for namespace ', namespace);
            ret = prefix;
        }

        return ret;
    },

    _getModuleItem : function(parentId, module) {
        var ns = module.getNamespace();
        var prefix = module.getPrefix();

        var modelName = this._getModelName(ns, prefix);
        var id = parentId + '-' + prefix;
        var label = modelName;

        var children = [];

        _.each(module.getChildren(), function(child) {
            var childId = id + child.getQualifiedName();
            var childLabel = child.getName();
            var href='/model/' + child.getQualifiedName();

            var item = {
                id      : childId,
                label   : childLabel,
                href    : href,
                kind    : child.getKind(),
                name    : child.getName(),
                qname   : child.getQualifiedName(),
                keypath : '/' + child.getQualifiedName()
            };

            children.push(item);
        });

        var moduleItem = {id: id, label: label, children: children};

        return moduleItem;
    },

    _buildReadResult : function(leafs, queryResult) {
        var qr = queryResult;
        var ret = [];

        _.each(qr.results, function(r) {
            var row = {};

            _.each(leafs, function(leaf, ix) {
                row[leaf] = r[ix];
            });

            ret.push(row);
        });

        return ret;
    }
});

});
