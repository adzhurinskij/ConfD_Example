define('tailf/dijit/form/Select', [
    'jquery',

    'lodash',

    'dojo/dom-construct',
    'dojo/dom-class',
    'dojo/_base/declare',
    'dojo/query',
    'dojo/on',

	'dijit/_WidgetBase',
	'dijit/_TemplatedMixin',
    'dijit/_Container',

    'dijit/form/_FormValueWidget',

	'dojo/text!./templates/Select.html',

    '../../core/logger',
    './_Select'
], function(

    $, _,
    domConstruct, domClass, declare, query, on,


    _WidgetBase, _TemplateMixin, _Container, _FormValueWidget,

    template,

    logger,
    _Select

) {


return declare([_Select, _TemplateMixin], {
	templateString: template,

    ownTitle : true,

    constructor : function(args) {
        this.rightButton = args.rightButton;
        this.editButton = args.editButton;
    },

    postCreate : function() {
        var me = this;

        this.inherited(arguments);

        this.setupConnections();

        // FIXME: Use dojo dom stuff instead, don't understand how to this right now
        var $t = $(this.domNode);
        var $tr = $t.find('tr.select-row');
        //var $header = $t.find('div.select-header');
        var $header = $t.find('label');
        var $sel = $t.find('select');
        var rb;

        if (this.ownTitle && this.title) {
            $header.html(this.title);
        } else if (!this.ownTitle) {
            $t.find('tr.title-row').remove();
        }


        if (me.editButton) {
            var eb = $('<button>').addClass(this.editButton.iconClass);

            if (_.isFunction(me.editButton.onClick)) {
                eb.click(function(evt) {
                    me.editButton.onClick(evt);
                });
            }

            if(!me.editButton.enabled) {
                eb.hide();
            }

            $tr.append($('<td>').append(eb));
        }

        if (me.rightButton && me.rightButton.iconClass) {
            rb = $('<button>').addClass(this.rightButton.iconClass);

            if (_.isFunction(me.rightButton.onClick)) {
                rb.click(function(evt) {
                    me.rightButton.onClick(evt);
                });
            }

            $tr.append($('<td>').append(rb));
        }

        if (me.rightButton && me.rightButton.id) {
            rb = $t.find('button').attr('id', me.rightButton.id);
        }
    },
    setupConnections: function() {
        var me = this;
        on(this.domNode, 'select:change', function(e) {
            var $select = $(this);

            if (me.editButton) {
                if($select.val()) {
                    $(me.domNode).find('button.'+me.editButton.iconClass).show();
                } else {
                    $(me.domNode).find('button.'+me.editButton.iconClass).hide();
                }
            }
        });
    }
});

});

