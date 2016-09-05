define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dataDV = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var dataObject = {
        initialRectangle: {
          top: dataDV.getInt16(0, false),
          left: dataDV.getInt16(2, false),
          bottom: dataDV.getInt16(4, false),
          right: dataDV.getInt16(6, false),
        },
        definitionID: dataDV.getInt16(8, false),
        visible: dataDV.getInt16(10, false),
        closeBox: dataDV.getInt16(12, false),
        referenceConstant: dataDV.getInt32(14, false),
      };
      dataObject.title = macintoshRoman(bytes, 19, bytes[18]);
      var pos = 19 + bytes[18];
      if (pos+2 <= bytes.length) {
        dataObject.positioning = dataDV.getInt16(pos);
      }
      item.setDataObject(dataObject);
    });
  };

});
