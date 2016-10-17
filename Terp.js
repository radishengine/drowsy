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
  
  function toTerpScript(stepOrBlock, okToModify) {
    if (stepOrBlock.length === 0) return emptyScript;
    if (!okToModify) {
      stepOrBlock = stepOrBlock.slice();
    }
    for (var i = 0; i < stepOrBlock.length; i++) {
      if (typeof stepOrBlock[i] === 'object' && stepOrBlock[i] !== null) {
        if (validTerpScripts.has(stepOrBlock[i])) {
          continue;
        }
        if (!Array.isArray(stepOrBlock(i))) {
          throw new SyntaxError('Non-Array objects are not currently supported in TerpScript');
        }
        stepOrBlock[i] = toTerpScript(stepOrBlock[i], okToModify);
      }
    }
    Object.freeze(stepOrBlock);
    validTerpScripts.set(stepOrBlock, true);
    return stepOrBlock;
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
