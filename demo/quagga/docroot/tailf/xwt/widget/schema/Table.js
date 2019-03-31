define('tailf/xwt/widget/schema/Table', [
    'lodash',

    'dojo/_base/declare',
	'dojo/_base/connect',
    'dojo/string',
    'dojo/data/ObjectStore',
    'dojo/store/Memory',

    'dojo/dnd/Source',

    'dijit/registry',
    'dijit/layout/BorderContainer',
    'dijit/layout/ContentPane',
    'dijit/form/DropDownButton',
    'dijit/DropDownMenu',
    'dijit/MenuItem',

    'xwt/widget/table/Table',
    'xwt/widget/table/Toolbar',
    'xwt/widget/table/GlobalToolbar',
    'xwt/widget/table/ContextualToolbar',
    'xwt/widget/table/ContextualButtonGroup',
    'xwt/widget/layout/Dialog',


    'tailf/global',
    'tailf/core/util',
    'tailf/core/logger',
    'tailf/core/happy',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/protocol/JsonRpcErr',
    'tailf/core/yang/Keypath',

    'tailf/dojo/store/yang/ListSchemaRW',
    'tailf/dijit/render-hints'

], function(
    _,
    declare, conUtils, dojoString, ObjectStore, MemoryStore,

    Source,

    registry, BorderContainer, ContentPane,
    DropDownButton, DropDownMenu, MenuItem,

    Table, Toolbar, GlobalToolbar, ContextualToolbar, ContextualButtonGroup, Dialog,

    tailfGlobal,
    tailfCoreUtil, logger, happy, JsonRpc, JsonRpcHelper, JsonRpcErr, Keypath,

    ListSchemaRW,
    renderHints
) {

return declare([BorderContainer], {
    // NOTE: schema and the keypath parameters are orthogonal

    // List schema instance
    // Keypath and keys are extracted from the schema.
    schema : undefined,

    // Explicit keypath
    keypath : undefined,
    // Explicit keys
    keys    : undefined,

    // Explicit key values, works with both schema and keypath
    keyValues : undefined,

    // Transaction handle
    th     : undefined,

    store : {
        callbacks : {
            // function queryCallback({
            //      th       : ...
            //      deferred : ...
            //      result   : [...]
            //  })
            query : undefined,

            // function put({
            //      th       : ... // Transaction handle (mandatory)
            //      deferred : ... // Deferred instance (mandatory)
            //      obj      : ... // Row item data
            //  })
            put : undefined
        }
    },

    callbacks : {
        onAdd : undefined,
        queryCallback : undefined,
    },

    // Object with the following functions
    //   getModelHref(keypath)
    //   navigateToHref(href)
    href   : undefined,

    inlineEditFactory : undefined,
    dialogFactory     : undefined,

    edit           : true,
    selectAll      : false,
    selectMultiple : true,

    quickFilterDefault : 'All',
    contextualToolbarShowButtons : 'add, delete, edit, clearselection',

    draggableKey   : false,

    _contextualToolbar : undefined,
    _prevSize          : undefined,

    constructor : function(kwArgs) {
        var me = this;

        _.bindAll(this, [
            '_modelEvent'
        ]);

        if (!this.style) {
            this.style = 'height:100%';
        }

        this.subscribeModelHandle = undefined;

        this.jrhListenerId = JsonRpcHelper.addListener('global-write-th', function(evt) {
            me._handleGlobalWriteThEvent(evt);
        });

        this.initialResizeRefresh = true;
        this._destroying = false;
    },

    destroy : function() {
        this._destroying = true;
        this.table.store.objectStore.destroy();

        JsonRpcHelper.deleteListener(this.jrhListenerId);
        this._unregisterModelEvents();

       this.inherited(arguments);
    },

    /* jshint maxcomplexity:11 */
    postCreate : function() {
        var me = this;

        this.inherited(arguments);

        var paneContent = new dijit.layout.ContentPane({
            'class' : 'tailf-xwt-schema-table',
            region: 'center',
            style: {
                overflow   : 'hidden',
                width      : '100%'
                //background : 'yellow',
                //'padding-bottom' : '100px'
                //'margin-bottom' : '10px',
                //'margin-right'  : '100px'
            }
        });

        var store;
        var _colInfo;
        var _keypath;

        var queryCallback;
        var putCallback;

        if (_.isObject(me.store)) {
            if (_.isObject(me.store.callbacks)) {
                queryCallback = me.store.callbacks.query;
                putCallback = me.store.callbacks.put;
            }
        }

        if (!queryCallback && me.callbacks.queryCallback) {
            queryCallback = me.callbacks.queryCallback;
        }

        if (!this.schema) {
            // Use explicit keypath and keys
            _keypath = me.keypath;
            _colInfo = me._getColumnInformation(me.keys, me.columns);

            store = new ListSchemaRW({
                keypath   : me.keypath,
                keys      : me.keys,
                keyValues : me.keyValues,
                queryCallback : queryCallback,
                putCallback   : putCallback,
                fields    : _colInfo.fields,
                volatileData : me.volatileData
            });

        } else {
            // Use schema
            _keypath = me.schema.getKeypath();
            _colInfo = me._getSchemaColumnInformation(me.schema);

            me.keys = [];
            _.each(_colInfo.keys, function(keySchema) {
                me.keys.push(keySchema.getName());
            });

            store = new ListSchemaRW({
                schema        : me.schema,
                keyValues     : me.keyValues,
                queryCallback : queryCallback,
                putCallback   : putCallback,
                fields        : _colInfo.schemaFields,
                volatileData  : me.volatileData
            });
        }

        var contextBar = true;
        var contextualToolbar;
        var contextualButtonGroup;

        var table = new Table({
            detailWidget : me.detailWidget,

            structure : _colInfo.structure,
            store     : new ObjectStore({objectStore: store}),
            edit      : me.edit,
            style     : {
                overflow : 'auto'
            },

            showIndex : true,
            //

            selectAllOption : me.selectAll,
            selectMultiple : me.selectMultiple,
            selectModel    : 'input',

            // See XWT 3.2 fix below
            //quickFilterDefault : me.quickFilterDefault,

            filter : function(f) {
                store.setFilter(f);
                table.refresh();
            },

            clearFilter : function() {
                store.clearFilter();
                table.refresh();
            }
        });

        // FIXME : XWT 3.2 fix
        if (me.quickFilterDefault) {
            setTimeout(function() {
                var tableId = table.attr('id');
                var filterDropDown = registry.byId(table.id + "_xwtTableContextualToolbar_quickFilterSelect");
                if (filterDropDown) {
                    filterDropDown.attr("value", me.quickFilterDefault);
                }
            });
        }


        var source = new Source(table.domNode, {
            withHandles: false,
            allowNested: true,
            copyOnly: true,
            singular: true,
            autoSync: true
        });

        // FIXME: Very dirty addItem override
        table._onNew = function(item, parent) {
            if (_.isObject(me.callbacks) && _.isFunction(me.callbacks.onAdd)) {
                me.callbacks.onAdd();
            } else {
                JsonRpcHelper.read().done(function(th) {
                    me._addNewItem(contextualButtonGroup, th, me.schema, _colInfo.keys);
                });
            }

            contextualButtonGroup.addRowButton.set('disabled', false);
        };

        me._registerModelEvents(_keypath);
        me._initTableEvents(table);

        // FIXME: Can't get inline adding to work since the key fields are read-only
        /*
        dojo.connect(table, 'onAdd', function(item) {
            logger.error('onAdd : table.structure=', this.structure);

            _.each(this.structure, function(col) {
                if (col._yang.fieldSchema.getKind() === 'key') {
                    col.editable = true;
                }
            });

            //this.editing = false;
        });
        */

        var title = _keypath;

        if (_.isString(me.title)) {
            title = me.title;
        }

        //global toolbar
        var globalToolbar = new GlobalToolbar({
            title: title,
            tableId : table.id,
            iconClass: 'titleIcon',
            showButtons: 'refresh, settings',
            displayTotalRecords: 'true'
        });

        if (contextBar) {
            contextualToolbar = new ContextualToolbar({
                tableId: table.id,
                disableAdvancedFilter: true,
                disableManageFilters: true
            });

            me._contextualToolbar = contextualToolbar;

            var showButtons = me.contextualToolbarShowButtons;

            if (me.schema) {
                if (me.schema.isOper()) {
                    showButtons = 'clearselection';
                }
            }

            // FIXME : Is read-only relevant in this context, if so implement the function
            /*
            else if (me.schema.isReadOnly()) {
                showButtons = 'clearselection';
            }
            */

            var cb = new ContextualButtonGroup({
                showButtons : showButtons
            });

            contextualButtonGroup = cb;
            contextualToolbar.addChild(cb);

            if (me.actions) {
                setTimeout(function() {
                    me._addSpecificActions(contextualToolbar, me.actions);
                });
            } else if (me.schema) {
                me._addSchemaActions(contextualToolbar, me.schema);
            }
        }

        paneContent.containerNode.appendChild(globalToolbar.domNode);

        if (contextBar) {
            paneContent.containerNode.appendChild(contextualToolbar.domNode);
        }

        paneContent.containerNode.appendChild(table.domNode);

        me.addChild(paneContent);

        me.table = table;
    },

    resize : function(size) {
        var store = this.table.store.objectStore;

        var callInherited = false;

        if (size) {
            var w = size.w;
            var h = size.h;

            $(this.table.domNode).height(h);
            $(this.table.domNode).width(w);

            if (this.initialResizeRefresh) {
                if (!this._destroying) {
                }
                this.initialResizeRefresh = false;
            }

            var ps = this._prevSize;
            if ((ps === undefined) || (size.h !== ps.h) || (size.w !== ps.w))  {
                callInherited = true;
            }
        }

        this._prevSize = size;

        if (callInherited) {
            this.inherited(arguments);
        }
    },

    /* FIXME : Why don't layout work when we are in the device view?
    __layout : function(size) {
        var w = $(this.domNode).width();
        var h = $(this.domNode).height();

        if (true) {
            //var w = size.w;
            //var h = size.h;

            $(this.table.domNode).height(h);
            $(this.table.domNode).width(w);

            if (this.initialResizeRefresh) {
                this.table.refresh();
                this.initialResizeRefresh = false;
            }
        }
    },
    */

    _handleGlobalWriteThEvent : function(evt) {
        if ((evt.action === 'removed') && (evt.specific === 'reverted')) {
            this.refresh();
        }
    },


    _addSpecificActions : function(contextualToolbar, actions) {
        var me = this;

        if (actions.length > 0) {
            var menu = new DropDownMenu({ style: 'display: none;'});

            _.each(actions, function(action) {
                var menuItem = new MenuItem({
                    label     : action.label,
                    iconClass : action.iconClass,
                    onClick   : action.onClick
                });
                menu.addChild(menuItem);
            });

            menu.startup();
            me._addActionDropDown(contextualToolbar, menu);
        }
    },

    _addSchemaActions : function(contextualToolbar, schema) {
        var me = this;
        var actions = schema.getChildrenOfKind('action');

        if (actions.length > 0) {
            var menu = new DropDownMenu({ style: 'display: none;'});

            _.each(actions, function(action) {
                var menuItem = new MenuItem({
                    label     : action.getName() + '...',
                    iconClass : 'icon-gear',
                    onClick : function() {
                        me._executeSchemaAction(schema, action);
                    }
                });
                menu.addChild(menuItem);
            });

            menu.startup();
            me._addActionDropDown(contextualToolbar, menu);
       }
    },

    _addActionDropDown : function(contextualToolbar, menu) {
        var actionButton = new DropDownButton({
            label: 'Actions',
            baseClass : 'dijitDropDownButton tailf',
            dropDown: menu,
            iconClass : 'icon-gear'
        });

        contextualToolbar.addChild(actionButton);
    },

    _executeSchemaAction : function(parentSchema, actionSchema) {
        var selected = this.selected();

        if (selected.length === 0) {
            return;
        }

        if (selected.length > 1) {
            tailfGlobal.messages().information('Only one item can be selected when executing an action');
            return;
        }

        var item = selected[0];
        var href = this._getItemHref(parentSchema.getKeypath(), this.keys, item) + '/' + actionSchema.getName();

        this.href.navigateToHref(href);
    },

    _registerModelEvents : function(keypath) {
        var me = this;
        var events = tailfGlobal.getEvents();

        events.subscribeChanges({
            path : keypath,
            callback : me._modelEvent,
            skip_local_changes : true
        }).done(function(handle) {
            if (me._destroying) {
                // May happen if the table is destroyed very quickly
                JsonRpc('unsubscribe', {handle : handle});
            } else {
                me.subscribeModelHandle = handle;
            }
        }).fail(function(err) {
            logger.error('_registerModelEvents : subscribeChanges FAILED! err=', err);
        });
    },

    _unregisterModelEvents : function() {
        var me = this;
        var events = tailfGlobal.getEvents();

        if (this.subscribeModelHandle === undefined) {
            // May happen if the table is destroyed before we've gotten an
            // answer from the subscribeChanged json-rpc call
            return;
        }

        events.unsubscribe(this.subscribeModelHandle).done(function() {
            me.subscribeModelHandle = undefined;
        }).fail(function(err) {
            logger.error('_unregisterModelEvents : FAILED : ', err);
        });
    },

    _modelEvent : function(evt) {
        this.refresh();
    },


    // FIXME : Add _destroyTableEvents
    _initTableEvents : function(table) {
        var me = this;
        var disableIndividualSelectUpdate =  false;

        function _log(txt, obj) {
            //logger.error(txt, obj);
        }

        // FIXME : To many calls to selectionChanged, especially during deselection, but it will do for now
        function _individualSel(src) {
            if (!disableIndividualSelectUpdate) {
                _log('_individualSel : ' + src + ' : arguments=', arguments);
                me.selectionChanged();
            }
        }

        function _multiSel(src) {
            disableIndividualSelectUpdate = true;
            _log('_multiSel : ' + src + ' : arguments=', arguments);

            me.selectionChanged();

            // FIXME: Not perfect, but it will at least enable individual selection eventually
            setTimeout(function() {
                disableIndividualSelectUpdate = false;
            }, 1000);
         }

        dojo.connect(table, 'onSelect', this, function() {
            _individualSel('onSelect');
        });

        dojo.connect(table, 'onDeselect', this, function() {
            _log('onDeselect : arguments=', arguments);
            _individualSel('onDeselect');
        });

        dojo.connect(table, 'selectAll', this, function(select) {
            _log('selectAll : arguments=', arguments);
            _multiSel('selectAll');
        });

        dojo.connect(table, 'onClearSelections', this, function() {
            _log('onClearSelections : arguments=', arguments);
            _multiSel('onClearSelections');
        });
    },

    // FIXME : Not optimal yet! Called to many times and a setTimeout is probably needed by the user
    //         before calling selected() on this table. Would be optimal if we could provide exactly what happens
    //         adding/deleting and what selections was added/deleted
    selectionChanged : function() {
    },

    addContextualToolbarChild : function(widget) {
        this._contextualToolbar.addChild(widget);
    },

    // Set the store key values and optionally refresh the table
    setKeyValues : function(keyValues, refresh) {
        this.table.store.objectStore.keyValues = keyValues;

        if (refresh) {
            this.table.refresh();
        }
    },

    refresh : function() {
        this.table.refresh();
    },

    selected : function() {
        return this.table.selected();
    },

    _getColumnInformation : function(keys, columns) {
        var me = this;
        var fields = [];
        var structure = [];

        function _columnWidget(orgWidget) {
            return {
                widget : function(opts) {
                    if (_.isFunction(orgWidget.widget)) {
                        return orgWidget.widget(orgWidget.options);
                    } else {
                      return orgWidget;
                    }
                },
                opts   : null
            };
        }


        /* jshint maxcomplexity:12 */
        _.each(columns, function(rawCol) {
            var rc = rawCol;
            var col;

            if (_.isString(rc)) {
                fields.push(rc);

                col = {
                    attr       : rc,
                    label      : rc,
                    width      : 100,
                    sortable   : true
                    //editable   : false
                };
            } else {
                var filterable = rc.volatile === true ? false : true;

                if (rc.volatile !== true) {
                    fields.push(rc.attr);
                } else if (rc.dataOnly === true) {
                    fields.push(rc.attr);
                }

                if (rc.editWidget) {
                    rc.editWidget = _columnWidget(rc.editWidget);
                }

                col = {
                    attr       : rc.attr,
                    label      : rc.label === undefined ? rc.attr : rc.label,
                    width      : rc.width === undefined ? 100 : rc.width,
                    sortable   : rc.sortable === undefined ? false : rc.sortable,
                    editable   : rc.editable === undefined ? false : rc.editable,
                    editWidget : rc.editWidget,
                    hidden     : rc.hidden === undefined ? false : rc.hidden,
                    filterable : filterable
                };
            }

            if (_.isFunction(rc.formatter)) {
                col.formatter = rc.formatter;
            } else {
                _.each(keys, function(key) {

                    if (col.attr === key) {
                        col.formatter = function(data, item, store) {
                            return me._keyColumnFormatter(me.keypath, keys, item, data);
                        };
                    } else {
                        col.formatter = me._escapeColumnFormatter;
                    }
                });
            }

            if (rc.dataOnly !== true) {
                structure.push(col);
            }
        });

        return {
            structure : structure,
            fields    : fields
        };
    },

    _useLeaf : function(path, child) {
        return renderHints.renderLeaf({
            category : 'list',
            path     : path,
            leaf     : child.getName()
        });
    },

    _getSchemaColumnInformation : function(schema) {
        var me = this;
        var structure = [];
        var schemaFields = [];
        var keys = [];
        var keyFields = [];

        var genericPath = renderHints.genericPath(schema.getKeypath());

        _.each(schema.getChildren(), function(child, ix) {
            var kind = child.getKind();

            if (((kind === 'leaf') || (kind === 'key')) && me._useLeaf(genericPath, child)) {
                var nameSuffix = '';
                var editable = true;

                if (kind === 'key') {
                    nameSuffix = '&nbsp; (k)';
                    editable = false;
                } else if (child.isReadOnly()) {
                    editable = false;
                }

                var th = 0; // FIXME: Need the th
                var widget;

                if (editable) {
                   var w = me.inlineEditFactory.createListInlineEditWidget(th, schema, child);

                   if (w) {
                       widget = {
                           widget : function(opts) {
                               return w;
                           },
                           opts : null
                       };
                   }
                 }

                var col = {
                    attr       : child.getName(),
                    label      : child.getName() + nameSuffix,
                    width      : 100,
                    sortable   : true,
                    editable   : editable,
                    editWidget : widget,
                    _yang      : {
                        fieldSchema : child
                    }
                };

                if (kind === 'key') {
                    keys.push(child);
                    keyFields.push(col.attr);

                    col.formatter = function(data, item, store) {
                        return me._keyColumnSchemaFormatter(
                                    schema, keyFields, data, item, store);
                    };
                } else {
                    col.formatter = me._escapeColumnFormatter;
                }

                schemaFields.push(child.getName());

                structure.push(col);
            }
        });

        return {
            schemaFields : schemaFields,
            keys         : keys,
            structure    : structure
        };
    },

    _getItemHref : function(keypath, keyFields, item) {
        var keys = [];
        _.each(keyFields, function(key) {
            keys.push(item[key]);
        });

        var href = this.href.getModelHref(keypath + Keypath.listKeyIndex(keys));
        return href;
    },

    _keyColumnFormatter : function(keypath, keyFields, item, value) {
        var  href = this._getItemHref(keypath, keyFields, item);
        value = dojoString.escape(value);
        var elem = '<a href="' + href + '">' + value + '</a>';
        if(this.draggableKey) {
            elem = '<a href="' + href + '" class="dojoDndItem" id="' + value + '">' + value + '</a>';
        }
        return elem;
    },

    _escapeColumnFormatter : function(value, item, store) {
        var re = /\s*https?:\/\/(localhost|127.0.0.1)[^\/]+(\/[^\s$]+)/;

        if(re.test(value)) {
            url = value.replace(re, '$2');
            return '<a href="' + encodeURI(url) + '">' + encodeURI(value) + '</a>';

        } else {
            return dojoString.escape(value);
        }
    },

    _keyColumnSchemaFormatter : function(schema, keyFields, data, item, store) {
        var value = data;
        var rowData = item; //this.getItem(rowIx);

        var key = '';
        _.each(keyFields, function(kf) {
            if (key.length > 0) {
                key += ' ';
            }

            key += '"' + rowData[kf] + '"';
        });

        var href = this.href.getModelHref(schema.getKeypath() + '{' + key + '}');
        value = dojoString.escape(value);

        var elem = '<a href="' + href + '">' + value + '</a>';
        if(this.draggableKey) {
            elem = '<a href="' + href + '" class="dojoDndItem" id="' + value + '">' + value + '</a>';
        }
        return elem;
    },

    _addNewItem : function(buttonGroup, th, parentSchema, keySchemas) {
        var me = this;

        function _showDialog(keyWidgets) {
            var dlg = new Dialog({
                title : 'Add ' + parentSchema.getName()
            });

            _.each(keyWidgets, function(w) {
                dlg.addChild(w);
            });

            conUtils.connect(dlg.buttonGroup.getItemAt(0), 'onClick', function() {
                var keyValues = [];

                _.each(keyWidgets, function(kw) {
                    var v = kw.getValue();
                    keyValues.push(v);
                });

                var keypath = parentSchema.getKeypath() + Keypath.listKeyIndex(keyValues);

                JsonRpcHelper.write().done(function(th) {
                    JsonRpc('create', {th:th, path: keypath}).done(function() {
                        dlg.destroy();

                        var href = me.href.getModelHref(keypath);
                        me.href.navigateToHref(href);

                    }).fail(function(err) {
                        logger.error('Create dialog key values failed! err=', err);
                        tailfGlobal.messages().error(JsonRpcErr.getInfo(err));
                    });
                });

            });
            conUtils.connect(dlg.buttonGroup.getItemAt(1), 'onClick', function() {
                dlg.destroy();
            });

            dlg.show();
        }

        var keyWidgets = [];
        var deferreds = [];

        function _addWidgetDeferred(keyWidgets, widgetDeferred) {
            var ix = keyWidgets.length;
            var deferred = $.Deferred();

            keyWidgets.push(undefined);

            widgetDeferred.done(function(w) {
                keyWidgets[ix] = w;
                deferred.resolve();
            });

            deferreds.push(deferred);
        }

        _.each(keySchemas, function(key) {
            var w = me.dialogFactory.createDialogChildWidget(th, parentSchema, key);
            if (tailfCoreUtil.isJQueryDeferred(w)) {
                _addWidgetDeferred(keyWidgets, w);
            } else {
                keyWidgets.push(w);
            }
        });

        if (deferreds.length === 0) {
            _showDialog(keyWidgets);
        } else {
            JsonRpcHelper.whenArray(deferreds).done(function() {
                _showDialog(keyWidgets);
            });
        }
    }
});
});
