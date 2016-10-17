define(function() {

  'use strict';
  
  function Terp() {
  }
  
  var validTerpScripts = new WeakMap();
  
  // modified version of JSON.stringify with specialized whitespace rules
  function stringifyStepOrBlock(stepOrBlock, indent) {
    if (typeof stepOrBlock[0] === 'string') {
      // step mode
      function stringifyElement(element) {
        if (typeof element === 'object' && element !== null) {
          if (!Array.isArray(element)) {
            throw new SyntaxError('Non-Array objects are not currently supported in TerpScript');
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
  
  var emptyScript = Object.freeze([]);
  validTerpScripts.set(emptyScript, true);
  
  const PARENT_SCOPE = Symbol('scope');
  const SCOPE_DEPTH = Symbol('depth');
  
  function toTerpScript(stepOrBlock, okToModify, scope) {
    if (stepOrBlock.length === 0) return emptyScript;
    if (stepOrBlock.length === 1 && scope && typeof stepOrBlock[0] === 'string' && stepOrBlock[0] in scope) {
      return scope[stepOrBlock[0]];
    }
    if (!okToModify) {
      stepOrBlock = stepOrBlock.slice();
    }
    var scopeDepth = scope ? scope[SCOPE_DEPTH] : -1;
    var usedScope = false;
    for (var i = 0; i < stepOrBlock.length; i++) {
      if (typeof stepOrBlock[i] !== 'object' || stepOrBlock[i] === null || validTerpScripts.has(stepOrBlock[i])) {
        continue;
      }
      if (!Array.isArray(stepOrBlock[i], scope)) {
        throw new SyntaxError('Non-Array objects are not currently supported in TerpScript');
      }
      stepOrBlock[i] = toTerpScript(stepOrBlock[i], okToModify, scope);
      if (PARENT_SCOPE in stepOrBlock[i]) {
        usedScope = true;
      }
      if (typeof stepOrBlock[i][0] !== 'string') continue;
      switch (stepOrBlock[i][0]) {
        case '</>':
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
          for (var j = 1; j < stepOrBlock[i].length; j++) {
            var scopedName = stepOrBlock[i][j];
            if (typeof scopedName !== 'string') {
              throw new SyntaxError('Scope step parameters must be strings');
            }
            var scopedRef = [scopedName];
            scopedRef[PARENT_SCOPE] = newScope;
            newScope[scopedName] = Object.freeze(scopedRef);
          }
          scope = Object.freeze(newScope);
          break;
      }
    }
    if (usedScope) {
      stepOrBlock[PARENT_SCOPE] = scope;
    }
    else {
      validTerpScripts.set(stepOrBlock, true);
    }
    return Object.freeze(stepOrBlock);
  }
  
  function script(v, isTheOnlyReference) {
    if (validTerpScripts.has(v)) return v;
    if (typeof v === 'string') {
      v = JSON.parse(v);
      if (!Array.isArray(v)) {
        throw new SyntaxError('TerpScripts must be contained in an Array');
      }
      return toTerpScript(JSON.parse(v), true);
    }
    if (!Array.isArray(v)) {
      if (typeof v.toJSON !== 'function' || !Array.isArray(v = v.toJSON())) {
        throw new SyntaxError('TerpScripts must be contained in an Array');
      }
      return toTerpScript(v, true);
    }
    return toTerpScript(v, isTheOnlyReference);
  }
  
  Object.assign(Terp, {
    script: Object.assign(script, {
      stringify: function(script) {
        if (typeof script === 'string') {
          script = JSON.parse(script);
          if (Array.isArray(script)) {
            return stringifyStepOrBlock(script);
          }
        }
        else {
          if (Array.isArray(script)) {
            return stringifyStepOrBlock(script);
          }
          if (typeof script.toJSON === 'function' && Array.isArray(script = script.toJSON())) {
            return stringifyStepOrBlock(script);
          }
        }
        throw new SyntaxError('TerpScript must be an contained in an Array');
      },
      empty: emptyScript,
    }),
  });
  
  return Terp;

});
