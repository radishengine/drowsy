define(function() {

  'use strict';
  
  var CRC = new Int32Array(256);
  for (var i = 0; i < 256; i++) {
    CRC[i] = i;
    for (var j = 0; j < 8; j++) {
      CRC[i] = CRC[i] & 1 ? 0xEDB88320 ^ (CRC[i] >>> 1) : (CRC[i] >>> 1);
    }
  }
  
  function CHOP(a) {
    return (a & 0xffff) + (a >>> 16 << 4) - (a >>> 16);
  }

  return {
    crc32: function(crc, bytes, offset, length) {
      switch (arguments.length) {
        case 0: return 0;
        case 2:
          offset = 0;
          length = bytes.byteLength;
          break;
        case 3:
          length = bytes.byteLength - offset;
          break;
        case 4: break;
        default: throw new Error('unexpected number of arguments');
      }
      
      crc ^= -1;
      for (var i = 0; i < length; i++) {
        crc = CRC[(crc ^ bytes[offset + i]) & 0xff] ^ (crc >>> 8);
      }
      return (crc ^ -1) >>> 0;
    },
    adler32: function(adler, bytes, offset, length) {
      switch (arguments.length) {
        case 0: return 1;
        case 2:
          offset = 0;
          length = bytes.byteLength;
          break;
        case 3:
          length = bytes.byteLength - offset;
          break;
        case 4: break;
        default: throw new Error('unexpected number of arguments');
      }
      var sum2 = (adler >>> 16);
      adler &= 0xffff;
      while (length-- > 0) {
        adler += bytes[offset++];
        sum2 += adler;
      }
      // 65521: largest prime smaller than 65536
      adler = CHOP(CHOP(adler)) % 65521;
      sum2 = CHOP(CHOP(sum2)) % 65521;

      /* return recombined sums */
      return adler | (sum2 << 16);
    },
    // reverse the bytes of a 32-bit integer
    swap32: function(q) {
      return ((q >> 24) & 0xff)
        | ((q >> 8) & 0xff00)
        | ((q & 0xff00) << 8)
        | ((q & 0xff) << 24);
    },
  };

});
