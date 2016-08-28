define(function() {

  'use strict';
  
  return function(resource) {
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    var count = dv.getInt16(0, false);
    if (count < 0) {
      console.error('MBAR: invalid number of menus');
      return;
    }
    resource.dataObject = new Array(count);
    for (var i = 0; i < count; i++) {
      resource.dataObject[i] = dv.getInt16(2 + 2*i);
    }
  };

});
