define([
    'lodash'
], function(_) {

// Reasonably correct
function m_isJQueryDeferred(obj) {
    return _.isFunction(obj.promise);
}

return {
    isJQueryDeferred : m_isJQueryDeferred
};

});
