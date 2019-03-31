define('tailf/core/yang/schema/List', [
    './DataChild'
], function(DataChild) {
    //
    // Yang list
    var List = DataChild.extend({
        init : function(args) {
            this._super(args);
        }
    });

    return List;
});

