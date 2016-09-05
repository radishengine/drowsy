define(function() {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var count = dv.getInt16(0, false);
      if (count < 0) {
        return Promise.reject('MBAR: invalid number of menus');
      }
      var dataObject = new Array(count);
      for (var i = 0; i < count; i++) {
        dataObject[i] = dv.getInt16(2 + 2*i);
      }
      item.setDataObject(dataObject);
    });
  };

});
