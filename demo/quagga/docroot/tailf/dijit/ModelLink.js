define('tailf/dijit/ModelLink', [
    'jquery',

    'dojo/dom-class',
    'dojo/_base/declare',
    'dojo/query',

	'dijit/_WidgetBase',
	'dijit/_TemplatedMixin',
    'dijit/_Container',

	'dojo/text!./templates/ModelLink.html',

    'tailf/core/logger'
], function(
    $,
    domClass, declare, query, _WidgetBase, _TemplateMixin, _Container,

    template,

    logger

) {

return declare([_WidgetBase, _TemplateMixin, _Container], {
	templateString: template,

    text      : 'trams-text',
    href      : 'trams-href',
    iconClass : 'icon-gear',

    postCreate : function() {
        this.inherited(arguments);

        // FIXME: Use dojo dom stuff instead, don't understand how to this right now
        var $t = $(this.domNode);
        var $a = $t.find('a');

        if (this.iconClass) {
            $t.find('span').addClass(this.iconClass);
        }

        if (this.text) {
            $a.text(this.text);
        }

        if (this.href) {
            $a.attr('href', this.href);
        }
    }

});

});

