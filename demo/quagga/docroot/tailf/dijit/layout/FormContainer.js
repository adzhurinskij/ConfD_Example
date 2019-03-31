define('tailf/dijit/layout/FormContainer', [
    'jquery',

    'dojo/dom',
    'dojo/dom-class',
	'dojo/dom-construct',

    'dojo/_base/declare',
    'dojo/query',

	'dijit/_WidgetBase',
	'dijit/_TemplatedMixin',
    'dijit/_Container',

	'dojo/text!./templates/FormContainer.html',

    'tailf/core/logger'
], function(
    $,
    dom, domClass, domConstruct, declare, query,

    _WidgetBase, _TemplateMixin, _Container,

    template,

    logger

) {

function _trace() {
    logger.tracePrefix('FormContainer : ', arguments);
}

return declare([_WidgetBase, _TemplateMixin, _Container], {
	templateString: template,

    _rows         : [],
    _currentRow   : undefined,

    postCreate : function() {
        var me = this;
        _trace('postCreate');
        this.inherited(arguments);
    },

    startup : function() {
        _trace('started : 00 : this._started=', this._started);
        if (this._started) {
            return;
        }

    },

    addField : function(field) {
        if (!this._currentRow) {
            this.addRow();
        }

        var td = domConstruct.place('<td/>', this._currentRow.tr);
        var fieldDiv = domConstruct.place('<div class="tf-field"/>', td);
        var title = '';

        if (field.title) {
            title = field.title;
        }

        domConstruct.place('<div class="tf-field-title">' + title + '</div>', fieldDiv);

        domConstruct.place(field.domNode, fieldDiv);

        this._currentRow.cols.push({
            //debug : title,
            field : field,
            td    : td
        });
    },

    addRow : function() {
        var table = query('tbody', this.domNode)[0];

        var row = domConstruct.place('<tr/>', table);

        this._rows.push({
            rowIx : this._rows.length,
            tr    : row,
            cols  : []
        });

        this._currentRow = this._rows[this._rows.length - 1];
    },

    setCurrentRow : function(rowIx) {
        this._currentRow = this._rows[rowIx];
    },

    removeFieldsFromCurrentRow : function(fromColIx) {
        var row = this._currentRow;

        while (fromColIx < row.cols.length) {
            this._destroyOneRowItem(row, fromColIx);
        }
    },

    getFieldInfo : function() {
        var row = this._currentRow;

        return {
            rowIx : row.rowIx,
            colIx : row.cols.length - 1
        };
    },

    _destroyOneRowItem : function(row, colIx) {
        var col = row.cols[colIx];
        row.cols.splice(colIx, 1);

        col.field.destroy();

        // FIXME: How to do this with dojo?
        $($(row.tr).children()[colIx]).remove();
    }

});

});

