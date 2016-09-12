define(function() {

  'use strict';

  function open(item) {
    item.getSubitem(/VWSC/)
    .then(function(vwsc) {
      console.log(vwsc);
    });
  }
  
  return open;

});
