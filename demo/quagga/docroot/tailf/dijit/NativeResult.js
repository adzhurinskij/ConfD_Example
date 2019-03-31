define([
    'lodash',
    'tailf/dijit/result-window'
], function(
    _,
    resultWindow
) {

function NativeResult(args) {
    args = _.assign({
    }, args);

    this.args = args;
    this.fp = undefined;
}

NativeResult.prototype.destroy = function() {
    if (this.fp) {
        this.fp.destroy();
    }
};

/*
 * args = {
 *      element : <element for the floating pane>
 *      title   : Floating pane title
 *      clearContent : true/false
 *  }
 */
NativeResult.prototype.show = function(args) {
    if (!this.fp) {
        this.fp = resultWindow.getFloatingPaneWindow({
            element : args.element
        });
        this.fp.startup();
    }

    this.fp.setTitle(args.title);
    this.fp.show();

    if (args.clearContent) {
        this.fp.setContent('');
    }
};

NativeResult.prototype.setContent = function(content) {
    var rows = content.split('\n');
    var result = '';

    _.each(rows, function(row) {
        row = _.escape(row);
        row = row.replace(/ /g, '&nbsp;');

        result += row + '<br>';
    });

    this.fp.setContent(result);
};

return NativeResult;
});
