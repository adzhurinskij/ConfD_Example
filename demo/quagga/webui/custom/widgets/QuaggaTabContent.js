define([
    'jquery',
    'lodash',

    'dojo/_base/declare',
    'dijit/_TemplatedMixin',

    'dijit/layout/ContentPane',

    'tailf/core/logger',

    //'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    //'tailf/core/protocol/JsonRpcErr',


    'tailf/dijit/html',
    'tailf/dijit/schema/List',

    'confd/href',
    'confd/widgets/list-helper',

    './ChassiInfo',
    './Ospf',
    './Rip',

    'dojo/text!./templates/QuaggaTabContent.html'
], function(
    $, _,

    declare, _TemplatedMixin,

    ContentPane,

    logger,
    //JsonRpc,
    JsonRpcHelper, //JsonRpcErr,
    dijitHtml, List,

    confdHref, listHelper,
    ChassiInfo, Ospf, Rip,
    template
) {

var QuaggaTab = declare([ContentPane, _TemplatedMixin], {
    templateString : template,

    destroy : function() {
        JsonRpcHelper.deleteListener(this._globalWriteThListener);
        this.inherited(arguments);
    },

    postCreate : function() {
        var me = this;
        me.inherited(arguments);

        var ci = new ChassiInfo();
        me.addChild(ci);

        var ospf = new Ospf();
        me.addChild(ospf);

        var rip = new Rip({
            callbacks : {
                refresh : function() {
                    me._refreshInterfaces();
                }
            }
        });
        me.addChild(rip);

        me._getInterfacesWidget().done(function(w) {
            me.interfaces = w;
            me.addChild(w);
        });

        me._globalWriteThListener = JsonRpcHelper.addListener('global-write-th', function(args) {
            me._refreshInterfaces();
       });
     },

    _refreshInterfaces : function() {
        var me = this;
        if (me.interfaces) {
            me.interfaces.refresh();
        }
    },

    _getInterfacesWidget : function() {
        var deferred = $.Deferred();

        JsonRpcHelper.read().done(function(th) {
            JsonRpcHelper.getSchema(th, '', '/system/interface', 1, false).done(function(schema) {
                var list = new List({
                    th     : th,
                    keypath : '/quagga:system/interface',
                    keys    : ['name'],
                    fields  : [{
                        name     : 'name',
                        text     : 'Name',
                        editable : false
                    }, {
                        name     : 'description',
                        text     : 'Description',
                        editable : true
                    }, {
                        name     : 'ip/rip/authentication-key-chain',
                        text     : 'IP Rip Authentication Key Chain',
                        editable : false
                    }, {
                        name     : 'ip/rip/authentication-string',
                        text     : 'IP Rip Authentication String',
                        editable : false
                    }, {
                        name     : 'ip/rip/receive-version',
                        text     : 'IP Rip Receive Version',
                        editable : false
                    }, {
                        name     : 'ip/rip/send-version',
                        text     : 'IP Rip Send Version',
                        editable : false
                    }, {
                        name     : 'ip/rip/split-horizon',
                        text     : 'IP Rip Split Horizon',
                        editable : false
                    }],

                    callbacks : {
                        keyDecorator : listHelper.keyCellDecorator
                    }
                });

                deferred.resolve(list);
            }).fail(function(err) {
                logger.error('err=', err);
            });
        });

        return deferred.promise();
    }
});

return QuaggaTab;

});

