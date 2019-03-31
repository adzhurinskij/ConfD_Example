define([
    'jquery',
    'lodash',

    'dojo/_base/declare',
    'dijit/_TemplatedMixin',

    'dijit/layout/ContentPane',


    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',

    'dojo/text!./templates/RollbacksGrid.html',

    'dojo/store/Memory',
    'gridx/core/model/cache/Sync',
    'gridx/Grid',
    'gridx/modules/RowHeader',
    'gridx/modules/select/Row'

], function(
    $, _,

    declare, _TemplateMixin,

    ContentPane,
    logger,
    JsonRpc,

    template,

    Memory, SyncCache, Grid, RowHeader, SelectRow
) {

var RollbacksGrid = declare([ContentPane, _TemplateMixin], {
    templateString : template,

    // function selected(rollback) {}
    rowSelected : undefined,

    // function deselected(rollback) {}
    rowDeselected : undefined,

    postCreate : function() {
        this.inherited(arguments);
        var me = this;

        setTimeout(function() {
            me.rollbacksGrid = me._getRollbacksGrid();
            me.addChild(me.rollbacksGrid);
        });
    },

    setRollbacks : function(rollbacks) {
        var me = this;
        var data = [];

        _.each(rollbacks, function(rb, ix) {
            data.push({
                id : ix,
                nr       : rb.nr,
                filename : rb.filename,
                date     : rb.date,
                creator  : rb.creator,
                via      : rb.via,
                label    : rb.label,
                comment  : rb.comment
            });
        });

        var store = new Memory({
            data : data
        });

        me.rollbacksGrid.setStore(store);
    },

    loadRollbacks : function() {
        var me = this;

        JsonRpc('get_rollbacks', {}).done(function(result) {
            logger.debug('result=', result);
            me.setRollbacks(result.rollbacks);
        }).fail(function(err) {
            logger.error('_loadRollbacks : err=', err);
        });
    },

    _getRollbacksGrid : function() {
        var me = this;

        var structure = [
            {id: 'nr',       name : 'Nr'},
            {id: 'filename', name : 'Filename'},
            {id: 'date',     name : 'Date'},
            {id: 'creator',  name : 'Creator'},
            {id: 'via',      name : 'Via'},
            {id: 'label',    name : 'Label', encode: true},
            {id: 'comment',  name : 'Comment', encode: true}
        ];

        var store = new Memory({
            data : []
        });

        var grid = Grid({
            cacheClass: SyncCache,
            store: store,
            structure: structure,

            style : 'width:100%;height:200px;',

            modules : [
                //RowHeader,
                SelectRow
            ],

            selectRowTriggerOnCell: true

        });

        grid.select.row.connect(grid.select.row, 'onSelected', function(row, rowId) {
            if (_.isFunction(me.rowSelected)) {
                me.rowSelected(row.grid.store.get(rowId));
            }
        });

        grid.select.row.connect(grid.select.row, 'onDeselected', function(row, rowId) {
            if (_.isFunction(me.rowDeselected)) {
                me.rowDeselected(row.grid.store.get(rowId));
            }
        });

        return grid;
    }

});

return RollbacksGrid;

});
