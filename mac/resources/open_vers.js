define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(resource) {
    resource.dataObject = {
      major: resource.data[0],
      minor: resource.data[1],
      developmentStage: (function(v) {
        switch(v) {
          case 0x20: return 'development';
          case 0x40: return 'alpha';
          case 0x60: return 'beta';
          case 0x80: return 'release';
          default: return v;
        }
      })(resource.data[2]),
      prereleaseRevisionLevel: resource.data[3],
      regionCode: (resource.data[4] << 8) | resource.data[5],
    };
    resource.dataObject.versionNumber = macintoshRoman(resource.data, 7, resource.data[6]);
    var pos = 7 + resource.data[6];
    resource.dataObject.versionMessage = macintoshRoman(resource.data, pos + 1, resource.data[pos]);
  };

});
