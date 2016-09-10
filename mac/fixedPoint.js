define(function() {

  'use strict';
  
  return {
    fromInt32: function(i32) {
      var frac = 0;
      for (var i = 0; i < 16; i++) {
        if (i32 & (0x8000 >> i)) {
          frac += 1 / (2 << i);
        }
      }
      return (i32 >>> 16) + frac;
    },
    fromInt32_2_30: function(i32) {
      var frac = 0;
      for (var i = 0; i < 30; i++) {
        if (i32 & (0x20000000 >> i)) {
          frac += 1 / (2 << i);
        }
      }
      return (i32 >>> 30) + frac;
    },
    fromUint16: function(u16) {
      var frac = 0;
      for (var i = 0; i < 8; i++) {
        if (u16 & (0x80 >> i)) {
          frac += 1 / (2 << i);
        }
      }
      return (u16 >>> 8) + frac;
    },
  };

});
