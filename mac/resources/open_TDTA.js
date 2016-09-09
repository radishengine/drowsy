define(function() {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var list = new Array(dv.getUint16(0, false));
      var pos = 2;
      for (var i = 0; i < list.length; i++) {
        list[i] = new Array(dv.getUint16(pos, false));
        pos += 2;
        for (var j = 0; j < list[i].length; j++) {
          list[i][j] = {
            unknown_0x00: bytes[pos],
            unknown_0x01: dv.getInt32(pos, false) << 2 >> 2, // 24-bit signed integer
          };
          pos += 4;
        }
      }
      item.setDataObject(list);
    });
  }
  
  return open;

});
