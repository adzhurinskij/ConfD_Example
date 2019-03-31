define([
    'lodash'
], function(_) {

function m_listKeyIndex(keys) {
    var ix = '';

    _.each(keys, function(key) {

        if (ix.length > 0) {
            ix += ' ';
        }

        ix += '"' + key + '"';
    });

    return '{' + ix + '}';
}

// FIXME: More robust algorith, using the parser, is needed.
function m_upOneLevel(path) {
    var items = path.split('/');

    var ret = '';

    _.each(items, function(item, ix) {
        if (ix === (items.length - 1)) {
            return false;
        }

        if (ret.length > 0) {
            ret += '/';
        }

        ret += item;
    });

    return '/' + ret;
}

function m_withoutLastKey(path) {
    var items = path.split('/');

    var ret = '';

    var keyRe = /^([^{]+)\{[^}]+\}$/;

    if(items.length > 0) {
        items[items.length - 1] = items[items.length -1].replace(keyRe, '$1');
    }

    return items.join('/');
}

return {
    listKeyIndex : m_listKeyIndex,
    upOneLevel   : m_upOneLevel,
    withoutLastKey   : m_withoutLastKey
};
});
