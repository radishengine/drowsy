define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(resource) {
    var dataDV = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    var textPos = dataDV.getUint32(0, false);
    var textLen = dataDV.getUint32(4, false);
    var num3 = dataDV.getUint32(8, false); // TODO: what is this
    resource.text = macintoshRoman(resource.data, textPos, textLen);
  };

});
