define(function() {

  'use strict';
  
  var BLOCK_SIZE = 512;
  
  function AllocationByteSink(byteSource, firstBlock, chunkSize, chunkCount) {
    this.chunkSize = chunkSize;
    var byteOffset = BLOCK_SIZE * firstBlock;
    var byteLength = BLOCK_SIZE * chunkSize * chunkCount;
    this.byteSource = byteSource.slice(byteOffset, byteOffset + byteLength);
  }
  AllocationByteSink.prototype = {
    allocationView: function(firstChunk, byteLength) {
      var offset = this.chunkSize * firstChunk;
      return this.byteSource.slice(offset, offset + byteLength);
    },
  };
  
  return AllocationByteSink;

});
