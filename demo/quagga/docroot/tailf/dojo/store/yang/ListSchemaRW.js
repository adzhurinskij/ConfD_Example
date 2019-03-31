// Based on dojo/store/JsonRest.js

// FIXME : How to avoid writing read only values?

define('tailf/dojo/store/yang/ListSchemaRW', [
    'lodash',
    'dojo/_base/declare',
    'dojo/_base/Deferred',
    'dojo/store/util/QueryResults',

    'tailf/core/keypath/kp-parser',

    'tailf/core/logger',

    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',

    'tailf/core/yang/Keypath',
    './helper'

], function(
    _,
    declare, Deferred, QueryResults,

    kpParser, logger, JsonRpc, JsonRpcHelper,

    Keypath,
    helper
) {

// No base class, but for purposes of documentation, the base class is dojo/store/api/Store
var base = null;
/*===== base = Store; =====*/

function _trace() {
    logger.tracePrefix('ListSchemaRW : ', arguments);
}

return declare('ncs.store.yang.ListSchemaRW', base, {

    schema : null,
    fields : [],

    // Used when no Yang schema is specified
    keypath : undefined,
    keys    : undefined,

    // Only use records with these keyvalues
    // FIXME: Only works for single key values for now
    keyValues : undefined,
/*
    // function(id, item)
    //
    // summary:
    //          Check whether a row has child rows. This function should not throw any error.
    // id: String|Number
    //          The row ID
    // item: Object
    //          The store item
    // returns:
    //          True if the given row has children, false otherwise.
    hasChildrenCallback : undefined,


    // function(item){
    //
    // summary:
    //          Get an array of the child items of the given row item.
    // item: Object
    //          The store item
    // returns:
    //          An array of the child items of the given row item.
    getChildrenCallback : undefined,
*/

    _keypath      : undefined,
    _identityKeys : [],

    _identities : {},


    constructor : function(options) {
        // function queryCallback({
        //      th       : ...
        //      deferred : ...
        //      result   : [...]
        //  })
        this.queryCallback = undefined;


        // function putCallback({
        //      th       : ... // Transaction handle (mandatory)
        //      deferred : ... // Deferred instance (mandatory)
        //      obj      : ... // Row item data
        //  })
        this.putCallback = undefined;

        declare.safeMixin(this, options);

        if (this.keypath !== undefined) {
            this._keypath = this.keypath;
        } else {
            this._keypath = this.schema.getKeypath();
        }

        if (this.keys !== undefined) {
            this._identityKeys = this.keys;
        } else {
            this._identityKeys = this._getIdentityKeys(this.schema);
        }

        this.filter = undefined;
        this._destroyed = false;
        this.queryCancelled = true;
    },

    destroy : function() {
        this._destroyed = true;
        this.inherited(arguments);
    },

    remove : function(id, options) {
        // NOTE: Multiple remove call can be issued immediately after each
        // other, without waiting for the deferred value.
        //
        // Currently handled by a somewhat brittle "pending write" in
        // JsonRpcHelper.write()

        var deferred = new Deferred();

        _trace('remove : arguments=', arguments);

        var item = this._identities[id];
        _trace('remove : item=', item);

        var keys = [];
        _.each(this._identityKeys, function(ik) {
            keys.push(item[ik]);
        });

        //var keypath = this.schema.getKeypath() + Keypath.listKeyIndex(keys);
        var keypath = this._keypath + Keypath.listKeyIndex(keys);
        _trace('remove : keypath=', keypath);


        JsonRpcHelper.write().done(function(th) {
            JsonRpc('delete', {th: th, path : keypath}).done(function() {
                // Do nothing
                deferred.resolve();
            }).fail(function(err) {
                logger.error('remove failed : keypath=' + keypath + ' : err=', err);
                deferred.reject(err);
            });
        });

        return deferred;
    },

    query : function(query, options) {
        var me = this;
        var _cleanup = {};

        var deferred = new Deferred(function(deferred) {
            //logger.warn('query : DEFERRED Cancelled! : _cleanup=', _cleanup);
            if (_cleanup && (_cleanup._qh !== undefined)) {
                JsonRpc('stop_query', {qh : _cleanup._qh});
            }

            _cleanup = undefined;
        });

        if (_.isArray(me.keyValues) && (me.keyValues.length === 0)) {
            deferred.total = 0;
            deferred.resolve([]);
        } else {
            JsonRpcHelper.read().done(function(th) {
                me._read({
                    th    : th,
                    start : options.start,
                    count : options.count,
                    sort  : options.sort,
                    filter : me.filter
                }, deferred, _cleanup);
            });

            deferred.total = deferred.then(function(result) {
                _cleanup = undefined;
                return result.total;
            }, function error(err) {
                if (_cleanup && (_cleanup._qh !== undefined)) {
                    JsonRpc('stop_query', {qh : _cleanup._qh});
                }

                _cleanup = undefined;
            });
        }

        return QueryResults(deferred);
    },

    get : function(id) {
        return this._identities[id];
    },

    put : function(obj, options) {
        var me = this;
        var deferred = new Deferred();

        // FIXME: Now rewrites the whole row, need a more efficient way.

        if (options.overwrite === true) {
            var kpAndData;

            /*jshint noempty: false */
            if (me.putCallback) {
                // Do nothing
            } else if (!me.schema) {
                kpAndData = this._getPutKeypathAndData(me._keypath, me.keys, me.fields, obj);
            } else {
                kpAndData = this._getSchemaPutKeypathAndData(me.schema, obj);
            }


            JsonRpcHelper.write().done(function(th) {
                if (me.putCallback) {
                    me.putCallback({
                        schema   : me.schema,
                        keypath  : me.keypath,
                        keys     : me.keys,
                        th       : th,
                        deferred : deferred,
                        obj      : obj
                    });
                } else {
                    me._put(th, kpAndData.keypath, kpAndData.data, deferred);
                }
            });

        } else if (options.overwrite === false) {
            // FIXME: Is it really true that we are adding an item here
            _trace('put : Add an item : obj=', obj);
            deferred.resolve();
        } else {
            logger.error('ListSchemaRW : unknown options parameter! options=', options);
        }

        return deferred;
    },

    getIdentity : function(item) {
        // FIXME : getIdentity during inline-adding is questionable
        // Called here when (inline-) adding a new item.
        if (item.__dojo__ === undefined) {
            return '__dojo__new_item';
        }

        return item.__dojo__.identity;
    },

    setFilter : function(f) {
        this.filter = f;
    },

    clearFilter : function() {
        this.filter = undefined;
    },

    _getIdentityKeys : function(schema) {
        var ret = [];

        _.each(schema.getChildren(), function(child) {
            if (child.getKind() === 'key') {
                ret.push(child.getName());
            }
        });

        return ret;
    },


    _read : function(args, deferred, _cleanup) {
        var me = this;
        var th = args.th;
        var xpathExpr;
        var contextNode;
        var path;

        if (!me.schema) {
			var parsed = helper.parseQueryPath(this._keypath);

			xpathExpr = parsed.xpathExpr;
			contextNode = parsed.contextNode;
			path = parsed.path;

        } else {
            xpathExpr = me.schema.getName();
            contextNode = me.schema.getParentKeypath();
        }

        var leafs = me.fields;
        var filter = me.filter;

        // Yes! Initial offset is one-based
        var initialOffset = args.start + 1;
        var chunkSize = args.count;

        var sort; // ['port']
        var sortOrder; // 'descending'

        if (args.sort && (args.sort.length > 0)) {
            sort = [];
            _.each(args.sort, function(s) {
                sort.push(s.attribute);
                if (s.descending === true) {
                    sortOrder = 'descending';
                }
            });
        }

        if (_.isArray(me.keyValues) && (me.keyValues.length > 0)) {
            xpathExpr = helper.createKeyValuesFilteredXpathExpr(xpathExpr, me.fields, me.keyValues);
        } else if (filter) {
            xpathExpr = me._createFilterXpathExpr(xpathExpr, filter);
        }

        var params = {
            th             : th,
            selection      : leafs,
            chunk_size     : chunkSize,
            initial_offset : initialOffset,
            result_as      : 'string',
            sort           : sort,
            sort_order     : sortOrder
        }

        if(contextNode || xpathExpr) {
            if(contextNode && contextNode !== "" && contextNode !== "/"){
                params.context_node = contextNode;
            }
            params.xpath_expr = xpathExpr;
        } else {
            params.path = path;
        }

        JsonRpc('start_query', params).done(function(qhResult) {
            var qh = qhResult.qh;

            // For potential cancel-cleanup
            _cleanup._qh = qh;

            if (deferred.isCanceled() || me._destroyed) {
                return;
            }

            JsonRpc('run_query', {'qh' : qh}).done(function(queryResult) {
                if (deferred.isCanceled() || me._destroyed) {
                    return;
                }

                var result = me._buildReadResult(leafs, queryResult);

                if (!deferred.isCanceled() && !me._destroyed) {
                    if (me.queryCallback) {
                        me.queryCallback({
                            th       : th,
                            deferred : deferred,
                            result   : result
                        });
                    } else {
                        deferred.resolve(result);
                    }
                }

                JsonRpc('stop_query', {qh : qh}).done(function() {
                    // Do nothing
                    _cleanup._qh = undefined;
                }).fail(function(err) {
                    // FIXME : What do do if  queryStop fails?
                    logger.error('stop_query failed! err=', err);
                    _cleanup._qh = undefined;
                });

            }).fail(function(err) {
                logger.error('ListSchemaRW._read : query_result : err=', err);
            });
        }).fail(function(err) {
            logger.error('start_query failed! err=', err);
            deferred.total = 0;
            deferred.resolve([]);
        });
    },

    _createFilterXpathExpr : function(xpathExpr, filter) {
        _trace('_createFilterXpathExpr : filter=', filter);

        var fs = '';

        function _addExpr(expr) {
            if (fs.length > 0) {
                fs += ' ' + filter.conjunction + ' ';
            }

            var v = expr.value;

            if ((v.length > 0) && (v[0] === '*')) {
                fs += 'contains(' + expr.attr + ',"' + expr.value.substr(1) +'")';
            } else  {
                fs += 'starts-with(' + expr.attr + ',"' + expr.value +'")';
            }
        }

        _.each(filter.expressions, function(expr) {
            _addExpr(expr);
        });

        return xpathExpr + '[' + fs + ']';
    },

    _put : function(th, keypath, data, deferred) {
        _trace('_put : keypath=', keypath);
        _trace('_put : data=', data);

        JsonRpcHelper.setValues(th, keypath, data).done(function() {
            deferred.resolve();
        }).fail(function(err) {
            logger.error('ListSchemaRW : _put : err=', err);
            deferred.reject(err);
        });
    },

    _buildReadResult : function(leafs, queryResult) {
        var me = this;
        var qr = queryResult;
        var ret = [];

        //_trace('_buildReadResult : leafs=', leafs);
        //_trace('_buildReadResult : qr=', qr);

        _.each(qr.results, function(r, res_ix) {
            var row = {};

            _.each(leafs, function(leaf, ix) {
                row[leaf] = r[ix];
            });

            // Build __dojo__ object
            var identity = '';

            // FIXME: How to handle identity for keys that aren't unique
            _.each(me._identityKeys, function(ik) {
                identity += row[ik] + '-';
            });

            if(!identity) {
                identity = res_ix;
            }

            row.__dojo__ = {
                identity : identity
            };

            // FIXME : Handle duplicate identity values ....
            me._identities[identity] = row;

            if (me.volatileData) {
                var tmpRow = me.volatileData(row);
                if (tmpRow !== undefined) {
                    row = tmpRow;
                }
            }

            ret.push(row);
        });

        ret.total = qr.total_number_of_results;

        return ret;
    },

    _getPutKeypathAndData : function(keypath, keys, fields, data) {
        var keyValues = [];

        _.each(keys, function(key) {
            keyValues.push(data[key]);
        });

        var kp = keypath + Keypath.listKeyIndex(keyValues);
        var d = {};

        _.each(fields, function(field) {

            if( !_.contains(keys, field) ){
                if (_.has(data, field) && (data[field] !== undefined)) {
                    d[field] = data[field];
                }
            }
        });

        return {
            keypath : kp,
            data    : d
        };
    },

    _getSchemaPutKeypathAndData : function(schema, data) {
        var kp;
        var d = {};
        var keys = [];

        _.each(schema.getChildren(), function(child) {
            var kind = child.getKind();
            var key = child.getName();

            /*jshint noempty: false */
            if (kind === 'key') {
                keys.push(data[key]);
            } else if (kind === 'leaf') {
                if (_.has(data, key) && (data[key] !== undefined)) {
                    d[key] = data[key];
                }
            } else if ((kind === 'list') || (kind === 'container') || (kind === 'action')) {
                // Do nothing
            } else {
                logger.warn('ListSchemaRW : _getPutKeypathData : Unsupported kind=', kind);
            }
        });

        //kp = schema.getKeypath() + Keypath.listKeyIndex(keys);
        kp = this._keypath + Keypath.listKeyIndex(keys);

        return {
            keypath : kp,
            data    : d
        };
    }

});

});
