define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(resource) {
    var strcount = new DataView(resource.data.buffer, resource.data.byteOffset, 2).getInt16(0, false);
    if (strcount < 0) {
      console.log(strcount, resource.data);
      return;
    }
    var list = [];
    var pos = 2;
    for (var istr = 0; istr < strcount; istr++) {
      var len = resource.data[pos++];
      list.push(macintoshRoman(resource.data, pos, len));
      pos += len;
    }
    resource.dataObject = list;
  };

});
