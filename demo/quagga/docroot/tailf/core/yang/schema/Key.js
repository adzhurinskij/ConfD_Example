define('tailf/core/yang/schema/Key', [
    './DataChild'
], function(DataChild) {
    //
    // Yang key
    var Key = DataChild.extend({
        init : function(args) {
            this._super(args);
        }
    });

    return Key;
});

