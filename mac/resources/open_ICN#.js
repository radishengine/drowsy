define(['mac/palette2'], function(palette) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      if (bytes.length !== 256) {
        return Promise.reject('ICN# resource expected to be 256 bytes, got ' + bytes.length);
      }
      item.withPixels(32, 32, function(pixelData) {
        for (var ibyte = 0; ibyte < 128; ibyte++) {
          var databyte = bytes[ibyte], maskbyte = bytes[128 + ibyte];
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
