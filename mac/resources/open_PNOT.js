define(['mac/roman', 'mac/date'], function(macRoman, macDate) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      item.setDataObject({
        modificationDate: macDate(dv, 0),
        version: dv.getUint16(4, false), // must be 0
        type: macRoman(bytes, 6, 4), // typically PICT
        number: dv.getInt16(10, false),
      });
    });
  }
  
  return open;

});
