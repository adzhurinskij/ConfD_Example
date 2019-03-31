// Based on dojox/lyaout/FloatingPane
define([
    'dojo/_base/kernel',
    'dojo/_base/lang',
    'dojo/_base/window',
    'dojo/_base/declare',
    'dojo/_base/fx',
    'dojo/_base/connect',
    'dojo/_base/array',
    'dojo/_base/sniff',
    'dojo/window',
    'dojo/dom',
    'dojo/dom-class',
    'dojo/dom-geometry',
    'dojo/dom-construct',
    'dijit/_TemplatedMixin',
    'dijit/_Widget',
    'dijit/BackgroundIframe',
    'dojo/dnd/Moveable',

    'dojox/layout/ContentPane',
    'dojox/layout/ResizeHandle',

    'tailf/core/logger',
    'dojo/text!./templates/FloatingPane.html'
], function(
    kernel, lang, winUtil, declare, baseFx, connectUtil, arrayUtil,
    has, windowLib, dom, domClass, domGeom, domConstruct,
    TemplatedMixin, Widget, BackgroundIframe,
    Moveable, ContentPane, ResizeHandle,
    logger,
    template
){
var _allFPs = [];
var _startZ = 100;


var FloatingPane = declare([ ContentPane, TemplatedMixin ],{
    // summary:
    //      A non-modal Floating window.
    // description:
    //      Makes a `dojox.layout.ContentPane` float and draggable by it's title [similar to TitlePane]
    //      and over-rides onClick to onDblClick for wipeIn/Out of containerNode
    //      provides minimize(dock) / show() and hide() methods, and resize [almost]

    // closeDestroy : Boolean
    //  true  : Destroy when closed
    //  false : Hide when closed
    closeDestroy : true,

    // closable: Boolean
    //      Allow closure of this Node
    closable: true,

    // resizable: Boolean
    //      Allow resizing of pane true if true
    resizable: false,

    // resizeAxis: String
    //      One of: x | xy | y to limit pane's sizing direction
    resizeAxis: "xy",

    // title: String
    //      Title to use in the header
    title: "",

    // duration: Integer
    //      Time is MS to spend toggling in/out node
    duration: 400,

    // Auto center position, x and y in window size fraction
    autoPos : {
        x : 0.5,
        y : 0.5
    },

    // Noise in autoPos x/y position
    jiggle : {
        x : 40,
        y : 40
    },

    // contentClass: String
    //      The className to give to the inner node which has the content
    contentClass: "dojoxFloatingPaneContent",


    onDestroy : undefined,
    onHideCallback : undefined,
    onShowCallback : undefined,

    // animation holders for toggle
    _showAnim: null,
    _hideAnim: null,

    // privates:
    templateString: template,

    attributeMap: lang.delegate(Widget.prototype.attributeMap, {
        title: { type:"innerHTML", node:"titleNode" }
    }),

    create : function(args) {
        if (!args.style) {
            args.style = '';
        }

        args.style += 'position:absolute:z-index:1';

        this.inherited(arguments);
    },

    postCreate: function(){
        this.inherited(arguments);

       if (this.autoPos) {
           this._autoPos(this.autoPos, this.jiggle);
       }

        new Moveable(this.domNode,{ handle: this.focusNode });
        //this._listener = dojo.subscribe("/dnd/move/start",this,"bringToTop");

        if(!this.closable){ this.closeNode.style.display = "none"; }
        if(!this.resizable){
            this.resizeHandle.style.display = "none";
        }else{
            this.domNode.style.width = domGeom.getMarginBox(this.domNode).w + "px";
        }

        _allFPs.push(this);
        this.domNode.style.position = "absolute";

        this.bgIframe = new BackgroundIframe(this.domNode);
        this._naturalState = domGeom.position(this.domNode);
    },

    _autoPos : function(ap, jiggle) {
        var pos = dojo.window.getBox();
        var wx = pos.w;
        var wy = pos.h;

        var dx = Math.floor(wx * ap.x);
        var dy = Math.floor(wy * ap.y);

        var x = (wx - dx) / 2;
        var y = (wy - dy) / 2;

        function _rnd(minV, maxV) {
            return Math.floor(minV + Math.random() * (maxV - minV));
        }

        if (jiggle) {
            x += _rnd(-jiggle.x, jiggle.x);
            y += _rnd(-jiggle.y, jiggle.y);
        }

        dojo.style(this.domNode, {
            top    : y + 'px',
            left   : x + 'px',
            width  : dx + 'px',
            height : dy + 'px'
        });
    },

    startup: function(){
        if(this._started){ return; }

        this.inherited(arguments);

        if(this.resizable){
            if (has("ie")){
                this.canvas.style.overflow = "auto";
            } else {
                this.containerNode.style.overflow = "auto";
            }

            this._resizeHandle = new ResizeHandle({
                targetId: this.id,
                resizeAxis: this.resizeAxis
            },this.resizeHandle);

        }

        this.connect(this.focusNode,"onmousedown","bringToTop");
        this.connect(this.domNode,  "onmousedown","bringToTop");

        // Initial resize to give child the opportunity to lay itself out
        this.resize(domGeom.position(this.domNode));

        this._started = true;
    },

    setTitle: function(/* String */ title){
        // summary:
        //      Update the Title bar with a new string
        kernel.deprecated("pane.setTitle", "Use pane.set('title', someTitle)", "2.0");
        this.set("title", title);
    },

    getContentNode : function() {
        return $(this.domNode).find('.dojoxFloatingPaneContent')[0];
    },

    hideOrDestroy : function() {
        if (this.closeDestroy) {
            this.close();
        } else {
            this.hide();
        }
    },

    close : function(){
        // summary:
        //      Close and destroy this widget
        if(!this.closable){ return; }
        connectUtil.unsubscribe(this._listener);
        this.hide(lang.hitch(this,function(){
            this.destroyRecursive();
        }));
    },

    hide: function(/* Function? */ callback){
        // summary:
        //      Close, but do not destroy this FloatingPane
        baseFx.fadeOut({
            node:this.domNode,
            duration:this.duration,
            onEnd: lang.hitch(this,function() {
                this.domNode.style.display = "none";
                this.domNode.style.visibility = "hidden";
                if (typeof callback === 'function') { callback(); }
                if (typeof this.onHideCallback === 'function') { this.onHideCallback(); }
            })
        }).play();
    },

    show: function(/* Function? */callback){
        // summary:
        //      Show the FloatingPane
        var anim = baseFx.fadeIn({node:this.domNode, duration:this.duration,
            beforeBegin: lang.hitch(this,function(){
                this.domNode.style.display = "";
                this.domNode.style.visibility = "visible";
                if (typeof callback == "function") { callback(); }
                if (typeof this.onShowCallback === 'function') { this.onShowCallback(); }
                this._isDocked = false;
            })
        }).play();
        // use w / h from content box dimensions and x / y from position
        var contentBox = domGeom.getContentBox(this.domNode);
        this.resize(lang.mixin(domGeom.position(this.domNode), {w: contentBox.w, h: contentBox.h}));
        this._onShow(); // lazy load trigger
    },

    resize: function(/* Object */dim){
        // summary:
        //      Size the FloatingPane and place accordingly
        dim = dim || this._naturalState;
        this._currentState = dim;

        // From the ResizeHandle we only get width and height information
        var dns = this.domNode.style;
        if("t" in dim){ dns.top = dim.t + "px"; }
        else if("y" in dim){ dns.top = dim.y + "px"; }
        if("l" in dim){ dns.left = dim.l + "px"; }
        else if("x" in dim){ dns.left = dim.x + "px"; }
        dns.width = dim.w + "px";
        dns.height = dim.h + "px";

        // Now resize canvas
        var mbCanvas = { l: 0, t: 0, w: dim.w, h: (dim.h - this.focusNode.offsetHeight) };
        domGeom.setMarginBox(this.canvas, mbCanvas);

        // If the single child can resize, forward resize event to it so it can
        // fit itself properly into the content area
        this._checkIfSingleChild();
        if(this._singleChild && this._singleChild.resize){
            this._singleChild.resize(mbCanvas);
        }
    },

    bringToTop: function(){
        // summary:
        //      bring this FloatingPane above all other panes

        var windows = arrayUtil.filter(
            _allFPs,
            function(i){
                return i !== this;
            },
        this);
        windows.sort(function(a, b){
            return a.domNode.style.zIndex - b.domNode.style.zIndex;
        });
        windows.push(this);

        arrayUtil.forEach(windows, function(w, x){
            w.domNode.style.zIndex = _startZ + (x * 2);
            domClass.remove(w.domNode, "dojoxFloatingPaneFg");
        }, this);
        domClass.add(this.domNode, "dojoxFloatingPaneFg");
    },

    destroy: function(){
        if (_.isFunction(this.onDestroy)) {
            this.onDestroy();
        }

        // summary:
        //      Destroy this FloatingPane completely
        _allFPs.splice(arrayUtil.indexOf(_allFPs, this), 1);
        if(this._resizeHandle){
            this._resizeHandle.destroy();
        }
        this.inherited(arguments);
    }
});

return FloatingPane;
});
