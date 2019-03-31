define([
    'jquery', 'lodash',

    'dojo/dom-class',
    'dojo/_base/declare',
    'dojo/string',
    'dojo/query',
    'dojo/store/Memory',

	'dijit/_WidgetBase',
	'dijit/_TemplatedMixin',
    'dijit/_Container',

    'dijit/Menu',
    'dijit/MenuItem',

    'dijit/form/Button',
    'dijit/form/_FormValueWidget',

    'gridx/core/model/cache/Sync',
    'gridx/modules/Menu',
    'gridx/Grid',

    'tailf/global',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/protocol/JsonRpcErr',

	'dojo/text!./templates/LeafList.html'
], function(

    $, _,
    domClass, declare, dojoString, query, Memory,

    _WidgetBase, _TemplateMixin, _Container, Menu, MenuItem, Button, _FormValueWidget,

    SyncCache, GridMenu, Grid,

    tailfGlobal, logger,
    JsonRpc, JsonRpcHelper, JsonRpcErr,

    template
) {

return declare([_WidgetBase, _TemplateMixin, _Container], {
	templateString: template,

    ownTitle : true,
    readOnly : true,
    schema   : undefined,

    callbacks : {

        /*
         * function(args)
         *  Returns jQuery promise
         *
         * args = {
         * }
         */
        addValueDialog : undefined,

        /*
         * function(args)
         *  Returns jQuery promise
         *
         * args = {
         *      path : <Path to (list-element)>
         */
        addLeafRefValueDialog : undefined,


        /*
         * function(value) {...}
         *
         */
        decorator : undefined
    },

    grid : undefined,
    _values : [],
    addButton : undefined,

    writeToServer : true,

    constructor : function(args) {
        //this.grid = undefined;
        //this.addButton = undefined;
    },

    destroy : function() {
        this.grid.destroy();

        if (this.addButton) {
            this.addButton.destroy();
        }

        this.inherited(arguments);
    },

    postCreate : function() {
        var me = this;
        this.inherited(arguments);

        if (this.ownTitle) {
            $($(this.domNode).find('tr.title-row label')[0]).text(this.title);
        }

        if (this.readOnly) {
            $(this.domNode).find('tr.leaflist-content td.actions').remove();
        } else {
            this.addButton = new Button({
                iconClass : 'icon-plus',
                onClick   : function(evt) {
                    me._addItem();
                }
            }, $(this.domNode).find('tr.leaflist-content td.actions > div')[0]);
        }

        var store = new Memory({
            data: []
        });

        var structure = [{
            id    : 'value',
            field : 'value',
            name  : 'Value',
            decorator : function(value) {
                if (_.isFunction(me.callbacks.decorator)) {
                    return me.callbacks.decorator(value);
                } else {
                    return value;
                }
            }
        }];

        //Create grid widget.
        var grid = Grid({
            cacheClass: SyncCache,
            store: store,
            structure: structure,
            headerHidden : true,
            modules : [
                GridMenu
            ]
        }, $(this.domNode).find('tr.leaflist-content > td > div')[0]);

        var ctxMenu = new Menu();
        ctxMenu.addChild(new MenuItem({
            label : 'Delete',
            onClick : function(e) {
                var ctx = grid.menu.context;
                grid.model.clearCache();
                grid.model.store.remove(ctx.row.id);
                grid.body.refresh();

                var newValues = grid.model.store.data.map(function(elem) {
                    return elem.value;
                });
                me.setValues(newValues);

                me._writeValues(me.getValues());
            }
        }));
        ctxMenu.startup();

        grid.menu.bind(ctxMenu, {hookPoint : 'row', selected : false});
        grid.startup();

        setTimeout(function() {
            grid.resize();
        });

        this.grid = grid;
    },

    setup : function() {
        this.inherited(arguments);
    },

    setValues : function(values) {
        var g = this.grid;
        var d = [];

        if (_.isString(values)) {
            values = [values];
        }

        this._values = values;
        _.each(values, function(value, ix) {
            value = dojoString.escape(value);
            d.push({id : ix, value : value});
        });

        var store = new Memory({
            data : d
        });

        g.model.clearCache();
        g.model.setStore(store);
        g.body.refresh();
    },

    getValues : function() {
        return this._values;
   },

    _addItem : function() {
        var schema = this.schema;

        if (schema.isLeafRef()) {
            this._addItemLeafRef();
        } else {
            this._addItemNoLeafRef();
        }
    },

    _addItemNoLeafRef : function() {
        var me = this;

        me.callbacks.addValueDialog().done(function(value) {
            me._addValue(value);
        });
    },

    _addItemLeafRef : function() {
        var me = this;

        me.callbacks.addLeafRefValueDialog({
            path : me.schema.getLeafRefTarget()
        }).done(function(value) {
            me._addValue(value);
        });
    },

    _addValue : function(value) {
        var me = this;

        function _add(th, newValue) {
            var v = me.getValues();

            if (v === undefined) {
                v = [];
            }

            if (_.isArray(newValue)) {
                _.each(newValue, function(value) {
                    v.push(value);
                });
            } else {
                v.push(newValue);
            }

            if (th !== undefined) {
                JsonRpc('set_value', {
                    th    : th,
                    path  : me.schema.getKeypath(),
                    value : v
                }).done(function() {
                    me.setValues(v);
                }).fail(function(err) {
                    console.error('set_value error: ', err);
                });
            } else {
                me.setValues(v);
            }
        }

        if (me.writeToServer) {
            JsonRpcHelper.write().done(function(th) {
                JsonRpc('get_value', {
                    th   : th,
                    path : me.schema.getKeypath()
                }).done(function(result) {
                    _add(th, value);
                }).fail(function(err) {
                    if (JsonRpcErr.isDataNotFoundErr(err)) {
                        _add(th, value);
                    } else {
                        logger.error('_addValue : err=', err);
                    }
                });
            });
        } else {
            // Don't update server
            _add(undefined, value);
        }
    },

    _writeValues : function(values) {
        var me = this;
        if (me.writeToServer) {
            JsonRpcHelper.write().done(function(th) {
                JsonRpc('set_value', {
                    th    : th,
                    path  : me.schema.getKeypath(),
                    value : values
                });
            });
        }
    }

});

});

