define('tailf/dojo/store/yang/helper', [
    'lodash',
    'tailf/core/logger',
    'tailf/core/keypath/kp-parser'
], function(
    _,
    logger,
    kpParser
) {

function m_objKeypath(keypath, keyNames, obj) {
    var keys = '';

    _.each(keyNames, function(key) {
        if (keys.length > 0) {
            keys += ' ';
        }

        keys += '"' + obj[key] + '"';
    });

    return keypath + '{' + keys + '}';
}


function _createKeyValuesFilteredXpathExpr(node, fields, values) {
    var ret;
    var filter = '';

    // FIXME: How to handle anything but "or" expressions?

    function _addStringItem(value) {
        if (filter.length > 0) {
            filter += ' or ';
        }

        filter += '(' + fields[0] + '="' + value + '")';
    }

    _.each(values, function(value) {
        if (_.isString(value)) {
            _addStringItem(value);
        } else {
            logger.error('_createKeyValuesFilteredXpathExpr : Can only handle single string values right now');
        }
    });

    ret = node + '[' + filter + ']';

    return ret;
}

function _parseQueryXPath(path) {
    var xpathExpr = '';
    var contextNode = '';

    var items = path.split('/');

    _.each(items, function(item, ix) {
        if (ix === (items.length - 1)) {
            xpathExpr = item;
        } else {
            if (item.length !== 0) {
                contextNode += '/' + item;
            }
        }
    });
    return { contextNode: contextNode, xpathExpr: xpathExpr};
}

function _parseParseQueryKeypath(path) {
    var parsed = kpParser.parse(path);

    var xpathExpr = '';
    var contextNode = '';

    return { contextNode: contextNode, xpathExpr: xpathExpr};
}

function _pathEndsWithKey(parsed) {
    return parsed.tokens[0].type === '}';
}

function _parseQueryPath(path) {
    var xpathExpr = '';
    var contextNode = '';

    var parsed = kpParser.parse(path);

    if(parsed.status === 'SyntaxError') {
        // This is a xpath, fall back to simple xpath parser
        return { xpathExpr: path };
    } else if(_pathEndsWithKey(parsed)) {
        xpathExpr = '.';
        contextNode = path;
    } else {
        // It's a valid keypath use parser, the parser handles complex keys
        var nodes = kpParser.tokensToNodes(parsed.tokens);
        xpathExpr = nodes.pop();
        contextNode = '/' + nodes.join('/');
    }

    return { contextNode: contextNode, xpathExpr: xpathExpr, path: path};
}

return {
    objKeypath : m_objKeypath,
    createKeyValuesFilteredXpathExpr: _createKeyValuesFilteredXpathExpr,
    parseQueryPath: _parseQueryPath
};

});
