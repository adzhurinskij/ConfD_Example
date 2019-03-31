define([
    'dijit/form/Button',
    'dijit/form/TextBox',
    'dojox/layout/TableContainer',

    'tailf/core/logger',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/yang/Keypath',
    'tailf/dijit/form/Select',
    'tailf/dijit/schema/Factory',

    './global'
], function(
    Button, TextBox,
    TableContainer,

    logger,
    JsonRpcHelper,
    keypath,

    Select,
    DefaultFactory,

    confdGlobal
) {

function _button(args) {
    var tc = new TableContainer({
        cols       : 1,
        showLabels : true
    });

    var tb = new Button({
        label     : args.label,
        iconClass : args.iconClass,
        onClick   : args.onClick
    });

    tc.addChild(tb);

    return tc;
}

function _dialogLeafRefWidget(th, schema) {
    var sel = new Select({
        title : schema.getName(),
        options : []
    });

    var target = schema.getLeafRefTarget();

    function _getKeyValues(listKeypath) {
        JsonRpcHelper.getListKeys(th, listKeypath).done(function(result) {
            sel.setOptions(result);
        });
    }

    JsonRpcHelper.getSchema(th, '', target, 1, false, true).done(function(schema) {
        var kind = schema.getKind();

        if (kind === 'key') {
            _getKeyValues(keypath.upOneLevel(target));
        }
    });

    return sel;
}


// -----------------------------------------------------------------------------

function m_createContainerChildWidget(args) {
    var th = args.th;
    var parentSchema = args.parentSchema;
    var schema = args.leafSchema;

    var kind = schema.getKind();

    function _btn(schema, iconClass) {
        return _button({
            label     : schema.getName(),
            iconClass : iconClass,
            onClick   : function() {
                confdGlobal.showKeypath(schema.getKeypath(), {
                    iconClass : iconClass,
                    selected  : true
                });
            }
        });
     }

    if ((kind === 'container') && (!schema.isPresence())) {
        return _btn(schema, 'dijitIconFolderClosed');
    } else if (kind === 'list') {
        return _btn(schema, 'dijitIconTable');
    } else if (kind === 'action') {
        return _btn(schema, 'dijitIconConfigure');
    } else {
        return DefaultFactory.createContainerChildWidget(args);
    }
}

function m_createDialogChildWidget(th, parentSchema, schema) {
    //logger.debug('.... createDialogChildWidget : schema=', schema);
    if (schema.isLeafRef()) {
        var target = schema.getLeafRefTarget();
        logger.debug('... createDialgoChildWidget : target=', target);
        return _dialogLeafRefWidget(th, schema);
    } else {
        return DefaultFactory.createDialogChildWidget(th, parentSchema, schema);
    }
}

function m_createListInlineEditWidget(th, parentSchema, schema) {
    return DefaultFactory.createListInlineEditWidget(th, parentSchema, schema);
}


// -----------------------------------------------------------------------------

return {
    setHref : function() {
        logger.error('setHref : arguments=', arguments);
    },

    createContainerChildWidget : m_createContainerChildWidget,
    createDialogChildWidget    : m_createDialogChildWidget,
    createListInlineEditWidget : m_createListInlineEditWidget
};

});

