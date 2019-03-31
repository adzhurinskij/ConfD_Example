define([
    'jquery',
    'lodash',

    'dojo/_base/declare',
    'dojo/dom-construct',
    'dojo/string',
    'dijit/_TemplatedMixin',

    'dijit/layout/ContentPane',
    'dijit/form/Button',
    'dijit/form/DropDownButton',
    'dijit/DropDownMenu',
    'dijit/MenuItem',

    'tailf/global',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/protocol/JsonRpcErr',

    'tailf/dijit/schema/KeypathEditor',

    'dojo/text!./templates/RollbackContent.html'
], function(
    $, _,

    declare, domConstruct, dojoString, _TemplateMixin,

    ContentPane, Button, DropDownButton, DropDownMenu, MenuItem,

    tailfGlobal, logger,
    JsonRpc, JsonRpcHelper, JsonRpcErr,

    KeypathEditor,

    template
) {

var RollbackContent = declare([ContentPane, _TemplateMixin], {
    templateString : template,

    destroy : function() {
        this.inherited(arguments);
    },

    postCreate : function() {
        this.inherited(arguments);
        var me = this;
        setTimeout(function() {
            me._createControlWidgets();
            me._createContentWidget();
            me.pathEl = $(me.domNode).find('div.rollback-path')[0];
            me.clearValue();
        });
    },

    /*
     * args = {
     *  filename : <rollback name>
     *  nr       : <rollback number>
     *  content  : <rollback content>
     * }
     */
    setValue : function(args) {
        var txt = 'Load &nbsp' + args.filename;
        this.rollbackButton.set('label', txt);
        $(this.rollbackButton.domNode).show();
        $(this.pathEl).show();
        this.rollbackContent.setValue(dojoString.escape(args.content));
        this.rollbackFilename = args.filename;
        this.rollbackNr = args.nr;
    },

    clearValue : function() {
        this.setValue({
            filename : undefined,
            nr       : undefined,
            content  : ''
        });

        $(this.rollbackButton.domNode).hide();
        $(this.pathEl).hide();
    },

    _createControlWidgets : function() {
        var me = this;
        var ddm = new DropDownMenu({
            style : 'display: none'
        });

        ddm.addChild(new MenuItem({
            label : 'Cumulative',
            onClick : function() {
                me._onCumulativeRollback();
            }
        }));
        
	ddm.addChild(new MenuItem({
            label : 'Selective ',
            onClick : function() {
                me._onSelectiveRollback();
            }
        }));
        
	ddm.startup();

	var keypathEditorHtml = $(me.domNode).find('#rollback_keypath_editor')[0];
	
	me.rollbackButton = new DropDownButton({
            label    : '',
            dropDown : ddm
	}, $(me.domNode).find('#rollback_btn')[0]);

        me.keypathEditor = new KeypathEditor({
            callbacks : {
                keypathSelected : function(keypath) {
                    logger.debug('keypath=', keypath);
                }
            }
        });

	domConstruct.place(me.keypathEditor.domNode, keypathEditorHtml);
    },

    _createContentWidget : function() {
        this.rollbackContent = this._getRollbackContent($(this.domNode).find('div.rollback-content textarea')[0]);
    },

    _getRollbackContent : function(textAreaElement) {
        var editor = CodeMirror.fromTextArea(textAreaElement, {
            readOnly       : true,
            lineNumbers    : true,
            viewPortMargin : Infinity
        });

        return editor;
    },

    _onCumulativeRollback : function() {
        this._rollback(false);
    },

    _onSelectiveRollback : function() {
        this._rollback(true);
    },

    _rollback : function(selective) {
        var me = this;
        JsonRpcHelper.write().done(function(th) {
            me._rollbackTh(th, selective);
        });
    },

    _rollbackTh : function(th, selective) {
        var me = this;
        var path = me.keypathEditor.getKeypath().trim();

        var args = {
            th        : th,
            nr        : me.rollbackNr,
            selective : selective
        };

        if (path.length > 0) {
            args.path = path;
        }

        JsonRpc('load_rollback', args).done(function(result) {
            tailfGlobal.messages().information('' + me.rollbackFilename + ' loaded');
        }).fail(function(err) {
            tailfGlobal.messages().error('' + me.rollbackFilename + ' load failed!<br><br>' +
                JsonRpcErr.getInfo(err));
        });
    }
});

return RollbackContent;

});
