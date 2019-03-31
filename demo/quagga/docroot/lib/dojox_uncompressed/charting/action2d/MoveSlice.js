define(["dojo/_base/connect", "dojo/_base/declare", "dojo/_base/array", "./PlotAction", "dojo/fx/easing", "dojox/gfx/matrix",
	"dojox/gfx/fx", "dojox/lang/functional", "dojox/lang/functional/scan", "dojox/lang/functional/fold"],
	function(hub, declare, array, PlotAction, dfe, m, gf, df){

	/*=====
	var __MoveSliceCtorArgs = {
			// summary:
			//		Additional arguments for move slice actions.
			// duration: Number?
			//		The amount of time in milliseconds for an animation to last.  Default is 400.
			// easing: dojo/fx/easing/*?
			//		An easing object (see dojo.fx.easing) for use in an animation.  The
			//		default is dojo.fx.easing.backOut.
			// scale: Number?
			//		The amount to scale the pie slice.  Default is 1.05.
			// shift: Number?
			//		The amount in pixels to shift the pie slice.  Default is 7.
	};
	=====*/
	
	var DEFAULT_SCALE = 1.05,
		DEFAULT_SHIFT = 7;	// px

	return declare("dojox.charting.action2d.MoveSlice", PlotAction, {
		// summary:
		//		Create an action for a pie chart that moves and scales a pie slice.

		// the data description block for the widget parser
		defaultParams: {
			duration: 400,	// duration of the action in ms
			easing:   dfe.backOut,	// easing for the action
			scale:    DEFAULT_SCALE,	// scale of magnification
			shift:    DEFAULT_SHIFT		// shift of the slice
		},
		optionalParams: {},	// no optional parameters

		constructor: function(chart, plot, kwArgs){
			// summary:
			//		Create the slice moving action and connect it to the plot.
			// chart: dojox/charting/Chart
			//		The chart this action belongs to.
			// plot: String?
			//		The plot this action is attached to.  If not passed, "default" is assumed.
			// kwArgs: __MoveSliceCtorArgs?
			//		Optional keyword arguments object for setting parameters.
			if(!kwArgs){ kwArgs = {}; }
			this.scale = typeof kwArgs.scale == "number" ? kwArgs.scale : DEFAULT_SCALE;
			this.shift = typeof kwArgs.shift == "number" ? kwArgs.shift : DEFAULT_SHIFT;

			this.connect();
			
			// This is a listener to try and help with pushing slices back in if the mouse
			// leaves the chart node, but the browser itself didn't fire a omouseout
			// on the slice in question.  This can happen with fast mouse movements
			// and cause missing events, and thus leave 'hung' slices sometimes.
			if(chart && chart.node){
				this._nodeL = hub.connect(chart.node, "onmouseout", this, function(evt){
					if(this.anim){
						var idx;
						for(idx in this.anim){
							var animObj = this.anim[idx];
							if(animObj.dir !== "in"){
								animObj.action.stop(true);
								this.anim[idx] = {dir: "in"};
								var angle = (this.angles[animObj.index] + this.angles[animObj.index + 1]) / 2;
								var rotateTo0  = m.rotateAt(-angle, animObj.cx, animObj.cy);
								var rotateBack = m.rotateAt( angle, animObj.cx, animObj.cy);
								this.anim[idx].action = gf.animateTransform({
									shape:    animObj.shape,
									duration: this.duration,
									easing:   this.easing,
									transform: [
										rotateBack,
										{name: "translate", start: [this.shift, 0], end: [0, 0]},
										{name: "scaleAt",   start: [this.scale, animObj.cx, animObj.cy],  end: [1, animObj.cx, animObj.cy]},
										rotateTo0
									]
								});
								this.anim[idx].cx = animObj.cx;
								this.anim[idx].cy = animObj.cy;
								this.anim[idx].action.play();
							}
						}
					}
				});	
			}
		},

		process: function(o){
			// summary:
			//		Process the action on the given object.
			// o: dojox/gfx/shape.Shape
			//		The object on which to process the slice moving action.
			if(!o.shape || o.element != "slice" || !(o.type in this.overOutEvents)){ return; }

			if(!this.angles){
				// calculate the running total of slice angles
				var startAngle = m._degToRad(o.plot.opt.startAngle);
				if(typeof o.run.data[0] == "number"){
					this.angles = df.map(df.scanl(o.run.data, "+", 0),
						"* 2 * Math.PI / this", df.foldl(o.run.data, "+", 0));
				}else{
					this.angles = df.map(df.scanl(o.run.data, "a + b.y", 0),
						"* 2 * Math.PI / this", df.foldl(o.run.data, "a + b.y", 0));
				}
				this.angles = array.map(this.angles, function(item){
					return item + startAngle;
				});
			}

			var index = o.index, anim, startScale, endScale, startOffset, endOffset,
				angle = (this.angles[index] + this.angles[index + 1]) / 2,
				rotateTo0  = m.rotateAt(-angle, o.cx, o.cy),
				rotateBack = m.rotateAt( angle, o.cx, o.cy);

			anim = this.anim[index];
			
			var dir;
			if(o.type == "onmouseover"){
				dir = "out";
			}else{
				dir = "in";
			}				

			if(anim){
				if(anim.dir !== dir){
					// Only do something if the animation is going a different
					// direction than the current one was for this slice.
					if(anim && anim.action && anim.action.status() === "playing"){
						anim.action.stop(true);
					}
				}else if(anim && anim.action && anim.action.status() !== "stopped"){
					// We're already doing this, so just return.  No need to redo it.
					return;
				}
			}else{
				this.anim[index] = anim = {};
			}
			
			
			// We should see if there is any item we missed due to browser-missed
			// mouseouts that have left things 'hanging'.  This will pull them
			// back in.
			var getIndex = function(i){
				return i;
			};
			var idx;
			for(idx in this.anim){
				var animObj = this.anim[idx];
				if(idx != index && animObj.action && animObj.dir){
					if(animObj.dir !== "in"){
						animObj.action.stop(true);
						this.anim[idx] = {dir: "in"};
						var angle2 = (this.angles[animObj.index] + this.angles[animObj.index + 1]) / 2;
						var rotateTo02  = m.rotateAt(-angle2, animObj.cx, animObj.cy);
						var rotateBack2 = m.rotateAt( angle2, animObj.cx, animObj.cy);
						this.anim[idx].action = gf.animateTransform({
							shape:    animObj.shape,
							duration: this.duration,
							easing:   this.easing,
							transform: [
								rotateBack2,
								{name: "translate", start: [this.shift, 0], end: [0, 0]},
								{name: "scaleAt",   start: [this.scale, animObj.cx, animObj.cy],  end: [1, animObj.cx, animObj.cy]},
								rotateTo02
							]
						});
						this.anim[idx].cx = animObj.cx;
						this.anim[idx].cy = animObj.cy;
						this.anim[idx].action.play();
					}
				}
			}

			// Handle the current slice now.
			if(dir === "out"){
				startOffset = 0;
				endOffset   = this.shift;
				startScale  = 1;
				endScale    = this.scale;
			}else{
				startOffset = this.shift;
				endOffset   = 0;
				startScale  = this.scale;
				endScale    = 1;
			}

			anim.action = gf.animateTransform({
				shape:    o.shape,
				duration: this.duration,
				easing:   this.easing,
				transform: [
					rotateBack,
					{name: "translate", start: [startOffset, 0], end: [endOffset, 0]},
					{name: "scaleAt",   start: [startScale, o.cx, o.cy],  end: [endScale, o.cx, o.cy]},
					rotateTo0
				]
			});
			
			// Store off our anim props, we will need these later in cleanup handlers.
			anim.dir = dir;
			anim.index = index;
			anim.shape = o.shape;
			anim.cx = o.cx;
			anim.cy = o.cy;

			if(o.type == "onmouseout"){
				hub.connect(anim.action, "onEnd", this, function(){
					delete this.anim[index];
				});
			}
			anim.action.play();
		},

		reset: function(){
			delete this.angles;
		},
		
		destroy: function(){
			// summary:
			//		Over-ridden cleanup.to clear out a node listener
			if(this._nodeL){
				this._nodeL.remove();
				delete this._nodeL;
			}
			this.inherited(arguments);
		}
	});		
});
