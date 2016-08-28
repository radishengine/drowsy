define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(resource) {
  
    var text = macintoshRoman(resource.data, 0, resource.data.length);
    debugger;
  
  };

});
