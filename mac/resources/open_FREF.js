define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      if (bytes.length !== 7) {
        return Promise.reject('FREF resource expected to be 7 bytes, got ' + bytes.length);
      }
      item.setDataObject({
        fileType: macintoshRoman(bytes, 0, 4),
        iconListID: (bytes[4] << 8) | bytes[5],
      });
    });
  };

});
