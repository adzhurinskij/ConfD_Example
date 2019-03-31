define([
    'jquery',
    'lodash',

    'dojo/_base/declare',
    'dijit/_TemplatedMixin',

    'dijit/MenuItem',
    'dijit/DropDownMenu',
    'dijit/form/Button',
    'dijit/form/ComboButton',
    'dijit/layout/ContentPane',

    'dojox/gauges/AnalogGauge',
    'dojox/gauges/AnalogArrowIndicator',
    'dojox/charting/Chart',
    'dojox/charting/axis2d/Default',
    'dojox/charting/plot2d/Lines',

    'tailf/global',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/protocol/JsonRpcErr',

    'confd/global',

    'dojo/text!./templates/SystemLoad.html'
], function(
    $, _,

    declare, _TemplatedMixin,

    MenuItem, DropDownMenu, Button, ComboButton, ContentPane,
    AnalogGauge, AnalogArrowIndicator,
    Chart, Default, Lines,

    tailfGlobal, logger,
    JsonRpc, JsonRpcHelper, JsonRpcErr,

    confdGlobal,
    template
) {

var SystemLoad = declare([ContentPane, _TemplatedMixin], {
    templateString : template,

    _chart : undefined,
    _gauge : undefined,

    destroy : function() {
        this.inherited(arguments);
        this.destroyed = true;
    },

    postCreate : function() {
        var me = this;

        if (me._chart) {
            me._chart.destroy();
        }

        if (me._gauge) {
            me._gauge.destroy();
        }

        me.inherited(arguments);
    },

    startup : function() {
        this._setContent();
// /loadhist:load/current",
//"/loadhist:load/sample{2015-03-04T09:30:16-00:00}/load","isKeyRef":false
    },

    refresh : function() {
        var me = this;
        me._updateChart();
        me._updateGauge();
    },

    _setContent : function() {
        var me = this;
        this._addChart();
        this._addGauge();

        function _getValues() {
            if (me.destroyed === true) {
                return;
            }

            me.refresh();

            setTimeout(function() {
                _getValues();
            }, 5000);
        }

        _getValues();
    },

    _addChart : function() {
        var el = $(this.domNode).find('div.chart div.widget')[0];
        var chart = new Chart(el);

        chart.addPlot('default', {type: Lines});
        chart.addAxis('x', {
            minorTicks : false,
            from : 0,
            to   : 10
        });
        chart.addAxis('y', {
            vertical: true,
            minorTicks : false,
            from : 0,
            to   : 100
        });

        chart.addSeries('Series 1', []);
        chart.render();

        this._chart = chart;
    },

    _addGauge : function() {
        var el = $(this.domNode).find('div.gauge div.widget')[0];

        var ranges1 = [
            {low:0,  high:20, hover:'0 - 20'},
            {low:20, high:40, hover:'20 - 40'},
            {low:40, high:60, hover:'40 - 60'},
            {low:60, high:80, hover:'60 - 80'},
            {low:80, high:100, hover:'80 - 100'}
        ];

        var indicator = new AnalogArrowIndicator({
            value:0,
            width: 3
         });

         var gauge = new AnalogGauge({
          //id: "defaultGauge",
          width: 300,
          height: 300,
          cx: 150,
          cy: 175,
          radius: 125,
          ranges: ranges1,
          minorTicks: {
            offset: 125,
            interval: 10,
            length: 5,
            color: 'gray'
          },
          majorTicks: {
            offset: 125,
            interval: 20,
            length: 10
          },

          indicators: [ indicator ]
        }, el);
        gauge.startup();

        this._gauge = gauge;
        this._gaugeIndicator = indicator;
    },

    _updateChart : function() {
        var me = this;

        // FIXME : Use query api instead
        JsonRpcHelper.read().done(function(th) {
            JsonRpcHelper.getListKeys(th, '/loadhist:load/sample').done(function(keys) {
                keys = keys.slice(Math.max(keys.length - 10, 1));

                var wa = [];
                _.each(keys, function(key) {
                    var path = '/loadhist:load/sample{"' + key + '"}/load';
                    wa.push(JsonRpc('get_value', {th: th, path: path}));
                });

                JsonRpcHelper.whenArray(wa).done(function(result) {
                    var values = [];
                    _.each(result, function(r) {
                        values.push(parseInt(r.value, 10));
                    });

                    me._newChartValues(values);
                }).fail(function(err) {
                    logger.error('err=', err);
                });
            });
        });

        //me._newChartValues([10,20,30]);
    },

    _updateGauge : function() {
        var me = this;

        JsonRpcHelper.read().done(function(th) {
            JsonRpc('get_value', {
                th   : th,
                path : '/loadhist:load/current'
            }).done(function(result) {
                me._newGaugeValue(result.value);
            });
        });
    },

    _newChartValues : function(values) {
        var ch = this._chart;
        ch.updateSeries('Series 1', values).render();
    },

    _newGaugeValue : function(value) {
        var gi = this._gaugeIndicator;
        gi.value = value;
        gi.draw();
    }

});

return SystemLoad;

});

