define([
    'jquery',

    'dojo/_base/declare',
    'dijit/layout/ContentPane',

    'tailf/core/logger'
], function(
    $,

    declare,
    ContentPane,
    logger
) {

var XmlOutput = declare([ContentPane], {

    destroy : function() {
        this.inherited(arguments);
    },

    startup : function() {
        var me = this;
        me.inherited(arguments);

        setTimeout(function() {
            me.editor = me._createEditor();
        });
    },

    _createEditor : function() {
        var $p = $(this.domNode);
        var $ta = $('<textarea>').attr({style: 'width:100%;height:100%'});

        $p.addClass('tailf-xml-output');
        $p.append($ta);

        var editor = CodeMirror.fromTextArea($ta.get(0), {
            readOnly       : true,
            mode           : 'xml',
            lineNumbers    : true,
            viewportMargin : Infinity,

            foldGutter: true,
            gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
        });

        return editor;
    },

    setXmlContent : function(content) {
        var me = this;

        if (me.editor) {
            me.editor.setValue(content);
        } else {
            setTimeout(function() {
                me.editor.setValue(content);
            }, 200);
        }
    }
});


return XmlOutput;

});



