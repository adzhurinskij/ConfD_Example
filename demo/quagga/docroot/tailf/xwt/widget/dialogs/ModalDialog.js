define([
    'lodash', 'jquery',

    'dojo/dom-class',
    'dojo/_base/declare',

    'dijit/layout/ContentPane',

    'dojox/layout/TableContainer',

    'xwt/widget/layout/Dialog',

    'tailf/global',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',

    'tailf/dijit/dialogs/SchemaDialogFields'
], function(
    _, $,

    domClass, declare,
    ContentPane,

    TableContainer,
    XwtDialog,

    TailfGlobal, logger,
    JsonRpc, JsonRpcHelper,

    SchemaDialogFields
) {

return declare([XwtDialog], {
    callbacks : {
        onOk     : function() {},
        onCancel : function() {}
    },

    postCreate : function() {
        var me = this;
        me.inherited(arguments);
        me._attachButtonEvents();
    },

    destroy : function() {
        // Strange, destroyDescendants doesn't seem to be called by XwtDialog.destroy()
        this.destroyDescendants();
        this.inherited(arguments);
    },

    _attachButtonEvents : function() {
        var me = this;

        // FIXME : The XWT button event hook is very hackey ....
        var buttons = $(this.domNode).find('span.xwt-TextButton');

        buttons.click(function(evt) {

            if (evt.currentTarget.className.search('defaultButton') >= 0) {
                me.callbacks.onOk.call(me);
            } else {
                if (_.isFunction(me.callbacks.onCancel)) {
                    me.callbacks.onCancel.call(me);
                }
            }

            evt.preventDefault();
            evt.stopPropagation();
            evt.stopImmediatePropagation();
        });

        $(this.domNode).keyup(function (event) {
            if(event.keyCode === 13) {
                me.callbacks.onOk.call(me);
            }
        });
    },

    close : function() {
        this.destroy();
    },

    onCancel : function() {
        // Ensure destruction
        this.inherited(arguments);
        this.destroy();
    },

    warning : function(text) {
        TailfGlobal.messages().warning(text);
    },

    error : function(text) {
        TailfGlobal.messages().error(text);
    }


});

});

