define(function() {

  'use strict';
  
  var rx_escape = '\\\\(?:u(?:\\{[^\\}]+\\}|....)?|x..|c.|[^cux])';
  var rx_set = '\\[(?:[^\\\\\\]]+|' + rx_escape + ')+\\]';
  var rx_singleton = rx_escape + '|' + rx_set + '|[^\\\\\\[\\]\\(\\)\\{\\}\\*\\?\\+\\$\\^\\|]';
  var rx_special = '\\((?:\\?[=!:])?|\\)|[\\*\\+\\?]\\??|\\{[^\\}]*\\}|\\$|\\^|\\|';
  
  var rx = new RegExp('(' + rx_singleton + ')|(' + rx_special + ')', 'g');
  
  function BytePattern(source) {
    if (source instanceof RegExp) source = source.source;
    else if (typeof source !== 'string') {
      throw new TypeError('source must be string or RegExp');
    }
    rx.lastIndex = 0;
    var nextIndex = 0;
    var context = [':'];
    var contextStack = [];
    for (var match = rx.exec(source); match; match = rx.exec(source)) {
      if (match.index > nextIndex) {
        throw new Error('invalid pattern: ' + source);
      }
      nextIndex = rx.lastIndex;
      if (typeof match[1] === 'string') {
        // character set or block of literal character
        var ch = match[1];
        context.push(ch);
      }
      else {
        // special character (grouping, repeat, etc.)
        var special = match[2];
        switch (special[0]) {
          case '(':
            contextStack.push(context);
            var newContext = [special[2] || special];
            context.push(newContext);
            context = newContext;
            break;
          case ')':
            context = contextStack.pop();
            break;
          case '*':
          case '?':
          case '+':
            context.push([special, context.pop()]);
            break;
          case '{':
            var range = special.match(/^\{\s*(\d+)?\s*(,\s*(\d+)?)?\s*\}$/);
            if (!range) throw new Error('invalid pattern: ' + source);
            var min = +range[1] || 0;
            var max = (typeof range[2] === 'string') ? +(range[3] || Infinity) : min;
            context.push(['{', min, max, context.pop()]);
            break;
          case '|':
            if (contextStack.length > 0 && contextStack[contextStack.length-1][0] === '|') {
              contextStack[contextStack.length-1].push(context = [':']);
            }
            else {
              var newContext = context.splice(0, context.length, '|');
              context[1] = newContext;
              contextStack.push(context);
              context = newContext;
            }
            break;
        }
      }
    }
    if (nextIndex < source.length) {
      throw new Error('invalid pattern: ' + source);
    }
    while (context.length === 2 && context[0] === ':') context = context[1];
    this.tree = context;
  }
  
  return BytePattern;

});
