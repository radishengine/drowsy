define(['itemObjectModel', 'mac/roman'], function(itemOM, macRoman) {

  'use strict';
  
  function open(item) {
    function onAtom(item, byteSource) {
      return byteSource.slice(0, 8).getBytes().then(function(headerBytes) {
        var length = new DataView(headerBytes.buffer, headerBytes.byteOffset, 4).getUint32(0, false);
        var name = macRoman(headerBytes, 4, 4);
        var atomItem = itemOM.createItem(name);
        if (length > 8) {
          atomItem.byteSource = byteSource.slice(8, length);
        }
        item.addItem(atomItem);
        if (byteSource.length > (length + 8)) {
          return onAtom(atomItem, byteSource.slice(length));
        }
      });
    }
    return onAtom(item, item.byteSource);
  }
  
  return open;

});
