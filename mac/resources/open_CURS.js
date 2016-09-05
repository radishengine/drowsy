define(['mac/palette2'], function(palette) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var hasMask;
      switch(bytes.length) {
        case 68: hasMask = true; break;
        case 37: hasMask = false; break;
        default:
          return Promise.reject('unexpected length for CURS resource: ' + bytes.length);
      }
      if (hasMask) {
        item.withPixels(16, 16, function(pixelData) {
          for (var ibyte = 0; ibyte < 32; ibyte++) {
            var databyte = bytes[ibyte], maskbyte = bytes[32 + ibyte];
            for (var ibit = 0; ibit < 8; ibit++) {
              var imask = 0x80 >> ibit;
              if (maskbyte & imask) {
                pixelData.set(palette[databyte & imask ? 1 : 0], (ibyte*8 + ibit) * 4);
              }
            }
          }
        });
      }
      else {
        item.withPixels(16, 16, function(pixelData) {
          for (var ibyte = 0; ibyte < 32; ibyte++) {
            var databyte = bytes[ibyte];
            for (var ibit = 0; ibit < 8; ibit++) {
              pixelData.set(palette[databyte & imask ? 1 : 0], (ibyte*8 + ibit) * 4);
            }
          }
        });
      }
      var hotspotDV = new DataView(bytes.buffer, bytes.byteOffset + (hasMask ? 64 : 32), 8);
      resource.setHotspot(hotspotDV.getInt16(2), hotspotDV.getInt16(0));
    });
  };

});
