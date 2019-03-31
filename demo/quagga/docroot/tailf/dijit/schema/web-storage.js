define([
    'lodash'
], function(
    _
) {

// NOTE : Originally used webstorage, rename eventually
var _storage = {
    leafs : {
    }
};

function m_setLeafValue(path, value) {
    if (_.isString(value)) {
        value = value.trim();
    }

    _storage.leafs[path] = value;
}

function m_getLeafValue(path) {
    return _storage.leafs[path];
}

function m_hasLeafValue(path) {
    return _storage.leafs[path] !== undefined;
}

function m_getMatchingPrefixLeafValues(prefix) {
    var ret = [];

    _.each(_storage.leafs, function(value, key) {
        if (key.indexOf(prefix) === 0) {
            ret.push({
                path  : key,
                value : value
            });
        }
    });

    return ret;
}

/**
 * Removes the deleteKey from the obj if it is a substring of the objKey
 * @param {object} obj The object that might contain a key that needs to be deleted
 * @param {string} deleteKey The sub string representation of the key you want to delete
 * @param {object} newObj A copy of the 'obj' param with the 'deleteKey' removed, if it existed
 */
function _deleteKeyFromObj(obj, deleteKey) {
    var newObj = {};

    Object.keys(obj).forEach(function(objKey) {
        if (objKey.indexOf(deleteKey) === -1) {
            _.assign(newObj, { [objKey]: obj[objKey] });
        }
    });

    return newObj;
}

function m_deleteKeys(keys) {
    var newLeafs = _storage.leafs;

    Object.keys(keys).forEach(function(key) {
        newLeafs = _deleteKeyFromObj(newLeafs, key);
    });

    _storage.leafs = newLeafs;
}

return {
    setLeafValue : m_setLeafValue,
    getLeafValue : m_getLeafValue,
    hasLeafValue : m_hasLeafValue,
    getMatchingPrefixLeafValues : m_getMatchingPrefixLeafValues,
    deleteKeys : m_deleteKeys,
};

});
