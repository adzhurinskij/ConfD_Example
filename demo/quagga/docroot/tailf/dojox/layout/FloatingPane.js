define('tailf/dojox/layout/FloatingPane', [
    'dojo/_base/declare',
    'dojox/layout/FloatingPane',

    'tailf/core/logger'
], function(declare, FloatingPane, logger) {

return declare([FloatingPane], {

    closeDestroy : false,

    close : function() {
        if (this.closeDestroy) {
           this.inherited(arguments);
        } else {
            this.hide();
        }
    }
});

});
