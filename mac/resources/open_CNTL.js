define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(resource) {
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    resource.dataObject = {
      rectangle: {
        top: dv.getInt16(0, false),
        left: dv.getInt16(2, false),
        bottom: dv.getInt16(4, false),
        right: dv.getInt16(6, false),
      },
      initialSetting: dv.getUint16(8, false),
      visible: !!resource.data[10],
      fill: !!resource.data[11],
      maximumSetting: dv.getInt16(12, false),
      minimumSetting: dv.getInt16(14, false),
      cdefID: dv.getInt16(16, false),
      referenceConstant: dv.getInt32(18, false),
      text: macintoshRoman(resource.data, 23, resource.data[22]),
    };
  };

});
