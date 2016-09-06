define(function() {

  'use strict';
  
  return function(item) {
    item.getBytes().then(function(bytes) {
      var clut = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
      var seed = clut.getInt32(0, false); // resource ID
      var flags = clut.getUint16(4, false); // 0x8000: color map for indexed device
      if (flags !== 0x0000) {
        console.log(resource.type, resource.name, resource.data);
        return;
      }
      var entryCount = clut.getUint16(6, false) + 1;
      item.withPixels(entryCount, 1, function(pixelData) {
        for (var icolor = 0; icolor < entryCount; icolor++) {
          var offset = clut.getInt16(8 + icolor*8, false) * 4;
          if (offset >= 0) {
            pixelData[offset] = resource.data[8 + icolor*8 + 2];
            pixelData[offset + 1] = resource.data[8 + icolor*8 + 4];
            pixelData[offset + 2] = resource.data[8 + icolor*8 + 6];
            pixelData[offset + 3] = 255;
          }
        }
      });
    });
  
  };

});
