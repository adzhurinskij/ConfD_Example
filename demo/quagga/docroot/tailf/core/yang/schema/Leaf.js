define('tailf/core/yang/schema/Leaf', [
    './DataChild'
], function(DataChild) {
    //
    // Yang leaf
    var Leaf = DataChild.extend({
        init : function(args) {
            this._super(args);
        }
    });

    return Leaf;
});

