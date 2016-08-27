define(['mac/bitpacking'], function(bitpacking) {

  'use strict';
  
  return function(resource) {
    resource.getUnpackedData = function() {
      return bitpacking.unpackBits(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    };
  };

});
