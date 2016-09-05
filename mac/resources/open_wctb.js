define(function() {

  'use strict';

  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var entryCount = dv.getInt16(6, false) + 1;
      if (entryCount < 0) {
        return Promise.reject('color table resource: invalid number of entries');
      }
      if (entryCount === 0) {
        item.setDataObject(null);
        return;
      }
      item.withPixels(entryCount, 1, function(pixelData) {
        for (var icolor = 0; icolor < entryCount; icolor++) {
          var offset = dv.getInt16(8 + icolor*8, false) * 4;
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
