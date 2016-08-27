define(['mac/palette2'], function(palette) {

  'use strict';
  
  return function(resource) {
    var hasMask;
    switch(resource.data.length) {
      case 68: hasMask = true; break;
      case 37: hasMask = false; break;
      default:
        console.error('unexpected length for CURS resource: ' + resource.data.length);
        return;
    }
    var img = document.createElement('CANVAS');
    img.width = 16;
    img.height = 16;
    var ctx = img.getContext('2d');
    var pix = ctx.createImageData(16, 16);
    if (hasMask) {
      for (var ibyte = 0; ibyte < 32; ibyte++) {
        var databyte = resource.data[ibyte], maskbyte = resource.data[32 + ibyte];
        for (var ibit = 0; ibit < 8; ibit++) {
          var imask = 0x80 >> ibit;
          if (maskbyte & imask) {
            pix.data.set(palette[databyte & imask ? 1 : 0], (ibyte*8 + ibit) * 4);
          }
        }
      }
    }
    else {
      for (var ibyte = 0; ibyte < 32; ibyte++) {
        var databyte = resource.data[ibyte];
        for (var ibit = 0; ibit < 8; ibit++) {
          pix.data.set(palette[databyte & imask ? 1 : 0], (ibyte*8 + ibit) * 4);
        }
      }
    }
    ctx.putImageData(pix, 0, 0);
    resource.image = {url: img.toDataURL(), width:16, height:16};
    var hotspotDV = new DataView(resource.data.buffer, resource.data.byteOffset + (hasMask ? 64 : 32), 8);
    resource.hotspot = {y:hotspotDV.getInt16(0), x:hotspotDV.getInt16(2)};
  };

});
