define(function() {
  
  // The advice is, never add to standard object prototypes. Why is that?
  // Well, it's because some other code somewhere might also want to add to it too.
  // No fair. Why does that OTHER code get to have all the fun?
  
  // (Let's get this proof-of-concept working first. If you want, we can worry about being a good neighbor later.)

  'use strict';
  
  var mattress = {};
  
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
  
  function imul32(a, b) {
    if (a < b) return imul32(b, a);
    var result = 0;
    while (b !== 0) {
      if (b & 1) result = (result + a) | 0;
      a <<= 1;
      b >>>= 1;
    }
    return result;
  }
  mattress.i32_mul = imul32;
  mattress.u32_mul = function(a, b) {
    return imul32(a, b) >>> 0;
  };
  
  function udivmod64(dividend, divisor, returnMod) {
    // based on code from the Bit Mathematics Cookbook by Joel Yliluoma
    // <http://bisqwit.iki.fi/story/howto/bitmath/>
    if (divisor.eq64(0)) throw new Error('division by zero');
    var remain = dividend, scaled_divisor = divisor;
    var result = 0, multiple = 1;
    while (scaled_divisor.lt64(dividend)) {
      scaled_divisor = scaled_divisor.u64_lshift(1);
      multiple = multiple.u64_lshift(1);
    }
    do {
      if (remain.gte64(scaled_divisor)) {
        remain = remain.u64_sub(scaled_divisor);
        result = result.u64_add(multiple);
      }
      scaled_divisor = scaled_divisor.u64_rshift(1);
      multiple = multiple.u64_rshift(1);
    } while (multiple.neq64(0));
    return returnMod ? remain : result;
  }
  
  function idivmod64(dividend, divisor, returnMod) {
    var sign = false;
    if (dividend.lt64(0)) {
      sign = !sign;
      dividend = dividend.i64_negate().asUint64;
    }
    if (divisor.lt64(0)) {
      sign = !sign;
      divisor = divisor.i64_negate().asUint64;
    }
    var result = udivmod64(dividend, divisor, returnMod);
    return sign ? result.i64_negate() : result;
  }
  
  function hashString(str) {
    var i_max = str.length;
    var hash = 0x6053b7f7 ^ i_max;
    var i_step = Math.max(1, (32 / i_max) | 0);
    for (var i = 0; i < i_max; i += i_step) {
      hash = (hash >>> 3) | ((hash & 7) << 29);
      hash ^= str.charCodeAt(i);
    }
    return hash;
  }
  mattress.hashString = hashString;
  
  var HASH_PROP = mattress.HASH_PROP = Symbol('hash');
  
  var hashStore = new WeakMap();
  
  function hashValue(v) {
    switch (typeof v) {
      case 'undefined': return 0;
      case 'object':
        if (v === null) return 0;
        if (HASH_PROP in v) return v[HASH_PROP];
        var hash = hashStore.get(v);
        if (typeof hash === 'undefined') {
          hashStore.set(v, hash = (Math.random() * 0xffffffff) | 0);
        }
        return hash;
      default: return hashString('' + v);
    }
  }
  mattress.hashValue = hashValue;
  
  function hashList(array, inAnyOrder, hash) {
    if (typeof inAnyOrder === 'number' && arguments.length === 2) {
      hash = inAnyOrder;
      inAnyOrder = false;
    }
    if (isNaN(hash)) hash = 0x86b27112;
    if (inAnyOrder) {
      // quirk: if the same value appears an odd number of times,
      //  it's the same as appearing once. if it appears an even
      //  number of times, it's the same as never appearing at all.
      for (var i = 0; i < array.length; i++) {
        hash ^= hashValue(array[i]);
      }
    }
    else {
      for (var i = 0; i < array.length; i++) {
        hash = ((hash << 31) | (hash >>> 1)) ^ hashValue(array[i]);
      }
    }
    return hash;
  }
  mattress.hashList = hashList;
    
  function Boxed() {
  }
  Boxed.prototype = {
    toString: function(radix) {
      return this.value.toString(radix);
    },
    toJSON: function() {
      return this.value;
    },
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
    i32_mul: function(factor) {
      return imul32(this.asInt32, factor.asInt32);
    },
    u32_mul: function(factor) {
      return imul32(this.asInt32, factor.asInt32) >>> 0;
    },
    i64_div: function(divisor) {
      return this.asBoxedInt64.i64_div(divisor);
    },
    u64_div: function(divisor) {
      return this.asBoxedInt64.u64_div(divisor);
    },
    i64_mod: function(divisor) {
      return this.asBoxedInt64.i64_mod(divisor);
    },
    u64_mod: function(divisor) {
      return this.asBoxedInt64.u64_mod(divisor);
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
  
  BoxedBoolean.prototype.set_mul = function(value) { return this.value = !!(this.value * value.asBoolean); }
  BoxedInt8.prototype.set_mul = function(value) { return this.value = (this.value * value.asInt8) << 24 >> 24; }
  BoxedInt16.prototype.set_mul = function(value) { return this.value = (this.value * value.asInt16) << 16 >> 16; }
  BoxedInt32.prototype.set_mul = function(value) { return this.value = imul32(this.value, value.asInt32); }
  BoxedUint8.prototype.set_mul = function(value) { return this.value = (this.value * value.asUint8) & 0xff; }
  BoxedUint16.prototype.set_mul = function(value) { return this.value = (this.value * value.asUint16) & 0xffff; }
  BoxedUint32.prototype.set_mul = function(value) { return this.value = imul32(this.value, value.asInt32) >>> 0; }
  BoxedFloat32.prototype.set_mul = function(value) { return this.value = (this.value * value.asFloat64).asFloat32; }
  BoxedFloat64.prototype.set_mul = function(value) { return this.value = this.value * value.asFloat64; }
  
  BoxedBoolean.prototype.set_div = function(value) { return this.value = !!(this.value / value.asBoolean); }
  BoxedInt8.prototype.set_div = function(value) { return this.value = (this.value / value.asInt32) << 24 >> 24; }
  BoxedInt16.prototype.set_div = function(value) { return this.value = (this.value / value.asInt32) << 16 >> 16; }
  BoxedInt32.prototype.set_div = function(value) { return this.value = (this.value / value.asInt32) | 0; }
  BoxedUint8.prototype.set_div = function(value) { return this.value = (this.value / value.asUint32) & 0xff; }
  BoxedUint16.prototype.set_div = function(value) { return this.value = (this.value / value.asUint32) & 0xffff; }
  BoxedUint32.prototype.set_div = function(value) { return this.value = (this.value / value.asUint32) >>> 0; }
  BoxedFloat32.prototype.set_div = function(value) { return this.value = (this.value / value.asFloat64).asFloat32; }
  BoxedFloat64.prototype.set_div = function(value) { return this.value = this.value / value.asFloat64; }
  
  BoxedBoolean.prototype.set_mod = function(value) { return this.value = !!(this.value % value.asBoolean); }
  BoxedInt8.prototype.set_mod = function(value) { return this.value = this.value % value.asInt8; }
  BoxedInt16.prototype.set_mod = function(value) { return this.value = this.value % value.asInt16; }
  BoxedInt32.prototype.set_mod = function(value) { return this.value = this.value % value.asInt32; }
  BoxedUint8.prototype.set_mod = function(value) { return this.value = this.value % value.asUint8; }
  BoxedUint16.prototype.set_mod = function(value) { return this.value = this.value % value.asUint16; }
  BoxedUint32.prototype.set_mod = function(value) { return this.value = this.value % value.asUint32; }
  BoxedFloat32.prototype.set_mod = function(value) { return this.value = (this.value % value.asFloat64).asFloat32; }
  BoxedFloat64.prototype.set_mod = function(value) { return this.value = this.value % value.asFloat64; }
  
  BoxedBoolean.prototype.set_bor = function(value) { return this.value = this.value || value.asBoolean; }
  BoxedInt8.prototype.set_bor = function(value) { return this.value = this.value | value.asInt8; }
  BoxedInt16.prototype.set_bor = function(value) { return this.value = this.value | value.asInt16; }
  BoxedInt32.prototype.set_bor = function(value) { return this.value = this.value | value.asInt32; }
  BoxedUint8.prototype.set_bor = function(value) { return this.value = this.value | value.asUint8; }
  BoxedUint16.prototype.set_bor = function(value) { return this.value = this.value | value.asUint16; }
  BoxedUint32.prototype.set_bor = function(value) { return this.value = (this.value | value.asInt32) >>> 0; }
  BoxedFloat32.prototype.set_bor = function(value) { return this.value = (this.value | value.asInt32).asFloat32; }
  BoxedFloat64.prototype.set_bor = function(value) { return this.value = this.value | value.asInt32; }
    
  BoxedBoolean.prototype.set_band = function(value) { return this.value = this.value && value.asBoolean; }
  BoxedInt8.prototype.set_band = function(value) { return this.value = this.value & value.asInt8; }
  BoxedInt16.prototype.set_band = function(value) { return this.value = this.value & value.asInt16; }
  BoxedInt32.prototype.set_band = function(value) { return this.value = this.value & value.asInt32; }
  BoxedUint8.prototype.set_band = function(value) { return this.value = this.value & value.asUint8; }
  BoxedUint16.prototype.set_band = function(value) { return this.value = this.value & value.asUint16; }
  BoxedUint32.prototype.set_band = function(value) { return this.value = (this.value & value.asInt32) >>> 0; }
  BoxedFloat32.prototype.set_band = function(value) { return this.value = (this.value & value.asInt32).asFloat32; }
  BoxedFloat64.prototype.set_band = function(value) { return this.value = this.value & value.asInt32; }
  
  BoxedBoolean.prototype.set_bxor = function(value) { return this.value = !!(this.value ^ value.asBoolean); }
  BoxedInt8.prototype.set_bxor = function(value) { return this.value = this.value ^ value.asInt8; }
  BoxedInt16.prototype.set_bxor = function(value) { return this.value = this.value ^ value.asInt16; }
  BoxedInt32.prototype.set_bxor = function(value) { return this.value = this.value ^ value.asInt32; }
  BoxedUint8.prototype.set_bxor = function(value) { return this.value = this.value ^ value.asUint8; }
  BoxedUint16.prototype.set_bxor = function(value) { return this.value = this.value ^ value.asUint16; }
  BoxedUint32.prototype.set_bxor = function(value) { return this.value = (this.value ^ value.asInt32) >>> 0; }
  BoxedFloat32.prototype.set_bxor = function(value) { return this.value = (this.value ^ value.asInt32).asFloat32; }
  BoxedFloat64.prototype.set_bxor = function(value) { return this.value = this.value ^ value.asInt32; }
  
  BoxedBoolean.prototype.set_lshift = function(count) { return this.value = !!(this.value << count.asUint8); }
  BoxedInt8.prototype.set_lshift = function(count) { return this.value = (this.value << count.asUint8) << 24 >> 24; }
  BoxedInt16.prototype.set_lshift = function(count) { return this.value = (this.value << count.asUint8) << 16 >> 16; }
  BoxedInt32.prototype.set_lshift = function(count) { return this.value = (this.value << count.asUint8); }
  BoxedUint8.prototype.set_lshift = function(count) { return this.value = (this.value << count.asUint8) & 0xff; }
  BoxedUint16.prototype.set_lshift = function(count) { return this.value = (this.value << count.asUint8) & 0xffff; }
  BoxedUint32.prototype.set_lshift = function(count) { return this.value = (this.value << count.asUint8) >>> 0; }
  BoxedFloat32.prototype.set_lshift = function(count) { return this.value = (this.value << count.asUint8).asFloat32; }
  BoxedFloat64.prototype.set_lshift = function(count) { return this.value = (this.value << count.asUint8); }
  
  BoxedBoolean.prototype.set_rshift = function(count) { return this.value = !!(this.value >>> count.asUint8); }
  BoxedInt8.prototype.set_rshift = function(count) { return this.value = (this.value >>> count.asUint8) << 24 >> 24; }
  BoxedInt16.prototype.set_rshift = function(count) { return this.value = (this.value >>> count.asUint8) << 16 >> 16; }
  BoxedInt32.prototype.set_rshift = function(count) { return this.value = (this.value >>> count.asUint8) | 0; }
  BoxedUint8.prototype.set_rshift = function(count) { return this.value = (this.value >>> count.asUint8); }
  BoxedUint16.prototype.set_rshift = function(count) { return this.value = (this.value >>> count.asUint8); }
  BoxedUint32.prototype.set_rshift = function(count) { return this.value = (this.value >>> count.asUint8); }
  BoxedFloat32.prototype.set_rshift = function(count) { return this.value = (this.value >>> count.asUint8).asFloat32; }
  BoxedFloat64.prototype.set_rshift = function(count) { return this.value = (this.value >>> count.asUint8); }
  
  BoxedBoolean.prototype.set_arshift = function(count) { return this.value = !!(this.value >> count.asUint8); }
  BoxedInt8.prototype.set_arshift = function(count) { return this.value = (this.value >> count.asUint8); }
  BoxedInt16.prototype.set_arshift = function(count) { return this.value = (this.value >> count.asUint8); }
  BoxedInt32.prototype.set_arshift = function(count) { return this.value = (this.value >> count.asUint8); }
  BoxedUint8.prototype.set_arshift = function(count) { return this.value = (this.value << 24 >> 24 >> count.asUint8) & 0xff; }
  BoxedUint16.prototype.set_arshift = function(count) { return this.value = (this.value << 16 >> 16 >> count.asUint8) & 0xffff; }
  BoxedUint32.prototype.set_arshift = function(count) { return this.value = (this.value >> count.asUint8) >>> 0; }
  BoxedFloat32.prototype.set_arshift = function(count) { return this.value = (this.value >> count.asUint8).asFloat32; }
  BoxedFloat64.prototype.set_arshift = function(count) { return this.value = (this.value >> count.asUint8); }
  
  function Boxed64() {
  }
  Boxed64.prototype = {
    set: function(value) {
      if (typeof value === 'string') {
        return parse64(this, value);
      }
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
    set_mul: function(factor) {
      var a, b;
      if (!(factor instanceof Boxed64)) factor = factor.asBoxedInt64;
      if (this.gt64(factor)) {
        a = new BoxedInt64(this.hi, this.lo);
        b = new BoxedInt64(factor.hi, factor.lo);
      }
      else {
        a = new BoxedInt64(factor.hi, factor.lo);
        b = new BoxedInt64(this.hi, this.lo);
      }
      this.hi = this.lo = 0;
      while (b.lo !== 0 || b.hi !== 0) {
        if (b.lo & 1) this.set_add(a);
        a.set_lshift(1);
        b.set_rshift(1);
      }
      return this;
    },
    set_bor: function(value) {
      value = value.asBoxedInt64;
      this.hi |= value.hi;
      this.lo |= value.lo;
      return this.normalized;
    },
    set_band: function(value) {
      value = value.asBoxedInt64;
      this.hi &= value.hi;
      this.lo &= value.lo;
      return this.normalized;
    },
    set_bxor: function(value) {
      value = value.asBoxedInt64;
      this.hi ^= value.hi;
      this.lo ^= value.lo;
      return this.normalized;
    },
    set_lshift: function(count) {
      var hi = this.hi, lo = this.lo;
      count = count.asUint8;
      if (count >= 32) {
        hi = lo;
        lo = 0;
        count -= 32;
      }
      hi <<= count;
      hi |= (lo >> (32 - count)) & ((1 << count) - 1);
      lo <<= count;
      this.hi = hi;
      this.lo = lo;
      return this;
    },
    set_rshift: function(count) {
      var hi = this.hi, lo = this.lo;
      count = count.asUint8;
      if (count >= 32) {
        lo = hi;
        hi = 0;
        count -= 32;
      }
      lo >>>= count;
      lo |= (hi & ((1 << count) - 1)) << (32 - count);
      hi >>>= count;
      this.hi = hi;
      this.lo = lo;
      return this;
    },
    set_arshift: function(count) {
      var hi = this.hi, lo = this.lo;
      count = count.asUint8;
      if (count >= 32) {
        lo = hi;
        hi = (hi < 0) ? -1 : 0;
        count -= 32;
      }
      lo >>= count;
      lo |= (hi & ((1 << count) - 1)) << (32 - count);
      hi >>= count;
      this.hi = hi;
      this.lo = lo;
      return this;
    },
    get asBoolean() { return !!(this.lo || this.hi); },
    get asInt8() { return this.lo << 24 >> 24; },
    get asInt16() { return this.lo << 16 >> 16; },
    get asInt32() { return this.lo; },
    get asUint8() { return this.lo & 0xff; },
    get asUint16() { return this.lo & 0xffff; },
    get asUint32() { return this.lo >>> 0; },
    get asFloat32() { return this.asFloat64.asFloat32; },
    get asBoxedBoolean() { return new BoxedBoolean(this.lo && this.hi); },
    get asBoxedInt8() { return new BoxedInt8(this.lo); },
    get asBoxedInt16() { return new BoxedInt16(this.lo); },
    get asBoxedInt32() { return new BoxedInt32(this.lo); },
    get asBoxedUint8() { return new BoxedUint8(this.lo); },
    get asBoxedUint16() { return new BoxedUint16(this.lo); },
    get asBoxedUint32() { return new BoxedUint32(this.lo); },
    get asBoxedFloat32() { return new BoxedFloat32(this.asFloat64); },
    get asBoxedFloat64() { return new BoxedFloat64(this.asFloat64); },
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
      return new BoxedInt64(this.hi, this.lo).set_lshift(count);
    },
    u64_lshift: function(count) {
      return new BoxedUint64(this.hi, this.lo).set_lshift(count);
    },
    i64_arshift: function(count) {
      return new BoxedInt64(this.hi, this.lo).set_arshift(count).normalized;
    },
    u64_rshift: function(count) {
      return new BoxedUint64(this.hi, this.lo).set_rshift(count).normalized;
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
    i32_mul: function(factor) {
      return imul32(this.lo, factor.asInt32);
    },
    u32_mul: function(factor) {
      return imul32(this.lo, factor.asInt32) >>> 0;
    },
  };
  
  function BoxedInt64(hi, lo) { this.hi = hi | 0; this.lo = lo | 0; }
  function BoxedUint64(hi, lo) { this.hi = hi | 0; this.lo = lo | 0; }
  
  [BoxedInt64, BoxedUint64]
  .forEach(function(T) {
    T.prototype = new Boxed64;
  });
  
  Object.defineProperty(BoxedInt64.prototype, 'asFloat64', {
    get: function() {
      var hi = this.hi, lo = this.lo;
      var sign;
      if (hi < 0) {
        sign = -1;
        if (lo === 0) {
          hi = -hi;
        }
        else {
          hi = ~hi;
          lo = -lo >>> 0;
        }
      }
      else {
        sign = +1;
        lo >>>= 0;
      }
      return sign * ((hi * 0x100000000) + lo);
    },
  });
  
  Object.defineProperty(BoxedUint64.prototype, 'asFloat64', {
    get: function() {
      var hi = this.hi >>> 0, lo = this.lo >>> 0;
      return ((hi * 0x100000000) + lo);
    },
  });
  
  BoxedInt64.prototype.i64_div = function(divisor) {
    return idivmod64(this, divisor, false);
  };
  
  BoxedInt64.prototype.u64_div = function(divisor) {
    return udivmod64(this, divisor, false);
  };
  
  BoxedInt64.prototype.i64_mod = function(divisor) {
    return idivmod64(this, divisor, true);
  };
  
  BoxedInt64.prototype.u64_mod = function(divisor) {
    return udivmod64(this, divisor, true);
  };
  
  BoxedInt64.prototype.set_div = function(divisor) {
    return this.set(idivmod64(this, divisor, false));
  };
  
  BoxedUint64.prototype.set_div = function(divisor) {
    return this.set(udivmod64(this, divisor, false));
  };
  
  BoxedInt64.prototype.set_mod = function(divisor) {
    return this.set(idivmod64(this, divisor, true));
  };
  
  BoxedUint64.prototype.set_mod = function(divisor) {
    return this.set(udivmod64(this, divisor, true));
  };
  
  BoxedInt64.prototype.set_mod = function(divisor) {
    var sign = false;
    var dividend = this;
    if (dividend.hi < 0) {
      sign = !sign;
      dividend = dividend.i64_negate();
    }
    if (divisor.lt64(0)) {
      sign = !sign;
      divisor = divisor.i64_negate();
    }
    var result = udivmod64(dividend, divisor, true);
    return this.set(sign ? result.i64_negate() : result);
  };
  
  BoxedUint64.prototype.set_div = function(divisor) {
    return udivmod64(this, divisor, false);
  };
  
  var zero_x31 = '0000000000000000000000000000000';
  
  function uint64ToString(hi, lo, radix) {
    if (isNaN(radix)) radix = 10;
    else if ((radix & (radix-1)) === 0) {
      // radix is a power of 2
      var padSize;
      switch (radix) {
        case 2: padSize = 32; break;
        case 4: padSize = 16; break;
        case 8:
          padSize = 11;
          lo += (hi & 3) * 0x100000000;
          hi >>>= 2;
          break;
        case 16: padSize = 8; break;
        case 32:
          padSize = 7;
          lo += (hi & 3) * 0x100000000;
          hi >>>= 2;
          break;
        default: throw new RangeError('toString() radix argument must be between 2 and 36');
      }
      if (hi === 0) return lo.toString(radix);
      return hi.toString(radix) + (zero_x31 + lo.toString(radix)).slice(-padSize);
    }
    var lo11 = lo & 0x7ff;
    var hi53 = (hi * 0x100000000 + (lo - lo11));
    lo11 = lo11.toString(radix);
    if (radix === 10) {
      // it looks like only in decimal are the final digits zeroed out by default
      // so we use toPrecision with the total number of decimal digits
      hi53 = hi53.toPrecision(Math.log10(hi53) + 1);
    }
    else {
      hi53 = hi53.toString(radix);
    }
    for (var i = lo11.length - 1, j = hi53.length - 1, carry = 0; i >= 0; i--, j--) {
      var c = parseInt(lo11[i], radix) + parseInt(hi53[j], radix) + carry;
      hi53[j] = (c % radix).toString(radix);
      carry = (c / radix) | 0;
    }
    if (carry) {
      for (; j >= 0; j--) {
        var c = parseInt(hi53[j], radix) + carry;
        hi53[j] = (c % radix).toString(radix);
        carry = (c / radix) | 0;
        if (!carry) {
          return hi53.join('');
        }
      }
      return carry.toString(radix) + hi53.join('');
    }
    return hi53.join('');
  }
  
  BoxedUint64.prototype.toString = function(radix) {
    var hi = this.hi >>> 0, lo = this.lo >>> 0;
    if (hi < 0x200000) return ((hi * 0x100000000) + lo).toString(radix);
    return uint64ToString(hi, lo, radix);
  };
  
  BoxedInt64.prototype.toString = function(radix) {
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
    if (hi < 0x200000) return negative + ((hi * 0x100000000) + lo).toString(radix);
    return negative + uint64ToString(hi, lo, radix);
  };
  
  BoxedUint64.prototype.toJSON = function() {
    var v = this.normalized;
    if (typeof v === 'number') return v;
    return '0x' + v.toString(16);
  };
  
  BoxedInt64.prototype.toJSON = function() {
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
    }
    else {
      lo = this.lo >>> 0;
    }
    if (hi < 0x200000) return (negative ? -1 : 1) * ((hi * 0x100000000) + lo);
    return (negative ? '-0x' : '0x') + uint64ToString(hi, lo, 16);
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
    set_mul: badSet,
    set_div: badSet,
    set_mod: badSet,
    set_bor: badSet,
    set_band: badSet,
    set_bxor: badSet,
    set_lshift: badSet,
    set_rshift: badSet,
    set_arshift: badSet,
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
    i32_mul: function(factor) {
      return imul32(this.asInt32, factor.asInt32);
    },
    u32_mul: function(factor) {
      return imul32(this.asInt32, factor.asInt32) >>> 0;
    },
    i64_div: function(divisor) {
      return this.asBoxedInt64.i64_div(divisor);
    },
    u64_div: function(divisor) {
      return this.asBoxedUint64.u64_div(divisor);
    },
    i64_mod: function(divisor) {
      return this.asBoxedInt64.i64_mod(divisor);
    },
    u64_mod: function(divisor) {
      return this.asBoxedUint64.u64_mod(divisor);
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
    asBoxedBoolean: {
      get: function() { return new BoxedBoolean(this); }
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
    set_mul: badSet,
    set_div: badSet,
    set_mod: badSet,
    set_bor: badSet,
    set_band: badSet,
    set_bxor: badSet,
    set_lshift: badSet,
    set_rshift: badSet,
    set_arshift: badSet,
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
    i32_mul: function(factor) {
      return imul32(this.asInt32, factor.asInt32);
    },
    i64_div: function(divisor) {
      return this.asBoxedInt64.i64_div(divisor);
    },
    u64_div: function(divisor) {
      return this.asBoxedUint64.u64_div(divisor);
    },
    i64_mod: function(divisor) {
      return this.asBoxedInt64.i64_mod(divisor);
    },
    u64_mod: function(divisor) {
      return this.asBoxedUint64.u64_mod(divisor);
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
    asBoxedBoolean: {
      get: function() { return new BoxedBoolean(this); }
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
  
  var inArrayProperties = {
    value: {
      get: function() {
        return this.array[this.index];
      },
      set: function(value) {
        this.array[this.index] = value;
      },
    },
  };
  [BoxedInt8, BoxedInt16, BoxedInt32, BoxedUint8, BoxedUint16, BoxedUint32, BoxedFloat32, BoxedFloat64]
  .forEach(function(T) {
    T.InArray = function(array, index) {
      this.array = array;
      this.index = index;
    };
    T.InArray.prototype = Object.defineProperties(new T(0), inArrayProperties);
  });
    
  var v1Prop = {
    get: function() {
      return this.array[this.index << 1];
    },
    set: function(value) {
      this.array[this.index << 1] = value;
    },
  };
  
  var v2Prop = {
    get: function() {
      return this.array[1 + this.index << 1];
    },
    set: function(value) {
      this.array[1 + this.index << 1] = value;
    },
  };
  
  var littleEndianArrays = (new Uint8Array(new Int16Array([1]).buffer)[0]) === 1;
  
  var inArrayProperties64 = littleEndianArrays ? {lo:v1Prop, hi:v2Prop} : {hi:v1Prop, lo:v2Prop};
  
  [BoxedInt64, BoxedUint64]
  .forEach(function(T) {
    T.InArray = function(array, index) {
      this.array = array;
      this.index = index;
    };
    T.InArray.prototype = Object.defineProperties(new T(0, 0), inArrayProperties64);
  });
  
  BoxedInt8.InDataView = function(dataView, byteOffset) {
    this.dataView = dataView;
    this.byteOffset = byteOffset;
  };
  BoxedInt8.InDataView.prototype = Object.defineProperties(new BoxedInt8(0), {
    value: {
      get: function() { return this.dataView.getInt8(this.byteOffset); },
      set: function(value) { this.dataView.setInt8(this.byteOffset, value); },
    },
  });
  
  BoxedUint8.InDataView = function(dataView, byteOffset) {
    this.dataView = dataView;
    this.byteOffset = byteOffset;
  };
  BoxedUint8.InDataView.prototype = Object.defineProperties(new BoxedUint8(0), {
    value: {
      get: function() { return this.dataView.getUint8(this.byteOffset); },
      set: function(value) { this.dataView.setUint8(this.byteOffset, value); },
    },
  });
  
  BoxedInt16.InDataView = function(dataView, byteOffset, littleEndian) {
    this.dataView = dataView;
    this.byteOffset = byteOffset;
    this.littleEndian = littleEndian;
  };
  BoxedInt16.InDataView.prototype = Object.defineProperties(new BoxedInt16(0), {
    value: {
      get: function() { return this.dataView.getInt16(this.byteOffset, this.littleEndian); },
      set: function(value) { this.dataView.setInt16(this.byteOffset, value, this.littleEndian); },
    },
  });
  
  BoxedUint16.InDataView = function(dataView, byteOffset, littleEndian) {
    this.dataView = dataView;
    this.byteOffset = byteOffset;
    this.littleEndian = littleEndian;
  };
  BoxedUint16.InDataView.prototype = Object.defineProperties(new BoxedUint16(0), {
    value: {
      get: function() { return this.dataView.getUint16(this.byteOffset, this.littleEndian); },
      set: function(value) { this.dataView.setUint16(this.byteOffset, value, this.littleEndian); },
    },
  });
  
  BoxedInt32.InDataView = function(dataView, byteOffset, littleEndian) {
    this.dataView = dataView;
    this.byteOffset = byteOffset;
    this.littleEndian = littleEndian;
  };
  BoxedInt32.InDataView.prototype = Object.defineProperties(new BoxedInt32(0), {
    value: {
      get: function() { return this.dataView.getInt32(this.byteOffset, this.littleEndian); },
      set: function(value) { this.dataView.setInt32(this.byteOffset, value, this.littleEndian); },
    },
  });
  
  BoxedUint32.InDataView = function(dataView, byteOffset, littleEndian) {
    this.dataView = dataView;
    this.byteOffset = byteOffset;
    this.littleEndian = littleEndian;
  };
  BoxedUint32.InDataView.prototype = Object.defineProperties(new BoxedUint32(0), {
    value: {
      get: function() { return this.dataView.getUint32(this.byteOffset, this.littleEndian); },
      set: function(value) { this.dataView.setUint32(this.byteOffset, value, this.littleEndian); },
    },
  });
  
  BoxedFloat32.InDataView = function(dataView, byteOffset, littleEndian) {
    this.dataView = dataView;
    this.byteOffset = byteOffset;
    this.littleEndian = littleEndian;
  };
  BoxedFloat32.InDataView.prototype = Object.defineProperties(new BoxedFloat32(0), {
    value: {
      get: function() { return this.dataView.getFloat32(this.byteOffset, this.littleEndian); },
      set: function(value) { this.dataView.setFloat32(this.byteOffset, value, this.littleEndian); },
    },
  });
  
  BoxedFloat64.InDataView = function(dataView, byteOffset, littleEndian) {
    this.dataView = dataView;
    this.byteOffset = byteOffset;
    this.littleEndian = littleEndian;
  };
  BoxedFloat64.InDataView.prototype = Object.defineProperties(new BoxedFloat64(0), {
    value: {
      get: function() { return this.dataView.getFloat64(this.byteOffset, this.littleEndian); },
      set: function(value) { this.dataView.setFloat64(this.byteOffset, value, this.littleEndian); },
    },
  });
  
  var littleEndianProps64 = {
    lo: {
      get: function() { return this.dataView.getInt32(this.byteOffset, true); },
      set: function(value) { this.dataView.setInt32(this.byteOffset, value, true); },
    },
    hi: {
      get: function() { return this.dataView.getInt32(this.byteOffset + 4, true); },
      set: function(value) { this.dataView.setInt32(this.byteOffset + 4, value, true); },
    },
  };
  
  var bigEndianProps64 = {
    hi: {
      get: function() { return this.dataView.getInt32(this.byteOffset, false); },
      set: function(value) { this.dataView.setInt32(this.byteOffset, value, false); },
    },
    lo: {
      get: function() { return this.dataView.getInt32(this.byteOffset + 4, false); },
      set: function(value) { this.dataView.setInt32(this.byteOffset + 4, value, false); },
    },
  };
  
  BoxedInt64.InDataView = function(dataView, byteOffset, littleEndian) {
    this.dataView = dataView;
    this.byteOffset = byteOffset;
    Object.defineProperties(this, littleEndian ? littleEndianProps64 : bigEndianProps64);
  };
  BoxedInt64.InDataView.prototype = new BoxedInt64(0);
  
  BoxedUint64.InDataView = function(dataView, byteOffset, littleEndian) {
    this.dataView = dataView;
    this.byteOffset = byteOffset;
    Object.defineProperties(this, littleEndian ? littleEndianProps64 : bigEndianProps64);
  };
  BoxedUint64.InDataView.prototype = new BoxedUint64(0);
  
  function parse64(value, str) {
    var parsed = str.match(/^([\+\-])?(0x([a-fA-F0-9]+)|0b([01]+)|(\d+))$/);
    if (!parsed) throw new Error('invalid integer literal');
    if (typeof parsed[3] === 'string') {
      var hex = parsed[3];
      value.lo = parseInt(hex.slice(-8), 16) | 0;
      if (hex.length < 8) {
        value.hi = 0;
      }
      else {
        value.hi = parseInt(hex.slice(0, -8).slice(-8), 16) | 0;
      }
    }
    else if (typeof parsed[4] === 'string') {
      var bin = parsed[4];
      value.lo = parseInt(bin.slice(-32), 2) | 0;
      if (bin.length < 32) {
        value.hi = 0;
      }
      else {
        value.hi = parseInt(bin.slice(0, -32).slice(-32), 2) | 0;
      }
    }
    else {
      var dec = parsed[5];
      value.lo = parseInt(dec.slice(-9)); // 9: maximum number of decimal digits stored in a 32-bit integer
      value.hi = 0;
      if (dec.length > 9) {
        // I think it's OK to keep the multiplier/multiplied digit as a double
        // even when it's outside of 53-bit range, the loss of precision
        // doesn't affect the integer value of a power of 10 that's less than Math.pow(2, 64)
        // (please let me know if I'm wrong on this...)
        var multiplier = 1000000000;
        for (var i = dec.length-10; i >= 0; i--) {
          var digit = dec.charCodeAt(i) - 48;
          if (digit !== 0) {
            value.set_add(digit * multiplier);
          }
          multiplier *= 10;
        }
      }
    }
    if (parsed[1] === '-') {
      if (value.lo === 0) {
        value.hi = -value.hi;
      }
      else {
        value.hi = ~value.hi;
        value.lo = -value.lo;
      }
    }
    return value;
  }
  
  Object.defineProperty(String.prototype, 'asBoxedInt64', {
    get: function() {
      return parse64(new BoxedInt64(0, 0), this);
    },
  });
  
  Object.defineProperty(String.prototype, 'asBoxedUint64', {
    get: function() {
      return parse64(new BoxedUint64(0, 0), this);
    },
  });
  
  Object.defineProperty(String.prototype, 'asInt64', {
    get: function() {
      return parse64(new BoxedInt64(0, 0), this).normalized;
    },
  });
  
  Object.defineProperty(String.prototype, 'asUint64', {
    get: function() {
      return parse64(new BoxedUint64(0, 0), this).normalized;
    },
  });
  
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  
  function HashTable() {
  }
  HashTable.prototype = {
    get stringHashed() {
      var obj = {};
      Object.defineProperty(this, 'stringHashed', {value:obj});
      return obj;
    },
    get intHashed() {
      var obj = {};
      Object.defineProperty(this, 'intHashed', {value:obj});
      return obj;
    },
    testEquality: Object.is,
    set: function(k, v) {
      if (typeof k === 'string') {
        this.stringHashed[k] = v;
        return;
      }
      var h = Object.getHashCode(k);
      var collisions = this.intHashed[h];
      if (!collisions) {
        this.intHashed[h] = [[k,v]];
        return;
      }
      for (var i = 0; i < collisions.length; i++) {
        if (this.testEquality(k, collisions[i][0])) {
          collisions[i][1] = v;
          return;
        }
      }
      collisions.push([k,v]);
    },
    get: function(k, defaultValue) {
      if (typeof k === 'string') {
        if (!hasOwnProperty.call(this.stringHashed, k)) {
          return defaultValue;
        }
        return this.stringHashed[k];
      }
      var h = Object.getHashCode(k);
      var collisions = this.intHashed[h];
      if (!collisions) return defaultValue;
      for (var i = 0; i < collisions.length; i++) {
        if (this.testEquality(k, collisions[i][0])) {
          return collisions[i][1];
        }
      }
      return defaultValue;
    },
    remove: function(k) {
      if (typeof k === 'string') {
        if (!hasOwnProperty.call(this.stringHashed, k)) {
          return false;
        }
        delete this.stringHashed[k];
        return true;
      }
      var h = Object.getHashCode(k);
      var collisions = this.intHashed[h];
      if (!collisions) return false;
      for (var i = 0; i < collisions.length; i++) {
        if (this.testEquality(k, collisions[i][0])) {
          collisions.splice(i, 1);
          return true;
        }
      }
      return false;      
    },
    contains: function(k) {
      if (typeof k === 'string') {
        return hasOwnProperty.call(this.stringHashed, k);
      }
      var h = Object.getHashCode(k);
      var collisions = this.intHashed[h];
      if (!collisions) return false;
      for (var i = 0; i < collisions.length; i++) {
        if (this.testEquality(k, collisions[i][0])) {
          return true;
        }
      }
      return false;
    },
    keys: function() {
      var keys = Object.keys(this.stringHashed);
      var hashes = Object.keys(this.intHashed);
      for (var i = 0; i < hashes.length; i++) {
        var collisions = this.intHashed[hashes[i]];
        for (var j = 0; j < collisions.length; j++) {
          keys.push(collisions[j][0]);
        }
      }
      return keys;
    },
  }
  
  mattress.HashTable = HashTable;
  
  return mattress;
  
});
