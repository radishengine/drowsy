define(function() {

  'use strict';
  
  var rx_escape = '\\\\(?:u(?:\\{[^\\}]+\\})?|.)';
  var rx_set = '\\[(?:[^\\\\\\]]+|' + rx_escape + ')+\\]';
  var rx_singleton = rx_escape + '|' + rx_set + '|[^\\\\\\[\\]\\(\\)\\{\\}\\*\\?\\+\\$\\^\\|]+';
  var rx_special = '\\((?:\\?[=!:])?|\\)|\\*|\\+|\\{[^\\}]*\\}|\\$|\\^';
  
  var rx = new RegExp('(' + rx_singleton + ')|(' + rx_special + ')', 'g');
  
  function BytePattern(source) {
    if (source instanceof RegExp) source = source.source;
    else if (typeof source !== 'string') {
      throw new TypeError('source must be string or RegExp');
    }
    rx.lastIndex = 0;
    var nextIndex = 0;
    for (var match = rx.exec(source); match; match = rx.exec(source)) {
      if (match.index > nextIndex) {
        throw new Error('invalid pattern: ' + source);
      }
      nextIndex = rx.lastIndex;
      if (typeof match[1] === 'string') {
        // character set or block of literal characters
        var ch = match[1];
      }
      else {
        // special character (grouping, repeat, etc.)
        var special = match[2];
        console.log('special', special);
      }
    }
    if (nextIndex < source.length) {
      throw new Error('invalid pattern: ' + source);
    }
  }
  
  return BytePattern;

});
