define(["dojo/_base/lang", "dojo/_base/array", "dojo/_base/declare", "dojo/has", "./CartesianBase", "./_PlotEvents", "./common",
		"dojox/lang/functional", "dojox/lang/functional/reversed", "dojox/lang/utils", "dojox/gfx/fx", "dojox/gfx/gradutils"], 
	function(lang, arr, declare, has, CartesianBase, _PlotEvents, dc, df, dfr, du, fx, gutils){

	var purgeGroup = dfr.lambda("item.purgeGroup()");

	function alwaysFalse(){ return false; }
	
	return declare("dojox.charting.plot2d.Columns", [CartesianBase, _PlotEvents], {
		// summary:
		//		The plot object representing a column chart (vertical bars).
		defaultParams: {
			gap:	0,		// gap between columns in pixels
			animate: null,  // animate bars into place
			enableCache: false
		},
		optionalParams: {
			minBarSize:	1,	// minimal column width in pixels
			maxBarSize:	1,	// maximal column width in pixels
			minWidth:   0,
			// theme component
			stroke:		{},
			outline:	{},
			shadow:		{},
			fill:		{},
			filter:     {},
			styleFunc:  null,
			font:		"",
			fontColor:	""
		},

		constructor: function(chart, kwArgs){
			// summary:
			//		The constructor for a columns chart.
			// chart: dojox/charting/Chart
			//		The chart this plot belongs to.
			// kwArgs: dojox.charting.plot2d.__BarCtorArgs?
			//		An optional keyword arguments object to help define the plot.
			this.opt = lang.clone(lang.mixin(this.opt, this.defaultParams));
			du.updateWithObject(this.opt, kwArgs);
			du.updateWithPattern(this.opt, kwArgs, this.optionalParams);
			this.animate = this.opt.animate;
		},

		getSeriesStats: function(){
			// summary:
			//		Calculate the min/max on all attached series in both directions.
			// returns: Object
			//		{hmin, hmax, vmin, vmax} min/max in both directions.
			var stats = dc.collectSimpleStats(this.series, lang.hitch(this, "isNullValue"));
			stats.hmin -= 0.5;
			stats.hmax += 0.5;
			return stats; // Object
		},

		createRect: function(run, creator, params){
			var rect;
			if(this.opt.enableCache && run._rectFreePool.length > 0){
				rect = run._rectFreePool.pop();
				rect.setShape(params);
				// was cleared, add it back
				creator.add(rect);
			}else{
				rect = creator.createRect(params);
			}
			if(this.opt.enableCache){
				run._rectUsePool.push(rect);
			}
			return rect;
		},

		render: function(dim, offsets){
			// summary:
			//		Run the calculations for any axes for this plot.
			// dim: Object
			//		An object in the form of { width, height }
			// offsets: Object
			//		An object of the form { l, r, t, b}.
			// returns: dojox/charting/plot2d/Columns
			//		A reference to this plot for functional chaining.
			if(this.zoom && !this.isDataDirty()){
				return this.performZoom(dim, offsets);
			}
			this.resetEvents();
			this.dirty = this.isDirty();
			var s;
			if(this.dirty){
				arr.forEach(this.series, purgeGroup);
				this._eventSeries = {};
				this.cleanGroup();
				s = this.getGroup();
				df.forEachRev(this.series, function(item){ item.cleanGroup(s); });
			}
			var t = this.chart.theme,
				ht = this._hScaler.scaler.getTransformerFromModel(this._hScaler),
				vt = this._vScaler.scaler.getTransformerFromModel(this._vScaler),
				baseline = Math.max(this._vScaler.bounds.lower,
					this._vAxis ? this._vAxis.naturalBaseline : 0),
				baselineHeight = vt(baseline),
				events = this.events();
			var bar = this.getBarProperties();

			// Collect and calculate  all values
			var extractedValues = this.extractValues(this._hScaler);
			extractedValues = this.rearrangeValues(extractedValues, vt, baselineHeight);

			// Reversed by XWT
			for(var i = 0; i < this.series.length; i++){
			//for(var i = this.series.length - 1; i >= 0; --i){
				var run = this.series[i];
				if(!this.dirty && !run.dirty){
					t.skip();
					this._reconnectEvents(run.name);
					continue;
				}
				run.cleanGroup();
				if(this.opt.enableCache){
					run._rectFreePool = (run._rectFreePool?run._rectFreePool:[]).concat(run._rectUsePool?run._rectUsePool:[]);
					run._rectUsePool = [];
				}
				var theme = t.next("column", [this.opt, run]),
					eventSeries = new Array(run.data.length);
				s = run.group;
				var indexed = arr.some(run.data, function(item){
					return typeof item == "number" || (item && !item.hasOwnProperty("x"));
				});
				// on indexed charts we can easily just interate from the first visible to the last visible
				// data point to save time
				var min = indexed ? Math.max(0, Math.floor(this._hScaler.bounds.from - 1)) : 0;
				var max = indexed ? Math.min(run.data.length, Math.ceil(this._hScaler.bounds.to)) : run.data.length;
				for(var j = min; j < max; ++j){
					var value = run.data[j];
					if(!this.isNullValue(value)){
						var valX = typeof value == "number" || isNaN(value.x) ? j : value.x - 1,
							valY = typeof value == "number" ? value : value.y,
							h = extractedValues[i][j], finalTheme, sshape;
						if(this.opt.styleFunc || typeof value != "number"){
							var tMixin = typeof value != "number" ? [value] : [];
							if(this.opt.styleFunc){
								tMixin.push(this.opt.styleFunc(value));
							}
							finalTheme = t.addMixin(theme, "column", tMixin, true);
						}else{
							finalTheme = t.post(theme, "column");
						}
						if(h && bar.width >= 1){
							var rect = {
								x: offsets.l + ht(valX + 0.5) + bar.gap + bar.thickness * i,
								y: dim.height - offsets.b - baselineHeight - Math.max(h, 0),
								width: bar.width,
								height: Math.abs(h)
							};
							if(finalTheme.series.shadow){
								var srect = lang.clone(rect);
								srect.x += finalTheme.series.shadow.dx;
								srect.y += finalTheme.series.shadow.dy;
								sshape = this.createRect(run, s, srect).setFill(finalTheme.series.shadow.color).setStroke(finalTheme.series.shadow);
								if(this.animate){
									this._animateColumn(sshape, dim.height - offsets.b + baselineHeight, Math.abs(h));
								}
							}

							/** XWT Modification.  Inversion of Fill colors **/
							var fill = finalTheme.series.fill;
							if(valY < 0){
								if(fill && fill.type === "linear" && fill.colors && fill.colors.length === 2){
									fill = gutils.reverse(fill);
								}
							}
							/** XWT Modification.  End of fill color inversion **/
							
							var specialFill = this._plotFill(fill, dim, offsets);
							specialFill = this._shapeFill(specialFill, rect);
							var shape = this.createRect(run, s, rect).setFill(specialFill).setStroke(finalTheme.series.stroke);
							if(shape.setFilter && finalTheme.series.filter){
								shape.setFilter(finalTheme.series.filter);
							}
							run.dyn.fill   = shape.getFill();
							run.dyn.stroke = shape.getStroke();
							if(events){
								var o = {
									element: "column",
									index:   j,
									run:     run,
									shape:   shape,
									shadow:  sshape,
									x:      valX + 0.5,
									y:      valY
								};
								this._connectEvents(o);
								eventSeries[j] = o;
							}
							if(this.animate){
								this._animateColumn(shape, dim.height - offsets.b - baselineHeight, Math.abs(h));
							}
						}
					}
				}
				this._eventSeries[run.name] = eventSeries;
				run.dirty = false;
			}
			this.dirty = false;
			// chart mirroring starts
			if(has("dojo-bidi")){
				this._checkOrientation(this.group, dim, offsets);
			}
			// chart mirroring ends
			return this;	//	dojox/charting/plot2d/Columns
		},
		extractValues: function(scaler){
			var extracted = [];
			for(var i = this.series.length - 1; i >= 0; --i){
				var run = this.series[i];
				if(!this.dirty && !run.dirty){
					continue;
				}
				// on indexed charts we can easily just interate from the first visible to the last visible
				// data point to save time
				var indexed = arr.some(run.data, function(item){
						return typeof item == "number" || (item && !item.hasOwnProperty("x"));
					}),
					min = indexed ? Math.max(0, Math.floor(scaler.bounds.from - 1)) : 0,
					max = indexed ? Math.min(run.data.length, Math.ceil(scaler.bounds.to)) : run.data.length,
					extractedSet = extracted[i] = [];
				extractedSet.min = min;
				extractedSet.max = max;
				for(var j = min; j < max; ++j){
					var value = run.data[j];
					extractedSet[j] = this.isNullValue(value) ? 0 :
						(typeof value == "number" ? value : value.y);
				}
			}
			return extracted;
		},
		rearrangeValues: function(values, transform, baseline){
			// transform to pixels
			for(var i = 0, n = values.length; i < n; ++i){
				var extractedSet = values[i];
				if(extractedSet){
					for(var j = extractedSet.min, k = extractedSet.max; j < k; ++j){
						var value = extractedSet[j];
						extractedSet[j] = this.isNullValue(value) ? 0 : transform(value) - baseline;
					}
				}
			}
			// the minWidth algorithm
			if(this.opt.minWidth){
				var minWidth = this.opt.minWidth;
				for(var i = 0, n = values.length; i < n; ++i){
					var extractedSet = values[i];
					if(extractedSet){
						for(var j = extractedSet.min, k = extractedSet.max; j < k; ++j){
							var value = extractedSet[j];
							if(value > 0 && value < minWidth){
								extractedSet[j] = minWidth;
							}
						}
					}
				}
			}
			return values;
		},
		isNullValue: function(value){
			if(value === null || typeof value == "undefined"){
				return true;
			}
			var h = this._hAxis ? this._hAxis.isNullValue : alwaysFalse,
				v = this._vAxis ? this._vAxis.isNullValue : alwaysFalse;
			if(typeof value == "number"){
				return v(0.5) || h(value);
			}
			return v(isNaN(value.x) ? 0.5 : value.x + 0.5) || value.y === null || h(value.y);
		},
		getBarProperties: function(){
			var f = dc.calculateBarSize(this._hScaler.bounds.scale, this.opt);
			return {gap: f.gap, width: f.size, thickness: 0};
		},
		_animateColumn: function(shape, voffset, vsize){
			if(vsize==0){
				vsize = 1;
			}
			fx.animateTransform(lang.delegate({
				shape: shape,
				duration: 1200,
				transform: [
					{name: "translate", start: [0, voffset - (voffset/vsize)], end: [0, 0]},
					{name: "scale", start: [1, 1/vsize], end: [1, 1]},
					{name: "original"}
				]
			}, this.animate)).play();
		}

	});
});
