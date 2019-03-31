define([
    'dijit/Menu',
    'dijit/MenuItem',
    'dijit/MenuSeparator',
    //'dijit/MenuBar',
    //'dijit/DropDownMenu',
    'dijit/PopupMenuBarItem',

    'tailf/core/logger',
    'confd/global',

    './widgets/QuaggaTabContent',
    './widgets/SystemLoad'

], function(
    Menu, MenuItem, MenuSeparator, PopupMenuBarItem,
    logger,

    confdGlobal,
    QuaggaTabContent,
    SystemLoad
) {

function _initMenuBar(menuBar) {
    var subMenu = new Menu();

    subMenu.addChild(new MenuItem({
        //iconClass : 'dijitIconCut',
        label     : 'System Load',
        onClick : function() {
            _addSystemLoad();
        }
    }));

    menuBar.addChild(new PopupMenuBarItem({
        label : 'Quagga',
        popup : subMenu
    }));
}

function _initMainTab(addTab) {
    addTab({
        'class'  : 'quagga-tab',
        title    : 'Quagga',
        closable : false,

        content  : new QuaggaTabContent()
    });
}

function _addSystemLoad() {
    confdGlobal.addGenericTab({
        title    : 'System load',
        content  : new SystemLoad(),
        selected : true
    });
}

function init(args) {
    _initMenuBar(args.ui.menuBar);
    _initMainTab(args.ui.addGenericTab);
}

return {
    init : init
};

});

