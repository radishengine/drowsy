define(['mac/roman'], function(macRoman) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      
      var pos = dv.getUint16(0, false);
      
      var obj = {
        top: dv.getInt16(pos, false),
        left: dv.getInt16(pos + 2, false),
        bottom: dv.getInt16(pos + 4, false),
        right: dv.getInt16(pos + 6, false),
        isPlural: !!bytes[pos + 8],
        // unknown: 4 bytes
        accuracy: bytes[pos + 13],
        value: bytes[pos + 14],
        type: bytes[pos + 15],
        damage: bytes[pos + 16],
        attackType: bytes[pos + 17],
        numberOfUses: dv.getUint16(pos + 18, false),
        returnToRandomScene: !!bytes[pos + 20],
        // unknown: 1 byte
      };
      pos += 22;
      
      obj.sceneOrOwner = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      
      obj.clickMessage = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      
      obj.operativeVerb = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      
      obj.failureMessage = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      
      obj.useMessage = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      
      obj.sound = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      
      item.setDataObject(obj);
    });
  }
  
  return open;

});
