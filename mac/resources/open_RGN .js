define(function() {

  'use strict';
  
  return function(resource) {
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    if (dv.getUint16(0, false) !== resource.data.length) {
      console.error('RGN: bad length');
      return;
    }
    var bounds = {
      top: dv.getInt16(2, false),
      left: dv.getInt16(4, false),
      bottom: dv.getInt16(6, false),
      right: dv.getInt16(8, false),
    };
    if (resource.data.length === 10) {
      resource.dataObject = bounds;
      return;
    }
    var canvas = document.createElement('CANVAS');
    canvas.width = bounds.right - bounds.left;
    canvas.height = bounds.bottom - bounds.top;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.globalCompositeOperation = 'xor';
    var y = -1;
    var lastRow = ctx.createImageData(canvas.width, 1);
    for (var pos = 10; pos < resource.data.length; ) {
      var newY = dv.getUint16(pos, false);
      if (newY === 0x7fff) {
        break;
      }
      while (++y <= newY) {
        ctx.putImageData(lastRow, 0, y);
      }
      pos += 2;
      var x = 0;
      var runLength = dv.getUint16(pos, false);
      while (runLength !== 0x7fff) {
        x += runLength;
        pos += 2;
        runLength = dv.getUint16(pos, false);
        ctx.fillRect(x, y, runLength, 1);
        x += runLength;
        pos += 2;
        runLength = dv.getUint16(pos, false);
      }
      lastRow = ctx.getImageData(0, y, canvas.width, 1);
      pos += 2;
    }
    resource.image = {
      offsetX: bounds.left,
      offsetY: bounds.top,
      url: canvas.toDataURL(),
      width: canvas.width,
      height: canvas.height,
    };
  };

});
