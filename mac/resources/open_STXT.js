define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dataDV = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var textPos = dataDV.getUint32(0, false);
      var textLen = dataDV.getUint32(4, false);
      var num3 = dataDV.getUint32(8, false); // TODO: what is this
      item.text = macintoshRoman(bytes, textPos, textLen);
    });
  };

});
