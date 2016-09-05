define(function() {
  
  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (dv.getUint32(0, false) !== bytes.length) {
        return Promise.reject('length does not match data');
      }
      var previousData = new Uint8Array(256 * 2);
      var dataObject = [];
      var pos = 4;
      while (pos < bytes.length) {
        var endPos = pos + dv.getUint16(pos);
        if (endPos === pos) break;
        pos += 2;
        while (pos < endPos) {
          var patchLength = bytes[pos] * 2, patchOffset = bytes[pos + 1] * 2;
          pos += 2;
          var patch = bytes.subarray(pos, pos + patchLength);
          pos += patchLength;
          dataObject.push({
            offset: patchOffset,
            patch: [].map.call(patch, function(v) {
              return ('0' + v.toString(16)).slice(-2);
            }).join(' '),
          });
        }
      }
      item.setDataObject(dataObject);
    });
  };
  
});
