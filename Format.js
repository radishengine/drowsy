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
  
  function FormatFilter() {
    if (this) return; // do nothing if used as a constructor
    if (arguments.length === 0) return matchAny;
    if (arguments[0] instanceof FormatFilter) {
      if (arguments.length !== 1) {
        if (arguments[0] instanceof Format) {
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
        andList.push(new Format(namePattern, stringParameters));
      }
    }
    else if (namePattern !== ANYSTRING) {
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
  FormatFilter.prototype = {
    filter: function() {
      var filter = FormatFilter.apply(null, arguments);
      if (filter === matchAny) return this;
      if (filter === matchNone) return matchNone;
      if (filter instanceof AndList) {
        return new AndList(Object.freeze([this].concat(filter.list)));
      }
      return new AndList(this, filter);
    },
    except: function() {
      return this.filter(FormatFilter.apply(null, arguments).inverted());
    },
    or: function() {
      var filter = FormatFilter.apply(null, arguments);
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
    count: function(number) {
      if (number < 1) return matchNone;
      return new CountedMatch(this, number);
    },
  };
  
  var formatHandlers = new WeakMap();
  
  var DEFAULT_TYPE;
  
  function Format(typeName, typeParameters) {
    if (!this) {
      if (typeName instanceof Format) {
        return typeName;
      }
      if (typeof typeName === 'object' && Array.isArray(typeName)) {
        return Format.apply(null, typeName);
      }
      if (!typeName && !typeParameters) {
        return DEFAULT_TYPE;
      }
      return new Format(typeName, typeParameters);
    }
    if (!typeName) typeName = DEFAULT_TYPE.typeName;
    var nameParts = typeName.match(/^\s*([a-z0-9_\-\.\+]+)\/([a-z0-9_\-\.\+]+)\s*(?:;(.*))?$/);
    if (!nameParts) {
      throw new TypeError('Format name must take the form: category/subtype');
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
  Format.prototype = Object.assign(Object.create(FormatFilter.prototype), {
    toString: function() {
      var name = this.name, parameters = encodeTypeParameters(this.parameters);
      return parameters ? (name + '; ' + parameters) : name;
    },
    toJSON: function() {
      return this.toString();
    },
    valueOf: function() {
      return this.toString();
    },
    test: function() {
      var other = Format.apply(null, arguments);
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
    getHandler: function() {
      var handler = formatHandlers.get(this);
      if (handler) return Promise.resolve(handler);
      var self = this;
      return new Promise(function(resolve, reject) {
        var requirePath = 'formats/' + self.name;
        require(
          [requirePath],
          function(handler) {
            if (typeof handler.withParameters === 'function' && Object.keys(self.parameters).length !== 0) {
              handler = handler.withParameters(self.parameters);
            }
            formatHandlers.set(self, handler);
            resolve(handler);
          },
          function() {
            Format.generic.getHandler().then(resolve);
          });
      });
    },
  });
  Object.defineProperty(Format.prototype, 'name', {
    get: function() {
      return this.category + '/' + this.subtype;
    },
  });
  
  DEFAULT_TYPE = new Format('application/octet-stream');
  
  matchAny = Object.freeze(Object.assign(new FormatFilter, {
    filter: function() { return FormatFilter.apply(null, arguments); },
    except: function() { return FormatFilter.apply(null, arguments).inverted(); },
    inverted: function() { return matchNone; },
    or: function() { return this; },
    toJSON: function() { return {any: true}; },
    test: function() { return true; },
  }));
  
  matchNone = Object.freeze(Object.assign(new FormatFilter, {
    filter: function() { return matchNone; },
    except: function() { return matchNone; },
    inverted: function() { return matchAny; },
    or: function() { return FormatFilter.apply(null, arguments); },
    toJSON: function() { return {any: false}; },
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
      list = Object.freeze(Array.prototype.slice.apply(arguments));
    }
    this.list = list;
    Object.freeze(this);
  }
  AndList.prototype = Object.assign(new FormatFilter, {
    filter: function() {
      var filter = FormatFilter.apply(null, arguments);
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
      var descriptor = Format.apply(null, arguments);
      for (var i = 0; i < this.list.length; i++) {
        if (!this.list[i].test(descriptor)) return false;
      }
      return true;
    },
    toJSON: function() {
      return {all: this.list};
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
  OrList.prototype = Object.assign(new FormatFilter, {
    or: function() {
      var filter = FormatFilter.apply(null, arguments);
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
      var descriptor = Format.apply(null, arguments);
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i].test(descriptor)) return true;
      }
      return false;
    },
    toJSON: function() {
      return {any: this.list};
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
  Not.prototype = Object.assign(new FormatFilter, {
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
    toJSON: function() {
      return {not: this.filter};
    },
  });
  Object.defineProperty(Not, 'willNeverMatch', {
    get: function() {
      return false;
    },
  });
  
  function NameMatch(pattern, invert) {
    this.pattern = pattern;
    if (invert) this.isInverted = true;
    Object.freeze(this);
  }
  NameMatch.prototype = Object.assign(new FormatFilter, {
    isInverted: false,
    test: function() {
      var descriptor = Format.apply(null, arguments);
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
    toJSON: function() {
      var json = {
        name: this.pattern.flags
          ? [this.pattern.source, this.pattern.flags]
          : this.pattern.source,
      };
      if (this.isInverted) json = {not: json};
      return json;
    },
  });
  
  function ParameterMatch(name, pattern, invert) {
    this.name = name;
    this.pattern = pattern;
    if (invert) this.isInverted = true;
    Object.freeze(this);
  }
  ParameterMatch.prototype = Object.assign(new FormatFilter, {
    isInverted: false,
    test: function() {
      var descriptor = Format.apply(null, arguments);
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
    toJSON: function() {
      var json = {parameter: [this.name, this.pattern.source]};
      if (this.pattern.flags) {
        json.parameter.push(this.pattern.flags);
      }
      if (this.isInverted) json = {not: json};
      return json;
    },
  });
  
  function CountedMatch(filter, count, invert) {
    Object.defineProperties(this, {
      filter: {value:filter},
      startCount: {value:count},
      isInverted: {value:!!invert},
    });
    this.count = count;
    Object.seal(this);
  }
  CountedMatch.prototype = Object.assign(new FormatFilter, {
    test: function() {
      if (this.count < 1) return this.isInverted;
      var result = this.filter.test.apply(this.filter, arguments);
      if (result) this.count--;
      if (this.isInverted) result = !result;
      return result;
    },
    reset: function() {
      return new CountedMatch(this.filter, this.startCount, this.isInverted);
    },
    inverted: function() {
      return new CountedMatch(this.filter, this.startCount, !this.isInverted);
    },
    toJSON: function() {
      var json = {count:[this.startCount, this.filter]};
      if (this.isInverted) json = {not: json};
      return json;
    },
    count: function(number) {
      if (number < 1) return matchNone;
      return new CountedMatch(this.filter, number * this.startCount, this.isInverted);
    },
  });
  Object.defineProperty(CountedMatch, 'willNeverMatch', {
    get: function() {
      return this.count < 1 || this.filter.willNeverMatch;
    },
  });
  
  Object.assign(Format, {
    encodeString: encodeTypeString,
    decodeString: decodeTypeString,
    encodeParameters: encodeTypeParameters,
    decodeParameters: decodeTypeParameters,
    filter: FormatFilter.bind(null),
    Filter: FormatFilter,
    except: function() {
      return FormatFilter.apply(null, arguments).inverted();
    },
    all: matchAny,
    none: matchNone,
    count: function(number) {
      return matchAny.count(number);
    },
    generic: DEFAULT_TYPE,
    fromJSON: function(json) {
      if (typeof json === 'string') {
        if (/^\s*\{/.test(json)) {
          json = JSON.parse(json);
        }
        else {
          return new Format(json);
        }
      }
      if (typeof json !== 'object' || json === null) return null;
      function fromObject(v) {
        var keys = Object.keys(v);
        if (keys.length !== 1) throw new Error('not a valid JSON-encoded type filter');
        var key = keys[0];
        var value = v[key];
        switch (key) {
          case 'any':
            if (value === true) return matchAny;
            if (value === false) return matchNone;
            if (!Array.isArray(value)) {
              throw new Error('not a valid JSON-encoded type filter');
            }
            return new OrList(Object.freeze(value.map(fromValue)));
          case 'all':
            if (!Array.isArray(value)) {
              throw new Error('not a valid JSON-encoded type filter');
            }
            return new AndList(Object.freeze(value.map(fromValue)));
          case 'count':
            if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'number') {
              throw new Error('not a valid JSON-encoded type filter');
            }
            return new CountedMatch(fromValue(value[1]), value[0]);
          case 'not':
            return fromValue(value).inverted();
          case 'name':
            if (typeof value === 'string') {
              return new NameMatch(new RegExp(value));
            }
            else if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string') {
              throw new Error('not a valid JSON-encoded type filter');
            }
            return new NameMatch(new RegExp(value[0], value[1]));
          case 'parameter':
            if (!Array.isArray(value) || value.length < 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string') {
              throw new Error('not a valid JSON-encoded type filter');
            }
            return new ParameterMatch(value[0], new RegExp(value[1], value[2]));
          default:
            throw new Error('not a valid JSON-encoded type filter');
        }
      }
      function fromValue(v) {
        if (typeof v === 'string') {
          return new Format(v);
        }
        if (typeof v !== 'object' || v === null) {
          throw new Error('not a valid JSON-encoded type filter');
        }
        return fromObject(v);
      }
      return fromObject(json);
    },
  });
  
  return Format;
 
});
