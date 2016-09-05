define(['mac/bitpacking'], function(bitpacking) {

  'use strict';
  
  return function(item) {
    return this.getBytes().then(function(bytes) {
      item.getUnpackedData = function() {
        return bitpacking.unpackBits(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      };
    });
  };

});
