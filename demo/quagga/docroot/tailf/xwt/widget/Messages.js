define('tailf/xwt/widget/Messages', [
    'dojo/string',
    'xwt/widget/notification/Alert',

    'tailf/core/logger'
], function(dojoString, Alert, logger) {

function _escapedContent(txt) {
    // Backwards compatibility
    var tmp = txt.replace(/<br>/g, '\n');

    tmp = tmp.replace(/&nbsp;/g, ' ');
    tmp = dojoString.escape(tmp);

    var ret = '';

    _.each(tmp.split('\n'), function(row) {
        if (ret.length > 0) {
            ret += '<br>';
        }

        ret += row;
    });

    return ret;
}

function _alert(type, args, extra, err) {
    var warn = new Alert({
        baseClass : 'xwtAlert tailf-alert',
        messageType : type,
        buttons : [{
            label : 'OK'
        }]
    });

    if (_.isString(args)) {
        var text = args;

        if (_.isString(extra)) {
            text += ' : ' + extra;
        }
        warn.setDialogContent(_escapedContent(text));

        if (type === 'error') {
            logger.error(text, err);
        }
    } else {
        warn.setDialogContent(_escapedContent(args.content));
    }
}

function m_information(args) {
    _alert('information', args);
}

function m_warning(args) {
    _alert('warning', args);
}

function m_error(args, extra, err) {
    _alert('error', args, extra, err);
}

function m_okCancel(text, okCallback) {
    var a = new Alert({
        baseClass : 'xwtAlert tailf-alert',
        messageType : 'warning',
        buttons     : [{
            label: 'OK',
            onClick: function() {okCallback();}
        }, {
            label: 'Cancel'
        }],

        dontShowAgainOption: false
    });

    a.setDialogContent(_escapedContent(text));
}

var _ret = {
    information : m_information,
    warning     : m_warning,
    error       : m_error,
    okCancel    : m_okCancel
};

return _ret;
});
