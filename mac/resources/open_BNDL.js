define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(resource) {
    var appSignature = macintoshRoman(resource.data, 0, 4);
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    
    var signatureResourceID = dv.getUint16(4, false),
      arrayCount = dv.getUint16(6, false),
      mappingResourceType = macintoshRoman(resource.data, 8, 4);
    if (signatureResourceID !== 0) {
      console.error('BNDL: signature resource ID expected to be 0, got ' + signatureResourceID);
      return;
    }
    if (arrayCount !== 2) {
      console.error('BNDL: array count expected to be 2, got ' + arrayCount);
      return;
    }
    if (mappingResourceType !== 'ICN#') {
      console.error('BNDL: expected mapping resource type ICN#, got ' + macintoshRoman(resource.data, 8, 2));
      return;
    }
    var offset = 12;
    var iconMapping = {};
    var iconMappingCount = dv.getUint16(offset, false);
    offset += 2;
    for (var i = 0; i < iconMappingCount; i++) {
      iconMapping[dv.getUint16(offset + i*4, false)] = dv.getUint16(offset + i*4 + 2, false);
    }
    offset += iconMappingCount * 4;
    var fileRefMapping = {};
    var fileRefMappingCount = dv.getUint16(offset, false);
    offset += 2;
    for (var i = 0; i < fileRefMappingCount; i++) {
      fileRefMapping[dv.getUint16(offset + i*4, false)] = dv.getUint16(offset + i*4 + 2, false);
    }
    resource.dataObject = {
      appSignature: appSignature,
      signatureResourceID: signatureResourceID,
      iconMapping: iconMapping,
      fileRefMapping: fileRefMapping,
    };
  };

});
