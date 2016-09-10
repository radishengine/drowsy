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
  };

});
