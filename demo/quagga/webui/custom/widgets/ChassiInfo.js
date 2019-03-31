define([
    'jquery',
    'lodash',

    'dojo/_base/declare',
    'dijit/_TemplatedMixin',

    'dijit/layout/ContentPane',

    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/protocol/JsonRpcErr',

    'dojo/text!./templates/ChassiInfo.html'
], function(
    $, _,

    declare, _TemplatedMixin,

    ContentPane,

    logger,
    JsonRpc, JsonRpcHelper, JsonRpcErr,

    template
) {

var ChassiInfo = declare([ContentPane, _TemplatedMixin], {
    templateString : template,

    destroy : function() {
        this.inherited(arguments);
    },

    postCreate : function() {
        this.inherited(arguments);
    },

    startup : function() {
        this._setContent();
    },

    _setContent : function() {
        var me = this;

        function _set(key, result) {
            var el = $($(me.domNode).find('span.' + key)[0]);
            el.text(result[key]);
        }

        JsonRpcHelper.read().done(function(th) {
            JsonRpcHelper.getValuesAsObject(th, '/chassis/server-info', ['system-name', 'ftos-version', 'location'])
                .done(function(result) {
                    logger.trace('result=', result);
                    _set('system-name', result);
                    _set('ftos-version', result);
                    _set('location', result);
                })
                .fail(function(err) {
                    logger.error('ChassiInfo : getValues : err=', err);
                });
        });
    }
});

return ChassiInfo;

});

