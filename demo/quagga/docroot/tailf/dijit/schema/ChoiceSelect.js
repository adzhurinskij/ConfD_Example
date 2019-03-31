define('tailf/dijit/schema/ChoiceSelect', [
    'jquery',

    'lodash',

    'dojo/dom-class',
    'dojo/_base/declare',
    'dojo/query',

	'dijit/_WidgetBase',
	'dijit/_TemplatedMixin',
    'dijit/_Container',

	'dojo/text!./templates/ChoiceSelect.html',

    'tailf/core/logger'
], function(
    $, _,

    domClass, declare, query, _WidgetBase, _TemplateMixin, _Container,

    template,

    logger

) {

function _trace() {
    logger.tracePrefix('ChoiceSelect : ', arguments);
}

return declare([_WidgetBase, _TemplateMixin, _Container], {
    // FIXME : Make these instance-variables
	templateString: template,

    header   : undefined,
    items    : [],
    current  : undefined,
    onChange : undefined,

    _choiceWidgets : undefined,

    postCreate : function() {
        var me = this;

        this.inherited(arguments);

        // FIXME: Use dojo dom stuff instead, don't understand how to this right now
        var $t = $(this.domNode);
        var $sel = $t.find('select');

        if (this.header !== undefined) {
            $t.find('div.choice-header').text(this.header);
        }

        _.each(this.items, function(item) {
            $sel.append($('<option>').attr('value', item).text(item));
        });

        /* jshint noempty : false */

        if (_.isString(this.current)) {
            $sel.val(this.current);
        } else if (this.current === undefined) {
            // Do nothing
        } else if (_.isObject(this.current) && this.current.done) {
            // A promise

            this.current.done(function(value) {
                if (value !== undefined) {
                    $sel.val(value);
                    me.onChange(value);
                }
            });

        } else {
            logger.error('this.current=', this.current);
        }

        /* jshint noempty : true */

        $sel.change(function(evt) {
            if (_.isFunction(me.onChange)) {
                me.onChange($sel.val(), evt);
            }
        });
    },

    setValue : function(value) {
        $(this.domNode).find('select').val(value);
    },

    getValue : function() {
        return $(this.domNode).find('select').val();
    },

    setChoiceWidgets : function(widgets) {
        this._choiceWidgets = widgets;
    },

    getChoiceWidgets : function() {
        return this._choiceWidgets;
    }

});
});




