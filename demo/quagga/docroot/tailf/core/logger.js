(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define('tailf/core/logger', [], factory);
    } else if (typeof exports === 'object') {
        // Node, CommonJS-like
        module.exports = factory();
    } else {
        // Browser globals (root is window)
    }
}(this, function () {
    function m_debug(txt, obj) {
        txt = 'DEBUG : ' + txt;

        if (arguments.length === 1) {
            console.debug(txt);
        } else {
            console.debug(txt, obj);
        }
    }

    function m_warn(txt, obj) {
        txt = 'WARN  : ' + txt;

        if (arguments.length === 1) {
            console.warn(txt);
        } else {
            console.warn(txt, obj);
        }
    }

    function m_error(txt, obj) {
        txt = 'ERROR : ' + txt;

        if (arguments.length === 1) {
            console.error(txt);
        } else {
            console.error(txt, obj);
        }
    }


    function m_trace(txt, obj) {
        var css = 'background:rgba(0,0,96,0.5);color:white;';

        txt = 'TRACE : ' + txt;

        if (arguments.length === 1) {
            console.debug('%c'+txt, css);
        } else {
            console.debug('%c' + txt, css, obj);
        }
    }

    function m_tracePrefix(prefix, argumentsArray) {
        var args = [
            prefix + argumentsArray[0]
        ];

        if (argumentsArray.length > 1) {
            args.push(argumentsArray[1]);
        }

        m_trace.apply(null, args);
    }

    return {
        debug : m_debug,
        warn  : m_warn,
        error : m_error,
        trace : m_trace,
        tracePrefix : m_tracePrefix
    };
}));
