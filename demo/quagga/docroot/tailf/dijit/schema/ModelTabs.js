define([
    'jquery', 'lodash',

    'dojo/_base/declare',
    'dojo/store/Memory',

	'dijit/_WidgetBase',
	'dijit/_TemplatedMixin',
    'dijit/_Container',

    'dijit/layout/ContentPane',
    'dijit/layout/TabContainer',
    'dijit/Toolbar',
    'dijit/form/Button',

    'tailf/global',
    'tailf/core/logger',
    'tailf/core/yang/Keypath',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/protocol/JsonRpcErr',

    'tailf/dijit/dialogs/ModalDialog',
    'tailf/dijit/dialogs/DialogBuilder',
    'tailf/dijit/schema/ModelContainer',
    'tailf/dijit/schema/List',

    'gridx/core/model/cache/Sync',
    'gridx/Grid',

	'dojo/text!./templates/ModelTabs.html',

    'dijit/ConfirmDialog'
], function(
    $, _,

    declare, Memory,

    _WidgetBase, _TemplateMixin, _Container,
    ContentPane, TabContainer, Toolbar, Button,

    tailfGlobal, logger,
    keypath, JsonRpc, JsonRpcHelper, JsonRpcErr,

    ModalDialog, DialogBuilder,
    ModelContainer, List,

    Cache, Grid,

    template,
    ConfirmDialog
) {

var _nofGridColumns = 4;

var _iconClassInfo      = 'dijitIconApplication';
var _iconClassContainer = 'dijitIconFolderClosed';
var _iconClassList      = 'dijitIconTable';
var _iconClassAction    = 'dijitIconFunction';


return declare([_WidgetBase, _TemplateMixin, _Container], {
	templateString: template,

    // Schema widget factory
    //
    // factory.createContainerChildWidget({
    //     th           : <transaction handle>
    //     parentSchema : <parent schema instance>
    //     leafSchema   : <leaf schema instance>
    // }
    //
    // Returns : Widget instance
    //
    // If not set the ModelContainer default schema widget factory is used
    schemaWidgetFactory : undefined,

    // See tailf/dijit/schema/List.callbacks.keyDecorator
    listKeyDecorator : undefined,

    _keypath : undefined,

    destroy : function() {
        //logger.error('ModelTabs.destroy : _keypath=', this._keypath);
        this.inherited(arguments);
    },

    postCreate : function() {
        var me = this;
        this.inherited(arguments);
    },

    setKeypath : function(keypath) {
        var me = this;

        me.destroyDescendants();

        me._keypath = keypath;

        JsonRpcHelper.read().done(function(th) {
            JsonRpcHelper.getSchema(th, '', keypath, 1, false).done(function(schema) {
                me._createContentFromSchema(th, schema);
            }).fail(function(err) {
                logger.error('setKeypath : err=', err);
                me._keypath = undefined;
            });
        });
    },

    getKeypath : function() {
        return this._keypath;
    },

    layout : function() {
        // Do nothing for now
    },

    _createContentFromSchema : function(th, schema) {
        var kind = schema.getKind();

        if (kind === 'list') {
            var listWidget = this._getListMainPane(th, schema);
            this.addChild(listWidget);
        } else if ((kind === 'container') || (kind === 'list-entry')) {
            this._createTabsFromContainer(th, schema);
        } else if (kind === 'action') {
            var actionWidget = this._getActionMainPane(th, schema);
            this.addChild(actionWidget);
        } else if (kind === 'leaf') {
            var leafWidget = this._getLeafMainPane(th, schema);
            this.addChild(leafWidget);
        }
    },

    _createTabsFromContainer : function(th, schema) {
        var me = this;

        me.tabInfo = [];

        var tc = new TabContainer({
            style : 'width:100%;height100%;'
        });

        tc.watch('selectedChildWidget', function(name, oval, nval){
            me._selectTabPane(oval, nval);
        });

        var kind = schema.getKind();

        me._createDefaultTabs(th, schema, tc);

        me.addChild(tc);
        tc.startup();
    },


    _createDefaultTabs : function(th, schema, tabContainer) {
        var me = this;
        var tc = tabContainer;

        var addInfoTab = false;
        var children = schema.getChildren();

        function _addInfoTab() {
            var leafs = [];

            _.each(schema.getChildren(), function(child) {
                var kind = child.getKind();

                if ( (kind !== 'container') && (kind !== 'list')) {
                    leafs.push(child);
                }
            });

            var pane = me._createInfoTabWidget(tc, schema, leafs);

            // Add first in list
            me.tabInfo.unshift({
                pane          : pane,
                ns            : schema.getNamespace(),
                path          : schema.getQualifiedName(),
                parentKeypath : schema.getKeypath(),
                keypath       : null //child.getKeypath()
            });
        }


        _.each(children, function(child, ix) {
            var kind = child.getKind();

            if ((kind === 'container') || (kind === 'list')) {
                var pane = me._createChildTabWidget(tc, ix + 1, child);

                me.tabInfo.push({
                    pane          : pane,
                    ns            : child.getNamespace(),
                    path          : child.getQualifiedName(),
                    parentKeypath : schema.getKeypath(),
                    keypath       : child.getKeypath()
                });

            } else {
                addInfoTab = true;
            }
        });


        if (addInfoTab) {
            _addInfoTab();
        }

        // Add actual widgets
        _.each(me.tabInfo, function(info, ix) {
            info.pane.yang.paneIx = ix;
            tc.addChild(info.pane);
        });


        setTimeout(function() {
            me._currentTabPane = undefined;
            me._selectTabPane(me._currentTabPane, me.tabInfo[0].pane);
        });
    },

    _createInfoTabWidget : function(parentWidget, schema, leafs) {
        var cp = new ContentPane({
            'class'    : 'tailf-yang-content',
            style      : 'width: 100%;height:100%;', //background: red;',
            title      : schema.getName(),
            iconClass  : _iconClassInfo,
            content    : 'INFO'
        });

        cp.yang = {
            parent : {
                namespace : schema.getNamespace(),
                keypath   : schema.getKeypath()
            },
            child : null,
            leafs : leafs
        };

        return cp;
    },


    _createChildTabWidget : function(parentWidget, ix, childSchema) {
        var me = this;

        var child = childSchema;

        var kind = child.getKind();
        var content = '';

        var iconClass = _iconClassContainer;
        var prefix = '';

        if (kind === 'list') {
            iconClass = _iconClassList;
            prefix = '';
        } else if (kind === 'action') {
            iconClass = _iconClassAction;
            prefix = '';
        }

        var title = prefix + child.getName();

        var cp = new ContentPane({
            'class'    : 'tailf-yang-content',
            style      : 'width: 100%;height:100%;',
            title      : title,
            iconClass  : iconClass,
            content    : content
        });

        cp.yang = {
            paneIx : undefined,
            child : child
        };
        return cp;
    },

    _selectTabPane : function(fromPane, toPane) {
        var me = this;
        var ns;
        var path;

        if (fromPane !== undefined) {
            fromPane.destroyDescendants();
        }

        JsonRpcHelper.read().done(function(th) {
            if (toPane.yang.leafs) {
                // FIXME : Info pane
                ns = toPane.yang.parent.namespace;
                path = toPane.yang.parent.keypath;

                JsonRpcHelper.getSchema(th, ns, path, 1, false)
                    .done(function(schema) {
                         me._fillPaneWithInfoLeafs(th, toPane, schema, toPane.yang.leafs);
                    });
            } else {
                var yc = toPane.yang.child;

                ns = yc.getNamespace();
                path = yc.getKeypath();

                JsonRpcHelper.getSchema(th, ns, path, 1, false).done(function(schema) {
                    me._fillPaneWithModel(th, toPane, schema);
                });
            }
        });
    },

    _fillPaneWithInfoLeafs : function(th, pane, parentSchema, leafs) {
        var me = this;
        pane.destroyDescendants();

        // --- Header pane
        var infoContent = '';

        infoContent += 'INFO' + '<br>';

        var headerPane = ContentPane({
            content : infoContent
        });

        var mainPane = new ModelContainer({
            nofColumns          : _nofGridColumns,
            th                  : th,
            parentSchema        : parentSchema,
            schemas             : leafs,
            schemaWidgetFactory : me.schemaWidgetFactory
        });

        pane.addChild(headerPane);
        pane.addChild(mainPane);

        headerPane.startup();
        mainPane.startup();
    },


    _fillPaneWithModel : function(th, pane, schema) {
        pane.destroyDescendants();

        var mainPane = this._getModelMainPane(th, schema);
        pane.addChild(mainPane);

        mainPane.startup();
    },


    _getModelMainPane : function(th, schema) {
        var me = this;
        var kind = schema.getKind();
        var ret;

        // FIXME : Add list and action pane content
        if ((kind === 'container') || (kind === 'list-entry')) {
            ret = me._getContainerMainPane(th, schema);
        } else if (kind === 'list') {
            ret = me._getListMainPane(th, schema);
        } else if (kind === 'action') {
            return me._getActionMainPane(th, schema);
        } else {
            throw new Error('Unknown pane type "' + kind + '"');
        }

        return ret;
    },

    _getContainerMainPane : function(th, schema) {
        var me = this;

        var grid = new ModelContainer({
            nofColumns          : _nofGridColumns,
            th                  : th,
            parentSchema        : schema,
            schemas             : schema.getChildren(),
            schemaWidgetFactory : me.schemaWidgetFactory
        });

        return grid;
    },

    _getListMainPane : function(th, schema) {
        var me = this;
        var editable = !schema.isReadOnly() && !schema.isOper();
        var toolbar;

        function _toolbar() {
            if (!toolbar) {
                toolbar = new Toolbar();
            }
            return toolbar;
        }

        function _addButton(label, iconClass, onClick) {
            var button = new Button({
                label     : label,
                iconClass : iconClass,
                onClick   : onClick
            });
            _toolbar().addChild(button);
        }

        if (editable) {
            _addButton('', 'icon-plus', function() {
                me._addListItemDialog(th, list);
            });
            _addButton('', 'dijitIconDelete', function() {
                list.deleteSelectedRows();
            });
        }

        if (toolbar) {
            toolbar.startup();
        }

        var list = new List({
            schema         : schema,
            inlineEditable : true,
            selectableRow  : true,

            callbacks : {
                keyDecorator : this.listKeyDecorator
            },

            toolbar : toolbar
        });

        return list;
    },

    _getActionMainPane : function(th, schema) {
        var me = this;

        var inputs = [];
        var outputs = [];

        _.each(schema.getChildren(), function(child) {
            // Only use action input
            if (child.isActionInput()) {
                inputs.push(child);
            }
        });

        var cp = new ContentPane({
        });

        var gridInput = new ModelContainer({
            nofColumns   : _nofGridColumns,
            th           : th,
            parentSchema : schema,
            schemas      : inputs
        });

        var gridOutput = new ModelContainer({
            nofColumns   : _nofGridColumns,
            th           : th,
            parentSchema : schema,
            schemas      : outputs
        });

        var button = new Button({
            'class'   : 'tailf-invoke-action',
            iconClass : 'dijitIconConfigure',
            label     : 'Invoke ' + schema.getName(),

            onClick : function() {
                me._runAction(th, schema.getKeypath(), gridInput, gridOutput);
            }
        });

        cp.addChild(gridInput);
        cp.addChild(button);
        cp.addChild(gridOutput);

        $(gridInput.domNode).addClass('tailf-action-input-parameters');
        $(gridOutput.domNode).addClass('tailf-action-output-parameters');

        setTimeout(function() {
            me._addActionResultGrid(gridOutput);
            me.layout();
        });

        return cp;
     },

    _getLeafMainPane : function(th, schema) {
        var me = this;
        var readValue = true;
        var writeValue = !(schema.isOper() || schema.isReadOnly());

        var w = me.schemaWidgetFactory.createContainerChildWidget({
            th               : th,
            parentSchema     : {
                getKind : function() {
                    return '__webui_simulated';
                }
            },
            readServerValue  : readValue,
            writeServerValue : writeValue,
            leafSchema       : schema
        });

        return w;
    },

    _addListItemDialog : function(th, list) {
        var me = this;

        var swf = me.schemaWidgetFactory;
        var schema = list.schema;
        var db = new DialogBuilder();
        /*
        var tc = db.getTableContainer({
            cols : 1
        });
        */

        var tc = new ContentPane();
        var fields = [];
        _.each(schema.getChildren(), function(child) {
            if (child.getKind() === 'key') {
                var name = child.getName();
                //var field = db.getTextBox(name);
                var field = swf.createDialogChildWidget(th, schema, child);
                tc.addChild(field);

                fields.push({
                    name  : name,
                    field : field
                });
            }
        });

        tc.startup();

        var dlg = new ModalDialog({
            'class' : 'tailf-dialog tailf-modeltabs-add-list-item-dialog',
            title   : 'Add List Item',
            content : tc,

            callbacks : {
                onOk : function() {
                    me._onAddListItem(list, dlg, schema, fields);
                }
            }
        });

        dlg.startup();
        dlg.show();
    },

    _onAddListItem : function(list, dialog, schema, fields) {
        var exit = false;

        var keyValues = [];

        _.each(fields, function(f) {
            var v = f.field.getValue().trim();

            if (v === '') {
                dialog.information('' + f.name + ' is empty');
                exit = true;
                return false;
            }

            keyValues.push(v);
        });

        if (exit) {
            return;
        }

        var path = schema.getKeypath() + keypath.listKeyIndex(keyValues);

        JsonRpcHelper.write().done(function(th) {
            JsonRpcHelper.exists(th, path).done(function(exists) {
                if (exists) {
                    dialog.information('Path ' + path + ' exist.');
                } else {
                    _create(th, path);
                }
            });
        });

        function _create(th, path) {
            JsonRpc('create', {
                th   : th,
                path : path
            }).done(function() {
                dialog.destroy();
                list.refresh();
            }).fail(function(err) {
                dialog.error('Failed to create path ' + path + '. <br>' + JsonRpcErr.getInfo(err));
            });
        }
    },

    _addActionResultGrid : function(gridParent) {
        var structure = [
            {id: 'name', name : 'Name'},
            {id: 'value', name : 'Value'}
        ];

        var store = new Memory({
            data : []
        });

        var grid = Grid({
            cacheClass: Cache,
            store: store,
            structure: structure,

            style : 'width:100%;height:200px;'
        });

        grid.startup();
        gridParent.addChild(grid);

        this.actionResultGrid = grid;
    },

    _runAction : function(th, keypath, input, output) {
        var me = this;
        var params = me._getActionInputParameters(input);

        if (_.isObject(params.__ui_error)) {
            tailfGlobal.messages().information(params.__ui_error.text);
            return;
        }

        function _errReason(err) {
            var ret = '';

            if (err.data) {
                _.each(err.data.reason, function(r) {
                    // FIXME : Getting strange error message from server for some actions
                    // that fails, e.g. southbound locked devices
                    if (_.isNumber(r)) {
                        ret += String.fromCharCode(r);
                    } else {
                        ret += '<br>';
                        ret += r;
                    }
                });
            }

            return ret;
        }

        JsonRpc('run_action', {
            th     : th,
            path   : keypath,
            params : params,
            format : 'normal'
        }).done(function(result) {
            //_trace('_runAction : result=', result);
            //$(output.domNode).text(JSON.stringify(result));
            me._setActionResult(result);
        }).fail(function(err) {
            if (JsonRpcErr.isRpcMethodFailedErr(err)) {
                tailfGlobal.messages().error('Action failed', _errReason(err));
            } else {
                tailfGlobal.messages().error('Action failed', JsonRpcErr.getInfo(err), err);
            }
        });
    },

    _setActionResult : function(result) {
        var data = [];

        if ((result === true) || (result === false)) {
            data = [{
                id  : 1,
                name : 'Result',
                value : result
            }];
        } else {
            _.each(result, function(item, ix) {
                data.push({
                    id    : ix + 1,
                    name  : item.name,
                    value : _.escape(item.value)
                });
            });
        }

        var store = new Memory({
            data : data
        });

        this.actionResultGrid.setStore(store);
    },

    _getActionInputParameters : function(inputContainer) {
        var ret = {};

        ret = {
        };

        function _error(text) {
            ret.__ui_error = {
                text : text
            };
        }

        var widgets = inputContainer.getWidgets();

        _.each(widgets, function(w) {
            logger.debug('w.stmt=', w.stmt);
            var kind = w.stmt.getKind();

            // FIXME : Implement list.
            if (kind === 'leaf') {
                var rt = w.stmt.getRawType();
                var v = w.widget.getValue();

                if (_.isString(v)) {
                    v = v.trim();
                }

                if (rt.isEmptyType()) {
                    if (v !== false) {
                        ret[w.stmt.getName()] = '';
                    }
                } else if (v === '') {
                    if (w.stmt.isMandatory()) {
                        _error('Mandatory field "' + w.stmt.getName() + '" not set.');
                        return false;
                    }
                } else {
                    ret[w.stmt.getName()] = v;
                }

            } else if (kind === 'leaf-list') {
                var llValues = w.widget.getValues();
                if (llValues.length > 0) {
                    ret[w.stmt.getName()] = llValues;
                }
            } else if (kind === 'list') {
                var l = w.widget;
                ret[w.stmt.getName()] = w.widget.getActionValues();
            } else {
                // FIXME : Handle more input types in actions
                throw new Error('Can\'t handle "' + kind + '" in input parameters');
            }
        });

        return ret;
    }

});
});

