define([
    'dijit/registry'
], function(
    registry
) {

function m_deleteChildWidgets(node) {
    _.each(registry.findWidgets(node.domNode), function(child) {
        node.removeChild(child);
        child.destroy();
    });
}

return {
    deleteChildWidgets : m_deleteChildWidgets
};

});
