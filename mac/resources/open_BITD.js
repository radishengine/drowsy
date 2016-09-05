define(['mac/bitpacking'], function(bitpacking) {

  'use strict';
  
  return function(item) {
    item.getUnpackedData = function() {
      return this.getBytes().then(function(bytes) {
        return bitpacking.unpackBits(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      });
    };
  };

});
