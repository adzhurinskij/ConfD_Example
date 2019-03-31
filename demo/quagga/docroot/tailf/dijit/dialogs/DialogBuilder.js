define([
    'lodash',
    'dijit/form/TextBox',
    'dojox/layout/TableContainer'
], function (
    _,
    TextBox,
    TableContainer
) {

function DialogBuilder() {
}

DialogBuilder.prototype.getTableContainer = function(args) {
    if (args === undefined) {
        args = {cols : 2};
    }

    return new TableContainer(args);
};


DialogBuilder.prototype.getTextBox = function(args) {
    if (_.isString(args)) {
        args = {
            label : args
        };
    }
    return new TextBox(args);
};


return DialogBuilder;

});
