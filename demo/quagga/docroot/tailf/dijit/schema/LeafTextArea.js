define([
    'dojo/_base/declare',
    'dojo/on',
    'dijit/form/Textarea'
    //'dojo/text!./templates/LeafTextArea.html'
], function(declare, on, TextArea) {


return declare('tailf/dijit/schema/LeafTextArea', [TextArea], {
    rows : '1',
    cols : 20,

    baseClass: "dijitTextArea dijitExpandingTextArea tailf-leaf-textarea tailf-leaf-textarea-no-border",

    layout : function() {
        //console.error('layout');
    },

    resize : function() {
        //console.error('resize');
    },

    postCreate : function() {
        if(this.title == 'device-modifications') {
            on(this.domNode, 'click', function() {
                var content = this.get('value');

                tfrc.ncs.widget.dialog.deviceModifications(content);
            }.bind(this));
        }
    }
});

});
