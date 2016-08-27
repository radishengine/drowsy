define(function() {

  'use strict';

  return function(resource) {
    if (resource.data.length !== 512) {
      console.error('icl4 resource expected to be 512 bytes, got ' + resource.data.length);
      return;
    }
    var img = document.createElement('CANVAS');
    img.width = 32;
    img.height = 32;
    var ctx = img.getContext('2d');
    var pix = ctx.createImageData(32, 32);
    for (var ibyte = 0; ibyte < 512; ibyte++) {
      pix.data.set(mac4BitSystemPalette[resource.data[ibyte] >> 4], ibyte*8);
      pix.data.set(mac4BitSystemPalette[resource.data[ibyte] & 15], ibyte*8 + 4);
    }
    ctx.putImageData(pix, 0, 0);
    resource.image = {url: img.toDataURL(), width:32, height:32};
  };

});
