define('tailf/core/yang/schema/Container', [
    './DataChild'
], function(DataChild) {
    //
    // Yang container
    var Container = DataChild.extend({
        init : function(args) {
            this._super(args);
        }
    });

    return Container;
});

