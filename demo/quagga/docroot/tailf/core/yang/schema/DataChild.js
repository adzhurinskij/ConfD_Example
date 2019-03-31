define('tailf/core/yang/schema/DataChild', [
    'lodash',
    'Class',
    './RawType',

    'tailf/core/logger'
], function(_, Class, RawType, logger) {

    var DataChild = Class.extend({

        /*
         * args = {
         *  childSchema : schema for child
         *  namespace   : ...
         *  prefix      : ...
         *  parentKeypath : ...
         * }
         */
        init : function(args) {
            this._schema = args.childSchema;
            this.namespace = args.namespace;
            this.prefix = args.prefix;
            this.parentKeypath = args.parentKeypath;
        },

        getDeps : function() {
            var deps = this._schema.deps;
            if (deps && Array.isArray(deps) && deps.length > 0) {
                return deps;
            }
            return undefined;
        },

        getNamespace : function() {
            return this.namespace;
        },

        getPrefix : function() {
            return this.prefix;
        },

        getKind : function() {
            return this._schema.kind;
        },

        getName : function() {
            return this._schema.name;
        },

        getQualifiedName : function() {
            return this._schema.qname;
        },

        // FIXME: Questionable usage of getQualifiedName, what to do?
        getKeypath : function() {
            var name = this.getQualifiedName();

            if (name === undefined) {
                name = this.getName();
            }

            if (this._schema.__client__ && this._schema.__client__.parentKeypath) {
                return this._schema.__client__.parentKeypath + '/' + name;
            } else {
                return this.parentKeypath + '/' + name;
            }
        },

        getKeypath2 : function() {
            var name = this.getName();

            if (this._schema.__client__ && this._schema.__client__.parentKeypath) {
                return this._schema.__client__.parentKeypath + '/' + name;
            } else {
                return this.parentKeypath + '/' + name;
            }
        },

        getInfo : function() {
            var info = this._schema.info;
            if (info && info.string) {
                return info.string;
            }

            return '';
        },

        getRawType : function() {
            return new RawType(this._schema.type);
        },

        isMandatory : function() {
            return this._schema.mandatory === true;
        },

        isOperational : function() {
            return this._schema.config === false;
        },

        isLeafRef : function() {
            return this._schema.is_leafref === true;
        },

        getLeafRefTarget : function() {
            return this._schema.leafref_target;
        },

        getWhenTargets : function() {
            return this._schema.when_targets;
        },

        // FIXME : Maybe add an isAccessReadonly instead
        isReadOnly : function() {
            var s = this._schema;
            if(s.readonly === true) {
                return true;
            }

            if(s.access && (s.access.create === true || s.access.update === true)) {
                return false;
            }

            if(s.access && (s.access.create === false && s.access.update === false)) {
                return true;
            }

            return false;
        },

        // FIXME : exists probably have no relevance here, i.e. remove it
        exists : function() {
            return this._schema.exists === true;
        },

        getEvaluatedWhen : function() {
            return this._schema.evaluated_when_entry;
        },

        isActionInput : function() {
            return this._schema.is_action_input === true;
        },

        isActionOutput : function() {
            return this._schema.is_action_output === true;
        },

        isPresence : function() {
            return this._schema.presence === true;
        },

        suppressEcho : function() {
            return this._schema.suppress_echo === true;
        },

        getRawChildren : function() {
            return this._schema.children;
        }
     });

    return DataChild;
});

