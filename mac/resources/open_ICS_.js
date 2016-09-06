define(['mac/palette2'], function(palette) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      if (bytes.length !== 64) {
        return Promise.reject('ics# resource expected to be 64 bytes, got ' + bytes.length);
      }
      item.withPixels(16, 16, function(pixelData) {
        for (var ibyte = 0; ibyte < 32; ibyte++) {
          var databyte = bytes[ibyte], maskbyte = bytes[32 + ibyte];
          for (var ibit = 0; ibit < 8; ibit++) {
            var imask = 0x80 >> ibit;
            if (maskbyte & imask) {
              pixelData.set(palette[databyte & imask ? 1 : 0], (ibyte*8 + ibit) * 4);
            }
          }
        }
      });
    });
  };

});
