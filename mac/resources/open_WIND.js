define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function() {
    var dataDV = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    resource.dataObject = {
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
    resource.dataObject.title = macintoshRoman(resource.data, 19, resource.data[18]);
    var pos = 19 + resource.data[18];
    if (pos+2 <= resource.data.length) {
      resource.dataObject.positioning = dataDV.getInt16(pos);
    }
  };

});
