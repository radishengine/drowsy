define(function() {

  'use strict';
  
  var EMPTY = Object.freeze({});
  var ANYSTRING = /^.*$/;
  
  function regexEscape(string) {
    return string.replace(/([.*+?^${}()|[\]\\])/g, '\\$1');
  }
  
  function encodeTypeString(str) {
    return str.replace(/[A-Z;=\*]/g, function(c) {
      return '%' + ('0' + c.charCodeAt(0).toString(16)).slice(-2);
    })
    .replace(/[^ -~]+/, encodeURIComponent)
    .toLowerCase();
  }
  var decodeTypeString = decodeURIComponent;
  
  function encodeTypeParameters(obj) {
    if (obj === EMPTY) return '';
    var keys = Object.keys(obj);
    if (keys.length === 0) return '';
    for (var i = 0 ; i < keys.length; i++) {
      keys[i] = encodeTypeString(keys[i]) + '=' + encodeTypeString('' + obj[keys[i]]);
    }
    return keys.join('; ');
  }
  function decodeTypeParameters(str) {
    if (!str) return EMPTY;
    var parts = str.split(';');
    var obj = null;
    for (var i = 0; i < parts.length; i++) {
      var paramParts = parts[i].match(/^\s*([^=\s;][^=;]*?)\s*=\s*(.*?)\s*$/);
      if (!paramParts) {
        if (!/\S/.test(parts[i])) continue;
        throw new TypeError('Type parameter must take the form: name=value');
      }
      if (obj === null) obj = {};
      obj[decodeTypeString(paramParts[1])] = decodeTypeString(paramParts[2]);
    }
    return obj === null ? EMPTY : Object.freeze(obj);
  }
  
  var matchAny, matchNone;
  
  var descriptorFilterCache = new WeakMap();
  
  function TypeFilter() {
    if (this) return; // do nothing if used as a constructor
    if (arguments.length === 0) return matchAny;
    if (arguments[0] instanceof TypeFilter) {
      if (arguments.length !== 1) {
        if (arguments[0] instanceof TypeDescriptor) {
          for (var i = 1; i < arguments.length; i++) {
            if (!(arguments[i] instanceof TypeDescriptor)) {
              throw new TypeError('filter(descriptor [, descriptor...]): every argument must be a descriptor object');
            }
          }
          return new OrList(Object.freeze(Array.prototype.slice.apply(arguments)));
        }
        throw new Error(
          'Only one filter object is allowed here.'
          + ' Use .filter(), .or(), .except() etc.'
          + ' to combine several filters into one object.');
      }
      return arguments[0];
    }
    var namePattern, parameterPatterns;
    if (typeof arguments[0] === 'string' || arguments[0] instanceof RegExp) {
      namePattern = arguments[0];
      if (namePattern === '*/*') namePattern = ANYSTRING;
      parameterPatterns = arguments[1] || EMPTY;
    }
    else {
      if (typeof arguments[0] !== 'object') {
        throw new TypeError('Argument 1: expecting string, regular expression or object');
      }
      namePattern = ANYSTRING;
      parameterPatterns = arguments[0] || EMPTY;
    }
    var andList = [];
    if (typeof namePattern === 'string') {
      var nameParts = arguments[0].match(/^\s*([^\/]+\/[^\/;]+)(?:\s*;\s*(\S.*)?)?$/);
      if (!nameParts) {
        throw new Error('type name must take the form: category/subtype');
      }
      namePattern = nameParts[1];
      var stringParameters = nameParts[2] ? decodeTypeParameters(nameParts[2]) : EMPTY;
      if (/\*/.test(namePattern)) {
        namePattern = new RegExp('^' + namePattern.split(/\*/g).map(regexEscape).join('.*') + '$');
        andList.push(new NameMatch(namePattern));
        parameterPatterns = Object.assign(stringParameters, parameterPatterns);
      }
      else {
        if (parameterPatterns !== EMPTY) {
          var keys = Object.keys(parameterPatterns);
          parameterPatterns = Object.assign({}, parameterPatterns);
          var count = 0;
          for (var i = 0; i < keys.length; i++) {
            var name = keys[i];
            var value = parameterPatterns[name];
            if (typeof value === 'string') {
              stringParameters[name] = value;
              delete newParameterPatterns[name];
              count++;
            }
          }
          if (count === keys.length) {
            parameterPatterns = EMPTY;
          }
        }
        andList.push(new TypeDescriptor(namePattern, stringParameters));
      }
    }
    else {
      andList.push(new NameMatch(namePattern));
    }
    if (parameterPatterns !== EMPTY) {
      var keys = Object.keys(parameterPatterns);
      for (var i = 0; i < keys.length; i++) {
        var parameterName = keys[i];
        var parameterPattern = parameterPatterns[parameterName];
        if (parameterPattern === true) {
          andList.push(new ParameterMatch(parameterName, ANYSTRING));
        }
        else if (parameterPattern === false) {
          andList.push(new ParameterMatch(parameterName, ANYSTRING, true));
        }
        else if (parameterPattern instanceof RegExp) {
          andList.push(new ParameterMatch(parameterName, parameterPattern));
        }
        else {
          parameterPattern = new RegExp('^' + regexEscape('' + parameterPattern) + '$');
          andList.push(new ParameterMatch(parameterName, parameterPattern));
        }
      }
    }
    if (andList.length === 0) return matchAny;
    if (andList.length === 1) return andList[0];
    return new AndList(Object.freeze(andList));
  }
  TypeFilter.prototype = {
    filter: function() {
      var filter = TypeFilter.apply(null, arguments);
      if (filter === matchAny) return this;
      if (filter === matchNone) return matchNone;
      if (filter instanceof AndList) {
        return new AndList(Object.freeze([this].concat(filter.list)));
      }
      return new AndList(this, filter);
    },
    except: function() {
      return this.filter(TypeFilter.apply(null, arguments).inverted());
    },
    or: function() {
      var filter = TypeFilter.apply(null, arguments);
      if (filter === matchAny) return matchAny;
      if (filter === matchNone) return this;
      if (filter instanceof OrList) {
        return new OrList(Object.freeze([this].concat(filter.list)));
      }
      return new OrList(this, filter);
    },
    reset: function() {
      return this;
    },
    willNeverMatch: false,
    inverted: function() {
      return new Not(this);
    },
    toString: function() {
      return JSON.stringify(this);
    },
  };
  
  function TypeDescriptor(typeName, typeParameters) {
    if (!this) {
      if (typeName instanceof TypeDescriptor) {
        return typeName;
      }
      return new TypeDescriptor(typeName, typeParameters);
    }
    var nameParts = typeName.match(/^\s*([a-z0-9_\-\.]+)\/([a-z0-9_\-\.]+)\s*(?:;(.*))?$/);
    if (!nameParts) {
      throw new TypeError('Type name must take the form: category/subtype');
    }
    this.category = nameParts[1];
    this.subtype = nameParts[2];
    if (!typeParameters) {
      typeParameters = EMPTY;
    }
    else if (typeParameters !== EMPTY) {
      var keys = Object.keys(typeParameters);
      if (keys.length === 0) {
        typeParameters = EMPTY;
      }
      else {
        var copy = null;
        if (!Object.isFrozen(typeParameters)) {
          copy = Object.assign({}, typeParameters);
        }
        for (var i = 0; i < keys.length; i++) {
          if (typeof typeParameters[keys[i]] !== 'string') {
            copy = copy || Object.assign({}, typeParameters);
            copy[keys[i]] = '' + typeParameters[keys[i]];
          }
        }
        if (copy !== null) {
          typeParameters = Object.freeze(copy);
        }
      }
    }
    if (typeof nameParts[3] === 'string') {
      var stringParameters = decodeTypeParameters(nameParts[3]);
      if (typeParameters === EMPTY) {
        typeParameters = stringParameters;
      }
      else if (stringParameters !== EMPTY) {
        typeParameters = Object.freeze(Object.assign(
          {},
          stringParameters,
          typeParameters));
      }
    }
    this.parameters = typeParameters;
    Object.freeze(this);
  }
  TypeDescriptor.prototype = Object.assign(new TypeFilter, {
    toString: function() {
      var name = this.name, parameters = encodeTypeParameters(this.parameters);
      return parameters ? (name + '; ' + parameters) : name;
    },
    toJSON: function() {
      return this.toString();
    },
    test: function() {
      var other = TypeDescriptor.apply(null, arguments);
      if (other === this) return true;
      if (other.category !== this.category) return false;
      if (other.subtype !== this.subtype) return false;
      if (this.parameters === EMPTY) return true;
      other = other.parameters;
      if (other === EMPTY) return false;
      var keys = Object.freeze(Object.keys(this.parameters));
      for (var i = 0; i < keys.length; i++) {
        var parameterName = keys[i];
        if (this.parameters[parameterName] !== other[parameterName]) {
          return false;
        }
      }
      return true;
    },
  });
  Object.defineProperty(TypeDescriptor.prototype, 'name', {
    get: function() {
      return this.category + '/' + this.subtype;
    },
  });
  
  matchAny = Object.freeze(Object.assign(new TypeFilter, {
    filter: function() { return TypeFilter.apply(null, arguments); },
    except: function() { return TypeFilter.apply(null, arguments).inverted(); },
    inverted: function() { return matchNone; },
    or: function() { return this; },
    toJSON: function() { return true; },
    test: function() { return true; },
  }));
  
  matchNone = Object.freeze(Object.assign(new TypeFilter, {
    filter: function() { return matchNone; },
    except: function() { return matchNone; },
    inverted: function() { return matchAny; },
    or: function() { return TypeFilter.apply(null, arguments); },
    toJSON: function() { return false; },
    test: function() { return false; },
    count: function() { return matchNone; },
    willNeverMatch: true,
  }));
  
  function AndList(list) {
    if (Array.isArray(list)) {
      if (!Object.isFrozen(list)) {
        list = Object.freeze(list.slice());
      }
    }
    else {
      list = Object.freeze(Array.slice.apply(arguments));
    }
    this.list = list;
    Object.freeze(this);
  }
  AndList.prototype = Object.assign(new TypeFilter, {
    filter: function() {
      var filter = TypeFilter.apply(null, arguments);
      if (filter === matchNone) return matchNone;
      if (filter === matchAny) return this;
      if (filter instanceof AndList) {
        return new AndList(this.list.concat(filter.list));
      }
      return new AndList(this.list.concat(filter));
    },
    inverted: function() {
      return new OrList(Object.freeze(this.list.map(function(filter) {
        return filter.inverted();
      })));
    },
    reset: function() {
      var newList, resetElement;
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i] !== (resetElement = this.list[i].reset())) {
          newList = newList || this.list.slice();
          newList[i] = resetElement;
        }
      }
      return newList ? new AndList(Object.freeze(newList)) : this;
    },
    test: function() {
      var descriptor = TypeDescriptor.apply(null, arguments);
      for (var i = 0; i < this.list.length; i++) {
        if (!this.list[i].test(descriptor)) return false;
      }
      return true;
    },
  });
  Object.defineProperty(AndList, 'willNeverMatch', {
    get: function() {
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i].willNeverMatch) return true;
      }
      return false;
    },
  });
  
  function OrList(list) {
    if (Array.isArray(list)) {
      if (!Object.isFrozen(list)) {
        list = Object.freeze(list.slice());
      }
    }
    else {
      list = Object.freeze(Array.prototype.slice.apply(arguments));
    }
    this.list = list;
    Object.freeze(this);
  }
  OrList.prototype = Object.assign(new TypeFilter, {
    or: function() {
      var filter = TypeFilter.apply(null, arguments);
      if (filter === matchAny) return matchAny;
      if (filter === matchNone) return this;
      if (filter instanceof OrList) {
        return new OrList(this.list.concat(filter.list));
      }
      return new OrList(this.list.concat(filter));
    },
    inverted: function() {
      return new AndList(Object.freeze(this.list.map(function(filter) {
        return filter.inverted();
      })));
    },
    reset: function() {
      var newList, resetElement;
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i] !== (resetElement = this.list[i].reset())) {
          newList = newList || this.list.slice();
          newList[i] = resetElement;
        }
      }
      return newList ? new OrList(newList) : this;
    },
    test: function() {
      var descriptor = TypeDescriptor.apply(null, arguments);
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i].test(descriptor)) return true;
      }
      return false;
    },
  });
  Object.defineProperty(OrList, 'willNeverMatch', {
    get: function() {
      if (this.list.length === 0) return true;
      for (var i = 0; i < this.list.length; i++) {
        if (!this.list[i].willNeverMatch) return false;
      }
      return true;
    },
  });
  
  function Not(filter) {
    this.filter = filter;
    Object.freeze(this);
  }
  Not.prototype = Object.assign(new TypeFilter, {
    test: function() {
      return !this.filter.test.apply(this.filter, arguments);
    },
    inverted: function() {
      return this.filter;
    },
    reset: function() {
      var innerReset = this.filter.reset();
      if (innerReset === this.filter) return this;
      return new Not(innerReset);
    },
  });
  Object.defineProperty(Not, 'willNeverMatch', {
    get: function() {
      return !this.filter.willNeverMatch;
    },
  });
  
  function NameMatch(pattern, invert) {
    this.pattern = pattern;
    if (invert) this.isInverted = true;
    Object.freeze(this);
  }
  NameMatch.prototype = Object.assign(new TypeFilter, {
    isInverted: false,
    test: function() {
      var descriptor = TypeDescriptor.apply(null, arguments);
      if (this.isInverted) {
        return !this.pattern.test(descriptor.name);
      }
      else {
        return this.pattern.match(descriptor.name);
      }
    },
    inverted: function() {
      return new NameMatch(this.pattern, !this.isInverted);
    },
  });
  
  function ParameterMatch(name, pattern, invert) {
    this.name = name;
    this.pattern = pattern;
    if (invert) this.isInverted = true;
    Object.freeze(this);
  }
  ParameterMatch.prototype = Object.assign(new TypeFilter, {
    isInverted: false,
    test: function() {
      var descriptor = TypeDescriptor.apply(null, arguments);
      if (this.isInverted) {
        if (this.name in descriptor.properties) {
          return true;
        }
        return !this.pattern.test(descriptor.properties[this.name]);
      }
      else {
        if (this.name in descriptor.properties) {
          return false;
        }
        return this.pattern.test(descriptor.properties[this.name]);
      }
    },
    inverted: function() {
      return new ParameterMatch(this.name, this.pattern, !this.isInverted);
    },
  });
  
  function CountedMatch(filter, count, invert) {
    Object.defineProperties(this, {
      filter: {value:filter},
      startCount: {value:count},
      isInverted: {value:!!invert},
    });
    this.filter = filter;
    this.count = this.startCount = count;
  }
  CountedMatch.prototype = Object.assign(new TypeFilter, {
    test: function() {
      if (this.count < 1) return this.isInverted;
      var result = this.filter.test.apply(this.filter, arguments);
      if (this.isInverted) result = !result;
      if (result) this.count--;
      return result;
    },
    reset: function() {
      return new CountedMatch(this.filter, this.startCount, this.isInverted);
    },
    inverted: function() {
      return new CountedMatch(this.filter, this.startCount, !this.isInverted);
    },
  });
  Object.defineProperty(CountedMatch, 'willNeverMatch', {
    get: function() {
      return this.count < 1 || this.filter.willNeverMatch;
    },
  });
  
  return Object.assign(TypeDescriptor, {
    encodeString: encodeTypeString,
    decodeString: decodeTypeString,
    encodeParameters: encodeTypeParameters,
    decodeParameters: decodeTypeParameters,
    filter: TypeFilter,
    Filter: TypeFilter,
    except: function() {
      return TypeFilter.apply(null, arguments).inverted();
    },
    all: matchAny,
    none, matchNone,
    count: function(number) {
      return matchAny.count(number);
    },
    isDescriptorOrFilter: function(value) {
      if (value instanceof TypeDescriptor) return 'descriptor';
      if (value instanceof TypeFilter) return 'filter';
      return false;
    },
  });
 
});
