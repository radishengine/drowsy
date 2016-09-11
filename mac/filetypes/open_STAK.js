define(['itemObjectModel', 'mac/roman'], function(itemOM, macRoman) {

  'use strict';
  
  function open(item) {
    function onBlock(item, byteSource) {
      return byteSource.slice(0, 12).getBytes().then(function(headerBytes) {
        var dv = new DataView(headerBytes.buffer, headerBytes.byteOffset, 4);
        var length = dv.getUint32(0, false);
        var name = macRoman(headerBytes, 4, 4);
        var id = dv.getInt32(8, false);
        var blockItem = itemOM.createItem(name + " " + id);
        item.addItem(blockItem);
        if (length > 8) {
          blockItem.byteSource = byteSource.slice(12, length);
        }
        if (byteSource.byteLength >= (length + 12)) {
          return onBlock(item, byteSource.slice(length));
        }
      });
    }
    return onBlock(item, item.byteSource);
  }
  
  return open;

});
