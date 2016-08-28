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
    var canvas = document.createElement('CANVAS');
    canvas.width = bounds.right - bounds.left;
    canvas.height = bounds.bottom - bounds.top;
    var ctx = canvas.getContext('2d');
    if (resource.data.length === 10) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    else {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'black';
      var on = false;
      var y = -1;
      for (var pos = 10; pos < resource.data.length; ) {
        var newY = dv.getUint16(pos, false);
        if (on && newY > ++y) {
          ctx.drawRect(0, y, canvas.width, newY - y);
        }
        y = newY;
        pos += 2;
        var x = 0;
        for (var runLength = dv.getUint16(pos); runLength !== 0x7fff; pos += 2) {
          if (on) ctx.fillRect(x, y, runLength, 1);
          on = !on;
          x += runLength;
        }
        if (on) {
          ctx.fillRect(x, y, canvas.width - x, 1);
        }
        pos += 2;
      }
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
