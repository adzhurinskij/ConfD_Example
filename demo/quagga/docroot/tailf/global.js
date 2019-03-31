define('tailf/global', [
], function() {

var _global = {
    events          : undefined,
    messages        : undefined,
    namespaces      : undefined,
    keypathRenderer : undefined,
    dialogs         : undefined
};

function m_getEvents() {
    if (_global.events === undefined) {
        throw 'No tailf/global protocol events are registered';
    }

    return _global.events;
}

function m_setEvents(events) {
    _global.events = events;
}

function m_setMessages(messages) {
    _global.messages = messages;
}

function m_getMessages() {
    if (_global.messages === undefined) {
        throw 'No tailf/global messages are registered';
    }

    return _global.messages;
}

function m_setNamespaces(ns) {
    _global.namespaces = ns;
}

function m_getNamespaces() {
    if (_global.namespaces === undefined) {
        throw 'No namespaces are registered';
    }

    return _global.namespaces;
}

function m_getNamespaceModuleName(ns) {
    var ret;

    _.each(m_getNamespaces(), function(namespace, module) {
        if (ns === namespace) {
            ret = module;
            return false;
        }
    });

    return ret;
}

/*
 * .html(keypath) Generate html for a keypath according to current settings
 *
 */
function m_getKeypathRenderer() {
    if (_global.keypathRenderer === undefined) {
        throw 'No keypath renderer is registered';
    }

    return _global.keypathRenderer;
}

function m_setKeypathRenderer(renderer) {
    _global.keypathRenderer = renderer;
}

/*
 *
 * Dialogs
 *
 * dialogs = {
 *      modalDialogClass : ...
 * }
 */

function m_getDialogs() {
    if (_global.dialogs === undefined) {
        throw 'No dialogs content is registered';
    }

    return _global.dialogs;
}

function m_setDialogs(dialogs) {
    // FIXME : Verify correct contents
    _global.dialogs = dialogs;
}

return {
    getEvents : m_getEvents,
    setEvents : m_setEvents,

    messages    : m_getMessages,
    setMessages : m_setMessages,

    namespaces             : m_getNamespaces,
    setNamespaces          : m_setNamespaces,
    getNamespaceModuleName : m_getNamespaceModuleName,

    keypathRenderer : m_getKeypathRenderer,
    setKeypathRenderer : m_setKeypathRenderer,

    dialogs    : m_getDialogs,
    setDialogs : m_setDialogs
};
});
