define('tailf/dijit/schema/KeypathEditor', [
    'jquery',
    'lodash',
    'Class',

    'dojo/_base/declare',
    'dojo/dom-construct',
    'dijit/_TemplatedMixin',
    'dijit/layout/ContentPane',

    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/keypath/kp-parser',

    'tailf/dijit/schema/icon-class',

    'dojo/text!./templates/KeypathEditor.html'
], function(
    $, _, Class,

    declare, domConstruct, _TemplatedMixin,

    ContentPane,

    logger,
    JsonRpc, JsonRpcHelper,
    KeypathParser,

    IconClass,

    template
) {

function _trace() {
    //logger.tracePrefix('KeypathEditor : ', arguments);
}

var KeypathEditor = declare([ContentPane, _TemplatedMixin], {
    templateString : template,

    constructor : function(args) {
        _.bindAll(this, [
            '_editorShowHint'
        ]);

        this.callbacks = args.callbacks;
    },

    destroy : function() {
        _trace('destroy');

        this._unregisterEditorEvents();

        this.inherited(arguments);
        this.destroyed = true;
    },

    postCreate : function() {
        var me = this;

        this.inherited(arguments);

        setTimeout(function() {
            me._initEditorWidget();
        });
    },

    setKeypath : function(keypath) {
        var me = this;
        setTimeout(function() {
            me.editor.setValue(keypath);
            me.editor.setCursor(keypath.length);
        }, 100);
    },

    getKeypath : function() {
        return this.editor.getValue();
    },

    focus : function() {
        this.editor.focus();
    },

    _initEditorWidget : function() {
        var me = this;

        //me.hintData = new HintDataSimple();
        me.hintData = new HintDataParser();

        function _onEnter() {
            var keypath = editor.getLine(0);

            if (me.callbacks && _.isFunction(me.callbacks.keypathSelected)) {
                me.callbacks.keypathSelected(keypath);
            }
        }

        var textArea = $(this.domNode).find('textarea')[0];

        var editor = CodeMirror.fromTextArea(textArea, {
            //mode: "xml",
            mode: 'tailf-keypath',
            lineNumbers: false,

            extraKeys: {
                'Enter' : function () {
                    _onEnter();
                }
            }
        });

        me.editor = editor;
        me._registerEditorEvents();
   },

    _registerEditorEvents : function() {
        var e = this.editor;
        e.on('change', this._editorShowHint);
    },

    _unregisterEditorEvents : function() {
        var e = this.editor;
        e.off('change', this._editorShowHint);
    },

    _editorShowHint : function(cm) {
        var me = this;

        if (me.initialSetValue) {
            me.initialSetValue = false;
            return;
        }

        function _hint(cm, callback, d) {
            var cur = cm.getCursor();
            var line = cm.getLine(cur.line);

            me.hintData.getHintsFromLine(line).done(function(hints) {
                var names = [];
                var removePrefix = '';

                if (hints.lastPrefix && (hints.lastPrefix.length > 0)) {
                    removePrefix = hints.lastPrefix;
                }

                _.each(hints.items, function(h) {
                    var name = h.qname;
                    name = name.replace(removePrefix, '');

                    var displayText = name;
                    var text = name;

                    if (h.kind !== 'key-value') {
                        displayText += ' - ' + h.kind;
                    }

                    if (h.kind === 'list') {
                        text = text + '{';
                    } else if (h.kind === 'container') {
                        text = text + '/';
                    } else if (h.kind === 'key-value') {
                        text = text + '}';
                    }

                    names.push({
                        cmp         : name,
                        kind        : h.kind,
                        text        : text,
                        displayText : displayText,
                        render      : function(element, _self, data) {
                            me._renderOneHint(element, _self, data);
                        }
                    });
                });

                names.sort(function(a,b) {return a.cmp < b.cmp ? -1 : 1;});

                var tokenStart = cur.ch;
                while (tokenStart > 0) {
                    var ch = line[tokenStart];

                    if ((ch === '/') || (ch === ':') || (ch === '{')) {
                        tokenStart += 1;
                        break;
                    }

                    tokenStart -= 1;
                }

                var Pos = CodeMirror.Pos;

                var ret = {
                    list : names,
                    from : Pos(cur.line, tokenStart),
                    to   : cur
                };

                callback(ret);
            });
        }
        _hint.async = true;

        setTimeout(function() {
              if (!cm.state.completionActive) {
                cm.showHint({
                    completeSingle: false,
                    closeCharacters: /[\s()\[\]{};>,]/,
                    hint : _hint
                });
              }
        }, 100);
     },

    _renderOneHint : function(element, _self, data) {
        var iconClass = IconClass.kindToClass(data.kind);

        if (data.kind === 'key-value') {
            $(element).append(
                $('<div>').text(data.displayText)
            );
        } else {
            $(element).append(
                $('<div>').append(
                    $('<div>').addClass('hint-icon ' + iconClass),
                    $('<div>').addClass('hint-text').append(
                        $('<span>').text(data.displayText)
                    )
                )
            );
        }
    }

});


// ----------------------------------------------------------------------------

CodeMirror.defineMode('tailf-keypath', function() {

    function _getToken(parseResult, col) {
        var ret = 'kp-err';

        _.each(parseResult.tokens, function(t) {
            if ((t.offset <= col) && (col < (t.offset + t.text.length))) {
                if (t.type === '/') {
                    ret = 'kp-slash';
                } else if (t.type === ':') {
                    ret = 'kp-colon';
                } else if ((t.type === '{') || (t.type === '}')) {
                    ret = 'kp-curly';
                } else if (t.type === 'name') {
                    ret =  'kp-name';
                } else if (t.type === 'ns') {
                    ret = 'kp-ns';
                } else if (t.type === 'key') {
                    ret = 'kp-key';
                }

                if (ret !== null) {
                    return false;
                }
            }
        });

        return ret;
    }

    return {
        startState : function() {
            return {
                parsed : false,
                parseResult : undefined
            };
        },

        token : function(stream, state) {
            if (!state.parsed) {
                state.parseResult = KeypathParser.parse(stream.string);
                state.parsed = true;
            }

            //logger.debug('token : stream=', stream);
            //logger.debug('token : column = ' + stream.column() + ' : stream.peek() = ', stream.peek());

            var token = _getToken(state.parseResult, stream.column());
            stream.next();

            return token;

            /*
            if (stream.peek() === '/') {
                stream.next();
                return 'string';
            } else {
                stream.next();
                return null;
            }
            */
         }
    };
});

/*
      // If a string starts here
      if (!state.inString && stream.peek() == '"') {
        stream.next();            // Skip quote
        state.inString = true;    // Update state
      }

      if (state.inString) {
        if (stream.skipTo('"')) { // Quote found on this line
          stream.next();          // Skip quote
          state.inString = false; // Clear flag
        } else {
           stream.skipToEnd();    // Rest of line is string
        }
        return "string";          // Token style
      } else {
        stream.skipTo('"') || stream.skipToEnd();
        return null;              // Unstyled token
      }
    }
*/


// ----------------------------------------------------------------------------

var HintModelHelper = function() {
};

HintModelHelper.prototype.getTopItemsTh = function(th) {
    var me = this;
    var deferred = $.Deferred();

    JsonRpc('get_system_setting', {operation : 'namespaces'}).done(function(result) {
        var whenArgs = [];
        _.each(result, function(ns) {
            whenArgs.push(me._getOneNamespaceTopItemsTh(th, ns));
        });

        JsonRpcHelper.whenArray(whenArgs).done(function (result) {
            var ret = [];
            _.each(result, function(nsItems) {
                _.each(nsItems, function(item) {
                    ret.push(item);
                });
            });

            deferred.resolve(ret);
        });
    });

    return deferred.promise();
};

HintModelHelper.prototype._getOneNamespaceTopItemsTh = function(th, namespace) {
    var me = this;
    var deferred = $.Deferred();

    JsonRpc('get_schema', {
        th            : th,
        namespace     : namespace,
        levels        : 1,
        insert_values : false,
        evaluate_when_entries : true
    }).done(function(result) {
        deferred.resolve(me._getSchemaResult(result));
    }).fail(function(err) {
        deferred.reject(err);
    });

    return deferred.promise();
};

HintModelHelper.prototype.getModelKeypathItemsTh = function(th, keypath) {
    var me = this;
    var deferred = $.Deferred();

    JsonRpc('get_schema', {
        th            : th,
        path          : keypath,
        levels        : 1,
        insert_values : false,
        evaluate_when_entries : true
    }).done(function(result) {
        deferred.resolve(me._getSchemaResult(result));
    }).fail(function(err) {
        logger.error('_getModelKeypathItemsTh : err=', err);
        deferred.resolve([]);
    });

    return deferred.promise();
};

HintModelHelper.prototype.getListKeypathItemsTh = function(th, keypath) {
    var deferred = $.Deferred();

    JsonRpcHelper.getListKeys(th, keypath, true).done(function(result) {
        var ret = [];

        _.each(result, function(res) {
            var name = '';

            _.each(res, function(key) {
                if (name.length > 0) {
                    name += ' ';
                }

                name += key;
            });

            ret.push({
                kind : 'key-value',
                name : name,
                qname : name
            });
        });

        deferred.resolve(ret);
    }).fail(function(err) {
        deferred.resolve([]);
    });

    return deferred.promise();
};

HintModelHelper.prototype._getSchemaResult = function(schema) {
    var ret = [];

    _.each(schema.data.children, function(stmt) {
        var ewe = stmt.evaluated_when_entry;

        if ((ewe === undefined) || (ewe === true)) {
            ret.push({
                kind  : stmt.kind,
                name  : stmt.name,
                qname : stmt.qname
            });
        }
    });

    return ret;
};


// ----------------------------------------------------------------------------

var HintDataParser = Class.extend({

    init : function() {
        this.currentKeypath = undefined;
        this.currentItems = undefined;

        this.hmh = new HintModelHelper();
    },

    getHintsFromLine : function(line) {
        var me = this;
        var deferred = $.Deferred();

        var parseResult = KeypathParser.parse(line);
        var tokens = parseResult.tokens;

        if (tokens.length === 0) {
            deferred.resolve([]);
        } else {
            this._getHintsFromTokens(tokens).done(function(items) {
                deferred.resolve(items);
            }).fail(function(err) {
                logger.error('getHintsFromLine : err=', err);
                deferred.resolve([]);
            });
        }

        return deferred.promise();
    },

    /* jshint maxcomplexity:12 */
    _getTokenSearchInfo : function(tokens) {
        var keypath = '';
        var match = '';
        var matchPrefix = '';

        if ((tokens.length === 0) || (tokens.length === 1)) {
            keypath = '/';
        } else {
            var t1 = tokens[tokens.length - 1];
            var spliceIx = tokens.length - 1;

            /*jshint noempty: false */
            if ((tokens.length === 2) && (t1.type === 'name')) {
                match = t1.text;
            } else if (t1.type === '/') {
                spliceIx += 1;
                matchPrefix = KeypathParser.getLastNamespace(tokens) + ':';
            } else if (t1.type === '{') {
            } else if (tokens.length > 1) {
                var t2 = tokens[tokens.length - 2];
                //logger.debug('t2=', t2);

                matchPrefix = KeypathParser.getLastNamespace(tokens) + ':';

                if ((t2.type === '/') && (t1.type === 'name')) {
                    // FIXME : Add spliceIx -= 1 ?
                    match = matchPrefix + t1.text;
                } else if ((t2.type === 'ns') && (t1.type === ':')) {
                    spliceIx -= 1;
                    match = t2.text + t1.text;
                } else if ((t2.type === '{') && (t1.type === 'key')) {
                    // FIXME: Handle multiple keys
                    match = t1.text;
                    matchPrefix = '';
                    spliceIx -= 1;
                } else if (tokens.length > 2) {
                    var t3 = tokens[tokens.length - 3];
                    //logger.debug('t3=', t3);

                    if ((t3.type === 'ns') && (t2.type === ':') && (t1.type === 'name')) {
                        spliceIx -= 2;
                        match = t3.text + t2.text + t1.text;
                    }
                }

            } else {
                // FIXME: Is this really needed?
                match = t1.text;
            }

            keypath = KeypathParser.tokensToStr(tokens.slice(0, spliceIx));
       }

        return {
            keypath     : keypath,
            match       : match,
            matchPrefix : matchPrefix
        };
    },

    _getHintsFromTokens : function(tokens) {
        var me = this;
        var deferred = $.Deferred();
        var si = me._getTokenSearchInfo(tokens);

        if (si.keypath === me.currentKeypath) {
            deferred.resolve(me._filter(me.currentItems, tokens, si));
        } else {
            me._getTokenItemsFromModel(si.keypath, tokens).done(function(items) {
                me.currentKeypath = si.keypath;
                me.currentItems = items;

                deferred.resolve(me._filter(items, tokens, si));
            }).fail(function(err) {
                logger.error('_getHintsFromTokens : err=', err);
                deferred.resolve([]);
            });
        }

        return deferred.promise();
    },

    _filter : function(items, tokens, searchInfo) {
        var cmpValue = searchInfo.match;
        var cmpPrefix = searchInfo.matchPrefix;

        var ret = {
            lastPrefix : cmpPrefix,
            items      : []
        };

        function _match(item, cmp) {
            return item.substr(0, cmp.length) === cmp;
        }

        _.each(items, function(item) {
            if ((cmpValue === '') || _match(item.qname, cmpValue)) {
                ret.items.push(item);
            }
        });

        return ret;
    },

    _getTokenItemsFromModel : function(keypath, tokens) {
        var me = this;
        var deferred = $.Deferred();

        JsonRpcHelper.read().done(function(th) {
            me._getTokenItemsFromModelTh(th, keypath, tokens).done(function(items) {
                deferred.resolve(items);
            });
        });

        return deferred.promise();
    },

    _getTokenItemsFromModelTh : function(th, keypath, tokens) {
        logger.trace('_getTokenItemsFromModelTh : keypath=' + keypath + ' : tokens=', tokens);

        if (tokens.length === 1) {
            // Only '/'
            return this.hmh.getTopItemsTh(th);
        } else {
            var t1 = tokens[tokens.length - 1];
            logger.trace('t1 = ', t1);

            if (t1.type === '/') {
                return this.hmh.getModelKeypathItemsTh(th, keypath);
            } else if (t1.type === '{') {
                return this.hmh.getListKeypathItemsTh(th, keypath);
            } else {
                var t2 = tokens[tokens.length - 2];

                if ((t2.type === '{') && (t1.type === 'key')) {
                    return this.hmh.getListKeypathItemsTh(th, keypath);
                }
            }

            return $.Deferred().resolve([]).promise();
        }
    }

});

return KeypathEditor;

});



