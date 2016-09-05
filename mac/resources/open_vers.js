define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dataObject = {
        major: bytes[0],
        minor: bytes[1],
        developmentStage: (function(v) {
          switch(v) {
            case 0x20: return 'development';
            case 0x40: return 'alpha';
            case 0x60: return 'beta';
            case 0x80: return 'release';
            default: return v;
          }
        })(bytes[2]),
        prereleaseRevisionLevel: bytes[3],
        regionCode: (bytes[4] << 8) | bytes[5],
      };
      dataObject.versionNumber = macintoshRoman(bytes, 7, bytes[6]);
      var pos = 7 + bytes[6];
      dataObject.versionMessage = macintoshRoman(bytes, pos + 1, bytes[pos]);
      item.setDataObject(dataObject);
    });
  };

});
