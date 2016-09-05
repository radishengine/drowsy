define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var dataObject = {
        rectangle: {
          top: dv.getInt16(0, false),
          left: dv.getInt16(2, false),
          bottom: dv.getInt16(4, false),
          right: dv.getInt16(6, false),
        },
        type: dv.getUint16(8, false),
        visible: !!bytes[10],
        closeBox: !!bytes[12],
        referenceConstant: dv.getInt32(14, false),
        itemListResourceID: dv.getInt16(18, false),
      };
      switch(dataObject.type) {
        case 0: dataObject.type = 'modal'; break;
        case 4: dataObject.type = 'modeless'; break;
        case 5: dataObject.type = 'movableModal'; break;
      }
      dataObject.text = macintoshRoman(bytes, 21, bytes[20]);
      var pos = 20 + 1 + dataObject.text.length + (1 + dataObject.text.length) % 2;
      if (pos + 2 <= bytes.length) {
        dataObject.positionCode = dv.getUint16(pos, false);
      }
      item.setDataObject(dataObject);
    });
  };

});
