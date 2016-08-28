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
      pixelType: macintoshRoman(resource.data, 30, 4),
      pixelSize: dv.getInt16(34, false),
      componentsPerPixel: dv.getInt16(36, false),
      bitsPerComponent: dv.getInt16(38, false),
      planeBytes: dv.getInt32(40, false),
      colorTableHandle: dv.getInt16(44, false),
      reserved: dv.getInt32(46, false),
    };
    var pos = 50;
    var maskBitmap = {
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
    maskBitmap.offset = pos;
    pos += maskBitmap.rowBytes * (maskBitmap.bounds.bottom - maskBitmap.bounds.top);
    iconBitmap.offset = pos;
    pos += iconBitmap.rowBytes * (iconBitmap.bounds.bottom - iconBitmap.bounds.top);
    var colorCount = dv.getInt16(pos + 6, false) + 1;
    if (colorCount < 0) {
      console.error('invalid number of colors in color table');
      return;
    }
    pos += 8;
    pos += 8 * colorCount;
    pixmap.offset = pos;
    pos += pixmap.rowBytes * (pixmap.bounds.bottom - pixmap.bounds.top);
    console.log('cicn', maskBitmap.offset, iconBitmap.offset, pixmap.offset, pos, resource.data.length);
  }

});
