define('tailf/core/StopWatch', [
    'Class'
], function(Class) {

var StopWatch = Class.extend({
    init : function() {
        this.startTime = this.start();
        this.stopTime  = undefined;
    },

    start : function() {
        this.startTime = new Date().getTime();
        return this.startTime;
    },

    stop : function() {
        this.stopTime = new Date().getTime();
        return this.stopTime;
    },

    timeMs : function() {
        var t = this.stopTime - this.startTime;
        return t;
    },

    timeS : function() {
        return this.timeMs() / 1000.0;
    },

    strTimeS : function() {
        return '' + this.timeS() + ' (s)';
    }

});

return StopWatch;
});


