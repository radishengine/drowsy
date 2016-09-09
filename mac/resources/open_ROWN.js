define(['mac/roman'], function(macRoman) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var list = new Array(bytes.length / 4);
      for (var i = 0; i < list.length; i++) {
        list[i] = macRoman(bytes, i*4, 4);
      }
      return list;
    });
  }
  
  return open;

});
