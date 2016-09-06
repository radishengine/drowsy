define(function() {

  'use strict';
  
  return function(dv, pos) {
    var sign = (dv.getUint8(pos) & 0x80) ? -1 : 1;
    var exponent = (dv.getUint16(pos, false) & 0x7fff) - 16383;
    var mantissaHigh = dv.getUint32(pos + 2, false);
    var mantissaLow = dv.getUint32(pos + 6, false);
    
    var normalized = (mantissaHigh >>> 31) & 1;
    if (normalized) mantissaHigh &= 0x7fffffff;
    
    var mantissa = normalized + (mantissaHigh / 0x80000000) + ((mantissaLow / 0x100000000) / 0x100000000);
    
    return sign * mantissa * Math.pow(2, exponent);
  };

});
