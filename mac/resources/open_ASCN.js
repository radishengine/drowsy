define(['mac/roman'], function(macRoman) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var designLength = dv.getUint16(0, false);
      var pos = designLength;
      var obj = {
        top: dv.getInt16(pos, false),
        left: dv.getInt16(pos + 2, false),
        bottom: dv.getInt16(pos + 4, false),
        right: dv.getInt16(pos + 6, false),
        worldY: dv.getInt16(pos + 8, false),
        worldX: dv.getInt16(pos + 10, false),
        northBlocked: !!bytes[pos + 12],
        southBlocked: !!bytes[pos + 13],
        eastBlocked: !!bytes[pos + 14],
        westBlocked: !!bytes[pos + 15],
        soundFrequency: dv.getInt16(pos + 16, false),
        soundType: bytes[pos + 18],
      };
      pos += 20;
      obj.northMessage = macRoman(bytes, pos+1, bytes[pos]);
      pos += 1 + obj.northMessage.length;
      obj.southMessage = macRoman(bytes, pos+1, bytes[pos]);
      pos += 1 + obj.southMessage.length;
      obj.eastMessage = macRoman(bytes, pos+1, bytes[pos]);
      pos += 1 + obj.eastMessage.length;
      obj.westMessage = macRoman(bytes, pos+1, bytes[pos]);
      pos += 1 + obj.westMessage.length;
      obj.soundName = macRoman(bytes, pos+1, bytes[pos]);
      item.setDataObject(obj);
    });
  }
  
  return open;

});
