define(function() {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var dataObject = {
        unknown1: bytes.subarray(0, 8),
        height: dv.getUint16(8, false),
        width: dv.getUint16(10, false),
        unknown2: bytes.subarray(12),
      };
      item.setDataObject(dataObject);
    });
  };

});
