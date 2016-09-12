define(['mac/roman'], function(macRoman) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      return macRoman(bytes, 0);
    });
  }
  
  return open;

});
