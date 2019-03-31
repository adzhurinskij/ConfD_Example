define('tailf/xwt/widget/YangModelTabs', [
    'jquery',
    'lodash',

    'dojo',
    'dojo/dom-construct',
    'dojo/dom-style',
    'dojo/dom-geometry',
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/data/ObjectStore',
    'dojo/store/Memory',
    'dojo/topic',

    'dijit/registry',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/layout/ContentPane',
    'dijit/Tooltip',
    'dijit/form/Button',
    'dijit/layout/_LayoutWidget',

    'xwt/widget/layout/XwtContentPane',
    'xwt/widget/layout/XwtTabContainer',

    'tailf/global',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/protocol/JsonRpcErr',

    'tailf/dijit/render-hints',
    'tailf/dijit/schema/ModelContainer',
    'tailf/dijit/schema/web-storage',

    './schema/Table',

    'dojo/store/Memory',
    'gridx/core/model/cache/Sync',
    'gridx/Grid'

],
function(
    $, _,

    dojo, domConstruct, domStyle, domGeometry, declare, lang,
    ObjectStore, MemoryStore, topic,

    registry, _WidgetBase, _TemplatedMixin,
    ContentPane, Tooltip,
    Button, _LayoutWidget,

    XwtContentPane, XwtTabContainer,

    TailfGlobal, logger, JsonRpc, JsonRpcHelper, JsonRpcErr,

    renderHints, ModelContainer, schemaStorage,
    SchemaTable,

    Memory, Cache, Grid
){

var _nofGridColumns = 4;

var _iconClassInfo = 'icon-desktop';
var _iconClassContainer = 'icon-folder-close-alt';
var _iconClassList      = 'icon-list-view';
var _iconClassAction    = 'icon-gear';

var _ReactContentPane = declare([ContentPane], {

    reactComponent         : undefined,
    reactComponentProps    : undefined,
    reactComponentInstance : undefined,

    destroy: function() {
        if (this.reactComponentInstance) {
            console.warn('YangModelTabs.js : _ReactContentPane.destroy : React component was NOT cleaned up!');
            tfrc.ReactDOM.unmountComponentAtNode(this.domNode);
        }

        this.inherited(arguments);
    },

    destroyDescendants: function() {
        if (this.reactComponentInstance) {
            tfrc.ReactDOM.unmountComponentAtNode(this.domNode);
            this.reactComponentInstance = undefined;
        }

        this.inherited(arguments);
    },

    postCreate: function() {
        this.inherited(arguments);

        $(this.domNode).addClass('tailf-react-xwt-yang-content-pane');
        var element = tfrc.React.createElement(this.reactComponent, this.reactComponentProps);

        this.reactComponentInstance = tfrc.ReactDOM.render(element, this.domNode);
    }

});

return declare([_LayoutWidget], {

    // Object with the following functions
    //   getModelHref(keypath)
    //   navigateToHref(href)
    href   : undefined,

    inlineEditFactory : undefined,
    dialogFactory     : undefined,


    _tabContainer   : undefined,
    _currentKeypath : undefined,
    _tabsState      : {},
    _subscriptions  : [],
    _movingTo       : false,

    postCreate : function() {
        this.inherited(arguments);
        this.actionResultGrid = undefined;
    },

    destroy : function() {
        this._unsubscribe();
        this.inherited(arguments);
    },

    moveToKeypath : function(keypath) {
        var me = this;
        me._movingTo = true;

        me.destroyDescendants();
        me._currentKeypath = keypath;

        me._createWidgets(keypath).done(function() {
            me._movingTo = false;
        });
    },

    _createWidgets : function(keypath) {
        var me = this;
        var deferred = $.Deferred();

        var namespace = '';
        var path = keypath;
        var genericPath = renderHints.genericPath(keypath);
        var ch = renderHints.getContainerHints(genericPath);
        var insertValues = ch.insertValues;

        JsonRpcHelper.read().done(function(th) {
            JsonRpcHelper.getSchema(th, namespace, path, 1, insertValues, true)
                .done(function(schema) {
                    var header = me._getHeaderWidget(schema);
                    me.addChild(header);

                    me._createTabWidgetsMain(th, schema);

                    deferred.resolve();
                })
                .fail(function(err) {
                    logger.error('getSchema failed! err=', err);
                });
        });

        return deferred.promise();
    },

    _getHeaderWidget : function(schema) {
        var node = domConstruct.toDom('<div class="tf-rc" id="tf-rc-breadcrumb-root" />');
        tfrc.render(tfrc.tailf.widget.BreadCrumb, {schema: schema, namespaces: TailfGlobal.namespaces() }, node);

        var xc = new XwtContentPane({content: node});

        xc.destroy = function() {
            tfrc.unmount(node)
        }

        return xc;
    },

    _createTabWidgetsMain : function(th, schema) {
        var me = this;

        var tc = new XwtTabContainer({
            // Note: Class name order important!
            baseClass : 'tailf dijitTabContainer',

            style: 'height: 100%; width: 100%;'
        });

        tc.watch('selectedChildWidget', function(name, oval, nval){
            me._tabSelected(oval, nval);
        });

        me._tabContainer = tc;

        var kind = schema.getKind();
        var pane;

        if (kind === 'list') {
            pane = me._createChildTabWidget(tc, 1, schema);
            tc.addChild(pane);

            me._tabSelected(undefined, pane);
        } else if (kind === 'action') {
            pane = me._createChildTabWidget(tc, 1, schema);
            tc.addChild(pane);

            me._tabSelected(undefined, pane);
        } else {
            me._createTabWidgetsDefaultMain(th, schema, tc);
        }

        me.addChild(tc);
        tc.startup();
    },

    _createTabWidgetsDefaultMain : function(th, schema, tabContainer) {
        var me = this;
        var tc = tabContainer;

        var kind = schema.getKind();
        var addInfoTab = kind === 'list-entry';

        me.tabInfo = [];

        function _addInfoTab() {
            var leafs = [];

            _.each(schema.getChildren(), function(child) {
                var kind = child.getKind();

                if ((kind !== 'container') && (kind !== 'list')) {
                    leafs.push(child);
                }
            });

            var pane = me._createInfoTabWidget(tc, schema, leafs);

            me.tabInfo.unshift({
                pane          : pane,
                ns            : schema.getNamespace(),
                path          : schema.getQualifiedName(),
                parentKeypath : schema.getKeypath(),
                keypath       : null //child.getKeypath()
            });

            //tc.addChild(pane);
        }

        var children = schema.getChildren();

        _.each(children, function(child, ix) {
            var kind = child.getKind();

            var deps = child.getDeps();
            if (deps) {
                for(var i = 0; i < deps.length; i++) {
                    var dep = deps[i];
                    var sub = topic.subscribe(dep, function(oldVal, newVal) {
                        if(!me._movingTo) {
                            me.moveToKeypath(me._currentKeypath);
                        }
                    });
                    me._subscriptions.push(sub);
                }
            }
            if ((kind === 'container') || (kind === 'list')) {
                var evaluatedWhen = child.getEvaluatedWhen();
                if(typeof evaluatedWhen === 'undefined' || evaluatedWhen === true) {
                    var pane = me._createChildTabWidget(tc, ix + 1, child);

                    me.tabInfo.push({
                        pane          : pane,
                        ns            : child.getNamespace(),
                        path          : child.getQualifiedName(),
                        parentKeypath : schema.getKeypath(),
                        keypath       : child.getKeypath()
                    });
                }

                // function _addKeysToWhenTarget(whenTarget) {
                    // var parent = schema.getKeypath();
                    // var parentKeyless = parent.replace(/\{[^}]+\}/, '');

                    // if (whenTarget.search(parentKeyless) > -1) {
                        // var newWhenTarget = whenTarget.replace(parentKeyless, parent);
                        // return newWhenTarget;
                    // }
                    // return whenTarget;
                // }

                // var whenTargets = child.getWhenTargets();
                // if(whenTargets && whenTargets.length > 0) {
                    // for(var i = 0; i < whenTargets.length; i++) {
                        // var whenTarget = _addKeysToWhenTarget(whenTargets[i]);
                        // var sub = topic.subscribe(whenTarget, function(oldVal, newVal) {
                            // //Refresh page to re evaluate when expressions
                            // if(!me._movingTo) {
                                // me.moveToKeypath(me._currentKeypath);
                            // }
                        // });
                        // me._subscriptions.push(sub);
                    // }
                // }

                //tc.addChild(pane);
            } else {
                addInfoTab = true;
            }
        });

        if (me.tabInfo.length === 0) {
            // FIXME : Not bullet-proof, what about 'rouge' leafs apart from container and list
            _addInfoTab();
        } else if (addInfoTab) {
            _addInfoTab();
        }

        _.each(me.tabInfo, function(info, ix) {
            info.pane.yang.paneIx = ix;
            tc.addChild(info.pane);
        });


        setTimeout(function() {
            var paneIx = 0;
            var tabState = me._tabsState[me._currentKeypath];

            if (tabState && (tabState.currentIx < me.tabInfo.length)) {
                paneIx = tabState.currentIx;
            }

            // FIXME : I don't understand why this is necessary
            if (paneIx === 0) {
                me._tabSelected(undefined, me.tabInfo[paneIx].pane);
            } else {
                me._tabContainer.selectChild(me.tabInfo[paneIx].pane);
            }
        });
    },

    _createInfoTabWidget : function(parentWidget, schema, leafs) {
        var cp = new ContentPane({

            'class'    : 'tailf-yang-tab-content tailf-yang-tab-content-info',
            region : 'center',

            //style : 'width: 100%;height:500px;', //background: red;',
            title         : schema.getName(),
            iconClass     : _iconClassInfo, //'icon-desktop',
            content       : 'INFO' // content
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

        if (kind === 'list') {
            iconClass = _iconClassList;
        } else if (kind === 'action') {
            iconClass = _iconClassAction;
        }

        var cp = new ContentPane({
            'class'    : 'tailf-yang-tab-content',
            //style      : 'width: 100%;height:500px;', //background: red;',
            title      : child.getName(),
            iconClass  : iconClass,
            content    : content
        });

        // FIXME : Questionable creation of instance data, is this really ok???
        cp.yang = {
            paneIx : undefined,
            child : child
        };

        setTimeout(function() {
            var tt = new Tooltip({
                // FIXME : tooltip id calculation somewhat brittle,
                //         based on reverse-engineering of the DOM
                connectId : [parentWidget.tablist.id + '_' + cp.id],
                label     : child.getInfo()
            });
        });

        return cp;
     },

    _tabSelected : function(fromContent, toContent) {
        var me = this;

        if (fromContent !== undefined) {
            fromContent.destroyDescendants();
        }

        JsonRpcHelper.read().done(function(th) {
            toContent.destroyDescendants();

            var tabState = me._tabsState[me._currentKeyPath];
            if (!tabState) {
                tabState = {
                    currentIx : undefined
                };

                me._tabsState[me._currentKeypath] = tabState;
            }

            tabState.currentIx = toContent.yang.paneIx;

            me._fillPaneWithModel(th, toContent).done(function() {
            });
        });
    },

    _fillPaneWithModel : function(th, pane) {
        var me = this;
        var deferred = $.Deferred();
        var yc = pane.yang.child;
        var ns;
        var path;

        setTimeout(function() {
        });

        if (pane.yang.leafs) {
            // Special info pane
            ns = pane.yang.parent.namespace;
            path = pane.yang.parent.keypath;

            JsonRpcHelper.getSchema(th, ns, path, 1, false, true)
                .done(function(schema) {
                     me._fillPaneWithInfoLeafsMain(th, pane, schema, pane.yang.leafs);
                     deferred.resolve();
                });
        } else {
            // Pane with schema
            ns = yc.getNamespace();
            path = yc.getKeypath();

            var genericPath = renderHints.genericPath(path);
            var ch = renderHints.getContainerHints(genericPath);
            var insertValues = ch.insertValues;

            JsonRpcHelper.getSchema(th, ns, path, 1, insertValues, true)
                .done(function(schema) {
                    me._fillPaneWithModelMain(th, pane, schema);
                    deferred.resolve();
                });
        }

        return deferred.promise();
    },

    _fillPaneWithInfoLeafsMain : function(th, pane, parentSchema, leafs) {
        var me = this;
        pane.destroyDescendants();

        // --- Header pane
        var infoContent = '';

        infoContent += 'INFO' + '<br>';

        var headerPane = ContentPane({
            content : infoContent
        });

        var mainPane = new ModelContainer({
            nofColumns   : _nofGridColumns,
            th           : th,
            parentSchema : parentSchema,
            schemas      : leafs
        });

        pane.addChild(headerPane);
        pane.addChild(mainPane);

        headerPane.startup();
        mainPane.startup();

        this._fixTabContentPaneSize(pane, headerPane, mainPane);
    },

    _fillPaneWithModelMain : function(th, pane, schema) {
        var me = this;

        pane.destroyDescendants();

        var headerPane = this._getModelHeaderPane(schema);
        var mainPane = this._getModelMainPane(th, schema);

        pane.addChild(headerPane);
        pane.addChild(mainPane);

        headerPane.startup();
        mainPane.startup();

        this._fixTabContentPaneSize(pane, headerPane, mainPane);
    },

    _fixTabContentPaneSize : function(pane, headerPane, mainPane) {
        var me = this;

        this.contentPane = pane;
        this.headerPane = headerPane;
        this.mainPane = mainPane;

        setTimeout(function() {
            me.layout();
        });
    },

    layout : function() {
        if (!this.contentPane) {
            //logger.warn('YMT.layout : !this.contentPane');
            return;
        }

        var $d = $(this.domNode);
        var $dtpw = $($(this.domNode).find('div.dijitTabPaneWrapper')[0]);

        var $ymth = $($d.find('div.tailf-xwt-yang-model-tabs-header')[0]);
        var $tabs= $($d.find('div.dijitTabListContainer-top')[0]);

        var $cp = $(this.contentPane.domNode);
        var $hp = $(this.headerPane.domNode);
        var $mp = $(this.mainPane.domNode);

        var h = $d.height() - $ymth.height() - $tabs.height() ;
        var w = $d.width();

        w -= 0;
        h -= 50;

        // FIXME : Why does this happen, e.g. navigation from specific device do sync-action
        if (($dtpw.height() < h)) {
            $dtpw.height(h);
        }

        var scp = {
            w : w,
            h : h
        };

        var mcp = {
            w : w , //w - 20,
            h : h //h - 50
        };

        this.contentPane.resize(scp);
        $(this.contentPane.domNode.parentElement.parentElement).width(mcp.w + 20);

        this._tabContainer.tablist.resize({
            w : scp.w,
            h : 50
        });

        if (_.isFunction(this.mainPane.resize)) {
            $(this.mainPane.domNode.parentElement).width(mcp.w);
            this.mainPane.resize(mcp);
        }
    },

    _getModelHeaderPane : function(schema) {
        var infoContent = '';
        infoContent += schema.getInfo();

        return new ContentPane({
            content : infoContent
        });
    },

    _getSchemaFlagsStr : function(schema) {
        var infoContent = '';

        if (schema.isOper()) {
            infoContent += 'oper';
        } else {
            infoContent += 'config';
        }

        if (schema.isMandatory()) {
            infoContent += ',&nbsp;mandatory';
        } else {
            infoContent += ',&nbsp;not&nbsp;mandatory';
        }

        return infoContent;
    },

    _getModelMainPane : function(th, schema) {
        var me = this;
        var kind = schema.getKind();
        var ret;

        if (kind === 'list') {
            ret = new _ReactContentPane({
                reactComponent      : tfrc.tailf.widget.schema.YangList,
                reactComponentProps : {
                    // Provide the raw json-rpc schema so that YangList can use the react-based schema code
                    rawSchema : schema._schema
                }
            });

        } else if (kind === 'container') {
            ret = me._getContainerMainPane(th, schema);
        } else if (kind === 'action') {
            ret = me._getContainerActionPane(th, schema);
        } else {
            throw new Error('Unknown pane type "' + kind + '"');
        }

        return ret;
    },

    _getContainerMainPane : function(th, schema) {
        var me = this;

        var grid = new ModelContainer({
            nofColumns   : _nofGridColumns,
            th           : th,
            parentSchema : schema,
            schemas      : schema.getChildren()
        });

        return grid;
    },

    _getContainerActionPane : function(th, schema) {
        var me = this;
        var inputs = [];
        var outputs = [];

        _.each(schema.getChildren(), function(child) {
            // Only use action input

            var isActionInput = child.isActionInput();


            // FIXME: Somewhat brittle fix for trac #13422, it would be better if the is_action_input was set by the server in the get_schema call
            if (!isActionInput && (child.getKind() === 'choice') && !child.isActionOutput()) {
                child._schema.is_action_input = true;
                isActionInput = true;
            }

            if (isActionInput) {
                inputs.push(child);
            }
        });

        var cp = new ContentPane({
        });

        var resetButton = new Button({
            'class'   : 'tailf-invoke-action',
            iconClass : 'icon-gear',
            label     : 'Reset action parameters',

            onClick : function() {
                var params = me._getActionInputParameters(schema.getKeypath(), gridInput);
                schemaStorage.deleteKeys(params);
                me.moveToKeypath(me._currentKeypath);
            }
        });

        var inputColumns = _nofGridColumns;
        if(inputs.length < 4) {
            inputColumns = inputs.length;
        }

        var gridInput = new ModelContainer({
            nofColumns   : inputColumns,
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
            iconClass : 'icon-gear',
            label     : 'Invoke ' + schema.getName(),

            onClick : function() {
                this.set('disabled', true);
                var maybeDeferred = me._runAction(th, schema.getKeypath(), gridInput, gridOutput);
                // If a single argument is passed to jQuery.when and it is not a Deferred,
                // it will be trated as a resolved Deferred and any doneCallbacks attached
                // will be executed immediately.
                $.when(maybeDeferred).then(lang.hitch(this, function() {
                    this.set('disabled', false);
                }));
            }
        });

        cp.addChild(resetButton);
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

    _addActionResultGrid : function(gridParent) {
        var structure = [
            {id: 'name', name : 'Name'},
            {
                id: 'value',
                name : 'Value',
                class : 'tailf-action-output-value',
                decorator : function(data) {
                    var re = /\s*https?:\/\/(localhost|127.0.0.1)[^\/]+(\/[^\s$]+)/;

                    if(re.test(data)) {
                        url = data.replace(re, '$2');
                        return '<a href="' + encodeURI(data) + '">' + encodeURI(data) + '</a>';

                    } else {
                        return data;
                    }
                }
            }
        ];

        var store = new Memory({
            data : []
        });

        var grid = Grid({
            id: 'grid',
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
        var params = me._getActionInputParameters(keypath, input);

        if (_.isObject(params.__ui_error)) {
            TailfGlobal.messages().information(params.__ui_error.text);
            return;
        }

        function _errReason(err) {
            var ret = '';

            if (err.data) {
                if (_.isString(err.data.reason)) {
                    ret += err.data.reason;
                } else {
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
            }

            return ret;
        }

        return JsonRpcHelper.write().done(function(th) {
            return JsonRpcHelper.runAction({
                th     : th,
                path   : keypath,
                params : params,
                format : 'normal'
            }).then(function(result) {
                me._setActionResult(result);
            }).fail(function(err) {
                if (JsonRpcErr.isRpcMethodFailedErr(err)) {
                    TailfGlobal.messages().error('Action failed', _errReason(err));
                } else {
                    TailfGlobal.messages().error('Action failed', JsonRpcErr.getInfo(err), err);
                }
            });
        }).fail(function(err) {
            console.log('get write transaction failed! err=', err);
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

    _getActionInputParameters : function(keypath, inputContainer) {
        var me = this;
        var ret = {};

        me._addActionInputParameters(ret, keypath, inputContainer.getWidgets(), false);

        return ret;
    },

    _addActionInputParameters : function(ret, keypath, widgets, fromChoice) {
        /* jshint maxcomplexity:11 */
        var me = this;

        function _error(text) {
            ret.__ui_error = {
                text : text
            };
        }

        _.each(widgets, function(w) {
            var kind = w.stmt.getKind();

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
                } else if (v === '' || v == null) {
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
            } else if (kind === 'container') {
                var kp = keypath;

                if (fromChoice) {
                    kp += '/' + w.stmt.getName();
                }

                var matchingItems = schemaStorage.getMatchingPrefixLeafValues(kp);

                // {dry-run: {outformat: "cli"}}}
                _.each(matchingItems, function(item) {
                    if (item.value !== '') {
                        var key = item.path.substr(keypath.length + 1);

                        // FIXME : Only handle 1 container level and leafs
                        var strs = key.split('/');

                        var subKey = strs[0];
                        var content = strs[1];

                        if ((content !== undefined) && (content.indexOf(':') >= 0)) {
                            content = content.split(':')[1];
                        }

                        var value = {};
                        value[content] = item.value;

                        if (content) {
                            if(subKey in ret) {
                                ret[subKey] = _.merge(ret[subKey], value);
                            } else {
                                ret[subKey] = value;
                            }
                        }
                    }
                });
            } else if (kind === 'choice') {
                me._addChoiceActionInputParameters(ret, keypath, w);
            } else {
                // FIXME : Handle more input types in actions
                throw new Error('Can\'t handle "' + kind + '" in input parameters');
            }
        });
    },

    _addChoiceActionInputParameters : function(ret, keypath, choiceItem) {
        var me = this;
        var choiceValue = choiceItem.widget.getValue();
        var cases = choiceItem.stmt.getCases();

        _.each(cases, function(_case) {
            if (_case.getName() === choiceValue) {
                me._addActionInputParameters(ret, keypath, choiceItem.widget.getChoiceWidgets(), true);
            }
        });
    },

    _unsubscribe : function() {
        for(var i = 0; i < this._subscriptions.length; i++) {
            this._subscriptions[i].remove();
        }
        this._subscriptions = [];
    }
});
});

