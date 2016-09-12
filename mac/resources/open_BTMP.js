define(['mac/palette2'], function(palette) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
    
      var bitmapInfo = new BitmapHeaderView(bytes.buffer, bytes.byteOffset, BitmapHeaderView.byteLength);
      
      var width = bitmapInfo.right - bitmapInfo.left;
      var height = bitmapInfo.bottom - bitmapInfo.top;
      
      item.withPixels(width, height, function(pixelData) {
        var pos = BitmapHeaderView.byteLength;
        for (var y = 0; y < height; y++) {
          for (var x = 0; x < width; x++) {
            var byte = bytes[pos + (x >> 8)];
            var bit = (byte >> (7 - (x & 7))) & 1;
            pixelData.set(palette[bit], 4 * (y*width + x));
          }
          pos += pixmap.rowBytes;
        }
      });
    
    });
  }
  
  function BitmapHeaderView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  BitmapHeaderView.prototype = {
    get baseAddr() {
      return this.dataView.getUint32(0, false);
    },
    get rowBytes() {
      return this.dataView.getUint16(4, false) & 0x3fff;
    },
    get flags() {
      return this.dataView.getUint8(4) & 0xC0;
    },
    get top() {
      return this.dataView.getInt16(6, false);
    },
    get left() {
      return this.dataView.getInt16(8, false);
    },
    get bottom() {
      return this.dataView.getInt16(10, false);
    },
    get right() {
      return this.dataView.getInt16(12, false);
    },
  };
  BitmapHeaderView.byteLength = 14;
  
  return open;

});
