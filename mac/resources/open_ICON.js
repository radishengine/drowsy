define(['mac/palette2'], function(palette) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      if (bytes.length !== 128 && bytes.length !== 256) {
        return Promise.reject('ICON resource expected to be 128 bytes, got ' + bytes.length);
      }
      item.withPixels(32, 32, function(pixelData) {
        var mask = bytes.length === 256 ? bytes.subarray(128, 256) : null;
        for (var ibyte = 0; ibyte < 128; ibyte++) {
          var databyte = bytes[ibyte], maskbyte = mask ? mask[ibyte] : 255;
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
