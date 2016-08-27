define(function() {

  'use strict';
  
  return function(resource) {
    if (resource.data.length < 12) {
      console.error('ALRT resource: expected length 12, got ' + resource.data.length);
      return;
    }
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    resource.dataObject = {
      rectangle: {
        top: dv.getInt16(0, false),
        left: dv.getInt16(2, false),
        bottom: dv.getInt16(4, false),
        right: dv.getInt16(6, false),
      },
      itemListResourceID: dv.getUint16(8, false),
      response4_3: resource.data[10],
      response2_1: resource.data[11],
      position: resource.data.length < 14 ? 0 : dv.getUint16(12, false),
    };
  };

});
