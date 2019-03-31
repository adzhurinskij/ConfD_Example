define([
    'lodash',
    'tailf/core/logger'
], function(
    _, logger
) {

var _hints = {
    // leafs[<category>].path[<path>].leaf[<leaf name>]
    leafs : {
    },

    // containers[<path>]
    containers : {
    }
};

function _getLeafHintCategory(category) {
    if ((category !== 'list')) {
        throw new Error('Invalid leaf hint category, ' + category);
    }

    var ret = _hints.leafs[category];
    if (!ret) {
        ret = {
            paths : {}
        };
        _hints.leafs[category] = ret;
    }

    return ret;
}


/*
 * Converts a path to it's more generic counter part, i.e. the keys are removed
 *
 * E.g.
 *
 *   /foo:bar/baz{one two}/zap  -> /foo:bar/baz/zap
 *
 */
function m_genericPath(path) {
    var items = path.split('/');
    var ret = '';

    _.each(items, function(item, ix) {
        var keys = item.split('{');
        if (ix > 0) {
            ret += '/' + keys[0];
        }
    });

    return ret;
}

/*
 *
 * args = {
 *      category : 'list',
 *      path     : <generic path>
 *      leaf     : <leaf name>
 *      hidden   : boolean
 *  }
 *
 */
function m_setLeafHint(args) {
    var c = _getLeafHintCategory(args.category);
    var p = c.paths[args.path];

    if (!p) {
        p = {
            leafs : {
            }
        };
        c.paths[args.path] = p;
    }

    var leaf = args.leaf;

    if (p.leafs[leaf]) {
        logger.error('setLeafHint : Leaf already set! args=', args);
    }

    p.leafs[leaf] = {
        hidden : args.hidden
    };
}

/*
 *
 * args = {
 *      category : 'list',
 *      path     : <generic path>
 *      leaf     : <leaf name>
 *      hidden   : boolean
 *  }
 *
 */
function m_renderLeaf(args) {
    var ret = true;
    var c = _getLeafHintCategory(args.category);
    var p = c.paths[args.path];

    // FIXME: Fix this more generally
    if (args.category === 'list') {
        if (args.leaf === 'device-modifications') {
            return false;
        }
    }

    if (p) {
        var l = p.leafs[args.leaf];
        if (l) {
            ret = !l.hidden;
        }
    }

    return ret;
}


var _defaultContainerHints = {
    insertValues : false
};

function m_getContainerHints(path) {
    var ch = _hints.containers[path];

    if (ch) {
        return _.assign(ch, _defaultContainerHints);
    } else {
        return _.assign({}, _defaultContainerHints);
    }
}

function m_setContainerHints(path, values) {
    var ch = _hints.containers[path];

    if (ch) {
        logger.error('Container hints already set for path ', path);
    } else {
        ch = _.assign(values, _defaultContainerHints);
        _hints.containers[path] = ch;
    }
}


var ret = {
    genericPath : m_genericPath,

    setLeafHint : m_setLeafHint,
    renderLeaf  : m_renderLeaf,

    getContainerHints : m_getContainerHints,
    setContainerHints : m_setContainerHints
};

return ret;

});
