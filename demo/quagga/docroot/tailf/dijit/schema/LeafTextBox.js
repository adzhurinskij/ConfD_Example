define([
    'dojo/_base/declare',
    'dijit/form/TextBox',
    'dojo/text!./templates/LeafTextBox.html'
], function(declare, TextBox, template) {

return declare('tailf/dijit/schema/LeafTextBox', [TextBox], {
    templateString : template,
    baseClass      : 'tailf-leaf-textbox'
});

});
