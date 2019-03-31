define([
    'jquery',
    'lodash',

    'dojo/_base/declare',
    'dijit/_TemplatedMixin',

    'dijit/MenuItem',
    'dijit/DropDownMenu',
    'dijit/form/Button',
    'dijit/form/ComboButton',
    'dijit/layout/ContentPane',

    'tailf/global',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/protocol/JsonRpcErr',
    'tailf/core/yang/Keypath',

    'tailf/dijit/dialogs/ModalDialog',
    'tailf/dijit/dialogs/DialogBuilder',
    'tailf/dijit/schema/List',

    'confd/global',

    'dojo/text!./templates/Rip.html'
], function(
    $, _,

    declare, _TemplatedMixin,

    MenuItem, DropDownMenu, Button, ComboButton, ContentPane,

    tailfGlobal, logger,
    JsonRpc, JsonRpcHelper, JsonRpcErr, yangKeypath,
    ModalDialog, DialogBuilder, List,

    confdGlobal,
    template
) {
var _path = '/quagga:system/router/rip';

var Rip = declare([ContentPane, _TemplatedMixin], {
    templateString : template,

    callbacks : {
        refresh : undefined
    },

    _globalWriteThListener : undefined,
    _createButton : undefined,
    _actionsButton : undefined,

    destroy : function() {
        if (this._createButton) {
            this._createButton.destroy();
        }

        if (this._actionsButton) {
            this._actionsButton.destroy();
        }

        this.list.destroy();

        JsonRpcHelper.deleteListener(this._globalWriteThListener);
        this.inherited(arguments);
    },

    postCreate : function() {
        var me = this;
        me.inherited(arguments);

        me._globalWriteThListener = JsonRpcHelper.addListener('global-write-th', function(args) {
            //me._updateIconAndButton();
            me.refresh();
        });
    },

    startup : function() {
        this._setContent();
    },

    refresh : function() {
        var me = this;
        me.list.refresh();
        me._updateIconAndButton();
    },

    _setContent : function() {
        var me = this;

        $(me.domNode).find('div.ospf-header a').click(function(e) {
            e.preventDefault();
            confdGlobal.showKeypath(_path, {
                selected : true
            });
        });

        me._addNetworkIpList();
        me._updateIconAndButton();
    },

    _addNetworkIpList : function() {
        var e = $(this.domNode).find('div.center div.yang-list')[0];
        var list = new List({
            keypath : _path + '/network-ip',
            keys    : ['prefix'],

            fields : [{
                name     : 'prefix',
                editable : false
            }]
        }, e);

        this.list = list;
    },

    _updateIconAndButton : function() {
        var me = this;
        var routerImg = $(me.domNode).find('div.router-img');

        if (me._createButton) {
            me._createButton.destroy();
            me._createButton = undefined;
        }

        if (me._actionsButton) {
            me._actionsButton.destroy();
            me._actionsButton = undefined;
        }

        JsonRpcHelper.read().done(function(th) {
            JsonRpcHelper.exists(th, _path).done(function(exists) {
                if (exists) {
                    routerImg.addClass('router-exist');
                    routerImg.removeClass('router-non-exist');

                    me._addActionsButton();
                 } else {
                    routerImg.removeClass('router-exist');
                    routerImg.addClass('router-non-exist');

                    me._addCreateButton();
                }
            });
        });
     },

    _addCreateButton : function() {
        var me = this;
        var createEl = $($(this.domNode).find('div.center div.create')[0]);

        var buttonEl = $('<div>');
        createEl.append(buttonEl);

        logger.error('createEl=', createEl);

        var button = new Button({
            label : 'Create router',
            onClick : function() {
                me._createContainer();
            }
        }, buttonEl.get(0));

        this._createButton = button ;
    },

    _addActionsButton : function() {
        var me = this;
        var createEl = $($(this.domNode).find('div.right div.actions')[0]);

        var buttonEl = $('<div>');
        createEl.append(buttonEl);

        var buttonMenu = new DropDownMenu({
            style : 'display: none'
        });

        buttonMenu.addChild(new MenuItem({
            label     : 'Quick setup',
            onClick   : function() {
                me._quickSetupDialog();
            }
        }));

        buttonMenu.addChild(new MenuItem({
            label     : 'Create interface',
            onClick   : function() {
                me._createInterfaceDialog();
            }
        }));

        buttonMenu.addChild(new MenuItem({
            label     : 'Show router details',
            onClick   : function() {
                confdGlobal.showKeypath(_path, {
                    selected : true
                });
            }
        }));

        buttonMenu.addChild(new MenuItem({
            label     : 'Delete router',
            onClick   : function() {
                me._deleteRouter();
            }
        }));

        var button = new ComboButton({
            label    : 'Actions',
            style    : 'float:left',
            dropDown : buttonMenu,
            onClick  : function(evt) {
                evt.cancelBubble = true;
            },

            // Disable _MenuBase complaint
            _setSelected : function() {
            }
        }, buttonEl.get(0));

        this._actionsButton = button ;
     },

    _createContainer : function() {
        var me = this;

        JsonRpcHelper.write().done(function(th) {
            JsonRpc('create', {
                th   : th,
                path : _path
            }).done(function(th) {
                me._updateIconAndButton();
            });
        });
    },

    _deleteRouter : function() {
        var me = this;

        function _actualDelete() {
            JsonRpcHelper.write().done(function(th) {
                JsonRpc('delete', {
                    th   : th,
                    path : _path
                }).done(function() {
                    logger.trace('########## deleted');
                    me.refresh();
                }).fail(function(err) {
                    logger.error('Delete router failed! : err=', err);
                });
            });
        }

        tailfGlobal.messages()
            .okCancel('Delete router?', _actualDelete);
    },

    _quickSetupDialog : function() {
        var me = this;

        var db = new DialogBuilder();
        var tc = db.getTableContainer({
            cols : 1
        });

        function _add(header, initialValue) {
            var field = db.getTextBox(header);
            field.setValue(initialValue);
            tc.addChild(field);
            return field;
        }

        var hostnameField     = _add('Hostname', 'eeth0');
        var passwordField     = _add('Password', 'secret');
        var networkIpPrefix   = _add('Network IP', '192.168.1.0/24');

        tc.startup();

        var dlg = new ModalDialog({
            title   : 'Create new Rip router',
            content : tc,

            callbacks : {
                onOk : function() {
                    var values = {
                        hostname     : hostnameField.getValue(),
                        password     : passwordField.getValue(),
                        networkIp    : networkIpPrefix.getValue(),
                    };

                    me._setupRip(values).done(function() {
                        dlg.destroy();
                        me.refresh();
                        me._refreshIndication();
                    });
                }
            }
        });

        dlg.startup();
        dlg.show();
    },

    _createInterfaceDialog : function() {
        var me = this;

        var db = new DialogBuilder();
        var tc = db.getTableContainer({
            cols : 1
        });

        function _add(header, initialValue) {
            var field = db.getTextBox(header);
            field.setValue(initialValue);
            tc.addChild(field);
            return field;
        }

        var networkIpPrefix   = _add('Network IP', '192.168.1.0/24');


        tc.startup();

        var dlg = new ModalDialog({
            title   : 'Create interface',
            content : tc,

            callbacks : {
                onOk : function() {
                    var values = {
                        networkIp    : networkIpPrefix.getValue(),
                    };

                    me._createInterface(values).done(function() {
                        dlg.destroy();
                        me.refresh();
                        me._refreshIndication();
                    });
                }
            }
        });

        dlg.startup();
        dlg.show();
    },


    _refreshIndication : function() {
        var cb = this.callbacks;
        if (cb && _.isFunction(cb.refresh)) {
            cb.refresh();
        }
    },

    _setupRip : function(values) {
        var me = this;
        var deferred = $.Deferred();

        JsonRpcHelper.write().done(function(th) {
            me._setupRipTh(th, values).done(function() {
                deferred.resolve();
            });
        });

        return deferred.promise();
    },

    _createInterface : function(values) {
        var me = this;
        var deferred = $.Deferred();

        JsonRpcHelper.write().done(function(th) {
            me._createInterfaceTh(th, values).done(function() {
                deferred.resolve();
            });
        });

        return deferred.promise();
     },

    _setupRipTh : function(th, values) {
        var me = this;
        var deferred = $.Deferred();

        /*
        /system/key-chain{ripauth}/key{11}/key-string : secret
        /system/interface{eeth0}/ip/rip/authentication-mode/mode : md5
        /system/interface{eeth0}/ip/rip/authentication-mode/auth-length : rfc
        /system/interface{eeth0}/ip/rip/authentication-key-chain : ripauth
        /system/router/rip/version : 2
        /system/router/rip/passive-interfaces/passive-by-default : true

        /system/router/rip/network-ip{194.13.0.0/32}
        */

        function _create(path) {
            return JsonRpc('create', {th : th, path : path});
        }

        function _setValue(path, value) {
            return JsonRpc('set_value', {th: th, path: path, value: value});
        }

        var hPath = '/system/interface{"' + values.hostname + '"}';
        var nipPath = '/system/router/rip/network-ip' + yangKeypath.listKeyIndex([values.networkIp]);

        $.when(
            _create('/system/key-chain{ripauth}'),
            _create('/system/key-chain{ripauth}/key{11}'),
            _setValue('/system/key-chain{ripauth}/key{11}/key-string', values.password),
            _create(hPath),
            _setValue(hPath + '/ip/rip/authentication-mode/mode', 'md5'),
            _setValue(hPath + '/ip/rip/authentication-mode/auth-length', 'rfc'),
            _setValue(hPath + '/ip/rip/authentication-key-chain', 'ripauth'),
            _setValue('/system/router/rip/version', '2'),
            _setValue('/system/router/rip/passive-interface/default', 'true'),
            _create(nipPath)
        )
        .done(function() {
            deferred.resolve();
        }).fail(function(err) {
            logger.error('Failed to create RIP : err=', err);
            deferred.reject(err);
        });

        return deferred.promise();
    },

    _createInterfaceTh : function(th, values) {
        var me = this;
        var deferred = $.Deferred();

        function _create(path) {
            return JsonRpc('create', {th : th, path : path});
        }

        var nipPath = '/system/router/rip/network-ip' + yangKeypath.listKeyIndex([values.networkIp]);

        $.when(
           _create(nipPath)
        )
        .done(function() {
            deferred.resolve();
        }).fail(function(err) {
            logger.error('Failed to create interface : err=', err);
            deferred.reject(err);
        });

        return deferred.promise();
    }


});

return Rip;

});

