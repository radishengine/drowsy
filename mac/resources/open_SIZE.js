define(function() {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      if (bytes.length !== 10) {
        return Promise.reject('SIZE: expected length 10, got ' + bytes.length);
      }
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      item.setDataObject({
        flags: dv.getUint16(0, false),
        preferredMemorySize: dv.getUint32(2, false),
        minimumMemorySize: dv.getUint32(6, false),
      });
    });
  }

});
