define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var text = macintoshRoman(bytes, 0, bytes.length);
      debugger;
    });
  };

});
