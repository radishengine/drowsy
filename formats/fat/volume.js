define(function() {

  'use strict';
  
  return {
    split: function split(segment, entries) {
      return segment.getSegment('fat/chunk; which=boot-sector', 0, 40)
      .getStruct().then(function(bootSector) {
        switch (bootSector.fatType) {
          case 'fat12':
            entries.add(segment.getSegment('fat/chunk; mode=fat12; which=boot-sector', 0, 62));
            break;
          case 'fat16':
            entries.add(segment.getSegment('fat/chunk; mode=fat16; which=boot-sector', 0, 62));
            break;
          case 'fat32':
            entries.add(segment.getSegment('fat/chunk; mode=fat32; which=boot-sector', 0, 90));
            break;
          default:
            return Promise.reject('unknown type: ' + bootSector.fatType);
        }
      });
    },
  };

});
