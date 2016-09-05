define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var appSignature = macintoshRoman(bytes, 0, 4);
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      
      var signatureResourceID = dv.getUint16(4, false);
      var arrayCount = dv.getUint16(6, false);
      if (signatureResourceID !== 0) {
        return Promise.reject('BNDL: signature resource ID expected to be 0, got ' + signatureResourceID);
      }
      var offset = 8;
      var mappings = {};
      for (var i = 0; i < arrayCount; i++) {
        var resourceType = macintoshRoman(bytes, offset, 4);
        offset += 4;
        var mappingCount = dv.getUint16(offset, false);
        offset += 2;
        var mapping = {};
        for (var i = 0; i < mappingCount; i++) {
          mapping[dv.getUint16(offset, false).toString()] = dv.getUint16(offset + 2, false);
          offset += 4;
        }
        mappings[resourceType] = mapping;
      }
      item.setDataObject({
        appSignature: appSignature,
        signatureResourceID: signatureResourceID,
        mappings: mappings,
      });
    });
  };

});
