define([
    'jquery',
    'lodash',

    'dojo/_base/declare',
    'dijit/_TemplatedMixin',

    'dijit/layout/BorderContainer',
    'dijit/layout/ContentPane',

    'tailf/core/logger',

    'tailf/core/protocol/JsonRpc',
    //'tailf/core/protocol/JsonRpcHelper',
    //'tailf/core/protocol/JsonRpcErr',

    'tailf/dijit/RollbacksGrid',
    'tailf/dijit/RollbackContent',


    'dojo/text!./templates/Rollbacks.html'
], function(
    $, _,

    declare, _TemplatedMixin,

    BorderContainer, ContentPane,

    logger,
    JsonRpc, //JsonRpcHelper, JsonRpcErr,

    RollbacksGrid, RollbackContent,
    template
) {

var Rollbacks = declare([ContentPane, _TemplatedMixin], {
    templateString : template,

    destroy : function() {
        this.inherited(arguments);
    },

    postCreate : function() {
        this.inherited(arguments);
        var me = this;

        setTimeout(function() {
            me._createContent();
        });
    },

    _createContent : function() {
        var me = this;
        me.inherited(arguments);

        var bc = new BorderContainer({
            style : 'width:100%;height:100%;'
        });

        var contentTable = new ContentPane({
            'class'  : 'rollbacks-table',
            splitter : true,
            region   : 'top'
        });

        me.rollbacksGrid = new RollbacksGrid({
            rowSelected : function(rollback) {
                me._rollbackSelected(rollback);
            },
            rowDeselected : function(rollback) {
                me._rollbackDeselected(rollback);
            }
        });
        contentTable.addChild(me.rollbacksGrid);

        bc.addChild(contentTable);

        var center = new ContentPane({
            'class'  : 'rollback-preview',
            splitter : true,
            region   : 'center'
        });

        me.rollbackContent = new RollbackContent();
        center.addChild(me.rollbackContent);

        bc.addChild(center);

        this.addChild(bc);

        setTimeout(function() {
            // Trick to fix initial size.
            bc.resize();
            me.rollbacksGrid.loadRollbacks();
        });
    },

    _rollbackSelected : function(rb) {
        var me = this;

        logger.error('_rollbackSelected : rb=', rb);
        JsonRpc('get_rollback', {
            nr : rb.nr
        }).done(function(result) {
            logger.error('rollback : result=', result);
            me.rollbackContent.setValue({
                filename : rb.filename,
                nr       : rb.nr,
                content  : result.rollback
            });
        }).fail(function(err) {
            logger.error('Failed to get rollback ' + rb.nr + ' : err=', err);
        });
    },

    _rollbackDeselected : function(rb) {
        this.rollbackContent.clearValue();
    }


});

return Rollbacks

});

