define('tailf/core/yang/schema/Choice', [
    'lodash',
    './DataChild',
    './Case'
], function(_, DataChild, Case) {

    // Yang choice
    var Choice = DataChild.extend({
        init : function(args) {
            this._super(args);
        },

        getCases : function() {
            var me = this;
            var ret = [];

            _.each(this._schema.cases, function(_case) {
                ret.push(new Case({
                    childSchema   : _case,
                    namespace     : me.getNamespace(),
                    prefix        : me.getPrefix(),
                    parentKeypath : me.getKeypath()
                }));
            });

            return ret;
         },

        getCaseNames : function() {
            var ret = [];

            _.each(this._schema.cases, function(_case) {
                ret.push(_case.name);
            });

            return ret;
        },


        getActiveCase : function() {
            return this._schema.active;
        }



    });


    return Choice;
});

