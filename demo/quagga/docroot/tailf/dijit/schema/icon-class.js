define('tailf/dijit/schema/icon-class', [
], function() {


function m_kindToClass(schemaKind) {
    if (schemaKind === 'container') {
        return 'icon-folder-close-alt';
    } else if (schemaKind === 'list') {
        return 'icon-list-view';
    } else if (schemaKind === 'action') {
        return 'icon-gear';
    }

    return '';
}

return {
    kindToClass : m_kindToClass
};

});
