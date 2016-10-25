define(function() {

  'use strict';
  
  function SquareScript(src) {
    if (this) {
      throw new Error('Use SquareScript() as a function instead of a constructor');
    }
    switch (typeof src) {
      case 'string':
        src = JSON.parse(src);
        if (typeof src !== 'object') {
          throw new SyntaxError('SquareScript source must be an Array');
        }
        // fall through:
      case 'object':
        if (typeof src.length !== 'number') {
          if (typeof src.toJSON !== 'function') {
            throw new SyntaxError('SquareScript source must be an Array');
          }
          src = src.toJSON();
          if (typeof src !== 'object' || typeof src.length !== 'number') {
            throw new SyntaxError('SquareScript source must be an Array');
          }
        }
        this.load(src, this.constructor.steps, this.constructor.globalScope);
        return;
      default:
        throw new SyntaxError('SquareScript source must be an Array');
    }
  }
  SquareScript.prototype = {
    load: function(src, steps, scope) {
      var properties = {length: {value:src.length}};
      if (typeof src[0] === 'string') {
        var stepName = src[0];
        if (stepName === '') {
          for (var i = 0; i < src.length; i++) {
            properties[i] = {value:src[i]};
          }
          Object.defineProperties(this, properties);
          return;
        }
        if (stepName in steps) {
          var handler = steps[src[0]];
          if (handler.isMacro) {
          }
        }
        else if (stepName in scope) {
          
        }
        else {
          throw new SyntaxError('');
        }
      }
      for (var i = 0; i < src.length; i++) {
        var operand = src[i];
        switch (typeof operand) {
          case 'boolean': case 'string': break;
          case 'number':
            if (isNaN(operand)) throw new SyntaxError('SquareScript: number literals must not be NaN');
            if (!isFinite(operand)) throw new SyntaxError('SquareScript: number literals must be finite');
            if (Object.is(operand, -0)) throw new SyntaxError('SquareScript: zero must not be negative');
            break;
          case 'object':
            if (operand === null) break;
            if (typeof t.length !== 'number') {
              throw new SyntaxError('Non-Array Objects are not currently supported in SquareScript syntax');
            }
            var loaded = Object.create(this.constructor.prototype);
            loaded.load(operand, steps, scope);
            operand = loaded;
            break;
          case 'undefined': throw new SyntaxError('SquareScript: null must be used instead of undefined');
          default: throw new SyntaxError('SquareScript syntax does not support inline ' + typeof operand + ' literals');
        }
        properties[i] = {value:operand};
      }
      Object.defineProperties(this, properties);
      if (typeof this[0] !== 'string') {
        for (var i = 0; i < this.length; i++) {
          if (typeof this[i] !== 'object' || this[i] === null) {
            throw new SyntaxError('SquareScript blocks must only contain steps');
          }
        }
      }
    },
    toJSON: [].slice,
  };
  Object.defineProperties(SquareScript.prototype, {
    stepName: {
      get: function() {
        var name = this[0];
        return typeof name === 'string' ? name : void 0;
      },
    },
    isBlock: {
      get: function() {
        return typeof this[0] !== 'string';
      },
    },
  });
  
  SquareScript.specialize = function(def) {
    def = def || {};
    function ScriptFlavor() {
      SquareScript.apply(this, arguments);
    }
    ScriptFlavor.prototype = Object.create(SquareScript, {
      constructor: {value:ScriptFlavor},
    });
    return ScriptFlavor;
  };
  
  return SquareScript;

});
