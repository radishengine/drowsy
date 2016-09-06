define(['mac/palette256'], function(palette) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      if (bytes.length !== 1024) {
        return Promise.reject('icl8 resource expected to be 1024 bytes, got ' + bytes.length);
      }
      item.withPixels(32, 32, function(pixelData) {
        for (var ibyte = 0; ibyte < 1024; ibyte++) {
          pixelData.set(palette[bytes[ibyte]], ibyte*4);
        }
      });
    });
  };

});
