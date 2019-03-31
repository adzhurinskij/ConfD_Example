define([
    'tailf/dijit/html',
    'confd/href'
], function(
    dijitHtml,
    confdHref
) {

function m_keyCellDecorator(args) {
    return dijitHtml.a(confdHref.getModelHref(args.keypath), args.value);
}

return {
    keyCellDecorator : m_keyCellDecorator
};

});
