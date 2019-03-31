// FIXME: Change name to InlineEnumSelect?
define('tailf/dijit/schema/InlineSelect', [
    'jquery',

    'lodash',

    'dojo/dom-class',
    'dojo/_base/declare',

	'dijit/_TemplatedMixin',

	'dojo/text!./templates/InlineSelect.html',

    'tailf/core/logger',
    'tailf/core/protocol/JsonRpcHelper',

    '../form/_Select'

], function(
    $, _,

    domClass, declare,  _TemplateMixin,

    template,

    logger, JsonRpcHelper,
    _Select


) {

function _trace() {
    logger.tracePrefix('InlineSelect : ', arguments);
}

// FIXME : Handle multiple keys
// FIXME : Add (async) functionality to filter list values
return declare([_Select, _TemplateMixin], {
	templateString: template,

    // loadDeferred.resolve() is called when the options are read from the model
    loadDeferred : undefined,

    constructor : function(args) {
        this.th = args.th;
        this.type = args.type; // 'list', 'enum', undefined === 'enum'
        this.keypath = args.keypath;
        this.current = args.current;
        this.onChange = args.onChange;
    },

    postCreate : function() {
        var me = this;

        me.inherited(arguments);

        if (me.th) {
            setTimeout(function() {
                me._setOptionsFromKeypath(me.th, me.type, me.keypath);
            });
        }
    },

    setTh : function(th) {
        var me = this;
        me.th = th;
        me._setOptionsFromKeypath(me.th, me.type, me.keypath);
    },

    setOptionsFromKeypath : function(th, keypath) {
        var me = this;

        me.keypath = keypath;

        if (!th) {
            JsonRpcHelper.read().done(function(th) {
                me._setOptionsFromKeypath(th, me.type, keypath);
            });
        } else {
            me._setOptionsFromKeypath(th, me.type, keypath);
        }
    },

    _setOptionsFromKeypath : function(th, type, keypath) {
        var me = this;

        if ((type === 'enum') || (type === undefined)) {
            this._setOptionsFromEnumKeypath(th, keypath);
        } else if (type === 'list') {
            this._setOptionsFromListKeypath(th, keypath);
        } else {
            throw 'Unknown data type "' + type + '"';
        }
    },

    _setOptionsFromEnumKeypath : function(th, keypath) {
        var me = this;

        JsonRpcHelper.getSchema(th, '', keypath, 2, false).done(function(schema) {
            var rti = schema.getRawType();
            var ti = schema.getTypeInfo(rti.getNamespace(), rti.getName());

            if (ti.isEnum()) {
                var enums = ti.getEnumLabels();
                me.setOptions(enums);
                me._optionsLoaded();
             } else {
                logger.error('InlineSelect : _setOptionsFromKeypath : Must be an enum! keypath=', keypath);
            }
        }).fail(function(err) {
            logger.error('InlineSelect._setOptionsFromKeypath : err=', err);
        });
    },

    _setOptionsFromListKeypath : function(th, keypath) {
        var me = this;

        if (!keypath) {
            return;
        }

        JsonRpcHelper.getListKeys2(th, keypath)
            .done(function(keys) {
                me._setListKeysOptions(keys);
                me._optionsLoaded();
            })
            .fail(function(err) {
                logger.error('InlineSelect : _setOptionsFromListKeypath : keypath=' + keypath + ' : err=', err);
            });
    },

    _setListKeysOptions : function(keys) {
        var opts = [];

        if (this.allowEmptyString === true) {
            opts.push('');
        }

        _.each(keys, function(key) {

            if (_.isString(key)) {
                opts.push(key);
            } else if (_.isArray(key)) {
                if (key.length === 1) {
                    opts.push(key[0]);
                } else {
                    var label = '';
                    var value = '';

                    _.each(key, function(k, ix) {
                        if (ix > 0) {
                            label += ' - ';
                            value += ' ';
                        }

                        label += k;
                        value += '"' + k + '"';
                    });

                    opts.push({
                        label : label,
                        value : value
                    });
                }
            } else {
                logger.error('_setListKeysOptions : Unsupported key result type : key=', key);
            }
        });

        this.setOptions(opts);
    },


    _optionsLoaded : function() {
        var me = this;

        if (_.isString(me.current)) {
            me.setValue(me.current);
        }

        if (me.loadDeferred !== undefined) {
            me.loadDeferred.resolve(me);
        }
	$(this.domNode).find("select").css("display", "");
     }
});
});




