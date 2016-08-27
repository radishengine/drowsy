define(['mac/palette256'], function(palette) {
  
  'use strict';
  
  return function(resource) {
    if (resource.data.length !== 256) {
      console.error('ics8 resource expected to be 256 bytes, got ' + resource.data.length);
      return;
    }
    var img = document.createElement('CANVAS');
    img.width = 16;
    img.height = 16;
    var ctx = img.getContext('2d');
    var pix = ctx.createImageData(16, 16);
    for (var ibyte = 0; ibyte < 256; ibyte++) {
      pix.data.set(palette[resource.data[ibyte]], ibyte*4);
    }
    ctx.putImageData(pix, 0, 0);
    resource.image = {url: img.toDataURL(), width:16, height:16};
  };

});
