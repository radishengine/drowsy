define(function() {
  
  // The advice is, never add to standard object prototypes. Why is that?
  // Well, it's because some other code somewhere might also want to add to it too.
  // No fair. Why does that OTHER code get to have all the fun?
  
  // (Let's get this proof-of-concept working first. If you want, we can worry about being a good neighbor later.)

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
  function badSet(){ throw new Error('cannot set unboxed value'); }
  
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
      return this.asBoxedInt64.i64_bnot();
    },
    u64_bnot: function() {
      return this.value.u64_bnot();
    },
    i64_bxor: function(other) {
      return this.asBoxedInt64.i64_bxor(other);
    },
    u64_bxor: function(other) {
      return this.asBoxedUint64.u64_bxor(other);
    },
    i64_band: function(other) {
      return this.asBoxedInt64.i64_band(other);
    },
    u64_band: function(other) {
      return this.asBoxedUint64.u64_band(other);
    },
    i64_bor: function(other) {
      return this.asBoxedInt64.i64_bor(other);
    },
    u64_bor: function(other) {
      return this.asBoxedUint64.u64_bor(other);
    },
    i64_lshift: function(count) {
      return this.asBoxedInt64.i64_lshift(count);
    },
    u64_lshift: function(count) {
      return this.asBoxedUint64.u64_lshift(count);
    },
    i64_arshift: function(count) {
      return this.asBoxedInt64.i64_arshift(count);
    },
    u64_rshift: function(count) {
      return this.asBoxedUint64.u64_rshift(count);
    },
    eq64: function(other) {
      if (other instanceof Boxed) other = other.value;
      if (typeof other === 'number' || typeof other === 'boolean') return +this.value === +other;
      return other.eq64(this);
    },
    neq64: function(other) {
      if (other instanceof Boxed) other = other.value;
      if (typeof other === 'number' || typeof other === 'boolean') return +this.value !== +other;
      return !other.eq64(this);
    },
    lt64: function(other) {
      if (other instanceof Boxed) other = other.value;
      if (typeof other === 'number' || typeof other === 'boolean') return this.value < other;
      return !other.lte64(this);
    },
    lte64: function(other) {
      if (other instanceof Boxed) other = other.value;
      if (typeof other === 'number' || typeof other === 'boolean') return this.value <= other;
      return !other.lt64(this);
    },
    gt64: function(other) {
      if (other instanceof Boxed) other = other.value;
      if (typeof other === 'number' || typeof other === 'boolean') return this.value > other;
      return other.lte64(this);
    },
    gte64: function(other) {
      if (other instanceof Boxed) other = other.value;
      if (typeof other === 'number' || typeof other === 'boolean') return this.value >= other;
      return other.lt64(this);
    },
    i64_add: function(other) {
      if (other instanceof Boxed) other = other.value;
      if (typeof other === 'number' || typeof other === 'boolean') return this.value + other;
      return other.i64_add(this);
    },
    u64_add: function(other) {
      if (other instanceof Boxed) other = other.value;
      if (typeof other === 'number' || typeof other === 'boolean') return (this.value + other).asUint64;
      return other.u64_add(this);
    },
    i64_sub: function(subtraction) {
      subtraction = subtraction.i64_negate();
      if (typeof subtraction === 'number') return this.value + subtraction;
      return subtraction.i64_add(this);
    },
    u64_sub: function(subtraction) {
      subtraction = subtraction.i64_negate();
      if (typeof subtraction === 'number') return this.value + subtraction;
      return subtraction.u64_add(this);
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
  
  function BoxedBoolean(value) { this.value = value.asBoolean; }
  function BoxedInt8(value) { this.value = value.asInt8; }
  function BoxedInt16(value) { this.value = value.asInt16; }
  function BoxedInt32(value) { this.value = value.asInt32; }
  function BoxedUint8(value) { this.value = value.asUint8; }
  function BoxedUint16(value) { this.value = value.asUint16; }
  function BoxedUint32(value) { this.value = value.asUint32; }
  function BoxedFloat32(value) { this.value = value.asFloat32; }
  function BoxedFloat64(value) { this.value = value.asFloat64; }
  
  [BoxedBoolean,
    BoxedInt8, BoxedInt16, BoxedInt32,
    BoxedUint8, BoxedUint16, BoxedUint32,
    BoxedFloat32, BoxedFloat64]
  .forEach(function(T) {
    T.prototype = new Boxed;
  });
  
  BoxedBoolean.prototype.set = function(value) { return this.value = value.asBoolean; }
  BoxedInt8.prototype.set = function(value) { return this.value = value.asInt8; }
  BoxedInt16.prototype.set = function(value) { return this.value = value.asInt16; }
  BoxedInt32.prototype.set = function(value) { return this.value = value.asInt32; }
  BoxedUint8.prototype.set = function(value) { return this.value = value.asUint8; }
  BoxedUint16.prototype.set = function(value) { return this.value = value.asUint16; }
  BoxedUint32.prototype.set = function(value) { return this.value = value.asUint32; }
  BoxedFloat32.prototype.set = function(value) { return this.value = value.asFloat32; }
  BoxedFloat64.prototype.set = function(value) { return this.value = value.asFloat64; }
  
  BoxedBoolean.prototype.set_add = function(value) { return this.value = !!(this.value + value.asBoolean); }
  BoxedInt8.prototype.set_add = function(value) { return this.value = (this.value + value.asInt8) << 24 >> 24; }
  BoxedInt16.prototype.set_add = function(value) { return this.value = (this.value + value.asInt16) << 16 >> 16; }
  BoxedInt32.prototype.set_add = function(value) { return this.value = (this.value + value.asInt32) | 0; }
  BoxedUint8.prototype.set_add = function(value) { return this.value = (this.value + value.asUint8) & 0xff; }
  BoxedUint16.prototype.set_add = function(value) { return this.value = (this.value + value.asUint16) & 0xffff; }
  BoxedUint32.prototype.set_add = function(value) { return this.value = (this.value + value.asUint32) >>> 0; }
  BoxedFloat32.prototype.set_add = function(value) { return this.value = (this.value + value.asFloat64).asFloat32; }
  BoxedFloat64.prototype.set_add = function(value) { return this.value = this.value + value.asFloat64; }
  
  BoxedBoolean.prototype.set_sub = function(value) { return this.value = !!(this.value - value.asBoolean); }
  BoxedInt8.prototype.set_sub = function(value) { return this.value = (this.value - value.asInt8) << 24 >> 24; }
  BoxedInt16.prototype.set_sub = function(value) { return this.value = (this.value - value.asInt16) << 16 >> 16; }
  BoxedInt32.prototype.set_sub = function(value) { return this.value = (this.value - value.asInt32) | 0; }
  BoxedUint8.prototype.set_sub = function(value) { return this.value = (this.value - value.asUint8) & 0xff; }
  BoxedUint16.prototype.set_sub = function(value) { return this.value = (this.value - value.asUint16) & 0xffff; }
  BoxedUint32.prototype.set_sub = function(value) { return this.value = (this.value - value.asUint32) >>> 0; }
  BoxedFloat32.prototype.set_sub = function(value) { return this.value = (this.value - value.asFloat64).asFloat32; }
  BoxedFloat64.prototype.set_sub = function(value) { return this.value = this.value - value.asFloat64; }
  
  function Boxed64() {
  }
  Boxed64.prototype = {
    set: function(value) {
      if (typeof value === 'number' || typeof value === 'boolean') {
        if (value < 0) {
          var negated = -value;
          var hi = (negated / 0x100000000) | 0, lo = negated | 0;
          if (lo === 0) {
            this.hi = -hi;
            this.lo = 0;
          }
          else {
            this.hi = ~hi;
            this.lo = -lo;
          }
        }
        else {
          this.hi = (value / 0x100000000) | 0;
          this.lo = value | 0;
        }
        return value;
      }
      else {
        this.hi = value.hi;
        this.lo = value.lo;
      }
      return this;
    },
    set_add: function(value) {
      value = value.asBoxedInt64;
      var lo = (this.lo >>> 0) + (value.lo >>> 0);
      if (lo < 0x100000000) {
        this.hi = (this.hi + value.hi) | 0;
      }
      else {
        this.hi = (this.hi + value.hi + 1) | 0;
      }
      this.lo = lo | 0;
      return this;
    },
    set_sub: function(value) {
      return this.set_add(value.i64_negate());
    },
    get asBoolean() { return !!(this.lo || this.hi); },
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
      }
      else if (lo === 0) {
        hi = -hi;
      }
      else {
        hi = ~hi;
        lo = -lo >>> 0;
      }
      if (hi < 0x200000) {
        return (hi * 0x100000000) + lo;
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
    u64_bnot: function() {
      var hi = ~this.hi, lo = ~this.lo;
      if (hi >= 0 && hi < 0x200000) {
        return (hi * 0x100000000) + (lo >>> 0);
      }
      return new BoxedUint64(hi, lo);
    },
    i64_bxor: function(other) {
      other = other.asBoxedInt64;
      return new BoxedInt64(this.hi ^ other.hi, this.lo ^ other.lo).normalized;
    },
    u64_bxor: function(other) {
      other = other.asBoxedUint64;
      return new BoxedUint64(this.hi ^ other.hi, this.lo ^ other.lo).normalized;
    },
    i64_band: function(other) {
      other = other.asBoxedInt64;
      var hi = this.hi & other.hi, lo = this.lo & other.lo;
      if (hi === 0) {
        return lo >>> 0;
      }
      else if (hi === -1) {
        return (lo < 0) ? lo : ~lo;
      }
      return new BoxedInt64(hi, lo).normalized;
    },
    u64_band: function(other) {
      other = other.asBoxedUint64;
      var hi = this.hi & other.hi, lo = this.lo & other.lo;
      if (hi === 0) {
        return lo >>> 0;
      }
      return new BoxedUint64(hi, lo).normalized;
    },
    i64_bor: function(other) {
      other = other.asBoxedInt64;
      return new BoxedInt64(this.hi | other.hi, this.lo | other.lo).normalized;
    },
    u64_bor: function(other) {
      other = other.asBoxedUint64;
      return new BoxedUint64(this.hi | other.hi, this.lo | other.lo).normalized;
    },
    i64_lshift: function(count) {
      var hi = this.hi, lo = this.lo;
      while (count >= 32) {
        hi = lo;
        lo = 0;
        count -= 32;
      }
      hi <<= count;
      hi |= (lo >> (32 - count)) & ((1 << count) - 1);
      lo <<= count;
      return new BoxedInt64(hi, lo).normalized;
    },
    u64_lshift: function(count) {
      var hi = this.hi, lo = this.lo;
      while (count >= 32) {
        hi = lo;
        lo = 0;
        count -= 32;
      }
      hi <<= count;
      hi |= (lo >> (32 - count)) & ((1 << count) - 1);
      lo <<= count;
      return new BoxedUint64(hi, lo).normalized;
    },
    i64_arshift: function(count) {
      var hi = this.hi, lo = this.lo;
      while (count >= 32) {
        lo = hi;
        hi = (hi < 0) ? -1 : 0;
        count -= 32;
      }
      lo >>= count;
      lo |= (hi & ((1 << count) - 1)) << (32 - count);
      hi >>= count;
      return new BoxedInt64(hi, lo).normalized;
    },
    u64_rshift: function(count) {
      var hi = this.hi, lo = this.lo;
      while (count >= 32) {
        lo = hi;
        hi = 0;
        count -= 32;
      }
      lo >>>= count;
      lo |= (hi & ((1 << count) - 1)) << (32 - count);
      hi >>>= count;
      return new BoxedUint64(hi | 0, lo).normalized;
    },
    neq64: function(other) {
      return !this.eq64(other);
    },
    gt64: function(other) {
      return !this.lte64(other);
    },
    gte64: function(other) {
      return !this.lt64(other);
    },
    i64_add: function(other) {
      return new BoxedInt64(this.hi, this.lo).set_add(other).normalized;
    },
    u64_add: function(other) {
      return new BoxedUint64(this.hi, this.lo).set_add(other).normalized;
    },
    i64_sub: function(subtraction) {
      return new BoxedInt64(this.hi, this.lo).set_add(subtraction.i64_negate()).normalized;
    },
    u64_sub: function(subtraction) {
      return new BoxedUint64(this.hi, this.lo).set_add(subtraction.i64_negate()).normalized;
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
  
  Object.assign(BoxedInt64.prototype, {
    eq64: function(other) {
      var hi = this.hi, lo = this.lo;
      if (typeof other === 'number' || typeof other === 'boolean') {
        if (hi < 0) {
          if (lo === 0) {
            hi = -hi;
          }
          else {
            hi = ~hi;
            lo = -lo >>> 0;
          }
          return -other === ((hi * 0x100000000) + lo);
        }
        return +other === ((hi * 0x100000000) + (lo >>> 0));
      }
      if (other instanceof BoxedUint64 && hi < 0) return false;
      return hi === other.hi && lo === other.lo;
    },
    lt64: function(other) {
      var hi = this.hi, lo = this.lo;
      if (typeof other === 'number' || typeof other === 'boolean') {
        if (hi < 0) {
          if (other >= 0) return true;
          if (lo === 0) {
            hi = -hi;
          }
          else {
            hi = ~hi;
            lo = -lo >>> 0;
          }
          return -((hi * 0x100000000) + lo) < other;
        }
        return ((hi * 0x100000000) + (lo >>> 0)) < other;
      }
      var other_hi = other.hi;
      if (hi < 0 && (other_hi >= 0 || other instanceof BoxedUint64)) return true;
      if (hi === other_hi) {
        return lo < other.lo;
      }
      return hi < other_hi;
    },
    lte64: function(other) {
      var hi = this.hi, lo = this.lo;
      if (typeof other === 'number' || typeof other === 'boolean') {
        if (hi < 0) {
          if (other >= 0) return true;
          if (lo === 0) {
            hi = -hi;
          }
          else {
            hi = ~hi;
            lo = -lo >>> 0;
          }
          return -((hi * 0x100000000) + lo) <= other;
        }
        return ((hi * 0x100000000) + (lo >>> 0)) <= other;
      }
      var other_hi = other.hi;
      if (hi < 0 && (other_hi >= 0 || other instanceof BoxedUint64)) return true;
      if (hi === other_hi) {
        return lo <= other.lo;
      }
      return hi < other_hi;
    },
  });
  
  Object.defineProperties(BoxedInt64.prototype, {
    normalized: {
      get: function() {
        var hi = this.hi;
        if (hi < 0) {
          var negativeHi, negativeLo = this.lo;
          if (negativeLo === 0) {
            negativeHi = -hi;
          }
          else {
            negativeHi = ~hi;
            negativeLo = -negativeLo >>> 0;
          }
          if (negativeHi < 0x200000) {
            return -((negativeHi * 0x100000000) + negativeLo);
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
  
  Object.assign(BoxedUint64.prototype, {
    eq64: function(other) {
      var hi = this.hi >>> 0, lo = this.lo >>> 0;
      if (typeof other === 'number' || typeof other === 'boolean') {
        if (other < 0) return false;
        return +other === ((hi * 0x100000000) + lo);
      }
      if (other instanceof BoxedInt64 && other.hi < 0) return false;
      return hi === other.hi && lo === other.lo;
    },
    lt64: function(other) {
      var hi = this.hi >>> 0, lo = this.lo >>> 0;
      if (typeof other === 'number' || typeof other === 'boolean') {
        return (other >= 0) && ((hi * 0x100000000 + lo) < other);
      }
      var other_hi = other.hi;
      if (other instanceof BoxedInt64 && other_hi < 0) return false;
      if (hi === other_hi) {
        return lo < other.lo;
      }
      return hi < other_hi;
    },
    lte64: function(other) {
      var hi = this.hi >>> 0, lo = this.lo >>> 0;
      if (typeof other === 'number' || typeof other === 'boolean') {
        return (other >= 0) && ((hi * 0x100000000 + lo) <= other);
      }
      var other_hi = other.hi;
      if (other instanceof BoxedInt64 && other_hi < 0) return false;
      if (hi === other_hi) {
        return lo <= other.lo;
      }
      return hi < other_hi;
    },
  });
  
  Object.defineProperties(BoxedUint64.prototype, {
    normalized: {
      get: function() {
        var hi = this.hi;
        if (hi < 0 || hi >= 0x200000) return this;
        return (hi * 0x100000000) + this.lo >>> 0;
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
    set: badSet,
    set_add: badSet,
    set_sub: badSet,
    i64_negate: function() {
      return -this;
    },
    i64_bnot: function() {
      var v = Math.floor(this);
      if (v < -0x80000000) {
        v = -v;
        var hi = ~(v / 0x100000000), lo = ~v >>> 0;
        return -((hi * 0x100000000) + lo);
      }
      else if (v >= 0x80000000) {
        var hi = ~(v / 0x100000000), lo = ~v >>> 0;
        return (hi * 0x100000000) + lo;
      }
      return ~v;
    },
    u64_bnot: function() {
      var v = Math.floor(this);
      if (v < 0) {
        v = -v;
        var hi = ~(v / 0x100000000) >>> 0, lo = ~v >>> 0;
        return -((hi * 0x100000000) + lo);
      }
      return new BoxedUint64(~(v / 0x100000000), ~v);
    },
    i64_bxor: function(other) {
      return this.asBoxedInt64.i64_bxor(other);
    },
    u64_bxor: function(other) {
      return this.asBoxedUint64.u64_bxor(other);
    },
    i64_band: function(other) {
      return this.asBoxedInt64.i64_band(other);
    },
    u64_band: function(other) {
      return this.asBoxedUint64.u64_band(other);
    },
    i64_bor: function(other) {
      return this.asBoxedInt64.i64_bor(other);
    },
    u64_bor: function(other) {
      return this.asBoxedUint64.u64_bor(other);
    },
    i64_lshift: function(count) {
      return this.asBoxedInt64.i64_lshift(count);
    },
    u64_lshift: function(count) {
      return this.asBoxedUint64.u64_lshift(count);
    },
    i64_arshift: function(count) {
      return this.asBoxedInt64.i64_arshift(count);
    },
    u64_rshift: function(count) {
      return this.asBoxedUint64.u64_rshift(count);
    },
    i64_add: function(other) {
      return this.asBoxedInt64.set_add(other).normalized;
    },
    u64_add: function(other) {
      return this.asBoxedUint64.set_add(other).normalized;
    },
    i64_sub: function(subtraction) {
      return this.asBoxedInt64.set_add(subtraction.i64_negate()).normalized;
    },
    u64_sub: function(subtraction) {
      return this.asBoxedUint64.set_add(subtraction.i64_negate()).normalized;
    },
    eq64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return other.eq64(this);
      return this === +other;
    },
    neq64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return !other.eq64(this);
      return this !== +other;
    },
    lt64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return !other.lte64(this);
      return this < other;
    },
    lte64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return !other.lt64(this);
      return this <= other;
    },
    gt64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return other.lt64(this);
      return this > other;
    },
    gte64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return other.lte64(this);
      return this >= other;
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
    asBoxedInt64: {
      get: function() {
        var v = Math.floor(this);
        var hi, lo;
        if (v < 0) {
          v = -v;
          hi = (v / 0x100000000) | 0;
          lo = v | 0;
          if (lo === 0) {
            hi = -hi;
          }
          else {
            hi = ~hi;
            lo = -lo;
          }
        }
        else {
          hi = (v / 0x100000000) | 0;
          lo = v | 0;
        }
        return new BoxedInt64(hi, lo);
      },
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
    asBoxedUint64: {
      get: function() {
        var v = Math.floor(this);
        var hi, lo;
        if (v < 0) {
          v = -v;
          hi = (v / 0x100000000) | 0;
          lo = v | 0;
          if (lo === 0) {
            hi = -hi;
          }
          else {
            hi = ~hi;
            lo = -lo;
          }
        }
        else {
          hi = (v / 0x100000000) | 0;
          lo = v | 0;
        }
        return new BoxedUint64(hi, lo);
      },
    },
    asBoxedFloat32: {
      get: function() { return new BoxedFloat32(this); }
    },
    asBoxedFloat64: {
      get: function() { return new BoxedFloat64(this); }
    },
  });
  
  Object.assign(Boolean.prototype, {
    set: badSet,
    set_add: badSet,
    set_sub: badSet,
    i64_negate: function() {
      return -this;
    },
    i64_bnot: function() {
      return ~this;
    },
    u64_bnot: function() {
      return new BoxedUint64(-1, -1 - this);
    },
    i64_bxor: function(other) {
      return this.asBoxedInt64.i64_bxor(other);
    },
    u64_bxor: function(other) {
      return this.asBoxedUint64.u64_bxor(other);
    },
    i64_band: function(other) {
      return this.asBoxedInt64.i64_band(other);
    },
    u64_band: function(other) {
      return this.asBoxedUint64.u64_band(other);
    },
    i64_bor: function(other) {
      return this.asBoxedInt64.i64_bor(other);
    },
    u64_bor: function(other) {
      return this.asBoxedUint64.u64_bor(other);
    },
    i64_lshift: function(count) {
      return this.asBoxedInt64.i64_lshift(count);
    },
    u64_lshift: function(count) {
      return this.asBoxedUint64.u64_lshift(count);
    },
    i64_arshift: function(count) {
      return this.asBoxedInt64.i64_arshift(count);
    },
    u64_rshift: function(count) {
      return this.asBoxedUint64.u64_rshift(count);
    },
    i64_add: function(other) {
      return this.asBoxedInt64.set_add(other).normalized;
    },
    u64_add: function(other) {
      return this.asBoxedUint64.set_add(other).normalized;
    },
    i64_sub: function(subtraction) {
      return this.asBoxedInt64.set_add(subtraction.i64_negate()).normalized;
    },
    u64_sub: function(subtraction) {
      return this.asBoxedUint64.set_add(subtraction.i64_negate()).normalized;
    },
    eq64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return other.eq64(this);
      return +this === +other;
    },
    neq64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return !other.eq64(this);
      return +this !== +other;
    },
    lt64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return !other.lte64(this);
      return this < other;
    },
    lte64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return !other.lt64(this);
      return this <= other;
    },
    gt64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return other.lt64(this);
      return this > other;
    },
    gte64: function(other) {
      if (typeof other !== 'number' && typeof other !== 'boolean') return other.lte64(this);
      return this >= other;
    },
  });
  Object.defineProperties(Boolean.prototype, {
    normalized: {get: retThis},
    asBoolean: {get: retThis},
    asInt8: {
      get: function() { return +this; },
    },
    asInt16: {
      get: function() { return +this; },
    },
    asInt32: {
      get: function() { return +this; },
    },
    asInt64: {
      get: function() { return +this; },
    },
    asUint8: {
      get: function() { return +this; }
    },
    asUint16: {
      get: function() { return +this; }
    },
    asUint32: {
      get: function() { return +this; }
    },
    asUint64: {
      get: function() { return +this; }
    },
    asFloat32:{
      get: function() { return +this; }
    },
    asFloat64: {
      get: function() { return +this; }
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
    asBoxedInt64: {
      get: function() {
        return new BoxedInt64(0, +this);
      },
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
    asBoxedUint64: {
      get: function() {
        return new BoxedUint64(0, +this);
      },
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
  Number.Boxed = BoxedFloat64;
  
});
