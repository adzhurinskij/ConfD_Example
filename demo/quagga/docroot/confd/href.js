define([
    'dojo/hash'
], function(hash) {

    function m_getModelHref(keypath) {
        return '#/model' + escape(keypath);
    }

    function m_navigateToHref(href) {
        hash(href);
    }

    return {
        getModelHref   : m_getModelHref,
        navigateToHref : m_navigateToHref
    };
});
