define([
    'lodash',
    'dijit/ConfirmDialog',
    'dojo/aspect'
], function(
    _,
    ConfirmDialog,
    aspect
) {

function _info(title, text, execute) {
    var dlg = new ConfirmDialog({
        title   : title,
        content : text
    });

    if (_.isFunction(execute)) {
        dlg.execute = execute;
    }

    dlg.startup();

    var signal, signals = [];

    function destroy() {
        _.each(signals, function(signal) {
            signal.remove();
        });
        signals = undefined;
        dlg.destroyRecursive();
    }

    signal = aspect.after(dlg, "onExecute", function() {
        destroy();
    });
    signals.push(signal);

    signal = aspect.after(dlg, "onCancel", function() {
        destroy();
    });
    signals.push(signal);

    dlg.show();
}

function m_information(text) {
    _info('Information', text);
}

function m_warning(text) {
    _info('Warning', text);
}

function m_error(text) {
    _info('Error', text);
}

function m_okCancel(text, callback) {
    _info(text, '', callback);
}

return {
    information : m_information,
    warning     : m_warning,
    error       : m_error,
    okCancel    : m_okCancel
};

});
