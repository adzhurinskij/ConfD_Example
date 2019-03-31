define([
    'jquery'
], function (
    $
) {

function _html(node) {
    return $('<div>').append(node).html();
}

function _a(href, text) {
    return '<a href="' + href + '">' + text + '</a>';
}

function m_a(href, text) {
    return _a(href, text);
}

function m_div(text) {
    return _html($('<div>').text(text));
}

return {
    a   : m_a,
    div : m_div
};

});
