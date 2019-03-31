define('tailf/xwt/widget/MemoryTable', [
    'dojo/_base/declare',
	'dojo/_base/connect',
    'dojo/data/ObjectStore',
    'dojo/store/Memory',

    'dijit/layout/BorderContainer',
    'dijit/layout/ContentPane',

    'xwt/widget/table/Table',
    'xwt/widget/table/Toolbar',
    'xwt/widget/table/GlobalToolbar',
    'xwt/widget/layout/Dialog',


    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/yang/Keypath'


], function(
    declare, conUtils, ObjectStore, MemoryStore,

    BorderContainer, ContentPane,

    Table, Toolbar, GlobalToolbar, Dialog,

    logger, JsonRpc, JsonRpcHelper, Keypath
) {

function _trace() {
    logger.tracePrefix('tailf.xwt.widget.Table : ', arguments);
}

return declare([BorderContainer], {

    title       : '',
    structure   : undefined,
    memoryStore : undefined,

    constructor : function(kwArgs) {
        this.inherited(arguments);

        this.style='background:blue;height:600px;';
    },

    destroy : function() {
        this.inherited(arguments);
    },

    postCreate : function() {
        var me = this;

        this.inherited(arguments);

        var paneContent = new dijit.layout.ContentPane({
            region: 'center',
            style: {
                overflow   : 'hidden',
                width      : '100%'
            }
        });

        var contextBar = true;
        var contextualToolbar;
        var contextualButtonGroup;

        var table = new Table({
            structure : me.structure,
            store     : new ObjectStore({objectStore: me.memoryStore}),
            style     : {
                overflow : 'auto',
                height : '400px'
                //height : '100%'
            },

            showIndex : true,
            //

            selectMultiple  : true,
            selectAllOption : true,
            selectModel     : 'input',

            quickFilterDefault : 'All'

            //editing : function() {return true;}
        });

        this._table = table;


        var globalToolbar = new xwt.widget.table.GlobalToolbar({
            title: me.title,
            tableId : table.id,
            iconClass: 'titleIcon',
            showButtons: 'refresh, settings, print, export',
            displayTotalRecords: 'true'
        });

        if (contextBar) {
            contextualToolbar = new xwt.widget.table.ContextualToolbar({
                tableId: table.id
            });

            var cb = new xwt.widget.table.ContextualButtonGroup();
            contextualButtonGroup = cb;

            contextualToolbar.addChild(cb);
        }


        paneContent.containerNode.appendChild(globalToolbar.domNode);

        if (contextBar) {
            paneContent.containerNode.appendChild(contextualToolbar.domNode);
        }

        paneContent.containerNode.appendChild(table.domNode);

        me.addChild(paneContent);
        //paneContent.startup();

        me.table = table;

        _trace('postCreate : 99');
    },

    addItem : function(item) {
        var objStore = this._table.store;

        objStore.newItem(item);
        objStore.save();
        this.table.refresh();
    },

    addItems : function(items) {
        var objStore = this._table.store;

        _.each(items, function(item) {
            objStore.newItem(item);
        });

        objStore.save();
        this.table.refresh();
    },

    // FIXME: getItems should return a promise, and the current implementation is horrible
    getItems : function() {
        var objStore = this._table.store;
        var store = objStore.objectStore;
        return store.data;
    }

});
});
