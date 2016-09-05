define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      item.setDataObject({
        rectangle: {
          top: dv.getInt16(0, false),
          left: dv.getInt16(2, false),
          bottom: dv.getInt16(4, false),
          right: dv.getInt16(6, false),
        },
        initialSetting: dv.getUint16(8, false),
        visible: !!bytes[10],
        fill: !!bytes[11],
        maximumSetting: dv.getInt16(12, false),
        minimumSetting: dv.getInt16(14, false),
        cdefID: dv.getInt16(16, false),
        referenceConstant: dv.getInt32(18, false),
        text: macintoshRoman(bytes, 23, bytes[22]),
      });
    });
  };

});
