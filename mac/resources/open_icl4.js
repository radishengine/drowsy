define(['mac/palette16'], function(palette) {

  'use strict';

  return function(item) {
    return item.getBytes().then(function(bytes) {
      if (bytes.length !== 512) {
        return Promise.reject('icl4 resource expected to be 512 bytes, got ' + bytes.length);
      }
      item.withPixels(32, 32, function(pixelData) {
        for (var ibyte = 0; ibyte < 512; ibyte++) {
          pixelData.set(palette[bytes[ibyte] >> 4], ibyte*8);
          pixelData.set(palette[bytes[ibyte] & 15], ibyte*8 + 4);
        }
      });
    });
  };

});
