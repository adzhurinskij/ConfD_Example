define('tailf/core/yang/schema/LeafList', [
    './DataChild'
], function(DataChild) {
    //
    // Yang leaflist
    var LeafList = DataChild.extend({
        init : function(args) {
            this._super(args);
        }
    });

    return LeafList;
});

