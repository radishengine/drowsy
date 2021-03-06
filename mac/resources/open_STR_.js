define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(item, typeName) {
    if (typeName === 'STR#') {
      // string table
      return item.getBytes().then(function(bytes) {
        var strcount = new DataView(bytes.buffer, bytes.byteOffset, 2).getInt16(0, false);
        if (strcount < 0) {
          return Promise.reject('invalid string count for STR#');
        }
        var list = [];
        var pos = 2;
        for (var istr = 0; istr < strcount; istr++) {
          var len = bytes[pos++];
          list.push(macintoshRoman(bytes, pos, len));
          pos += len;
        }
        item.setDataObject(list);
      });
    }
    // single string
    return item.getBytes().then(function(bytes) {
      item.text = macintoshRoman(bytes, 1, bytes[0]);
    });      
  };

});
