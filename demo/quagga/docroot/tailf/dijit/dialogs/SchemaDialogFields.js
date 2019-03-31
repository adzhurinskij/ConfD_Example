define([
    'lodash', 'jquery',

    'dijit/Fieldset',
    'dijit/form/TextBox',

    'dojox/layout/TableContainer',

    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/yang/Keypath',

    'tailf/dijit/schema/InlineSelect'
], function(
    _, $,

    Fieldset, TextBox,

    TableContainer,

    logger,
    JsonRpc, JsonRpcHelper,
    Keypath,

    InlineSelect
) {


// args.type   : 'list'
// args.action : 'create', 'update'
//
// args.createFieldContainer : function() {returns widget)
//
// args.fields
// {
//     leaf         : <Keypath relative leaf path>
//     text         : <Field header>
//     initialValue : string (optional)
//     type : {
//        isKey  : boolean (false default)
//        kind : 'string' (default), 'leafref-list',
//        path : For leafref-list,
//        onChange : function() {newValue} ... Only for kind 'leafref-list',
//        loadDeferred : jQuery deferred,  ... done(function(widget) {}) Currently only workds for kind='leafref-list';
//        noWriteToModel   : boolean (optional) ... If the widget doesn't contain data that should be written/read from the model
//     },
//     createWidget : function(field) {return widget;} ... Optional create widget function
// }

function Sdf(args) {
    this.fields = args.fields;

    // _leafs array of leaf/widget object info
    // {
    //     leaf  : Yang leaf name
    //     field : Widget connected to this field
    //     isKey : boolean
    // }
    this._leafs = [];
    this._focusField = undefined;
    this._flattenedFields = undefined;

    this.createFieldContainerCallback = args.createFieldContainerCallback;
    //this._container = this._createFieldContainer();
}

Sdf.prototype._createFieldContainer = function() {
    if (_.isFunction(this.createFieldContainerCallback)) {
        return this.createFieldContainerCallback();
    } else {
        return new TableContainer({cols: 1});
    }
};

Sdf.prototype.getField = function(leafName) {
    var f;

    _.each(this._leafs, function(leaf) {
        if (leaf.leaf === leafName) {
            f = leaf.field;
            return false;
        }
    });

    if (f === undefined) {
        throw new Error('Field with yang leaf-name \"' + leafName + '\" not found!');
    }

    return f;
};

Sdf.prototype.focus = function() {
    if (this._focusField) {
        this._focusField.focus();
    }
};

Sdf.prototype.addFields = function(parentWidget) {
    var me  = this;

    if (me._container === undefined) {
        me._container = me._createFieldContainer();
        parentWidget.addChild(me._container);
    }

    me._flattenedFields = [];

    function _addFields(fields) {
        _.each(fields, function (field) {
            if (field.type === 'fieldset') {
                var fs = new Fieldset({
                    title : field.legend
                });
                me._container = me._createFieldContainer();
                fs.addChild(me._container);


                if (_.isObject(field.fieldset)) {
                    var ff = field.fieldset;

                    if (_.isString(ff.extraClass)) {
                        $(fs.domNode).addClass(ff.extraClass);
                    }

                    if (ff.hidden) {
                        $(fs.domNode)
                            .children( ".dijitFieldsetContentOuter" ).css( "display", "none" );
                    }
                }

                parentWidget.addChild(fs);

                _addFields(field.fields);
            } else {
                me._flattenedFields.push(field);

                var f = _getFieldWidget(field);
                me._container.addChild(f);

                if (!me._focusField) {
                    me._focusField = f;
                }

                if (field.initialValue !== undefined) {
                    f.setValue(field.initialValue);
                }

                if (_.isString(field.leaf)) {
                    me._leafs.push({
                        leaf           : field.leaf,
                        field          : f,
                        isKey          : field.type && field.type.isKey ? true : false,
                        noWriteToModel : field.type && field.type.noWriteToModel ? field.type.noWriteToModel : false
                    });
                }
            }
        });
    }

    _addFields(me.fields);
};

function _getLabel(field) {
    var label = field.text;

    if (label === undefined) {
        label = field.leaf;
    }
    return label;
}

function _getFieldWidget(field) {
    if (_.isFunction(field.createWidget)) {
        return field.createWidget(field);
    }

    if (field.type) {
        if (field.type.kind === 'leafref-list') {
            return _getLeafrefListWidget(field);
        }
    }

    return _getDefaultFieldWidget(field);
}

function _getDefaultFieldWidget(field) {
    var f = new TextBox({
        label   : _getLabel(field)
    });

    return f;
}

function _getLeafrefListWidget(field) {
    var loadDeferred = field.type ? field.type.loadDeferred : undefined;

    var f = new InlineSelect({
        label   : _getLabel(field),
        type    : 'list',
        keypath : field.type.path,
        onChange : field.type.onChange,
        current  : field.initialValue,
        loadDeferred : loadDeferred
    });

    JsonRpcHelper.read().done(function(th) {
        f.setTh(th);
    });

    return f;
}

Sdf.prototype.getModelValues = function(th, keypath) {
    var deferred = $.Deferred();
    var ls = [];

    _.each(this.fields, function(l) {
        ls.push(l.leaf);
    });

    JsonRpcHelper.getValuesAsObject(th, keypath, ls)
        .done(function(result) {
            deferred.resolve(result);
        })
        .fail(function(err) {
            deferred.reject(err);
        });

    return deferred.promise();
};

Sdf.prototype.createModelFieldValues = function(th, keypath, valuesCallback) {
    var me = this;
    var deferred = $.Deferred();
    var values = me._getFieldValues();
    var itemPath = me._getListKeypath(keypath, values);

    JsonRpcHelper.createAllowExist(th, itemPath).done(function(result) {
        // FIXME : Use result.created to remove path if setModelValues fails
        me._setModelValues(deferred, th, itemPath, values.nonKeyValues, valuesCallback);
    }).fail(function(err) {
        deferred.reject({
            text : 'Failed to create path ' + itemPath,
            err  : err
        });
    });

    return deferred.promise();
};

Sdf.prototype._setModelValues = function(deferred, th, path, values, valuesCallback) {
    if (_.isFunction(valuesCallback)) {
        valuesCallback({
            path   : path,
            values : values
        });
    }

    JsonRpcHelper.setValues(th, path, values)
        .done(function(result) {
            deferred.resolve();
        })
        .fail(function(err) {
            deferred.reject({
                text : 'Failed to set values',
                err  : err
            });
        });
};

Sdf.prototype._getFieldValues = function() {
    var ret = {
        keyValues    : {},
        nonKeyValues : {}
    };

    _.each(this._leafs, function(l) {
        if (l.isKey) {
            ret.keyValues[l.leaf] = l.field.getValue();
        } else if (!l.noWriteToModel) {
            ret.nonKeyValues[l.leaf] = l.field.getValue();
        }
    });

    return ret;
};

Sdf.prototype._getListKeypath = function(listPath, values) {
    var keyValues = [];

    _.each(this._flattenedFields, function(field) {
        if (field.type && field.type.isKey) {
            keyValues.push(values.keyValues[field.leaf]);
        }
    });

    return listPath + Keypath.listKeyIndex(keyValues);
};


Sdf.prototype.setFieldValues = function(values) {
    _.each(this._leafs, function(leaf) {
        var v = _.find(values, function(v, k) {
            return k === leaf.leaf;
        });

        leaf.field.setValue(v);
    });
};

return Sdf;

});
