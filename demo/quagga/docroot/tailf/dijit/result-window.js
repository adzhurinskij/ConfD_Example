define([
    'tailf/dijit/layout/FloatingPane'
], function(
    FloatingPane
){

function m_getFloatingPaneWindow(args) {
    var element = args.element;
    var fp = new FloatingPane({
            closeDestroy : false,
            resizable    : true
        }, element);

    return fp;
}


var ret = {
    getFloatingPaneWindow : m_getFloatingPaneWindow
};

return ret;
});
