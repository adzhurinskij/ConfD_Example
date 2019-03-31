define([
    'lodash'
], function(_) {

function m_isAjaxTimeoutErr(err) {
    return (err.message === 'timeout');
}

function m_isDataNotFoundErr(err) {
    return err.type === 'data.not_found';
}

function m_isValidationFailedErr(err) {
    return err.type === 'trans.validation_failed';
}

function m_isRpcMethodFailedErr(err) {
    return err.type === 'rpc.method.failed';
}

function m_isTransResolveNeededErr(err) {
    return err.type === 'trans.resolve_needed';
}

function m_isAccessDeniedErr(err) {
    if(err.type === 'rpc.method.failed') {
        if(err.data && err.data.reason === 'access denied') {
            return true;
        }
    }
    return false;
}

function m_getInfo(err) {
    if (err.message && (err.message.length > 0)) {
        if (err.data && err.data.param && err.data.reason) {
            return err.message + ' : ' + err.data.reason + ' : ' + err.data.param;
        } else if (err.data && err.data.message && err.data.message.length > 0) {
            return err.message + ' : ' + err.data.message;
        } else {
            return err.message;
        }
    }

    if (err.data && (err.data.reason || err.data.message)) {
        var reason = err.data.reason || err.data.message;

        if (_.isString(reason)) {
            return reason;
        } else if (_.isArray(reason)) {
            var ret = '';

            _.each(reason, function(r) {
                if (_.isNumber(r)) {
                    ret += String.fromCharCode(r);
                } else {
                    ret += r;
                }
            });

            return ret;
        } else {
            return reason;
        }
    } else if (err.data && err.data.param) {
        return err.type + ' : ' + err.data.param;
    }

    return err.type;
}

return {
    isAjaxTimeoutErr        : m_isAjaxTimeoutErr,
    isDataNotFoundErr       : m_isDataNotFoundErr,
    isValidationFailedErr   : m_isValidationFailedErr,
    isRpcMethodFailedErr    : m_isRpcMethodFailedErr,
    isTransResolveNeededErr : m_isTransResolveNeededErr,
    getInfo                 : m_getInfo,
    isAccessDeniedErr       : m_isAccessDeniedErr
};
});
