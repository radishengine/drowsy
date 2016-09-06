define(function() {

  'use strict';
  
  return function(item) {
    item.getBytes().then(function(bytes) {
      var clut = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var seed = clut.getInt32(0, false); // resource ID
      var flags = clut.getUint16(4, false); // 0x8000: color map for indexed device
      var entryCount = clut.getUint16(6, false) + 1;
      item.withPixels(entryCount, 1, function(pixelData) {
        for (var icolor = 0; icolor < entryCount; icolor++) {
          var offset = clut.getInt16(8 + icolor*8, false) * 4;
          if (offset >= 0) {
            pixelData[offset] = bytes[8 + icolor*8 + 2];
            pixelData[offset + 1] = bytes[8 + icolor*8 + 4];
            pixelData[offset + 2] = bytes[8 + icolor*8 + 6];
            pixelData[offset + 3] = 255;
          }
        }
      });
    });
  
  };

});
