define(['ByteSource', 'itemObjectModel', 'mac/bitpacking'], function(ByteSource, itemObjectModel, bitpacking) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var unpackedItem = itemObjectModel.createItem('unpacked');
      unpackedItem.byteSource = ByteSource.from(bitpacking.unpackBits(bytes.buffer, bytes.byteOffset, bytes.byteLength));
      item.addItem(unpackedItem);
    });
  }
  
  return open;

});
