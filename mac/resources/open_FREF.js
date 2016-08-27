define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(resource) {
    if (resource.data.length !== 7) {
      console.error('FREF resource expected to be 7 bytes, got ' + resource.data.length);
      return;
    }
    resource.dataObject = {
      fileType: macintoshRoman(resource.data, 0, 4),
      iconListID: (resource.data[4] << 8) | resource.data[5],
    };
  };

});
