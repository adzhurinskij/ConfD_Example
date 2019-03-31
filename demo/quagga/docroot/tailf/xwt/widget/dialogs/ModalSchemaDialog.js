define([
    'lodash', 'jquery',

    'dojo/dom-class',
    'dojo/_base/declare',

    'dijit/Dialog',
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
    DijitDialog, ContentPane,

    TableContainer,
    XwtDialog,

    TailfGlobal, logger,
    JsonRpc, JsonRpcHelper,

    SchemaDialogFields
) {

return declare([XwtDialog], {
    additionalClass : '',

    type    : 'list',
    action  : 'update',

    keypath : undefined,

    // Array of field configurations, see SchemaDialogFields
    fields  : undefined,

    cols : 2,

    callbacks : {
        preExecute   : undefined,  // function(th) {returns deferred} Called before create/update
        onValidOk    : undefined,  // function() {} Called after a valid ok sequence
        modifyValuesBeforeWrite : undefined   // function({path : ..., values : ...}) {} Optionally modify values before they are written
    },

    postCreate : function() {
        var me = this;
        me.inherited(arguments);

        domClass.add(me.domNode, me.additionalClass);

        me._sdf = new SchemaDialogFields({
            fields : me.fields,
            createFieldContainerCallback : function() {
                return new TableContainer({cols: me.cols});
            }
        });

        me._sdf.addFields(this);
        me._attachButtonEvents();

        setTimeout(function() {
            me._sdf.focus();
        }, 200);
    },

    destroy : function() {
        this.inherited(arguments);
    },

    getField : function(leafName) {
        return this._sdf.getField(leafName);
    },

    _attachButtonEvents : function() {
        var me = this;

        // FIXME : The XWT button event hook is very hackey ....
        var buttons = $(this.domNode).find('span.xwt-TextButton');

        buttons.click(function(evt) {

            if (evt.currentTarget.className.search('defaultButton') >= 0) {
                me._onOk();
            } else {
                me._onCancel();
            }

            evt.preventDefault();
            evt.stopPropagation();
            evt.stopImmediatePropagation();
        });
    },

    onCancel : function() {
        // Ensure destruction
        this.inherited(arguments);
        this.destroy();
    },

    _onOk : function() {
        var me = this;

        JsonRpcHelper.write().done(function(th) {
            function _execute() {
                if (me.action === 'create') {
                    me._onOkCreate(th);
                } else {
                    me._onOkUpdate(th);
                }
            }

            if (_.isFunction(me.callbacks.preExecute)) {
                try {
                    me.callbacks.preExecute(th).then(function() {
                        _execute();
                    }).fail(function(err) {
                        logger.error('preExecute failed! err=', err);
                    });
                } catch (e) {
                    logger.error('preExecute failed! e=', e);
                }

            } else {
                _execute();
            }
       });
    },

    _onCancel : function() {
    },

    _onOkCreate : function(th) {
        var me = this;

        me._sdf.createModelFieldValues(th, me.keypath, me.callbacks.modifyValuesBeforeWrite).done(function(result) {
            if (_.isFunction(me.callbacks.onValidOk)) {
                me.callbacks.onValidOk();
            }
            me.onCancel();
        }).fail(function(err) {
            logger.error('_onOkCreate : err=', err);
            TailfGlobal.messages().error(err.text);
        });
    }
});

});

