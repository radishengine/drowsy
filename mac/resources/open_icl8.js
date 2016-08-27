define(['mac/palette256'], function(palette) {

  'use strict';
  
  return function(resource) {
    if (resource.data.length !== 1024) {
      console.error('icl8 resource expected to be 1024 bytes, got ' + resource.data.length);
      return;
    }
    var img = document.createElement('CANVAS');
    img.width = 32;
    img.height = 32;
    var ctx = img.getContext('2d');
    var pix = ctx.createImageData(32, 32);
    for (var ibyte = 0; ibyte < 1024; ibyte++) {
      pix.data.set(palette[resource.data[ibyte]], ibyte*4);
    }
    ctx.putImageData(pix, 0, 0);
    resource.image = {url: img.toDataURL(), width:32, height:32};
  };

});
