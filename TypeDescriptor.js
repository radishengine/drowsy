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
  
  function TypeDescriptor(typeName, typeParameters) {
    var nameParts = typeName.match(/^\s*([a-z0-9_\-\.]+)\/([a-z0-9_\-\.]+)\s*(?:;(.*))?$/);
    if (!nameParts) {
      throw new TypeError('Type name must take the form: category/subtype');
    }
    this.category = nameParts[1];
    this.subtype = nameParts[2];
    if (!typeParameters) {
      typeParameters = EMPTY;
    }
    else {
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
  Object.assign(TypeDescriptor, {
    encodeString: encodeTypeString,
    decodeString: decodeTypeString,
    encodeParameters: encodeTypeParameters,
    decodeParameters: decodeTypeParameters,
  });
  TypeDescriptor.prototype = {
    get name() {
      return this.category + '/' + this.subtype;
    },
    toString: function() {
      var name = this.name, parameters = encodeTypeParameters(this.parameters);
      return parameters ? (name + '; ' + parameters) : name;
    },
    toJSON: function() {
      if (this.parameters === EMPTY) return this.name;
      return [this.name, this.parameters];
    },
    test: function(other, withNoOtherParameters) {
      if (other.category !== this.category) return false;
      if (other.subtype !== this.subtype) return false;
      if (this.parameters === EMPTY) {
        if (withNoOtherParameters) {
          return other.parameters === EMPTY || (Object.keys(other.parameters).length === 0);
        }
        return true;
      }
      if (other.parameters === EMPTY) {
        return false;
      }
      var keys = Object.freeze(Object.keys(this.parameters));
      other = other.parameters;
      if (withNoOtherParameters) other = Object.assign({}, other);
      for (var i = 0; i < keys.length; i++) {
        if (this.parameters[keys[i]] !== other[keys[i]]) {
          return false;
        }
        if (withNoOtherParameters) delete other[keys[i]];
      }
      if (withNoOtherParameters) {
        return Object.keys(other).length === 0;
      }
      return true;
    },
    filter: function() {
      if (arguments.length === 0) return filter(this);
      return filter(this).filter(filter.apply(null, arguments));
    },
    except: function() {
      return filter(this).except(filter.apply(null, arguments));
    },
    or: function() {
      return filter(this).or(filter.apply(null, arguments));
    },
    reset: function() {
      return filter(this);
    },
    willNeverMatch: false,
  };
  
  var matchAny, matchNone;
  
  function TypeFilter() {
  }
  TypeFilter.prototype = {
    filter: function() {
      var filter = filter.apply(null, parameters);
      if (filter === matchAny) return this;
      if (filter === matchNone) return matchNone;
      return new AndList(this, filter);
    },
    except: function() {
      return this.filter(filter.apply(null, parameters).inverted());
    },
    or: function() {
      var filter = filter.apply(null, parameters);
      if (filter === matchAny) return matchAny;
      if (filter === matchNone) return this;
      return new OrList(this, filter);
    },
    reset: function() {
      return this;
    },
    willNeverMatch: false,
  };
  
  matchAny = Object.freeze(Object.assign(new TypeFilter, {
    filter: function() { return filter.apply(null, arguments); },
    except: function() { return filter.apply(null, arguments).inverted(); },
    inverted: function() { return matchNone; },
    or: function() { return this; },
    toJSON: function() { return true; },
    test: function(descriptor) {
      return true;
    },
  }));
  
  matchNone = Object.freeze(Object.assign(new TypeFilter, {
    filter: function() { return matchNone; },
    except: function() { return matchNone; },
    inverted: function() { return matchAny; },
    or: function() { return filter.apply(null, arguments); },
    toJSON: function() { return false; },
    test: function() { return false; },
    count: function() { return matchNone; },
    willNeverMatch: true,
  }));
  
  function AndList(list) {
    if (Array.isArray(list)) {
      var copy = null;
      if (!Object.isFrozen(list)) {
        copy = list.map(filter);
      }
      else {
        for (var i = 0; i < list.length; i++) {
        }
      }
      if (copy !== null) {
        list = Object.freeze(copy);
      }
    }
    else {
      list = Object.freeze(Array.prototype.map.apply(arguments, filter));
    }
    this.list = list;
    Object.freeze(this);
  }
  AndList.prototype = Object.assign(new TypeFilter, {
    filter: function() {
      var filter = filter.apply(null, arguments);
      if (filter === none) return none;
      if (filter === all) return this;
      if (filter instanceof AndList) {
        return new AndList(this.list.concat(filter.list));
      }
      return new AndList(this.list.concat(filter));
    },
    inverted: function() {
      return new OrList(this.list.map(function(filter) {
        return filter.inverted();
      }));
    },
    reset: function() {
      var newList, resetElement;
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i] !== (resetElement = this.list[i].reset())) {
          newList = newList || this.list.slice();
          newList[i] = resetElement;
        }
      }
      return newList ? new AndList(newList) : this;
    },
    test: function(descriptor) {
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
      list = Object.freeze(list.map(filter));
    }
    else {
      list = Object.freeze(Array.prototype.map.apply(arguments, filter));
    }
    this.list = list;
    Object.freeze(this);
  }
  OrList.prototype = Object.assign(new TypeFilter(EMPTY), {
    or: function() {
      var filter = filter.apply(null, arguments);
      if (filter === all) return all;
      if (filter === none) return this;
      if (filter instanceof OrList) {
        return new OrList(this.list.concat(filter.list));
      }
      return new OrList(this.list.concat(filter));
    },
    inverted: function() {
      return new AndList(this.list.map(function(filter) {
        return filter.inverted();
      }));
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
    test: function(descriptor) {
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
  
  function NameMatch(pattern, invert) {
    this.pattern = pattern;
    if (invert) this.isInverted = true;
    Object.freeze(this);
  }
  NameMatch.prototype = Object.assign(new TypeFilter, {
    isInverted: false,
    test: function(descriptor) {
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
    test: function(descriptor) {
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
      if (this.count < 1) return false;
      var result = this.filter.test.apply(this.filter, arguments);
      if (result) this.count--;
      return this.isInverted ? result : !result;
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
  
  var descriptorFilterCache = new WeakMap();
  
  function filter(namePattern, parameterPatterns) {
    if (arguments.length === 0) return matchAny;
    if (namePattern instanceof TypeDescriptor) {
      var filterChain = [];
      var i = 0;
      do {
        var filter = descriptorFilterCache.get(arguments[i]);
        if (!filter) {
          var andList = [new NameMatch(new RegExp('^' + regexEscape(arguments[i].name) + '$'))];
          var keys = Object.keys(arguments[i].parameters);
          for (var j = 0; j < keys.length; j++) {
            var key = keys[j];
            var value = arguments[i].parameters[key];
            andList.push(new ParameterMatch(key, new RegExp('^' + regexEscape(value) + '$')));
          }
          if (andList.length === 1) {
            filter = andList[0];
          }
          else {
            filter = new AndList(andList);
          }
          descriptorFilterCache.set(arguments[i], filter);
        }
        filterChain.push(filter);
        if (++i >= arguments.length) {
          if (filterChain.length === 1) return filterChain[0];
          return new OrList(Object.freeze(filterChain));
        }
        if (!(arguments[i] instanceof TypeDescriptor)) {
          throw new TypeError('filter(descriptor [, descriptor...]): every argument must be a descriptor object');
        }
      } while (true);
    }
    if (typeof parameterPatterns === 'string') {
      namePattern = namePattern + '/' + parameterPatterns;
      parameterPatterns = arguments[2];
    }
    else if (typeof namePattern === 'object') {
      parameterPatterns = namePattern;
      namePattern = ANYSTRING;
    }
    var andList = [];
    if (typeof namePattern === 'string') {
      var nameParts = namePattern.match(/^\s*([^\/]+\/[^\/;]+)(?:\s*;\s*(\S.*)?)?$/);
      if (!nameParts) {
        throw new Error('type name must take the form: category/subtype');
      }
      if (nameParts[1] !== '*/*') {
        namePattern = new RegExp('^' + nameParts[1].split(/\*/g).map(regexEscape).join('.*') + '$');
        andList.push(new NameMatch(namePattern));
      }
      if (typeof nameParts[2] === 'string') {
        var extraParameterPatterns = decodeTypeParameters(nameParts[2]);
        var keys = Object.keys(extraParameterPatterns);
        for (var i = 0; i < keys.length; i++) {
          var name = keys[i];
          var pattern = extraParameterPatterns[name];
          andList.push(new ParameterMatch(name, new RegExp('^' + regexEscape(pattern) + '$')));
        }
      }
    }
    else if (namePattern !== ANYSTRING) {
      filter = filter.filter(new NameMatch(namePattern));
    }
    if (parameterPatterns) {
      var keys = Object.keys(parameterPatterns);
      for (var i = 0; i < keys.length; i++) {
        var parameterName = keys[i];
        var parameterPattern = parameterPatterns[parameterName];
        if (parameterPattern === true) {
          andList.push(new ParameterPattern(parameterName, ANYSTRING));
        }
        else if (parameterPattern === false) {
          andList.push(new ParameterPattern(parameterName, ANYSTRING, true));
        }
        else if (parameterPattern instanceof RegExp) {
          andList.push(new ParameterPattern(parameterName, parameterPattern));
        }
        else {
          parameterPattern = new RegExp('^' + regexEscape('' + parameterPattern) + '$');
          andList.push(new ParameterPattern(parameterName, parameterPattern));
        }
      }
    }
    if (andList.length === 0) return matchAny;
    if (andList.length === 1) return andList[0];
    return new AndList(Object.freeze(andList));
  }
  
  TypeDescriptor.Filter = TypeFilter;
  TypeDescriptor.filter = filter;
  TypeDescriptor.except = function() {
    return filter.apply(null, arguments).inverted();
  };
  TypeDescriptor.any = matchAny;
  TypeDescriptor.none = matchNone;
  TypeDescriptor.count = function(number) {
    return matchAny.count(number);
  };
  
  return TypeDescriptor;
 
});
