define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var count = dv.getUint16(0, false);
      var list = [];
      var base = 2 + (4 * (count + 1));
      for (var i = 0; i < count; i++) {
        if (bytes[2 + 4*i] !== (i+1)) {
          return Promise.reject('expected ' + (i+1) + ', got ' + bytes[2 + 4*i]);
        }
        if (bytes[2 + 4*i + 1] !== 1) {
          return Promise.reject('second byte expected to be 1, got ' + bytes[2 + 4*i + 1]);
        }
        var thisPos = dv.getUint16(2 + 4*i + 2, false);
        var nextPos = dv.getUint16(2 + 4*(i+1) + 2, false);
        list.push(macintoshRoman(bytes, base + thisPos, nextPos - thisPos));
      }
      if (bytes[2 + 4*count] !== (count+1) || bytes[2 + 4*count + 1] !== 0) {
        return Promise.reject('unexpected end for VWAC');
      }
      item.setDataObject(list);
    });
  }
  
  return open;

});
