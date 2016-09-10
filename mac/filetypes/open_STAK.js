define(['itemObjectModel', 'mac/roman'], function(itemOM, macRoman) {

  'use strict';
  
  function open(item) {
    function onBlock(item, byteSource) {
      return byteSource.slice(0, 8).getBytes().then(function(headerBytes) {
        var length = new DataView(headerBytes.buffer, headerBytes.byteOffset, 4).getUint32(0, false);
        var name = macRoman(headerBytes, 4, 4);
        var blockItem = itemOM.createItem(name);
        item.addItem(blockItem);
        if (length > 8) {
          blockItem.byteSource = byteSource.slice(8, length);
        }
        if (byteSource.byteLength >= (length + 8)) {
          return onBlock(item, byteSource.slice(length));
        }
      });
    }
    return onBlock(item, item.byteSource);
  }
  
  return open;

});
