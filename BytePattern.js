define(function() {

  'use strict';
  
  var rx_escape = '\\\\(?:u(?:\\{[^\\}]+\\}|....)?|x..|c.|[^cux])';
  var rx_set = '\\[(?:[^\\\\\\]]+|' + rx_escape + ')+\\]';
  var rx_singleton = rx_escape + '|' + rx_set + '|[^\\\\\\[\\]\\(\\)\\{\\}\\*\\?\\+\\$\\^\\|\\.]+|\\.';
  var rx_special = '\\((?:\\?[=!:])?|\\)|\\*|\\+|\\?|\\{[^\\}]*\\}|\\$|\\^|\\||\\.';
  
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
    function popSingleton() {
      var last = context.pop();
      if (typeof last === 'string' && last.length > 1) {
        context.push(last.slice(0, -1));
        return last.slice(-1);
      }
      return last;
    }
    for (var match = rx.exec(source); match; match = rx.exec(source)) {
      if (match.index > nextIndex) {
        throw new Error('invalid pattern: ' + source);
      }
      nextIndex = rx.lastIndex;
      if (typeof match[1] === 'string') {
        // character set or block of literal character
        var ch = match[1];
        switch(ch[0]) {
          case '\\':
          case '.':
            context.push([ch]);
            break;
          case '[':
            context.push(['[', ch.slice(1, -1)]);
            break;
          default:
            context.push(ch);
            break;
        }
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
            context.push(['{', 0, Infinity, false, popSingleton()]);
            break;
          case '+':
            context.push(['{', 1, Infinity, false, popSingleton()]);
            break;
          case '?':
            if (typeof context[context.length-1] === 'object' && context[context.length-1][0] === '{') {
              context[context.length-1][3] = true;
            }
            else {
              context.push(['{', 0, 1, false, popSingleton()]);
            }
            break;
          case '{':
            var range = special.match(/^\{\s*(\d+)?\s*(,\s*(\d+)?)?\s*\}$/);
            if (!range) throw new Error('invalid pattern: ' + source);
            var min = +range[1] || 0;
            var max = (typeof range[2] === 'string') ? +(range[3] || Infinity) : min;
            context.push(['{', min, max, false, popSingleton()]);
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
