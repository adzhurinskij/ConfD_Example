define([
    'dojo/_base/declare',

    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/_FocusMixin',

    'dijit/form/TimeTextBox',
    'dijit/form/DateTextBox',

    'dojo/text!./templates/DateAndTime.html'
], function(
    declare,

    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    _FocusMixin,

    TimeTextBox,
    DateTextBox,

    template) {

    return declare([_WidgetBase, _FocusMixin, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString : template,
        baseClass      : 'tailf-leaf-dateandtime',

        postCreate: function() {
            this.date.constraints = {
                selector: 'date',
                datePattern: 'yyyy-MM-dd',
                locale: 'en-us'
            };
            this.time.constraints = {
                selector: 'time',
                timePattern: 'HH:mm:ss',
                clickableIncrement: 'T00:30:00',
                visibleIncrement: 'T00:30:00',
                visibleRange: 'T01:00:00'
            };

            if(this.readOnly) {
                this.date.set('disabled', true);
                this.time.set('disabled', true);
            }
        },

        setValue: function(value) {
            var match = /^([^T]+)(T[0-9:]+)/.exec(value);
            if(match) {
                this.date.set('value', match[1]);
                this.time.set('value', match[2]);
            }
        },

        getValue: function() {
            function pad(n) { return n < 10 ? '0' + n : n; }

            var vd = this.date.get('value'),
                vt = this.time.get('value'),
                val;

            if(vd != null && vt != null) {
                var d = vd.getFullYear() + '-' + pad(vd.getMonth()+1) + '-' + pad(vd.getDate()),
                    t = pad(vt.getHours()) + ':' + pad(vd.getMinutes()) + ':' + pad(vd.getSeconds());

                val = d+'T'+t;
            }
            return val;
        }
    });
});
