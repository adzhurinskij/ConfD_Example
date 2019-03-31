define([
    'lodash',
    'jquery',

    'dijit/MenuItem',
    'dijit/MenuSeparator',
    'dijit/DropDownMenu',
    'dijit/form/ComboButton'
], function(
    _, $,

    MenuItem,
    MenuSeparator,
    DropDownMenu,
    ComboButton
) {


function m_dropDownButton(args) {
    var menu = new DropDownMenu({
        style : 'display: none'
    });

    _.each(args.menu, function(item) {
        if (item === 'separator') {
            menu.addChild(new MenuSeparator());
        } else {
            menu.addChild(new MenuItem({
                'class'   : item['class'],
                iconClass : item.iconClass,
                label     : item.label,
                onClick   : item.onClick
            }));
        }
    });

    var btn = args.button;

    var button = new ComboButton({
        label    : btn.label,
        style    : btn.style,
        dropDown : menu,
        onClick  : function(evt) {
            evt.cancelBubble = true;
            btn.onClick(evt);
        },

        // Disable _MenuBase complaint
        _setSelected : function() {
        }
    });

    if (btn.extraClass) {
        $(button.domNode).addClass(btn.extraClass);
    }

    return button;
}

return {
    dropDownButton : m_dropDownButton
};

});
