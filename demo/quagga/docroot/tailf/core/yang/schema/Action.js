define('tailf/core/yang/schema/Action', [
    'lodash',
    './DataChild'
], function(_, DataChild) {
    //
    // Yang action
    var Action = DataChild.extend({
        init : function(args) {
            this._super(args);
        },

        getInputParameters : function() {
            var ret = [];

            // FIXME: Return instances
            _.each(this._schema.children, function(child) {
                if (child.isActionInput) {
                    ret.push(child);
                }
            });

            return ret;
        },

        getOutputParameters : function() {
            var ret = [];

            // FIXME: Return instances
            _.each(this._schema.children, function(child) {
                if (child.isActionOutput) {
                    ret.push(child);
                }
            });

            return ret;
        }
     });

    return Action;
});

