define(['mac/roman', 'mac/fixedPoint'], function(macintoshRoman, fixedPoint) {

  'use strict';
  
  return function(resource) {
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    var pixmap = {
      baseAddr: dv.getUint32(0, false),
      rowBytes: dv.getUint16(4, false) & 0x3fff,
      flags: dv.getUint16(4, false) & 0xC000,
      bounds: {
        top: dv.getInt16(6, false),
        left: dv.getInt16(8, false),
        bottom: dv.getInt16(10, false),
        right: dv.getInt16(12, false),
      },
      recordVersionNumber: dv.getInt16(14, false),
      packType: dv.getInt16(16, false),
      packSize: dv.getInt32(18, false),
      hRes: fixedPoint.fromInt32(dv.getInt32(22, false)),
      vRes: fixedPoint.fromInt32(dv.getInt32(26, false)),
      pixelType: dv.getInt16(30, false),
      pixelSize: dv.getInt16(32, false),
      componentCount: dv.getInt16(34, false),
      componentSize: dv.getInt16(36, false),
      pixelFormat: macintoshRoman(resource.data, 38, 4),
      colorTableHandle: dv.getInt32(42, false),
      reserved: dv.getInt32(46, false),
    };
    var pos = 50;
    var mask = {
      baseAddr: dv.getUint32(pos),
      rowBytes: dv.getUint16(pos + 4),
      bounds: {
        top: dv.getInt16(pos + 6, false),
        left: dv.getInt16(pos + 8, false),
        bottom: dv.getInt16(pos + 10, false),
        right: dv.getInt16(pos + 12, false),
      },
    };
    pos += 14;
    var iconBitmap = {
      baseAddr: dv.getUint32(pos),
      rowBytes: dv.getUint16(pos + 4),
      bounds: {
        top: dv.getInt16(pos + 6, false),
        left: dv.getInt16(pos + 8, false),
        bottom: dv.getInt16(pos + 10, false),
        right: dv.getInt16(pos + 12, false),
      },
    };
    pos += 14;
    var iconDataHandle = dv.getUint32(pos, false);
    pos += 4;
    mask.offset = pos;
    pos += mask.rowBytes * (mask.bounds.bottom - mask.bounds.top);
    iconBitmap.offset = pos;
    pos += iconBitmap.rowBytes * (iconBitmap.bounds.bottom - iconBitmap.bounds.top);
    var colorCount = dv.getInt16(pos + 6, false) + 1;
    if (colorCount < 0) {
      console.error('invalid number of colors in color table');
      return;
    }
    pos += 8;
    var palette = new Array(256);
    for (var i = 0; i < colorCount; i++) {
      var entryNumber = dv.getUint16(pos, false);
      palette[entryNumber] = [
        resource.data[pos + 2],
        resource.data[pos + 4],
        resource.data[pos + 6],
        255];
      pos += 8;
    }
    pixmap.offset = pos;
    pos += pixmap.rowBytes * (pixmap.bounds.bottom - pixmap.bounds.top);
    
    // TODO: extract palette and bitmap version too (multiple resource output)
    var canvas = document.createElement('CANVAS');
    canvas.width = pixmap.bounds.right - pixmap.bounds.left;
    canvas.height = pixmap.bounds.bottom - pixmap.bounds.top;
    var ctx = canvas.getContext('2d');
    var pixels = ctx.createImageData(canvas.width, canvas.height);
    var pixelPitch = pixels.width * 4;
    switch(pixmap.pixelSize) {
      case 1:
        for (var y = 0; y < canvas.height; y++) {
          for (var x = 0; x < canvas.width; x++) {
            var xc = x >> 3, xn = x & 7;
            var xp = resource.data[pixmap.offset + y*pixmap.rowBytes + xc];
            var ix = 0x80 >> xn;
            pixels.data.set(
              palette[(xp & ix) ? 1 : 0] || [0,0,0,0],
              pixelPitch * y + 4 * x);
          }
        }
        break;
      case 4:
        for (var y = 0; y < canvas.height; y++) {
          for (var x = 0; x < canvas.width; x++) {
            var mp = resource.data[mask.offset + y*mask.rowBytes + (x >> 3)];
            if (mp & (0x80 >> (x & 0x7))) {
              var xp = resource.data[pixmap.offset + y*pixmap.rowBytes + (x >> 1)];
              var xc = (x & 1) ? xp & 0xf : xp >> 4;
              pixels.data.set(
                palette[xc] || [0,0,0,0],
                pixelPitch * y + 4 * x);
            }
          }
        }
        break;
      case 8:
        for (var y = 0; y < canvas.height; y++) {
          for (var x = 0; x < canvas.width; x++) {
            pixels.data.set(
              palette[resource.data[pixmap.offset + y*pixmap.rowBytes + x]] || [0,0,0,0],
              pixelPitch * y + 4 * x);
          }
        }
        break;
      default:
        console.error('pixel size not yet supported: ' + pixmap.pixelSize);
        return;
    }
    ctx.putImageData(pixels, 0, 0);
    resource.image = {
      url: canvas.toDataURL(),
      width: canvas.width,
      height: canvas.height,
      offsetX: pixmap.bounds.left,
      offsetY: pixmap.bounds.top,
    };
  }

});
