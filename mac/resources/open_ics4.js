define(['mac/palette16'], function(palette) {

  'use strict';

  return function(item) {
    return item.getBytes().then(function(bytes) {
      if (bytes.length !== 128) {
        return Promise.reject('ics4 resource expected to be 128 bytes, got ' + bytes.length);
      }
      item.withPixels(16, 16, function(pixelData) {
        for (var ibyte = 0; ibyte < 128; ibyte++) {
          pixelData.set(palette[bytes[ibyte] >> 4], ibyte*8);
          pixelData.set(palette[bytes[ibyte] & 15], ibyte*8 + 4);
        }
      });
    });
  };
  
});
