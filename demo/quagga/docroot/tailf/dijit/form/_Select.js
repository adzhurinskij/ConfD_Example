define('tailf/dijit/form/_Select', [
    'jquery',

    'lodash',

    'dojo/dom-class',
    'dojo/_base/declare',
    'dojo/query',

	'dijit/_WidgetBase',
    'dijit/_Container',

    'dijit/form/_FormValueWidget',

    '../../core/logger'
], function(

    $, _,
    domClass, declare, query,

    _WidgetBase, _Container, _FormValueWidget,

    logger
) {


return declare([_WidgetBase, _Container], {
    options  : undefined,

    constructor : function(args) {
        this.options = args.options;
        this._dijitOnSelect = undefined;
	this._type = args.type;
    },

    destroy : function() {
        if (this.subscriptions) {
            _.each(this.subscriptions, function(sub) {
                sub.remove();
            });
            this.subscriptions = undefined;
        }
    },

    postCreate : function() {
        var me = this;

        this.inherited(arguments);

        var $sel = me._$sel();

        var selected;

        _.each(this.options, function(option) {
            me._addOption($sel, option);

            if (option.selected) {
                if (_.isString(option)) {
                    selected = option;
                } else {
                    selected = option.value;
                }
            }
        });

        if (selected !== undefined) {
            $sel.val(selected);

            // Indicate initial selection
            if (_.isFunction(me.onChange)) {
                setTimeout(function() {
                    me.onChange(selected);
                });
            }
        }

        $sel.change(function(evt) {
            me._propagateOnChange($sel, evt);
        });

	var ua = window.navigator.userAgent;
	var msie = ua.indexOf("MSIE ");
	this.usingIE = false;
	if (msie > 0) // If Internet Explorer, return version number
    	{
            var temp = parseInt(ua.substring(msie + 5, ua.indexOf(".", msie)));
	    this.usingIE = true;
    	}	
	if(this.usingIE) {
	    this._$sel().css("display", "none");
	    setTimeout(function() { me._$sel().css("display", ""); }, 2000);
	}

    },

    _propagateOnChange : function($sel, evt) {
        if (_.isFunction(this.onChange)) {
            this.onChange($sel.val(), evt);
        }

        if (_.isFunction(this._dijitOnSelect)) {
            this._dijitOnSelect($sel.val());
        }
    },

    _$sel : function() {
        return $(this.domNode).find('select');
    },

    setValue : function(value) {
        this.attr('value', value);
    },

    getValue : function() {
        return this.attr('value');
    },

    resize : function(width) {
        this._$sel().width(width);
    },

    // Make it useable as table inline edit
    attr : function(key, value) {
        var $sel = this._$sel();

        /*jshint noempty: false */
        if (key === 'value') {
            if (arguments.length === 2) {
                // Set value
                $sel.val(value);
           } else {
                // Get value
                return $sel.val();
            }
        } else if (key === 'displayedValue') {
            // FIXME : Don't know what to do here, no other arguments are provided.
        } else if (key === 'id') {
            return $(this.domNode).attr('id');
        } else {
            logger.error('tailf.dijit.form.Select.attr : Unsupported key=', key);
        }
    },

    // Old dojo.connect style, used by the xwt table edit functionality
    connect : function(instance, eventName, callback) {
        var me = this;

        this.inherited(arguments);

        var $sel = this._$sel();

        if (eventName === 'onChange') {
            this._dijitOnSelect = callback;

            // Additional change event handled registered here since the original
            // change(...) event handled is registered to early for table
            // inline editing.

            // FIXME : Is the unbinding of the initial event correct?
            $sel.unbind('change');
            $sel.change(function(evt) {
                me._propagateOnChange($sel, evt);
            });
        }
    },

    addOptions : function(options) {
        var $sel = this._$sel();

         _.each(options, function(option) {
            this._addOption($sel, option);
        }, this);
    },

    setOptions : function(options) {
        if(options === undefined) {
            var $sel = this._$sel();
            $sel.find('option').remove();
            this.options = undefined;
            return;
        }
        var $sel = this._$sel();
        $sel.find('option').remove();
        this.addOptions(options);
        this.options = options;
    },

    getOptions : function() {
        return this.options;
    },

    _addOption : function($sel, option) {

        var value = option;
        var label = option;

        if (_.isObject(option)) {
            value = option.value;
            label = option.label;
        }

        $sel.append($('<option>').attr('value', value).text(label));
    }

});

});

