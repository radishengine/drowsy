define(['mac/palette256'], function(palette) {
  
  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      if (bytes.length !== 256) {
        return Promise.reject('ics8 resource expected to be 256 bytes, got ' + bytes.length);
      }
      item.withPixels(16, 16, function(pixelData) {
        for (var ibyte = 0; ibyte < 256; ibyte++) {
          pixelData.set(palette[bytes[ibyte]], ibyte*4);
        }
      });
    });
  };

});
