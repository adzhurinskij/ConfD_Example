define([
    'jquery',
    'lodash',

    'dojo',
    'dojo/aspect',
    'dojo/router',
    'dojo/data/ObjectStore',

    'dijit/Menu',
    'dijit/MenuItem',
    'dijit/MenuSeparator',
    'dijit/MenuBar',
    'dijit/DropDownMenu',
    'dijit/PopupMenuBarItem',
    'dijit/form/Button',

    'dijit/layout/ContentPane',
    'dijit/layout/AccordionContainer',
    'dijit/layout/BorderContainer',
    'dijit/layout/TabContainer',

    'dijit/form/DropDownButton',
    'dijit/form/ComboButton',

    "dijit/tree/TreeStoreModel",
    'dijit/Tree',

    'gridx/Grid',
    'gridx/modules/ColumnResizer',

    'tailf/global',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/protocol/JsonRpcEvent',
    'tailf/core/protocol/JsonRpcErr',

    'confd_tailf/dojo/store/yang/TreeModules',

    'tailf/dijit/messages',
    'tailf/dijit/result-window',
    'tailf/dijit/CliTerminal',
    'tailf/dijit/schema/ModelTabs',
    'tailf/dijit/dialogs/ModalDialog',

    'confd/global',
    'confd/ConfdSchemaWidgetFactory',
    'confd/widgets/list-helper',
    'confd/widgets/Rollbacks'
], function(
    $, _,

    dojo, aspect, router, ObjectStore,

    Menu, MenuItem, MenuSeparator, MenuBar, DropDownMenu, PopupMenuBarItem, Button,
    ContentPane, AccordionContainer, BorderContainer, TabContainer,
    DropDownButton, ComboButton,
    TreeStoreModel, Tree,

    Grid, ColumnResizer,

    tailfGlobal, logger,
    JsonRpc, JsonRpcHelper, JsonRpcEvent, JsonRpcErr,
    TreeModulesStore,

    messages, resultWindow, CliTerminal, ModelTabs, ModalDialog,

    confdGlobal,
    ConfdSchemaWidgetFactory,
    listHelper,
    Rollbacks
) {

var _global = {
    ui : {
        menuBar      : undefined,
        commitButton : undefined
    }
};

var _tabContainer;

var _changesResult = {
    fp   : undefined,
    grid : undefined
};

var _resolveWindow = {
    fp   : undefined,
    grid : undefined
};

var _cliWindow = {
    fp  : undefined
};

function _init() {
    JsonRpc('get_system_setting', {
        operation : 'all'
    }).done(function(ss) {
        _initGlobals(ss);
        _initUI(ss);
        _initRouter();
        _initCustom();
    }).fail(function(err) {
        logger.error('_init : err=', err);
    });
}

function _updateCommitButton(hasWriteTh) {
    var btn = $(_global.ui.commitButton.domNode);

    if (!btn.hasClass('confd-commit')) {
        btn.addClass('confd-commit');
    }

    if (hasWriteTh) {
        btn.addClass('has-write-th');
    } else {
        btn.removeClass('has-write-th');
    }
}

function _initGlobals(systemSettings) {
    var ss = systemSettings;
    var events = JsonRpcEvent.createChannel('main-events-' + String(Math.random()).substring(6));
    events.start();

    tailfGlobal.setEvents(events);
    tailfGlobal.setMessages(messages);
    tailfGlobal.setNamespaces(ss.namespaces);
    tailfGlobal.setDialogs({
        modalDialogClass : ModalDialog
    });

    confdGlobal.showKeypath = function(keypath, args) {
        _addKeypathTab(keypath, args);
    };

    confdGlobal.addGenericTab = function(args) {
        _addGenericTab(args);
    };

    JsonRpcHelper.addListener('global-write-th', function(args) {
        if (args.action === 'created') {
            _updateCommitButton(true);
        } else if (args.action == 'removed') {
            _updateCommitButton(false);
        }
    });
}


function _initUI(systemSettings) {
    var bc = new BorderContainer({
        liveSplitters: false,
        design : 'sidebar'
    }, $('div.main')[0]);

    _global.ui.menuBar = _getMenuBar();

    bc.addChild(_global.ui.menuBar);

    var ac = _getAccordionWidget(systemSettings);
    bc.addChild(ac);

    var tc = _getTabContainer();
    _tabContainer = tc;
    bc.addChild(tc);

    bc.startup();

    function _resize() {

        var w = $(window);
        $(bc.domNode)
            .width(w.width() - 20)
            .height(w.height() - 20);

        bc.resize();
    }

    setTimeout(function() {
        _resize();
    });
}

function _initRouter() {
    router.register('/model/*keypath', function(evt) {
        var keypath = '/' + unescape(evt.params.keypath);
        _addKeypathTab(keypath, {
            selected : true
        });
    });

    router.startup();
}

function _initCustom() {
    function _loadLess(href) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/less';
        link.href = href;

        less.sheets.push(link);
        less.refresh();

        return;
    }

    _loadLess('custom/amd.less');

    // Remove default error reporting
    // Depends on 'dojo-publish-privates' is set
    var lq = require.listenerQueues;
    if (lq && lq.error) {
        lq.error = [];
    }

    function _onError(err) {
        var isCustomAmdLoadError = _.isArray(err.info) && (err.info.length > 0) && (err.info[0] === '/custom/amd.js');
        if (!isCustomAmdLoadError) {
            // Don't silence this error
            logger.error('ConfD require error : err=', err);
        }
    }

    var onResult = require.on('error', _onError);

    try {
        require(['custom/amd'], function(amd) {
            try {
                amd.init({
                    ui : {
                        addGenericTab : _addGenericTab,
                        menuBar       : _global.ui.menuBar
                    }
                });
            } catch (e) {
                logger.error('ConfD custom amd.init() failed! Error=', e);
            }
        });
    } catch (e) {
        logger.error('amd load failed : e=', e);
    }
}

function _logout() {
    function _actualLogout() {
        JsonRpc('logout').done(function() {
            window.location.href = 'login.html';
        }).fail(function(err) {
            console.error('Logout failed! err=', err);
        });
    }

    if (JsonRpcHelper.hasWriteTransaction()) {
        tailfGlobal.messages()
            .okCancel('Non-commited changes, logout?', _actualLogout);
    } else {
        _actualLogout();
    }
}

function _commit() {
    function _actualCommit() {
        JsonRpcHelper.write().done(function(th) {
            JsonRpcHelper.apply(th).done(function() {
                console.debug('Commit SUCCEEDED!');
            }).fail(function(err) {
                if (JsonRpcErr.isValidationFailedErr(err)) {
                    var msg = _getValidationFailedMessage(err) ;

                    tailfGlobal.messages().error(msg);
                } else if (JsonRpcErr.isTransResolveNeededErr(err)) {
                    _resolve();
                } else {
                    tailfGlobal.messages().error(JsonRpcErr.getInfo(err));
                }
            });
        });
    }

    tailfGlobal.messages().okCancel('Commit?', _actualCommit);
}

function _revert() {
    function _actualRevert() {
        JsonRpcHelper.revert();
    }
    tailfGlobal.messages().okCancel('Revert?', _actualRevert);
}

function _viewChanges() {
    if (!_changesResult.fp) {
        var fp = resultWindow.getFloatingPaneWindow({
            element      : $('body').find('div.tailf-global-changes-result')[0]
        });

        fp.startup();
        fp.setTitle('View Changes');

        var store = new dojo.store.Memory({data : []});
        var structure = [{
            id : 'path', field : 'path', name: 'Path'
        }, {
            id : 'op', field : 'op', name : 'Operation'
        }, {
            id: 'value', field: 'value', name: 'Value'
        }, {
            id: 'old', field: 'old', name: 'Old value'
        }];

        var grid = new Grid({
            style : 'width:100%;height:100%;',
            cacheClass : 'gridx/core/model/cache/Sync',
            store      : store,
            structure  : structure,
            modules    : [
                ColumnResizer
            ]
        });

        fp.addChild(grid);

        // path, op, value, old
        _changesResult.fp = fp;
        _changesResult.grid = grid;
    }

    _changesResult.fp.show();

    JsonRpcHelper.read().done(function(th) {
        JsonRpc('get_trans_changes', {
            th : th
        }).done(function(result) {
            var data = result.changes;
            var MaxValueLength = 100;

            function _truncate(v) {
                if (_.isString(v) && (v.length > MaxValueLength)) {
                    v = v.substr(0, MaxValueLength) + ' ...';
                }
                return v;
            }

            _.each(data, function(d, ix) {
                d.value = _truncate(d.value);
                d.old = _truncate(d.old);

                d.id = ix;
            });

            var grid = _changesResult.grid;
            grid.model.clearCache();
            grid.store.setData(data);
            grid.body.refresh();
        }).fail(function(err) {
            logger.error('_viewChanges : err=', err);
        });
    });
}

function _resolve() {
    if (!_resolveWindow.fp) {
        var fp = resultWindow.getFloatingPaneWindow({
            element      : $('body').find('div.tailf-global-resolve')[0]
        });

        fp.startup();
        fp.setTitle('Resolve');

        var store = new dojo.store.Memory({data : []});
        var structure = [{
            id : 'path', field : 'path', name: 'What\'s in conflict'
        }, {
            id : 'op', field : 'op', name : 'What was done'
        }, {
            id: 'value', field: 'value', name: 'Theirs'
        }, {
            id: 'old', field: 'old', name: 'Yours'
        }];

        var grid = new Grid({
            style : 'width:100%;height:90%;',
            cacheClass : 'gridx/core/model/cache/Sync',
            store      : store,
            structure  : structure,
            modules    : [
                ColumnResizer
            ]
        });

        fp.addChild(grid);

        var oursButton = new Button({
            label : 'Accept ours',
            onClick : function() {
                _acceptOurs();
                fp.close();
            }
        });

        var theirsButton = new Button({
            label : 'Accept theirs',
            onClick : function() {
                _acceptTheirs();
                fp.close();
            }
        });

        var closeButton = new Button({
            label : 'Close',
            onClick : function() {
                fp.close();
            }
        });

        fp.addChild(oursButton);
        fp.addChild(theirsButton);
        fp.addChild(closeButton);

        _resolveWindow.fp = fp;
        _resolveWindow.grid = grid;
    }

    _resolveWindow.fp.show();

    JsonRpcHelper.read().done(function(th) {
        JsonRpc('get_trans_conflicts', {
            th : th
        }).done(function(result) {
            var data = result.conflicts;
            var MaxValueLength = 100;

            function _truncate(v) {
                if (_.isString(v) && (v.length > MaxValueLength)) {
                    v = v.substr(0, MaxValueLength) + ' ...';
                }
                return v;
            }

            _.each(data, function(d, ix) {
                d.value = _truncate(d.value);
                d.old = _truncate(d.old);

                d.id = ix;
            });

            var grid = _resolveWindow.grid;
            grid.model.clearCache();
            grid.store.setData(data);
            grid.body.refresh();
        }).fail(function(err) {
            logger.error('_resolve: err=', err);
        });
    });

    function _acceptOurs() {
        JsonRpcHelper.read().done(function(th) {
            JsonRpc('resolve_trans', {
                th : th
            }).done(function() {
                JsonRpcHelper.apply(th);
            }).fail(function() {
                logger.error('resolve_trans failed! err=', err);
            });
        });
    }

    function _acceptTheirs() {
        JsonRpcHelper.revert();
    }
}

function _validateChanges() {
    if (JsonRpcHelper.hasWriteTransaction()) {
        JsonRpcHelper.write().done(function(th) {
            JsonRpc('validate_trans', {
                th : th
            }).done(function(result) {
                tailfGlobal.messages().information('Validate succeeded!');
            }).fail(function(err) {
                if (JsonRpcErr.isValidationFailedErr(err)) {
                    var msg = _getValidationFailedMessage(err) ;
                    tailfGlobal.messages().error(msg);
                } else {
                    tailfGlobal.messages().error(JsonRpcErr.getInfo(err));
                }
             });
        });
    }
}

function _getValidationFailedMessage(err) {
    var msg = 'Validation Failed!<br>';

    _.each(err.data.errors, function(e) {
        msg += '<br>' + e.path + '&nbsp;:&nbsp;' + e.reason;
    });

    return msg;
}


var _rollbacksTab;

function _rollbacks() {
    if (_rollbacksTab) {
        _tabContainer.selectChild(_rollbacksTab);
    } else {
        _rollbacksTab = _addGenericTab({
            title    : 'Rollbacks',
            content  : new Rollbacks(),
            selected : true
        });
    }
}

function _showCliWindow() {
    if (!_cliWindow.fp) {
        var fp = resultWindow.getFloatingPaneWindow({
            element      : $('body').find('div.tailf-cli-window')[0]
        });

        fp.startup();
        fp.setTitle('CLI');
        _cliWindow.fp = fp;

        var cli = new CliTerminal();
        cli.onExitCallback = function () { fp.hide(); };

        fp.onShowCallback = function () { cli.onShow(); };
        fp.onHideCallback = function () { cli.onHide(); };

        fp.addChild(cli);
    }

    _cliWindow.fp.show();
}

function _getMenuBar() {
    var mb = new MenuBar({
        region : 'top'
    });

    // --- Commit button -------------------------------------------------------

    var commitButtonMenu = new DropDownMenu({
        style : 'display: none'
    });

    commitButtonMenu.addChild(new MenuItem({
        //'class'   : 'confd-commit',
        label     : 'Revert',
        //iconClass : 'dijitEditorIcon dijitEditorIconSave',
        onClick   : function() {
            _revert();
        }
    }));

    commitButtonMenu.addChild(new MenuItem({
        //'class'   : 'confd-commit',
        label     : 'View Changes',
        //iconClass : 'dijitEditorIcon dijitEditorIconSave',
        onClick   : function() {
            _viewChanges();
        }
    }));

    commitButtonMenu.addChild(new MenuItem({
        //'class'   : 'confd-commit',
        label     : 'Validate Changes',
        //iconClass : 'dijitEditorIcon dijitEditorIconSave',
        onClick   : function() {
            _validateChanges();
        }
    }));

    commitButtonMenu.addChild(new MenuSeparator());

    commitButtonMenu.addChild(new MenuItem({
        label     : 'Rollbacks',
        onClick   : function() {
            _rollbacks();
        }
    }));


    var commitButton = new ComboButton({
        label    : 'Commit',
        style    : 'float:left',
        dropDown : commitButtonMenu,
        onClick  : function(evt) {
            evt.cancelBubble = true;
            _commit();
        },

        // Disable _MenuBase complaint
        _setSelected : function() {
        }
    });

    // --- CLI button
    var cliButton = new Button({
        label : 'CLI',
        onClick : function(e) {
            _showCliWindow();
        },
        // Disable _MenuBase complaint
        _setSelected : function() {
        }
     });

    // --- Logout Button

    var logoutButton = new ComboButton({
        label    : 'Logout',
        style    : 'float:right',
        //dropDown : commitButtonMenu,
        onClick  : function(evt) {
            evt.cancelBubble = true;
            _logout();
        },

        // Disable _MenuBase complaint
        _setSelected : function() {
        }
    });



    // -------------------------------------------------------------------------

    mb.addChild(commitButton);
    mb.addChild(cliButton);
    mb.addChild(logoutButton);

    setTimeout(function() {
        if (JsonRpcHelper.hasWriteTransaction()) {
            _updateCommitButton(true); }
    });

    _global.ui.commitButton = commitButton;

    return mb;
}

function _getAccordionWidget(systemSettings) {
    var ac = new AccordionContainer({
        region : 'leading',
        splitter : true,
        minSize  : 20
        //style    : 'width:300px;'
    });

    ac.addChild(_getModelContent(systemSettings.namespaces, systemSettings.models));

    return ac;
}


function _getModelContent(namespaces, models) {
    var cp = new ContentPane({
        title : 'Model'
    });

    var objectStore = new TreeModulesStore({
        namespaces : namespaces,
        models     : models
    });

    var dataStore = new ObjectStore({objectStore : objectStore});
    var myModel = new TreeStoreModel({store: dataStore});

    // Create the Tree.
    var tree = new Tree({
        model: myModel,

        onClick : function(item) {
            if (item.href) {
                _addKeypathTab(item.keypath, {
                    selected : true
                });
            }
        }
    });

    cp.addChild(tree);

    return cp;
}

function _getTabContainer() {
    var tc = new TabContainer({
        region : 'center',
        tabStrip : 'true'
    });

    tc.watch("selectedChildWidget", function(name, oval, nval){
        setTimeout(function() {
            var tab = nval.getChildren()[0];

            if (_.isFunction(tab.getKeypath) && (tab.getKeypath() === undefined)) {
                tab.setKeypath(tab._confd.keypath);
            }
        });
    });


    return tc;
}

function _addKeypathTab(keypath, args) {
    var iconClass;
    var selected = false;
    var tp;

    // Look for existing tab
    _.each(_tabContainer.getChildren(), function(child) {
        if (child._confd && (child._confd.keypath === keypath)) {
            tp = child;
            return false;
        }
    });

    if (args) {
        iconClass = args.iconClass;
        selected = args.selected ? true : false;
    }

    if (!tp) {
        var _confd = {
            keypath : keypath
        };

        tp = new ContentPane({
            title     : keypath,
            'class'   : 'keypath-tab',
            closable  : true,
            iconClass : iconClass,
            _confd    : _confd
        });

        tp.onClose = function() {
            router.go('/');
            return true;
        }

        var mts = new ModelTabs({
            schemaWidgetFactory : ConfdSchemaWidgetFactory,
            listKeyDecorator    : listHelper.keyCellDecorator,
            _confd :  _confd
        });
        tp.addChild(mts);

        tp.startup();
        _tabContainer.addChild(tp);
    }

    if (selected) {
        _tabContainer.selectChild(tp);
    }
}

/*
 * args = {
 *  title     : <string>
 *  iconClass : ...
 *  class     : ...
 *  content   :
 *  selected  : <boolean>
 * }
 *
 */
function _addGenericTab(args) {
    args = _.assign({
        title     : '',
        iconClass : '',
        'class'   : '',
         content  : new ContentPane({content : 'Default content'}),
         closable : true,
         selected : true
    }, args);


    if (_.isString(args.content)) {
         args.content = new ContentPane({content : args.content});
    }

    var tp = new ContentPane({
        title     : args.title,
        'class'   : args['class'],
        closable  : args.closable,
        iconClass : args.iconClass
    });

    tp.addChild(args.content);
    _tabContainer.addChild(tp);

    if (args.selected) {
        _tabContainer.selectChild(tp);
    }

    return tp;
}


return {
    run : function() {
        _init();
    }
};

});
