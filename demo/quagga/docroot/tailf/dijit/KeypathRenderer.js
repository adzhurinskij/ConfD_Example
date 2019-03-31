define([
    'jquery', 'lodash',

    'tailf/core/logger',
    'tailf/core/keypath/kp-parser'
], function($, _, logger, keypathParser) {


function _elToHtml(el) {
    return $('<div>').append(el).html();
}

function _hrefKeypath(getModelHref, kp) {
    return location.origin + location.pathname + getModelHref(kp);
}


// args = {
//  getModelHref : function(keypath) get the model href
// }
function Renderer(args) {
    this.getModelHref = args.getModelHref;
}

Renderer.prototype.html = function (keypath) {
    return this._htmlKeypath(keypath);
};

// Generate the keypath version of html
Renderer.prototype._htmlKeypath = function(kp) {
    var me = this;
    var el;

    var result = keypathParser.parse(kp);

    if (result.status === 'ok') {
        var items = keypathParser.tokensToUIParts(result.tokens);

        el = $('<span>');

        _.each(items, function(item) {
            if (item.keypath) {
                el.append(
                    $('<a>')
                        .attr('href', _hrefKeypath(me.getModelHref, item.keypath))
                        .addClass('keypath-href')
                        .text(item.text)
                );
            } else {
                el.append(
                    $('<span>')
                        .addClass('keypath-text')
                        .text(item.text)
                );
            }
        });
    } else {
        logger.error('parse failed : result=', result);
        el = $('<a>').attr('href', _hrefKeypath(this.getModelHref, kp)).text(kp);
    }

    return _elToHtml(el);
};


return Renderer;

});
