define(function() {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (dv.getUint16(0, false) !== bytes.length) {
        return Promise.reject('RGN: bad length');
      }
      var bounds = {
        top: dv.getInt16(2, false),
        left: dv.getInt16(4, false),
        bottom: dv.getInt16(6, false),
        right: dv.getInt16(8, false),
      };
      if (bytes.length === 10) {
        item.setDataObject(bounds);
        return;
      }
      var offsetX = bounds.left, offsetY = bounds.top;
      item.setOffset(offsetX, offsetY);
      var width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
      item.with2DContext(width, height, function(ctx) {
        ctx.fillStyle = 'black';
        ctx.globalCompositeOperation = 'xor';
        var y, x;
        for (var pos = 10; 0x7fff !== (y = dv.getUint16(pos, false)); pos += 2) {
          for (pos += 2; 0x7fff !== (x = dv.getUint16(pos, false)); pos += 2) {
            ctx.fillRect(x - offsetX, y - offsetY, width, height);
          }
        }
      });
    });
  };

});
