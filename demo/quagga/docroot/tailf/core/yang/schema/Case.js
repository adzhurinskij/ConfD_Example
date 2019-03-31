define('tailf/core/yang/schema/Case', [
    'lodash',
    './DataChild'
], function(_, DataChild) {

    // Yang case
    var Case = DataChild.extend({
        init : function(args) {
            this._super(args);
        },

        getRawChildren : function() {
            return this._schema.children;
        }
    });


    return Case;
});

