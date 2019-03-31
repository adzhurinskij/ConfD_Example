define([
    'lodash', 'jquery',

    'dojo/on',
    'dojo/dom-class',
    'dojo/_base/declare',

    'dijit/Dialog',
    'dijit/layout/ContentPane',
    'dojox/layout/TableContainer',


    'tailf/global',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',

    'tailf/dijit/dialogs/DialogBuilder'
], function(
    _, $,

    on, domClass, declare,
    Dialog, ContentPane, TableContainer,

    tailfGlobal, logger,
    JsonRpc, JsonRpcHelper,

    DialogBuilder
) {

return declare([Dialog], {

    callbacks : {
        onOk     : function() {},
        onCancel : function() {}
    },

    postCreate : function() {
        var me = this;

        var actionBar = dojo.create("div", {
            "class": "dijitDialogPaneActionBar"
        }, this.containerNode);

        new dijit.form.Button({
            label : 'Ok',
            onClick : function() {
                if (_.isFunction(me.callbacks.onOk)) {
                    me.callbacks.onOk();
                }
            }
        }).placeAt(actionBar);

        new dijit.form.Button({
            label   : 'Cancel',
            onClick : function() {
                me.destroy();
                if (_.isFunction(me.callbacks.onCancel)) {
                    me.callbacks.onCancel();
                }
            }
        }).placeAt(actionBar);

        me.inherited(arguments);
    },

    destroy : function() {
        this.inherited(arguments);
    },

    setFields : function(fields) {
        this.addChild(fields, 0);
    },

    information : function(text) {
        tailfGlobal.messages().information(text);
    },

    warning : function(text) {
        tailfGlobal.messages().warning(text);
    },

    error : function(text) {
        tailfGlobal.messages().error(text);
    }
});

});

