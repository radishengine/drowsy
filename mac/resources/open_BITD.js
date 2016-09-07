define(['ByteSource', 'itemObjectModel', 'mac/bitpacking'], function(ByteSource, itemObjectModel, bitpacking) {

  'use strict';
  
  function open(item) {
    item.startAddingItems();
    item.addEventListener(itemObjectModel.EVT_POPULATE, onPopulateUnpacked);
    return Promise.resolve(item);
  }
  
  function onPopulateUnpacked() {
    this.removeEventListener(itemObjectModel.EVT_POPULATE, onPopulateUnpacked);
    this.notifyPopulating(this.getBytes().then(function(bytes) {
      var unpackedItem = itemObjectModel.createItem('unpacked');
      unpackedItem.byteSource = ByteSource.from(bitpacking.unpackBits(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    }));
  }
  
  return open;

});
