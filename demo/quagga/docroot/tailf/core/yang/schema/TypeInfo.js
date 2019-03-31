define('tailf/core/yang/schema/TypeInfo', [
    'lodash',
    'Class'
], function(_, Class) {

    // Type information retrieved from the namespace
    var TypeInfo = Class.extend({

        init : function(typeInfo) {
            this._ti = typeInfo;
            this._enum = undefined;
            this._union = undefined;
            this._unionData = undefined;
        },

        isEnum : function() {
            var me = this;

            if (this._enum) {
                return true;
            }

            if (this._enum === false) {
                return false;
            }

            // Not cached yet

            this._enum = false;

            _.each(this._ti, function(item) {

                if (item.enumeration) {
                    me._enum = {
                        name   : item.enumeration,
                        values : []
                    };

                    _.each(item.enumeration, function(e) {
                        me._enum.values.push({
                            label : e.label
                        });
                    });

                    return false;
                }
            });

            return this._enum !== false;
        },

        isUnion : function() {
            var me = this;

            if (this._union) {
                return true;
            }

            if (this._union === false) {
                return false;
            }

            // Not cached yet

            this._union = false;
            _.each(this._ti, function(item) {

                if (item.union) {
                    me._unionData = item.union;
                    me._union = true;
                    return false;
                }
            });

            return me._union !== false;
        },

        getEnumLabels : function() {
            var ret = [];

            if (!this.isEnum()) {
                throw 'Not an enum type';
            }

            _.each(this._enum.values, function(v) {
                return ret.push(v.label);
            });

            return ret;
        },

        getUnionTypes : function() {
            var ret = [];

            _.each(this._unionData, function(type) {
                var name;
                var exactName;

                _.each(type, function(typeItem, ix) {
                    // The exact name seems to come first, if there is one
                    if (name) {
                        exactName = name;
                    }

                    // Discriminate e.g. range objects
                    if (typeItem.name && (_.size(typeItem) === 1)) {
                        name = typeItem.name;
                    }
                });

                var item = {
                    name : name
                };

                if (exactName) {
                    item.exactName = exactName;
                }

                ret.push(item);
            });

            return ret;
        }
    });

    return TypeInfo;
});


