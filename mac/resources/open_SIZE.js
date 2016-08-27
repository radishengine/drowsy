define(function() {

  'use strict';
  
  return function(resource) {
    if (resource.data.length !== 10) {
      console.error('SIZE: expected length 10, got ' + resource.data.length);
      return;
    }
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    resource.dataObject = {
      flags: dv.getUint16(0, false),
      preferredMemorySize: dv.getUint32(2, false),
      minimumMemorySize: dv.getUint32(6, false),
    };
  }

});
