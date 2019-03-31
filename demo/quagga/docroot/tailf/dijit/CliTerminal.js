define([
    'jquery',
    'lodash',

    'dojo/_base/declare',
    'dojo/dom-construct',
    'dijit/_TemplatedMixin',
    'dijit/layout/ContentPane',

    'tailf/global',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'dojo/text!./templates/CliTerminal.html'
], function(
    $, _,

    declare, domConstruct, _TemplatedMixin,
    ContentPane,

    tailfGlobal,
    logger,
    JsonRpc, JsonRpcHelper,
    template
) {

// FIXME : Cleanup this code
/* jshint eqeqeq:false, curly:false, bitwise:false */

var CliTerminal = declare([ContentPane, _TemplatedMixin], {
    templateString : template,

    destroy : function() {
        this.inherited(arguments);
        this.destroyed = true;
    },

    postCreate : function() {
        var me = this;
        me.inherited(arguments);
    },

    startup : function() {
        var me = this;
        me.inherited(arguments);

        var tc = $($(this.domNode).find('div.terminal-content')[0]);

        tc.keydown(function(e) {
            me.terminal.keyDown(e);
        });

        tc.keypress(function(e) {
            me.terminal.keyPress(e);
        });

        me.terminal = new Terminal({
            callbacks : {
                newData : function(d) {
                    me._newData(d);
                },
                onExit : function () {
                    if(typeof me.onExitCallback === 'function') {
                        me.onExitCallback();
                    }
                }
            }
        });

        $(this.domNode).click(function () {
            tc.focus();
            tc.parent().scrollTop(tc[0].scrollHeight);
        });

        me.terminal.start();

        setTimeout(function() {
            tc.focus();
        }, 500);
    },

    onExitCallback : undefined,
    onShow : function () {
        var me = this;
        if(me.terminal.state === 'stopped') {
            me.terminal.start();

            var tc = $($(this.domNode).find('div.terminal-content')[0]);
            setTimeout(function() {
                tc.focus();
            }, 500);
        }
    },
    onHide : function () {
        var me = this;
        if(me.terminal.stop === 'started') {
            me.terminal.stop();
        }
    },
    _newData : function(d) {
        var tc = $($(this.domNode).find('div.terminal-content')[0]);
        tc.html(d.scrollBuffer + d.terminalScreen);
        tc.parent().scrollTop(tc[0].scrollHeight);
    }

});


// -----------------------------------------------------------------------------
function escSeq(s) {
  return String.fromCharCode( 27 )+ '[' + s;
}
var colors = ['black','red','green','yellow','blue','magenta','cyan','white'];

var keytable = {
    8 :  String.fromCharCode( 8 ),   // Backspace
    9 :  String.fromCharCode( 9 ),   // Tab
    27 : String.fromCharCode( 27 ),  // Escape
    33 : escSeq( '5~' ),             // PgUp
    34 : escSeq( '6~' ),             // PgDn
    35 : escSeq( '4~' ),             // End
    36 : escSeq( '1~' ),             // Home
    37 : escSeq( 'D' ),              // Left
    38 : escSeq( 'A' ),              // Up
    39 : escSeq( 'C' ),              // Right
    40 : escSeq( 'B' ),              // Down
    45 : escSeq( '2~' ),             // Ins
    46 : escSeq( '3~' ),             // Del
    112 : escSeq( '[A' ),            // F1
    113 : escSeq( '[B' ),            // F2
    114 : escSeq( '[C' ),            // F3
    115 : escSeq( '[D' ),            // F4
    116 : escSeq( '[E' ),            // F5
    117 : escSeq( '17~' ),           // F6
    118 : escSeq( '18~' ),           // F7
    119 : escSeq( '19~' ),           // F8
    120 : escSeq( '20~' ),           // F9
    121 : escSeq( '21~' )           // F10
};

var BACKSPACE = 8, TAB = 9, ENTER = 13;
function _decodeData(data) {
    // replace newlines with <br>
    var ptr = 0,
        t = '',
        i = data.indexOf('\n', ptr),
        last = 0,
        cols, flags, tmp, bg, fg;

    while (i >= 0) {
        t += data.substr(ptr, i - ptr);
        ptr = i + 1;
        if (ptr == last + 1) // empty line, have one space at least
            t += ' <br>';
        else
            t += '<br>';
        last = ptr;
        i = data.indexOf('\n', ptr);
    }

    t += data.substr(ptr);
    data = t;
    // replace space with &#160;
    ptr = 0;
    t = '';
    i = data.indexOf(' ', ptr);
    while (i >= 0) {
        t += data.substr(ptr, i - ptr);
        ptr = i + 1;
        t += '&';
        t += '#160;';
        i = data.indexOf(' ', ptr);
    }

    t += data.substr(ptr);
    data = t;
    // replace our tags <sXX> with proper style tags
    ptr = 0;
    t = '';
    i = data.indexOf('<s', ptr);
    while (i >= 0) {
        t += data.substr(ptr, i - ptr);
        cols = parseInt(data.substr(i + 2, 2), 16);
        flags = parseInt(data.substr(i + 4, 2), 16);
        ptr = i + 7;
        t += '<span style="';
        bg = colors[(cols & 0x0f)];
        fg = colors[((cols & 0xf0) >> 4)];
        if (flags & 0x10) fg = bg;
        if (flags & 0x8) {
            tmp = bg;
            bg = fg;
            fg = tmp;
        }
        if (flags & 0x2) t += 'text-decoration:underline;';
        if (flags & 0x4) t += 'text-decoration:blink;';
        if (flags & 0x1) t += 'font-weight:bold;';
        t += 'color:' + fg + ';';
        t += 'background-color:' + bg + ';">';
        i = data.indexOf('<s', ptr);
    }
    t += data.substr(ptr);
    // finally replace cursor tag <c> and end tag </s>
    t = t.replace(/<c>/g, '<span id="cursor">');
    t = t.replace(/<\/s>/g, '</span>');
    return t;
  }


function Terminal(args) {
    this.handle = undefined;
    this.state = 'stopped';
    this.scrollBuffer = '';
    this.terminalScreen = '';
    this.termKeys = '';
    this.callbacks = args.callbacks;
    this.sendingKeys = false;
}

Terminal.prototype.start = function() {
    var me = this;
    var events = tailfGlobal.getEvents();
    if(me.state === 'stopped') {
        JsonRpcHelper.read().done(function(th) {
            me.state = 'starting';
            JsonRpc('init_cmd', {
                th   : th,
                name : 'cli',
                scroll : 300,
                args : '',
                comet_id : events.cometId,
                emulate : true
            }).done(function(result) {
                me.handle = result.handle;

                events.comet.setCallback(me.handle, function(data) {
                    me._newDataFromServer(data);
                });

                JsonRpc('start_cmd', {
                    handle : me.handle
                }).done(function(result) {
                    me.state = 'started';
                }).fail(function(err) {
                    logger.error('start_cmd : err=', err);
                });
            }).fail(function(err) {
                logger.error('init_cmd : err=', err);
            });
        });
    }
};

Terminal.prototype.stop = function() {
    var me = this;
    var events = tailfGlobal.getEvents();

    if(me.state === 'started') {
        JsonRpc('stop_cmd', {
            handle : me.handle
        }).done(function() {
            events.comet.removeCallback(me.handle);
            me.terminalScreen = '';
            me.scrollBuffer = '';
            me.state = 'stopped';
        }).fail(function(err) {
            //FIXME Crashes on 'exit' command. JsonRpc bug? Remove rows below when fixed.
            logger.error('stop_cmd : err=', err);
            me.terminalScreen = '';
            me.scrollBuffer = '';
            me.state = 'stopped';
        });
    }
};

Terminal.prototype.suspend = function() {
    var me = this;
    JsonRpc('suspend_cmd', {
        handle : me.handle
    });
};

Terminal.prototype.resume = function() {
    var me = this;
    JsonRpc('resume_cmd', {
        handle : me.handle
    });
};

Terminal.prototype.keyDown = function(e) {
    /* jshint maxcomplexity:25 */
    var jqueryEvent = e;

    var key, keyCode, ret;

    keyCode = jqueryEvent.keyCode;
    if (keyCode === 38) {
      // Prevent IE from scrolling up
      jqueryEvent.preventDefault();
      jqueryEvent.stopPropagation();
    }
    key = keytable[keyCode];
    if (key === undefined) {
      // Handle enter in IE
      if (document.all && keyCode == ENTER) {
        jqueryEvent.preventDefault();
        jqueryEvent.stopPropagation();
        this.processKey(String.fromCharCode(keyCode));
        return;
      }
      // Corner case: Neither CTRL nor ALT but keyCode
      // indicates that it is either, then the event is
      // simply left alone.
      if (
        !(jqueryEvent.ctrlKey || jqueryEvent.altKey ) &&
         (keyCode == 17 ||keyCode == 18)
      ) {
        return;
      }
      if (jqueryEvent.altKey) {
        return; // alt key combos handled in keyPress
      } else if (jqueryEvent.shiftKey) {
        if (keyCode == 219) {
            key = String.fromCharCode(0); // Ctrl-@
        } else if (keyCode == 54) {
            key = String.fromCharCode(30);  // Ctrl-^
        } else if (keyCode == 109) {
            key = String.fromCharCode(31); // Ctrl-_
        }
      } else if (jqueryEvent.ctrlKey) {
        if (keyCode >= 65 && keyCode <= 90) {
          key = String.fromCharCode(keyCode - 64); // Ctrl-A..Z
        } else if (keyCode == 32) {
            key = String.fromCharCode(0); // Ctrl-@
        } else if (keyCode == 219) {
            key = String.fromCharCode(27); // Ctrl-[
        } else if (keyCode == 220) {
            key = String.fromCharCode(28); // Ctrl-\   .
        } else if (keyCode == 221) {
            key = String.fromCharCode(29); // Ctrl-]
        }
        jqueryEvent.preventDefault();
        jqueryEvent.stopPropagation();
      }
    }
    if (keyCode === BACKSPACE || keyCode === TAB) {
      jqueryEvent.stopPropagation();
      jqueryEvent.preventDefault();
    }
    if (key !== undefined) {
      this.processKey(key);
    } else if (String.fromCharCode(keyCode) == ' ') {
      // Handle space
      jqueryEvent.stopPropagation();
      jqueryEvent.preventDefault();
      this.processKey(' ');
    }
};

Terminal.prototype.keyPress = function(e) {
    /* jshint -W041 */
    var jqueryEvent = e;
    var key, keyCode;
    jqueryEvent.stopPropagation();
    jqueryEvent.preventDefault();
    if (
      jqueryEvent.ctrlKey ||
      jqueryEvent.which == 0 || jqueryEvent.keyCode == 8
    ) {
      return;
    }
    if (jqueryEvent.keyCode) keyCode = jqueryEvent.keyCode;
    if (jqueryEvent.which) keyCode = jqueryEvent.which;
    key = String.fromCharCode(keyCode);
    this.processKey(key);
};

Terminal.prototype.processKey = function(key) {
    this.termKeys += key;
    if (!this.sendingKeys) {
      this.sendKeys();
    }
};

Terminal.prototype.sendKeys = function() {
    var me = this, keys;

    me.sendingKeys = true;
    keys = me.termKeys;
    me.termKeys = '';

    JsonRpc('send_cmd_data', {
        handle : me.handle,
        data   : keys
    }).done(function() {
        me.sendingKeys = false;
        if (me.termKeys !== '') {
          me.sendKeys();
        }
    }).fail(function(err) {
        logger.error('sendKeys : err=', err);
    });
};

Terminal.prototype._newDataFromServer = function(data) {
    var me = this;

    if (data.stopped) {
        me.stop();
        me.callbacks.onExit();
    } else {

        if (data.startsWith('<scroll>')) {
            data = _decodeData(data.substring(8));
            me.scrollBuffer += data;
        } else {
            me.terminalScreen = _decodeData(data);
        }

        if (me.callbacks && _.isFunction(me.callbacks.newData)) {
            me.callbacks.newData({
                scrollBuffer   : me.scrollBuffer,
                terminalScreen : me.terminalScreen
            });
        }
    }
};

return CliTerminal;

});
