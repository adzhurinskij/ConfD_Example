define('tailf/core/yang/schema/RawType', [
    'lodash',
    'Class'
], function(_, Class) {

    // Raw type information, from a DataChild sub-type
    var RawType = Class.extend({

        init : function(rawTypeInfo) {
            this._typeInfo = rawTypeInfo;
        },

        getName : function() {
            return this._typeInfo.name;
        },

        isPrimitive : function() {
            return this._typeInfo.primitive === true;
        },

        getPrimitiveTypeName : function() {
            return this._typeInfo.name;
        },

        // Only valid for non-primitive types
        getNamespace : function() {
            return this._typeInfo.namespace;
        },

        isEmptyType : function() {
            return this.isPrimitive() && (this.getName() === 'empty');
        }

    });

    return RawType;
});


