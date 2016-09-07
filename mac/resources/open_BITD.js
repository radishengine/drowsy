define(['ByteSource', 'itemObjectModel', 'mac/bitpacking'], function(ByteSource, itemObjectModel, bitpacking) {

  'use strict';
  
  function open(item) {
    var unpackedItem = itemObjectModel.createItem('unpacked');
    function onPopulateUnpacked() {
      unpackedItem.removeEventListener(itemObjectModel.EVT_POPULATE, onPopulateUnpacked);
      unpackedItem.notifyPopulating(item.getBytes().then(function(bytes) {
        unpackedItem.byteSource = ByteSource.from(bitpacking.unpackBits(bytes.buffer, bytes.byteOffset, bytes.byteLength));
      }));
    }
    unpackedItem.addEventListener(itemObjectModel.EVT_POPULATE, onPopulateUnpacked);
    item.addItem(unpackedItem);
    return Promise.resolve(item);
  }
  
  return open;

});
