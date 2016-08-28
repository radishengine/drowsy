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
      type: dv.getUint16(8, false),
      visible: !!resource.data[10],
      closeBox: !!resource.data[12],
      referenceConstant: dv.getInt32(14, false),
      itemListResourceID: dv.getInt16(18, false),
    };
    switch(resource.dataObject.type) {
      case 0: resource.dataObject.type = 'modal'; break;
      case 4: resource.dataObject.type = 'modeless'; break;
      case 5: resource.dataObject.type = 'movableModal'; break;
    }
    resource.dataObject.text = macintoshRoman(resource.data, 21, resource.data[20]);
    var pos = 20 + 1 + resource.dataObject.text.length + (1 + resource.dataObject.text.length) % 2;
    resource.dataObject.positionCode = dv.getUint16(pos, false);
  };

});
