define(['itemObjectModel'], function(itemOM) {

  'use strict';
  
  function open(item, resourceName) {
    return item.getBytes().then(function(bytes) {
      if (resourceName === 'PAT#') {
        var count = new DataView(bytes.buffer, bytes.byteOffset, 2).getInt16(0);
        if (count < 0 || bytes.length < 2 * count*8) {
          return Promise.reject('bad length for PAT# table');
        }
        for (var i = 0; i < count; i++) {
          var patItem = itemOM.createItem('#'+i);
          item.addItem(patItem);
          drawPattern(patItem, bytes, 2 + i*8);
        }
      }
      else {
        drawPattern(item, bytes, 0);
      }
    });
  }
  
  function drawPattern(item, bytes, offset) {
    item.withPixels(8, 8, function(pixelData) {
      for (var y = 0; y < 8; y++) {
        for (var x = 0; x < 8; x++) {
          if (bytes[offset + y] & (0x80 >> x)) {
            pixelData[4 * (y * 8 + x) + 3] = 0xff;
          }
        }
      }
    });
  }
  
  return open;

});
