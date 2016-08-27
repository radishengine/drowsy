define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(resource) {
    var appSignature = macintoshRoman(resource.data, 0, 4);
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    
    var signatureResourceID = dv.getUint16(4, false),
      arrayCount = dv.getUint16(6, false);
    if (signatureResourceID !== 0) {
      console.error('BNDL: signature resource ID expected to be 0, got ' + signatureResourceID);
      return;
    }
    var offset = 8;
    var mappings = {};
    for (var i = 0; i < arrayCount; i++) {
      var resourceType = macintoshRoman(resource.data, offset, 4);
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
    resource.dataObject = {
      appSignature: appSignature,
      signatureResourceID: signatureResourceID,
      mappings: mappings,
    };
  };

});
