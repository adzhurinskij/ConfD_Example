define([
    'lodash', 'jquery',

    'dojo/dom-class',
    'dojo/_base/declare',

    'dijit/layout/ContentPane',

    'dojox/layout/TableContainer',

    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',

    './SchemaDialogFields'
], function(
    _, $,

    domClass, declare,
    ContentPane,

    TableContainer,

    logger,
    JsonRpc, JsonRpcHelper,

    SchemaDialogFields
) {

return declare([ContentPane], {
    additionalClass : '',

    keypath : undefined,

    // Array of field configurations, see SchemaDialogFields
    fields  : undefined,

    cols : 2,

    postCreate : function() {
        var me = this;
        me.inherited(arguments);

        domClass.add(me.domNode, me.additionalClass);

        me._sdf = new SchemaDialogFields({
            fields : me.fields
        });

        me._addFields();

        me._getValues(me.keypath).done(function(result) {
            me._sdf.setFieldValues(result);
        });

        setTimeout(function() {
            me._sdf.focus();
        }, 200);
    },

    _addFields : function() {
        var me = this;
        var container = new TableContainer({cols: me.cols});

        me._sdf.addFields(container);

        this.addChild(container);
    },

    _getValues : function(keypath) {
        var me = this;
        var deferred = $.Deferred();

        JsonRpcHelper.read().done(function(th) {
           me._sdf.getModelValues(th, keypath).done(function(result) {
                deferred.resolve(result);
            }).fail(function(err) {
                deferred.reject(err);
            });
        });

        return deferred.promise();
    }
});

});

