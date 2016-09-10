define(['mac/roman'], function() {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      item.setDataObject(macRoman(bytes, 0, bytes.length).replace(/\0.*/, ''));
    });
  }
  
  return open;

});
