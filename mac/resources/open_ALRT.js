define(function() {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      if (bytes.length < 12) {
        return Promise.reject('ALRT resource: expected length 12, got ' + bytes.length);
      }
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      item.setDataObject({
        rectangle: {
          top: dv.getInt16(0, false),
          left: dv.getInt16(2, false),
          bottom: dv.getInt16(4, false),
          right: dv.getInt16(6, false),
        },
        itemListResourceID: dv.getUint16(8, false),
        response4_3: bytes[10],
        response2_1: bytes[11],
        position: bytes.length < 14 ? 0 : dv.getUint16(12, false),
      });
    });
  };

});
