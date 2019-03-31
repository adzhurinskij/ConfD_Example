define('tailf/core/yang/schema/Module', [
    './Schema'
], function(Schema) {

    //
    // Represents a yang module, created from schema retrieved from server
    var Module = Schema.extend({
        init : function(moduleSchema) {
            this._super(moduleSchema);
        }
    });

    return Module;
});
