define(['mac/palette2'], function(ICON) {

  'use strict';
  
  return function(resource) {
    if (resource.data.length !== 128) {
      console.error('ICON resource expected to be 128 bytes, got ' + resource.data.length);
      return;
    }
    var img = document.createElement('CANVAS');
    img.width = 32;
    img.height = 32;
    var ctx = img.getContext('2d');
    var pix = ctx.createImageData(32, 32);
    for (var ibyte = 0; ibyte < 128; ibyte++) {
      var databyte = resource.data[ibyte];
      for (var ibit = 0; ibit < 8; ibit++) {
        var imask = 0x80 >> ibit;
        pix.data.set(palette[databyte & imask ? 1 : 0], (ibyte*8 + ibit) * 4);
      }
    }
    ctx.putImageData(pix, 0, 0);
    resource.image = {url: img.toDataURL(), width:32, height:32};
  };

});
