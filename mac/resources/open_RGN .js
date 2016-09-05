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
      item.setOffset(bounds.left, bounds.top);
      var width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
      item.with2DContext(width, height, function(ctx) {
        ctx.fillStyle = 'black';
        ctx.globalCompositeOperation = 'xor';
        var y = -1;
        var lastRow = ctx.createImageData(width, 1);
        for (var pos = 10; pos < bytes.length; ) {
          var newY = dv.getUint16(pos, false);
          if (newY === 0x7fff) {
            break;
          }
          while (++y < newY) {
            ctx.putImageData(lastRow, 0, y);
          }
          ctx.putImageData(lastRow, 0, y);
          pos += 2;
          var x1 = dv.getUint16(pos, false);
          while (x1 !== 0x7fff) {
            var x2 = dv.getUint16(pos + 2, false);
            ctx.fillRect(x1, y, x2 - x1, 1);
            pos += 4;
            x1 = dv.getUint16(pos, false);
          }
          lastRow = ctx.getImageData(0, y, width, 1);
          pos += 2;
        }
      });
    });
  };

});
