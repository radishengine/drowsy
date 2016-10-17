define(function() {

  'use strict';
  
  function Terp() {
  }
  
  var validSquipts = new WeakMap();
  
  // modified version of JSON.stringify with specialized whitespace rules
  function stringifyStepOrBlock(stepOrBlock, indent) {
    if (typeof stepOrBlock[0] === 'string') {
      // step mode
      function stringifyElement(element) {
        if (typeof element === 'object' && element !== null) {
          if (!Array.isArray(element)) {
            throw new SyntaxError('Non-Array objects are not currently supported in SquareScript');
          }
          return stringifyStepOrBlock(element, indent);
        }
        return JSON.stringify(element);
      }
      return '[' + stepOrBlock.map(stringifyElement).join(', ') + ']';
    }
    if (stepOrBlock.length === 0) return '[ ]';
    if (stepOrBlock.length === 1) {
      indent = indent || '';
      var single = stringifyStepOrBlock(stepOrBlock[0], indent);
      if (!/\n/.test(single)) {
        return '[ ' + single + ' ]';
      }
      return '[\n' + indent + single + '\n' + indent + ']';
    }
    if (typeof indent !== 'string') {
      indent = '';
      function stringifyStepTop(step) {
        return stringifyStepOrBlock(step, indent);
      }
      return '[\n\n' + stepOrBlock.map(stringifyStepTop).join(',\n') + '\n\n]';
    }
    indent = indent || '';
    var newIndent = indent + '  ';
    function stringifyStep(step) {
      return stringifyStepOrBlock(step, newIndent);
    }
    return '[\n' + newIndent + stepOrBlock.map(stringifyStep).join(',\n' + newIndent) + '\n' + indent + ']';
  }
  
  var emptySquipt = Object.freeze([]);
  validSquipts.set(emptySquipt, true);
  
  const PARENT_SCOPE = Symbol('scope');
  const SCOPE_DEPTH = Symbol('depth');
  const IMPORT = Symbol('import');
  
  function toSquipt(stepOrBlock, okToModify, scope) {
    if (stepOrBlock.length === 0) return emptySquipt;
    if (stepOrBlock.length === 1 && scope && typeof stepOrBlock[0] === 'string' && stepOrBlock[0] in scope) {
      return scope[stepOrBlock[0]];
    }
    if (!okToModify) {
      stepOrBlock = stepOrBlock.slice();
    }
    var scopeDepth = scope ? scope[SCOPE_DEPTH] : -1;
    var usedScope = false;
    for (var i = 0; i < stepOrBlock.length; i++) {
      if (typeof stepOrBlock[i] !== 'object' || stepOrBlock[i] === null || validSquipts.has(stepOrBlock[i])) {
        continue;
      }
      if (!Array.isArray(stepOrBlock[i], scope)) {
        throw new SyntaxError('Non-Array objects are not currently supported in SquareScript');
      }
      stepOrBlock[i] = toSquipt(stepOrBlock[i], okToModify, scope);
      if (PARENT_SCOPE in stepOrBlock[i]) {
        usedScope = true;
      }
      if (typeof stepOrBlock[i][0] !== 'string') continue;
      switch (stepOrBlock[i][0]) {
        case '</>':
          if (stepOrBlock[i].length !== 1) {
            throw new SyntaxError('End-of-Scope step must have no parameters');
          }
          if (!scope || scope[SCOPE_DEPTH] !== scopeDepth + 1) {
            throw new SyntaxError('End-of-Scope step without corresponding Scope step');
          }
          scope = scope[PARENT_SCOPE];
          break;
        case '< >':
          var newScope = scope ? Object.assign({}, scope) : {};
          if (scope) {
            newScope[PARENT_SCOPE] = scope;
            newScope[SCOPE_DEPTH] = scope[SCOPE_DEPTH] + 1;
          }
          else {
            newScope[SCOPE_DEPTH] = 0;
          }
          var imports = {};
          var startScope = stepOrBlock[i];
          while (i+1 < stepOrBlock.length) {
            if (typeof stepOrBlock[i+1] !== 'object' || stepOrBlock[i+1] === null || stepOrBlock[i+1][0] !== '<^>') {
              break;
            }
            i++;
            var importTo = stepOrBlock[i][1];
            var importString = stepOrBlock[i][2] || stepOrBlock[i][1];
            if (importTo in imports && imports[importTo] !== importString) {
              throw new SyntaxError('Multiple conflicting imports for ' + importTo);
            }
            imports[importTo] = importString;
          }
          for (var j = 1; j < startScope.length; j++) {
            var scopedName = startScope[j];
            if (typeof scopedName !== 'string') {
              throw new SyntaxError('Scope step parameters must be strings');
            }
            var scopedRef = [scopedName];
            scopedRef[PARENT_SCOPE] = newScope;
            if (scopedName in imports) {
              scopedRef[IMPORT] = imports[scopedName];
              delete imports[scopedName];
            }
            newScope[scopedName] = Object.freeze(scopedRef);
          }
          var unusedImports = Object.keys(imports);
          if (unusedImports.length !== 0) {
            throw new SyntaxError('Attempt to import to undefined scope variables: ' + unusedImports.join(', '));
          }
          scope = Object.freeze(newScope);
          break;
        case '<^>':
          throw new SyntaxError('Import-to-Scope steps must only appear immediately after an Open-Scope step');
      }
    }
    if (usedScope) {
      stepOrBlock[PARENT_SCOPE] = scope;
    }
    else {
      validSquipts.set(stepOrBlock, true);
    }
    return Object.freeze(stepOrBlock);
  }
  
  function squipt(v, isTheOnlyReference) {
    if (validSquipts.has(v)) return v;
    if (typeof v === 'string') {
      v = JSON.parse(v);
      if (!Array.isArray(v)) {
        throw new SyntaxError('A SquareScript document must be contained in an Array');
      }
      return toSquipt(JSON.parse(v), true);
    }
    if (!Array.isArray(v)) {
      if (typeof v.toJSON !== 'function' || !Array.isArray(v = v.toJSON())) {
        throw new SyntaxError('A SquareScript document must be contained in an Array');
      }
      return toSquipt(v, true);
    }
    return toSquipt(v, isTheOnlyReference);
  }
  
  function SquareTranscriber(output) {
    this.output = output || [];
  }
  SquareTranscriber.prototype = {
    toJSON: function() {
      return this.output;
    },
    toString: function() {
      return stringifyStepOrBlock(this.toJSON());
    },
  };
  
  Object.assign(Terp, {
    SquareTranscriber: SquareTranscriber,
    squipt: Object.assign(squipt, {
      stringify: function(source) {
        if (typeof source === 'string') {
          source = JSON.parse(source);
          if (Array.isArray(source)) {
            return stringifyStepOrBlock(source);
          }
        }
        else if (Array.isArray(source) || (typeof source.toJSON === 'function' && Array.isArray(source = source.toJSON()))) {
          return stringifyStepOrBlock(source);
        }
        throw new SyntaxError('A SquareScript document must be an contained in an Array');
      },
      empty: emptySquipt,
    }),
  });
  
  return Terp;

});
