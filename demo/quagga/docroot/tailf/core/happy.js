define('tailf/core/happy', [
    'jquery', 'lodash',
    './logger'
], function($, _, logger) {

/*
 * Haapy (deferred) code path
 * Returns a deferred promise and logs if the call fails
 *
 * happy(f, arg0, ..., argN, (optional) callback ) {
 * }
 *
 * function f(arg0, ..., argN) {
 *      return $.Deferred();
 * }
 *
 * function callback(result) { ... }
 *
 * If the callback returns a value !== undefined, then it is "returned",
 * via deferred.resolve(...), instead of the result.
 *
 */

function m_happy() {
    var _a = arguments;

    var f;
    var args = [];
    var callback;

    _.each(_a, function(arg, ix) {
        if (ix === 0) {
            f = arg;
        } else if (ix === (_a.length - 1)) {
            if (_.isFunction(arg)) {
                callback = arg;
            } else {
                args.push(arg);
            }
        } else {
            args.push(arg);
        }
    });

    var deferred = $.Deferred();

    f.apply(null, args).done(function(result) {
        if (callback) {
            var cres = callback(result);
            if (cres !== undefined) {
                result = cres;
            }
        }
        deferred.resolve(result);
    }).fail(function(err) {
        logger.error('happy : err=', err);
        deferred.reject(err);
    });

    return deferred.promise();
}


return m_happy;

});
