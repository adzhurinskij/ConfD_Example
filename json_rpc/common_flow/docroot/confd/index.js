window.onerror = function (errorMsg, url, lineNumber) {
  window.alert('Error: ' +
               errorMsg +
               ' Script: ' +
               url +
               ' Line: ' +
               lineNumber);
};

requirejs.config({
  paths: {
    jquery: 'lib/jquery/jquery',
    lodash: 'lib/lodash/lodash',
    bluebird: 'lib/bluebird/bluebird'
  }
});

require(['example']);
