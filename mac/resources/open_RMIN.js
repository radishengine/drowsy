define(['mac/roman'], function(macRoman) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var list = new Array(bytes.length / 6);
      for (var i = 0; i < list.length; i++) {
        list[i] = {
          type: macRoman(bytes, i*6, 4),
          id: dv.getUint16(i*6 + 4, false),
        };
      }
      item.setDataObject(list);
    });
  }
  
  return open;

});
