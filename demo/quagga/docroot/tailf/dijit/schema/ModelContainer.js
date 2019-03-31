define('tailf/dijit/schema/ModelContainer', [
    'jquery', 'lodash', 'Class',

    'dojo/dom',
    'dojo/dom-class',
	'dojo/dom-construct',

    'dojo/_base/declare',
    'dojo/query',

    'dijit/registry',
	'dijit/_WidgetBase',
	'dijit/_TemplatedMixin',
    'dijit/_Container',

	'dojo/text!./templates/ModelContainer3.html',

    'tailf/global',
    'tailf/core/util',
    'tailf/core/logger',
    'tailf/core/yang/Keypath',

    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',

    'tailf/dijit/dialogs/DialogBuilder',
    'tailf/dijit/schema/List',
    'tailf/dijit/schema/Factory'
], function(
    $, _, Class,

    dom, domClass, domConstruct, declare, query,

    registry, _WidgetBase, _TemplateMixin, _Container,

    template,

    tailfGlobal, tailfCoreUtil, logger, keypath,
    JsonRpc, JsonRpcHelper,

    DialogBuilder,
    List,
    DefaultSchemaWidgetFactory
) {

function _trace() {
//    logger.tracePrefix('tailf.dijit.schema.ModelContainer : ', arguments);
}


function _newModalDialog(args) {
    var dlg = new tailfGlobal.dialogs().modalDialogClass(args);

    if (!_.isFunction(dlg.setFields)) {
        dlg.setFields = function(fields) {
            dlg.addChild(fields);
        };
    }

    return dlg;
}

var RowContext = Class.extend({
    init : function(args) {
        this._row = undefined;
        this._style = args.style;
        this.level = args.level ? args.level : 0;
    },

    newRow : function(_parentEl) {
        this._row= $('<div>')
                        .addClass('model-row');


        if (this._style) {
            this._row.attr({style : this._style});
        }

        if (_parentEl !== undefined) {
            //var par = $(_parent.domNode);
            var par = $(_parentEl);
            par.append(this._row);
        }

        return this._row;
    },

    getRowElement : function() {
        return this._row.get();
    }
});

function _addLeafListValueDialog(args) {
    var deferred = $.Deferred();
    var db = new DialogBuilder();
    var valueField;

    //var dlg = new tailfGlobal.dialogs().modalDialogClass({
    var dlg = _newModalDialog({
        title : 'Add to leaf-list',
        callbacks : {
            onOk : function() {
                var v = valueField.getValue().trim();

                if (v !== '') {
                    deferred.resolve(v);
                    dlg.close();
                } else {
                    deferred.reject({
                        cause : 'Empty field'
                    });
                }
            }
        }
    });

    var tc = db.getTableContainer();

    valueField = db.getTextBox('Value');
    tc.addChild(valueField);
    dlg.setFields(tc);

    dlg.show();

    return deferred.promise();
}

function _addLeafListLeafRefValueDialog(args) {
    var deferred = $.Deferred();
    var itemsWidget;
    var field;

    //var dlg = new tailfGlobal.dialogs().modalDialogClass({
    var dlg = _newModalDialog({
        title : args.path,
        callbacks : {
            onOk : function() {
                var values = [];

                if (itemsWidget) {
                    var rows = itemsWidget.getSelectedRows();
                    _.each(rows, function(row) {
                        values.push(row[field]);
                    });
                }

                deferred.resolve(values);
                dlg.close();
            }
        }
    });

    function _schema(th, path) {
        return JsonRpcHelper.getSchema(th, '', path, 1, false);
    }

    JsonRpcHelper.read().done(function(th) {
        $.when(
            _schema(th, args.path),
            _schema(th, keypath.upOneLevel(args.path))
        ).done(function(p, pp) {
            /*jshint noempty: false */
            if (pp.getKind() === 'list') {
                field = p.getName();

                var l = new List({
                    style  : 'height:200px',
                    schema : pp,
                    fields : [{
                        name : field
                    }],
                    inlineEditable  : true,
                    columnResizable : false,
                    columnWidthAutoResize : false,
                    selectableRow : true
                });

                itemsWidget = l;

                dlg.setFields(l);
                dlg.show();
            } else {
                // FIXME : What to do when it's not a list key
            }
        }).fail(function(err) {
            logger.error('ModelContainer : _addLeafListValueDialog : err=', err);
        });
    });

    return deferred.promise();
}

return declare([_WidgetBase, _TemplateMixin, _Container], {
	templateString: template,
    //style : 'background:red;',

    nofColumns : 1,

    // Instance of tailf/core/yang/schema/Schema
    parentSchema : undefined,

    // List of tailf/core/yang/schema/DataChild instances/sub-classes
    schemas      : [],

    readOnly     : undefined,

    // Transaction handle
    th           : undefined,

    // Schema widget factory
    //
    // factory.createContainerChildWidget({
    //     th           : <transaction handle>
    //     parentSchema : <parent schema instance>
    //     leafSchema   : <leaf schema instance>,
    //     callbacks    : {
    //          dialogs : ...
    //     }
    // }
    //
    // Returns : Widget instance
    schemaWidgetFactory : undefined,

    dialogCallbacks : {
        addLeafListValue        : _addLeafListValueDialog,
        addLeafListLeafRefValue : _addLeafListLeafRefValueDialog
    },

    // Widgets in container
    _widgets     : [],

    constructor : function(args) {
        var me = this;
        this.jrhListenerId = JsonRpcHelper.addListener('global-write-th', function(evt) {
            me._handleGlobalWriteThEvent(evt);
        });
    },

    destroy : function() {
        // FIXME: Handle cleanup of widgets, I'm not using the _container.addChild()
        // for all the widgets, e.g. choice, at the moment.

        JsonRpcHelper.deleteListener(this.jrhListenerId);
        this.inherited(arguments);
    },

    postCreate : function() {
        var me = this;
        this.inherited(arguments);

        if (me.schemaWidgetFactory === undefined) {
            me.schemaWidgetFactory = DefaultSchemaWidgetFactory;
        }
    },

    resize : function(s) {
        if (s && s.w && s.h) {
            $(this.domNode).width(s.w).height(s.h);
        }
    },

    _handleGlobalWriteThEvent : function(evt) {
        var me = this;

        if ((evt.action === 'removed') && (evt.specific === 'reverted')) {
            // Since the global write th is reverted, we (most likely) have an
            // invalid th.

            JsonRpcHelper.read().done(function(th) {
                me.th = th;
                me.reloadWidgets();
            });
        }
    },

    startup : function() {
        var me = this;

        if (this._started) {
            return;
        }

        this.inherited(arguments);

        this._initWidgets();
    },

    getWidgets : function() {
        return this._widgets;
    },

    reloadWidgets : function() {
        this.destroyDescendants();
        $(this.domNode).empty();
        this._initWidgets();
    },

    _initWidgets : function() {
        var me = this;
        me._widgets = me._addSchemaWidgets({
            rowContext   : new RowContext({
                style : 'width:100%'
            }),
            th           : me.th,
            parentSchema : me.parentSchema,
            leafs        : me.schemas,
            readOnly     : me.readOnly,

            parentEl     : me.domNode,
            choices      : {}
        });
     },

    _addSchemaWidgets : function(args) {
        var me = this;
        var th = args.th;
        var parentSchema = args.parentSchema;

        function _createChildWidget(schema) {
            return me.schemaWidgetFactory.createContainerChildWidget({
                th           : th,
                parentSchema : parentSchema,
                leafSchema   : schema,
                readOnly     : args.readOnly,
                callbacks    : {
                    dialogs : me.dialogCallbacks
                }
            });
        }

        return this._addWidgets({
            rowContext        : args.rowContext,
            th                : args.th,
            parentSchema      : args.parentSchema,
            leafs             : args.leafs,
            createChildWidget : _createChildWidget,
            choices           : args.choices,
            parentEl          : args.parentEl
        });
    },

    _addWidgets : function(args) {
        var me = this;

        var rowCtx = args.rowContext;
        var th = args.th;
        var parentSchema = args.parentSchema;
        var parentKind = parentSchema.getKind();
        var leafs = args.leafs;
        var createChildWidget = args.createChildWidget;
        var choices = args.choices;
        var parentEl = args.parentEl;

        var row = 0;
        var col = 0;

        var ret = [];

        _trace('_addWidgets : 10 : parentSchema.kp=', parentSchema.getKeypath());
        _trace('_addWidgets : 10 : leafs=', leafs);

        function _forceNewRow() {
            if (col > 0) {
                row += 1;
                col = 0;

               return rowCtx.newRow(parentEl);
            } else {
                return $(rowCtx.getRowElement());
            }
        }

        function _addChildWidget(leaf, w, adminItem) {
            var kind = leaf.getKind();

            if (col === 0) {
                rowCtx.newRow(parentEl);
            } else if ((kind === 'list') && leaf.isActionInput() && (parentKind === 'action')) {
                // FIXME : Allow one row that occupies complete row
                var $row = _forceNewRow();
                $row.addClass('model-container-action-list-row');
            }

            if (kind === 'choice') {

                // Start all choices on new row
                _forceNewRow();

                me._addChoiceChild(rowCtx, parentSchema, leaf, choices, rowCtx.getRowElement(), w, row, col);
            } else {
                me._addCurrentRowChild(rowCtx.getRowElement(), w, row, col, adminItem);
            }

            col += 1;
            if (col === me.nofColumns) {
                row += 1;
                col = 0;
            }
        }

        if (parentSchema.isPresence()) {
            // Special fix for presence container
            var cw = createChildWidget(parentSchema);
            _addChildWidget(parentSchema, cw);
            ret.push({
                stmt   : parentSchema,
                widget : cw
            });
            _forceNewRow();
        }

        _.each(leafs, function(leaf) {
            var ew = leaf.getEvaluatedWhen();

            if ((ew === undefined) || (ew === true)) {
                var cw = createChildWidget(leaf);

                if (cw !== undefined) {
                    var item = {
                        stmt   : leaf,
                        widget : cw
                    };

                    _addChildWidget(leaf, cw, item);

                    ret.push(item);
                } else {
                    logger.error('ModelContainer : cw === undefined : leaf=', leaf);
                }
            }
        });

        return ret;
    },

    _addChoiceChild : function(rowCtx, parentSchema, leaf, choices, parentEl, widget, row, col) {
        var me = this;

        _trace('_addChoiceChild : parentSchema=', parentSchema);
        _trace('_addChoiceChild : parentSchema.kp=', parentSchema.getKeypath());
        _trace('_addChoiceChild : leaf=', leaf);

        var kp = leaf.getKeypath();
        var par = $(parentEl);

        _trace('_addChoiceChild : kp=', kp);

        var choiceRowContext = new RowContext({
            level : rowCtx.level + 1
        });
        var choiceDiv = $('<div>').addClass('yang-choice ' + 'yang-choice-level-' + choiceRowContext.level);
        var choiceWidgetDiv = $('<div>').addClass('yang-widget');

        var choiceWidgetsRow = choiceRowContext.newRow();
        choiceWidgetsRow.addClass('yang-choice-elements');

        choiceDiv.append(choiceWidgetDiv);
        choiceDiv.append(choiceWidgetsRow);

        par.append(choiceDiv);

        var choiceData = choices[kp];

        if (!choiceData) {
            choiceData = {};
            choices[kp] = choiceData;
        }

        var orgOnChange = widget.onChange;

        widget.onChange = function(newValue, e) {
            me._updateChoiceFromValue(
                    choiceRowContext, parentSchema, leaf, newValue, choiceData,
                    choiceWidgetsRow.get(), choices);

            widget.setChoiceWidgets(choiceData.childWidgets);

            if (_.isFunction(orgOnChange)) {
                orgOnChange(newValue, e);
            }
        };

        var w = me._addCurrentRowChild(choiceWidgetDiv.get(), widget, row, col, true);
        w.css({ 'float': ''});
    },

    _updateChoiceFromValue: function(rowCtx, parentSchema, choiceStmt,
                                    choiceValue, choiceData, parentEl, choices) {
        var me = this;

        me._destroyRowChildren(choiceData.childWidgets, choices);

        choiceData.value = choiceValue;
        choiceData.keypath = choiceStmt.getKeypath();
        choiceData.childWidgets = [];

        var choiceChildren = me._getChoiceChildren(parentSchema, choiceStmt, choiceValue);

        var widgets = me._addSchemaWidgets({
            rowContext   : rowCtx,
            th           : me.th,
            parentSchema : parentSchema,
            leafs        : choiceChildren,
            parentEl     : parentEl,
            choices      : choices
        });

        choiceData.childWidgets = widgets;
    },

    _getChoiceChildren : function(parentSchema, choiceStmt, value) {
        var ret = [];

        var activeCase = choiceStmt.getActiveCase();
        var cases = choiceStmt.getCases();

        // FIXME : What to do with with no activeCase
        /*
        if (activeCase === undefined) {
        }
        */

        _.each(cases, function(_case) {
            var name = _case.getName();

            if (name === value) {
                var rawChildren = _case.getRawChildren();
                var children = parentSchema.rawChildrenToChildren(rawChildren);

                ret = children;
                return false;
            }
        });

        return ret;
    },

    _destroyRowChild : function(child, choices) {
        var me = this;

        // Note: This must match the structure created in _addCurrentRowChild

        var stmt = child.stmt;
        var cw = child.widget;

        var node = cw.domNode;
        var parent = $(cw.domNode).parent().parent();

        if (stmt.getKind() === 'choice') {
            var choiceAdmin = choices[stmt.getKeypath()];

            if (choiceAdmin) {
                me._destroyRowChildren(choiceAdmin.childWidgets, choices);
                choiceAdmin.childWidgets = [];
            } else {
                logger.error('_destroyRowChild : choice : missing choiceAdmin for keypath=', stmt.getKeypath());
            }
        }

        cw.destroy();
        parent.remove();
    },

    _destroyRowChildren : function(children, choices) {
        var me = this;
        _.each(children, function(child) {
            _trace('_destroyChildren : child=', child);
            me._destroyRowChild(child, choices);
        });
    },

    _addCurrentRowChild : function(parentEl, widget, row, col, adminItem) {
        var par = $(parentEl);

        var widgetMainDiv = $('<div>')
                            .addClass('widget-cell');
                            //.text('' + row + ':' + col);

        // FIXME: Only works for 4 columns items
        var mainStyle;
        switch(this.nofColumns) {
            case 1:
                mainStyle = 'width:99%';
                break;
            case 2:
                mainStyle = 'width:50%';
                break;
            case 3:
                mainStyle = 'width:33%';
                break;
            default:
                mainStyle = 'width:25%';
                break;
        }

        if (col === (this.nofColumns - 1)) {
            mainStyle += ';float:left';
        } else {
            mainStyle += ';float:left';
        }

        widgetMainDiv.attr({style: mainStyle});

        var widgetDiv = $('<div>');

        if (tailfCoreUtil.isJQueryDeferred(widget)) {
            var deferred = widget;

            deferred.done(function(widget) {
                if (adminItem !== undefined) {
                    adminItem.widget = widget;
                } else {
                    logger.error('ModelContainer._addCurrentRowChild : adminItem === undefined, for deferred widget create');
                }

                widgetDiv.append(widget.domNode);
            });
        } else {
            widgetDiv.append(widget.domNode);
        }

        widgetMainDiv.append(widgetDiv);

        par.append(widgetMainDiv);

        return widgetMainDiv;
    }

});

});

