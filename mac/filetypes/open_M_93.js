define(['itemObjectModel'], function(itemObjectModel) {

  'use strict';

  function open(item) {
    return item.getBytes().then(function(bytes) {
      if (String.fromCharCode.apply(null, bytes.subarray(0, 4)) !== 'RIFX'
        || String.fromCharCode.apply(null, bytes.subarray(8, 12)) !== 'MV93') {
        return Promise.reject('not a MV93 RIFX file');
      }
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (bytes.length < dv.getUint32(4, false) + 8) {
        return Promise.reject('bad length');
      }
      item.notifyPopulating(new Promise(function(resolve, reject) {
        for (var pos = 12; pos < bytes.length; pos += 8 + dv.getUint32(pos + 4)) {
          var chunkItem = itemObjectModel.createItem(String.fromCharCode.apply(null, bytes.subarray(pos, pos+4)));
          var chunkLen = dv.getUint32(pos + 4);
          if (chunkLen !== 0) {
            chunkItem.byteSource = item.byteSource.slice(pos + 8, pos + 8 + dv.getUint32(pos + 4));
          }
          item.addItem(chunkItem);
        }
      }));

    });
  }
  
  return open;

});
