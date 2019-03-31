define('tailf/core/yang/schema/Schema', [
    'lodash',
    'Class',

    'tailf/core/logger',

    './TypeInfo',
    './Container',
    './List',
    './Key',
    './Leaf',
    './LeafList',
    './Choice',
    './Action',

    './RawType'
], function(
    _,
    Class,

    logger,

    TypeInfo, Container, List, Key, Leaf, LeafList, Choice, Action,

    RawType
) {

    // Represent a schema retrieved from server
    //
    var Schema = Class.extend({
        init : function(schema) {
            this._schema = schema;
        },

        getKind : function() {
            return this._schema.data.kind;
        },

        hasChildren : function() {
            var data = this._schema.data;
            return _.isArray(data.children) && (data.children.length > 0);
        },

        getNamespace : function() {
            return this._schema.meta.namespace;
        },

        getPrefix : function() {
            return this._schema.meta.prefix;
        },

        getInfo : function() {
            var info = this._schema.data.info;

            if (info && info.string) {
                return info.string;
            }

            return '';
        },

        getName : function() {
            return this._schema.data.name;
        },

        getQualifiedName : function() {
            return this._schema.data.qname;
        },

        getKeypath : function() {
            return this._schema.meta.keypath;
        },

        // FIXME: Questionable getParentKeypath implementation
        getParentKeypath : function() {
            var kp = this.getKeypath();

            while (kp.length > 0) {
                var ch = kp[kp.length - 1];
                kp = kp.slice(0, -1);

                if (ch === '/') {
                    break;
                }
            }

            return kp;
        },

        isOper : function() {
            return this._schema.data.config === false;
        },

        isConfig : function() {
            return !this.isOper();
        },

        isMandatory : function() {
            return this._schema.data.mandatory === true;
        },

        isLeafRef : function() {
            return this._schema.data.is_leafref === true;
        },

        isActionInput : function() {
            return this._schema.data.is_action_input === true;
        },

        isActionOutput : function() {
            return this._schema.is_action_output === true;
        },

        isPresence : function() {
            return this._schema.data.presence === true;
        },

        isReadOnly : function() {
            var s = this._schema;
            return (s.readonly === true) || (s.access && (s.access.update === false));
        },


        // FIXME : exists probably have no relevance here, i.e. remove it
        exists : function() {
            return this._schema.data.exists === true;
        },

        getRawType : function() {
            return new RawType(this._schema.data.type);
        },


        getTypeInfo : function(typeNamespace, typeName) {
            var _m  = this._schema.meta;
            //var key = this.getNamespace() + ':' + typeName;
            var key = typeNamespace + ':' + typeName;
            var ti  = _m.types[key];

            if (ti !== undefined) {
                return new TypeInfo(ti);
            }

            logger.trace('Unknown type "' + typeName + '" in namespace ' +
                        typeNamespace, this._schema);
        },

        getChildren : function() {
            var ret = [];
            var d = this._schema.data;

            var keypath = this.getKeypath();

            if (_.isArray(d.children)) {
                var ns = this._schema.meta.namespace;
                var prefix = this._schema.meta.prefix;
                ret = this._getChildren(ns, prefix, d.children, keypath);
            }

            return ret;
        },
        getRawChildren : function() {
            return this._schema.data.children;
        },

        rawChildrenToChildren : function(rawChildren) {
            var keypath = this.getKeypath();
            var ns = this._schema.meta.namespace;
            var prefix = this._schema.meta.prefix;

            return this._getChildren(ns, prefix, rawChildren, keypath);
        },

        getChildWithName : function(name) {
            var me = this;
            var ret;

            var kp = this.getKeypath();
            var ns = this._schema.meta.namespace;
            var prefix = this._schema.meta.prefix;

            _.each(this._schema.data.children, function(child) {
                if (child.name === name) {
                    ret = me._getChildInstance(ns, prefix, child, kp);
                    return false;
                }
            });

            return ret;
        },

        getChildrenOfKind : function(kind) {
            var me = this;

            var ret = [];
            var d = this._schema.data;

            if (_.isArray(d.children)) {
                var kp = this.getKeypath();
                var ns = this._schema.meta.namespace;
                var prefix = this._schema.meta.prefix;

                _.each(d.children, function(child) {
                    if (child.kind === kind) {
                        var inst = me._getChildInstance(ns, prefix, child, kp);

                        if (inst) {
                            ret.push(inst);
                        }
                    }
                });
            }

            return ret;
        },

        // Only works for list
        getKeyNames : function() {
            var ret = [];

            var keys = this.getChildrenOfKind('key');
            _.each(keys, function(key) {
                ret.push(key.getName());
            });
            return ret;
        },

        _getChildren : function(namespace, prefix, children, parentKeypath) {
            var me = this;
            var pkp = parentKeypath;
            var ret = [];

            _.each(children, function(child) {
                var inst = me._getChildInstance(namespace, prefix, child, parentKeypath);

                if (inst) {
                    ret.push(inst);
                }
            });

            return ret;
        },

        _getChildInstance : function(namespace, prefix, child, parentKeypath) {
            var args = {
                childSchema   : child,
                namespace     : namespace,
                prefix        : prefix,
                parentKeypath : parentKeypath
            };

            if (child.kind === 'container') {
                return new Container(args);
            } else if (child.kind === 'list') {
                return new List(args);
            } else if (child.kind === 'leaf') {
                return new Leaf(args);
            } else if (child.kind === 'leaf-list') {
                return new LeafList(args);
            } else if (child.kind === 'choice') {
                return new Choice(args);
            } else if (child.kind === 'action') {
                return new Action(args);
            } else if (child.kind === 'key') {
                return new Key(args);
            } else {
                // NOT throwing an error since I wan't to continue for now
                // FIXME: Change to throw in the future.
                console.error('Unknown child kind "' + child.kind + '"', child);
            }
         }

    });

    return Schema;
});



// Exemple of schema instances
//
// Module with children and types
//
//   data: Object
//       children: Array[4]
//           0: Object
//               access: Object
//                   update: true
//               children: Array[2]
//                   0: Object
//                       access: Object
//                           update: true
//                       exists: true
//                       info: Object
//                           string: "User management"
//                       kind: "container"
//                       mandatory: true
//                       name: "authentication"
//                       qname: "aaa:authentication"
//                   1: Object
//                       length: 2
//               exists: true
//               info: Object
//                   string: "AAA management"
//               kind: "container"
//               mandatory: true
//               name: "aaa"
//               qname: "aaa:aaa"
//           1: Object
//           2: Object
//           3: Object
//           length: 4
//       kind: "module"
//   meta: Object
//       namespace: "http://tail-f.com/ns/aaa/1.1"
//       prefix: "aaa"
//       types: Object
//           http://tail-f.com/ns/aaa/1.1:display-level: Array[2]
//               0: Object
//                   name: "http://tail-f.com/ns/aaa/1.1:display-level"
//                   range: Object
//                       value: Array[1]
//                           0: Array[2]
//                               0: "1"
//                               1: "64"
//                               length: 2
//                           length: 1
//               1: Object
//               length: 2
//           http://tail-f.com/ns/aaa/1.1:history: Array[2]
//           http://tail-f.com/ns/aaa/1.1:idle-timeout: Array[2]


//
// Module with no children and no types
//
//   data: Object
//       children: ""
//       kind: "module"
//   meta: Object
//       namespace: "http://tail-f.com/ns/ncs-webui"
//       prefix: "ncs-webui"
//       types: Object


