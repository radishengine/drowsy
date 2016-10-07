define(function() {

  'use strict';
  
  var tempBuffer = new ArrayBuffer(8);
  var tempFloat32 = new Float32Array(tempBuffer);
  var tempFloat64 = new Float64Array(tempBuffer);
  var tempInt32 = new Int32Array(tempBuffer);
  
  var MAX_INTEGER_AS_DOUBLE = Math.pow(2, 53);
  
  function retThis(){ return this; }
  function retValue(){ return this.value; }
  function retNumber(){ return +this.value; }
  function retString(){ return ''+this.value; }
  function retBoolean(){ return !!this.value; }
  function retInt8(){ return this.value << 24 >> 24; }
  function retInt16(){ return this.value << 16 >> 16; }
  function retInt32(){ return this.value | 0; }
  function retInt64(){ return Math.floor(this.value); }
  function retUint8(){ return this.value & 0xff; }
  function retUint16(){ return this.value & 0xffff; }
  function retUint32(){ return this.value >>> 0; }
  function retUint64() {
    var v = Math.floor(this.value);
    if (v >= 0) return v;
    v = -v;
    var lo = v | 0;
    var hi = (v / 0x100000000) | 0;
    if (lo === 0) {
      return new BoxedUint64(-hi, 0);
    }
    else {
      return new BoxedUint64(~hi, -lo);
    }
  }
  function retFloat32() {
    tempFloat32[0] = this.value;
    return tempFloat32[0];
  }
  function retFloat64(){ return +this.value; } 
  function retBoxedBoolean(){ return new BoxedBoolean(this.value); }
  function retBoxedInt8(){ return new BoxedInt8(this.value); }
  function retBoxedInt16(){ return new BoxedInt16(this.value); }
  function retBoxedInt32(){ return new BoxedInt32(this.value); }
  function retBoxedInt64(){
    var v = this.value;
    return new BoxedInt64(v < 0 ? -1 : v, v | 0);
  }
  function retBoxedUint8(){ return new BoxedUint8(this.value); }
  function retBoxedUint16(){ return new BoxedUint16(this.value); }
  function retBoxedUint32(){ return new BoxedUint32(this.value); }
  function retBoxedUint64(){
    var v = this.value;
    return new BoxedUint64(v < 0 ? -1 : v, v | 0);
  }
  function retBoxedFloat32(){ return new BoxedFloat32(this.value); }
  function retBoxedFloat64(){ return new BoxedFloat64(this.value); }
  
  var HASH_INT8 = 0x1b3432b0;
  var HASH_INT16 = 0xf1a9036;
  var HASH_INT32 = 0x6832d134;
  var HASH_INT64 = 0x8c34e6f5;
  var HASH_UINT8 = 0xafb416c3;
  var HASH_UINT16 = 0x47f22696;
  var HASH_UINT32 = 0x3f0a2256;
  var HASH_UINT64 = 0xa74ee61b;
  var HASH_FLOAT32 = 0x91f9ae85;
  var HASH_FLOAT64 = 0xd320c4e;
  var HASH_STRING = 0x6053b7f7;
  var HASH_TRUE = 0xbd5fdc92;
  var HASH_FALSE = 0xe84aa32;
  var HASH_NULL = 0x531173fb;
  
  var HASH_PROP = Object.HASH_PROP = Symbol('hash');
  
  Object.getHashCode = function(v) {
    if (v === null || typeof v === 'undefined') return HASH_NULL;
    return v[HASH_PROP];
  };
  
  Object.defineProperty(Object.prototype, HASH_PROP, {
    get: function() {
      var hash = (Math.random() * 0xffffffff) | 0;
      Object.defineProperty(this, HASH_PROP, {value:hash});
      return hash;
    },
  });
  
  Object.defineProperty(String.prototype, HASH_PROP, {
    get: function() {
      var i_max = this.length;
      var hash = HASH_STRING ^ i_max;
      var i_step = Math.max(1, i_max >>> 5);
      for (var i = 0; i < i_max; i += i_step) {
        hash = (hash >>> 3) | ((hash & 7) << 29);
        hash ^= this.charCodeAt(i);
      }
      return hash;
    },
  });
  
  Object.defineProperty(Number.prototype, HASH_PROP, {
    get: function() {
      tempFloat64[0] = this;
      var hash = HASH_FLOAT64 ^ tempInt32[0];
      hash = (hash >>> 16) | (hash << 16);
      return hash ^ tempInt32[1];
    },
  });
  
  Object.defineProperty(Boolean.prototype, HASH_PROP, {
    get: function() {
      return this ? HASH_TRUE : HASH_FALSE;
    },
  });
  
  function Boxed() {
  }
  Boxed.prototype = {
    toString: retString,
    i64_negate: function() {
      return -this.value;
    },
    i64_bnot: function() {
      return ~this.value;
    },
  };
  Object.defineProperties(Boxed.prototype, {
    normalized: {get: retValue},
    asBoolean: {get: retBoolean},
    asInt8: {get: retInt8},
    asInt16: {get: retInt16},
    asInt32: {get: retInt32},
    asInt64: {get: retInt64},
    asUint8: {get: retUint8},
    asUint16: {get: retUint16},
    asUint32: {get: retUint32},
    asUint64: {get: retUint64},
    asFloat32: {get: retValue},
    asFloat64: {get: retValue},
    asBoxedBoolean: {get: retBoxedBoolean},
    asBoxedInt8: {get: retBoxedInt8},
    asBoxedInt16: {get: retBoxedInt16},
    asBoxedInt32: {get: retBoxedInt32},
    asBoxedInt64: {get: retBoxedInt64},
    asBoxedUint8: {get: retBoxedUint8},
    asBoxedUint16: {get: retBoxedUint16},
    asBoxedUint32: {get: retBoxedUint32},
    asBoxedUint64: {get: retBoxedUint64},
    asBoxedFloat32: {get: retBoxedFloat32},
    asBoxedFloat64: {get: retBoxedFloat64},
  });
  
  function BoxedBoolean(value) { this.value = !!value; }
  function BoxedInt8(value) { this.value = value << 24 >> 24; }
  function BoxedUint8(value) { this.value = value & 0xff; }
  function BoxedInt16(value) { this.value = value << 16 >> 16; }
  function BoxedUint16(value) { this.value = value & 0xffff; }
  function BoxedInt32(value) { this.value = value | 0; }
  function BoxedUint32(value) { this.value = value >>> 0; }
  function BoxedFloat32(value) { tempFloat32[0] = value; this.value = tempFloat32[0]; }
  function BoxedFloat64(value) { this.value = +value; }
  
  [BoxedBoolean,
    BoxedInt8, BoxedInt16, BoxedInt32,
    BoxedUint8, BoxedUint16, BoxedUint32,
    BoxedFloat32, BoxedFloat64]
  .forEach(function(T) {
    T.prototype = new Boxed;
  });
  
  function Boxed64() {
  }
  Boxed64.prototype = {
    get asBoolean() { return this.lo && this.hi; },
    get asInt8() { return this.lo << 24 >> 24; },
    get asInt16() { return this.lo << 16 >> 16; },
    get asInt32() { return this.lo; },
    get asUint8() { return this.lo & 0xff; },
    get asUint16() { return this.lo & 0xffff; },
    get asUint32() { return this.lo >>> 0; },
    get asBoxedBoolean() { return new BoxedBoolean(this.lo && this.hi); },
    get asBoxedInt8() { return new BoxedInt8(this.lo); },
    get asBoxedInt16() { return new BoxedInt16(this.lo); },
    get asBoxedInt32() { return new BoxedInt32(this.lo); },
    get asBoxedUint8() { return new BoxedUint8(this.lo); },
    get asBoxedUint16() { return new BoxedUint16(this.lo); },
    get asBoxedUint32() { return new BoxedUint32(this.lo); },
    i64_negate: function() {
      var hi = this.hi, lo = this.lo;
      if (hi < 0) {
        if (lo === 0) {
          hi = -hi;
          lo = 0;
        }
        else {
          hi = ~hi;
          lo = -lo >>> 0;
        }
        if (hi < 0x200000) {
          return (hi * 0x100000000) + lo;
        }
      }
      else if (lo === 0) {
        hi = -hi;
      }
      else {
        hi = ~hi;
        lo = -lo >>> 0;
      }
      return new BoxedInt64(hi, lo);
    },
    i64_bnot: function() {
      var hi = ~this.hi, lo = ~this.lo;
      if (hi < 0) {
        var negatedHi, negatedLo;
        if (lo === 0) {
          negatedHi = -hi;
          negatedLo = 0;
        }
        else {
          negatedHi = ~hi;
          negatedLo = -lo >>> 0;
        }
        if (negatedHi < 0x200000) {
          return -((negatedHi * 0x100000000) + negatedLo);
        }
      }
      else if (hi < 0x200000) {
        return (hi * 0x100000000) + lo;
      }
      return new BoxedInt64(hi, lo);
    },
  };
  
  function BoxedInt64(hi, lo) { this.hi = hi | 0; this.lo = lo | 0; }
  function BoxedUint64(hi, lo) { this.hi = hi | 0; this.lo = lo | 0; }
  
  [BoxedInt64, BoxedUint64]
  .forEach(function(T) {
    T.prototype = new Boxed64;
  });
  
  Object.defineProperty(BoxedBoolean.prototype, HASH_PROP, {
    get: function() {
      return this.value ? HASH_TRUE : HASH_FALSE;
    },
  });
  
  Object.defineProperty(BoxedInt8.prototype, HASH_PROP, {
    get: function() {
      var v = this.value & 0xff;
      return (v | (v << 8) | (v << 16) | (v << 24)) ^ HASH_INT8;
    },
  });
  
  Object.defineProperty(BoxedUint8.prototype, HASH_PROP, {
    get: function() {
      var v = this.value;
      return (v | (v << 8) | (v << 16) | (v << 24)) ^ HASH_UINT8;
    },
  });
  
  Object.defineProperty(BoxedInt16.prototype, HASH_PROP, {
    get: function() {
      var v = this.value & 0xffff;
      return (v | (v << 16)) ^ HASH_INT16;
    },
  });
  
  Object.defineProperty(BoxedUint16.prototype, HASH_PROP, {
    get: function() {
      var v = this.value;
      return (v | (v << 16)) ^ HASH_UINT16;
    },
  });
  
  Object.defineProperty(BoxedInt32.prototype, HASH_PROP, {
    get: function() {
      return this.value ^ HASH_INT32;
    },
  });
  
  Object.defineProperty(BoxedUint32.prototype, HASH_PROP, {
    get: function() {
      return this.value ^ HASH_UINT32;
    },
  });
  
  Object.defineProperty(BoxedInt64.prototype, HASH_PROP, {
    get: function() {
      return this.hi ^ this.lo ^ HASH_INT64;
    },
  });
  
  Object.defineProperty(BoxedUint64.prototype, HASH_PROP, {
    get: function() {
      return this.hi ^ this.lo ^ HASH_UINT64;
    },
  });
  
  function uint64ToDecimalString(hi, lo) {
    var digits = [
      lo & 0xf,
      (lo >>> 4) & 0xf,
      (lo >>> 8) & 0xf,
      (lo >>> 12) & 0xf,
      (lo >>> 16) & 0xf,
      (lo >>> 20) & 0xf,
      (lo >>> 24) & 0xf,
      (lo >>> 28) & 0xf,
      hi & 0xf,
      (hi >>> 4) & 0xf,
      (hi >>> 8) & 0xf,
      (lo >>> 12) & 0xf,
      (hi >>> 16) & 0xf,
      (hi >>> 20) & 0xf,
      (hi >>> 24) & 0xf,
      (hi >>> 28) & 0xf];
    
    var fromBase = 16;
    
    // ** code below:
    // ** based on code by Dan Vanderkam <http://www.danvk.org/hex2dec.html>
    // ** (Apache License 2.0)
    
    // Adds two arrays for base 10, returning the result.
    // This turns out to be the only "primitive" operation we need.
    function addDigitArrays(x, y) {
      var z = [];
      for (var i = 0, carry = 0, i_max = Math.max(x.length, y.length); i < i_max || (carry !== 0); i++) {
        var zi = carry + (x[i] || 0) + (y[i] || 0);
        z.push(zi % 10);
        carry = Math.floor(zi / 10);
      }
      return z;
    }    

    function multiplyDigitArrayByNumber(digits, num) {
      if (num === 0) return [];
      var result = [];
      do {
        if (num & 1) result = addDigitArrays(result, digits);
        num >>>= 1;
        if (num === 0) return result;
        power = addDigitArrays(digits, digits);
      } while (true);
    }
    
    var outArray = [];
    var power = [1];
    for (var i = 0; i < digits.length; i++) {
      // invariant: at this point, fromBase^i = power
      if (digits[i] !== 0) {
        outArray = addDigitArrays(outArray, multiplyDigitArrayByNumber(power, digits[i]));
      }
      power = multiplyDigitArrayByNumber(power, fromBase);
    }
    return outArray.join('');
  }
  
  BoxedUint64.prototype.toString = function() {
    var hi = this.hi >>> 0, lo = this.lo >>> 0;
    if (hi < 0x200000) return ((hi * 0x100000000) + lo).toString();
    return uint64ToDecimalString(hi, lo);
  };
  
  BoxedInt64.prototype.toString = function() {
    var hi = this.hi | 0, lo;
    var negative = hi < 0;
    if (negative) {
      lo = this.lo | 0;
      if (lo === 0) {
        hi = -hi;
      }
      else {
        hi = ~hi;
        lo = -lo >>> 0;
      }
      negative = '-';
    }
    else {
      lo = this.lo >>> 0;
      negative = '';
    }
    if (hi < 0x200000) return negative + ((hi * 0x100000000) + lo).toString();
    return negative + uint64ToDecimalString(hi, lo);
  };
  
  Object.defineProperties(BoxedBoolean.prototype, {
    asBoolean: {get:retValue},
    asInt8: {get:retNumber},
    asInt16: {get:retNumber},
    asInt32: {get:retNumber},
    asInt64: {get:retNumber},
    asUint8: {get:retNumber},
    asUint16: {get:retNumber},
    asUint32: {get:retNumber},
    asUint64: {get:retNumber},
    asFloat32: {get:retNumber},
    asFloat64: {get:retNumber},
    asBoxedBoolean: {get:retThis},
    asBoxedInt64: {
      get: function() {
        return new BoxedInt64(0, +this.value);
      },
    },
    asBoxedUint64: {
      get: function() {
        return new BoxedUint64(0, +this.value);
      },
    },
  });
  
  Object.defineProperties(BoxedInt8.prototype, {
    asInt8: {get:retValue},
    asInt16: {get:retValue},
    asInt32: {get:retValue},
    asInt64: {get:retValue},
    asBoxedInt8: {get:retThis},
  });
  
  Object.defineProperties(BoxedInt16.prototype, {
    asInt16: {get:retValue},
    asInt32: {get:retValue},
    asBoxedInt16: {get:retThis},
  });
  
  Object.defineProperties(BoxedInt32.prototype, {
    asInt32: {get:retValue},
    asBoxedInt32: {get:retThis},
    asFloat32: {get:retFloat32},
  });
  
  Object.defineProperties(BoxedInt64.prototype, {
    normalized: {
      get: function() {
        var hi = this.hi;
        if (hi < 0) {
          var negativeHi = -hi;
          if (negativeHi < 0x200000) {
            var negativeLo = this.lo;
            if (negativeLo === 0) {
              negativeHi = -negativeHi;
            }
            else {
              negativeHi = ~negativeHi;
              negativeLo = -negativeLo >>> 0;
            }
            return -((negativeHi * 0x100000000) + (negativeLo >>> 0));
          }
        }
        else if (hi < 0x200000) {
          return (hi * 0x100000000) + (this.lo >>> 0);
        }
        return this;
      },
    },
    asInt64: {
      get: function() {
        return this.normalized;
      }
    },
    asUint64: {
      get: function() {
        var hi = this.hi, lo = this.lo;
        if (hi >= 0 && hi < 0x200000) {
          return (hi * 0x100000000) + (lo >>> 0);
        }
        return new BoxedUint64(hi, lo);
      },
    },
    asBoxedInt64: {get:retThis},
    asBoxedUint64: {
      get: function() {
        return new BoxedUint64(this.hi, this.lo);
      },
    },
  });
  
  Object.defineProperties(BoxedUint8.prototype, {
    asUint8: {get:retValue},
    asUint16: {get:retValue},
    asUint32: {get:retValue},
    asUint64: {get:retValue},
    asBoxedUint8: {get:retThis},
  });
  
  Object.defineProperties(BoxedUint16.prototype, {
    asUint16: {get:retValue},
    asUint32: {get:retValue},
    asUint64: {get:retValue},
    asBoxedUint16: {get:retThis},
  });
  
  Object.defineProperties(BoxedUint32.prototype, {
    asUint32: {get:retValue},
    asBoxedUint32: {get:retThis},
    asFloat32: {get:retFloat32},
  });
  
  Object.defineProperties(BoxedUint64.prototype, {
    normalized: {
      get: function() {
        var hi = this.hi;
        if (hi < 0 || hi >= 0x200000) return this;
        return (hi * 0x100000000) + this.lo;
      },
    },
    asUint64: {
      get: function() {
        return this.normalized;
      }
    },
    asInt64: {
      get: function() {
        var hi = this.hi, lo = this.lo;
        if (hi < 0) {
          var negativeHi, negativeLo;
          if (lo === 0) {
            negativeHi = -hi;
            negativeLo = 0;
          }
          else {
            negativeHi = ~hi;
            negativeLo = -lo >>> 0;
          }
          if (negativeHi < 0x200000) {
            return -((negativeHi * 0x100000000) + negativeLo);
          }
        }
        else if (hi < 0x200000) {
          return (hi * 0x100000000) + (lo >>> 0);
        }
        return new BoxedInt64(hi, lo);
      },
    },
    asBoxedUint64: {get:retThis},
    asBoxedInt64: {
      get: function() {
        return new BoxedInt64(this.hi, this.lo);
      },
    },
  });
  
  Object.defineProperties(BoxedFloat32.prototype, {
    asFloat32: {get:retValue},
    asFloat64: {get:retValue},
    asBoxedFloat32: {get:retThis},
  });
  
  Object.defineProperties(BoxedFloat64.prototype, {
    asFloat64: {get:retValue},
    asBoxedFloat64: {get:retThis},
  });
  
  Object.assign(Number.prototype, {
    i64_negate: function() {
      return -this;
    },
    i64_bnot: function() {
      return ~this;
    },
  });
  Object.defineProperties(Number.prototype, {
    normalized: {
      get: function() { return this; },
    },
    asBoolean: {
      get: function() { return !!this; },
    },
    asInt8: {
      get: function() { return this << 24 >> 24; },
    },
    asInt16: {
      get: function() { return this << 16 >> 16; },
    },
    asInt32: {
      get: function() { return this | 0; },
    },
    asInt64: {
      get: function() { return Math.floor(this); },
    },
    asUint8: {
      get: function() { return this & 0xff; }
    },
    asUint16: {
      get: function() { return this & 0xffff; }
    },
    asUint32: {
      get: function() { return this >>> 0; }
    },
    asUint64: {
      get: function() {
        var v = Math.floor(this);
        if (v >= 0) return v;
        var v = Math.floor(-this);
        var hi = (v / 0x100000000) | 0, lo = v | 0;
        if (lo === 0) {
          return new BoxedUint64(-hi, 0);
        }
        return new BoxedUint64(~hi, -lo);
      },
    },
    asFloat32:{
      get: function() {
        tempFloat32[0] = this;
        return tempFloat32[0];
      }
    },
    asFloat64: {
      get: function() { return this; }
    },
    asBoxedInt8: {
      get: function() { return new BoxedInt8(this); }
    },
    asBoxedInt16: {
      get: function() { return new BoxedInt16(this); }
    },
    asBoxedInt32: {
      get: function() { return new BoxedInt32(this); }
    },
    asBoxedUint8: {
      get: function(){ return new BoxedUint8(this); }
    },
    asBoxedUint16: {
      get: function() { return new BoxedUint16(this); }
    },
    asBoxedUint32: {
      get: function() { return new BoxedUint32(this); }
    },
    asBoxedFloat32: {
      get: function() { return new BoxedFloat32(this); }
    },
    asBoxedFloat64: {
      get: function() { return new BoxedFloat64(this); }
    },
  });
  
  Boolean.Boxed = BoxedBoolean;
  Number.BoxedInt8 = BoxedInt8;
  Number.BoxedInt16 = BoxedInt16;
  Number.BoxedInt32 = BoxedInt32;
  Number.BoxedInt64 = BoxedInt64;
  Number.BoxedUint8 = BoxedUint8;
  Number.BoxedUint16 = BoxedUint16;
  Number.BoxedUint32 = BoxedUint32;
  Number.BoxedUint64 = BoxedUint64;
  Number.BoxedFloat32 = BoxedFloat32;
  Number.BoxedFloat64 = BoxedFloat64;
  
});