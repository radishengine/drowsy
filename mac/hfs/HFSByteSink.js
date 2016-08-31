define(['mac/hfs/MasterDirectoryBlockView'], function(MasterDirectoryBlockView) {

  'use strict';
  
  var BLOCK_BYTES = 512;
  var _MDB = Symbol('MDB');
  var _ALLOC = Symbol('ALLOC');
  var _CATALOG = Symbol('CATALOG');
  
  function HFSByteSink(byteSource) {
    this.byteSource = byteSource;
  }
  HFSByteSink.prototype = {
    getRawBlock: function(number, knownLength) {
      var offset = number * BLOCK_BYTES;
      var length = knownLength || BLOCK_BYTES;
      return this.byteSource.slice(offset, offset+length).getBytes();
    },
    blockView: function(offset, length) {
      return this.byteSource.slice(offset * BLOCK_BYTES, (offset + length) * BLOCK_BYTES);
    },
    getMasterDirectoryBlock: function() {
      return (_MDB in this) ? this[_MDB]
      : this[_MDB] = this.getRawBlock(2, MasterDirectoryBlockView.byteLength)
        .then(function(bytes) {
          var mdb = new MasterDirectoryBlockView(bytes.buffer, bytes.byteOffset);
          if (!mdb.hasValidTag) {
            return Promise.reject('not a valid HFS volume');
          }
          return mdb;
        });
    },
    getAllocationChunks: function() {
      var self = this;
      return (_ALLOC in this) ? this._ALLOC : this._ALLOC = this.getMasterDirectoryBlock()
      .then(function(mdb) {
        return new AllocationByteSink(
          self.byteSource,
          mdb.firstAllocationBlock,
          mdb.allocationChunkSize,
          mdb.allocationChunkCount);
      });
    },
    getCatalogTree: function() {
      return (_CATALOG in this) ? this[_CATALOG]
      : this[_CATALOG] = Promise.all([ this.getMasterDirectoryBlock(), this.getAllocationChunks() ])
        .then(function(values) {
          var mdb = values[0], allocChunks = values[1];
          return new BTreeByteSink(allocChunks.allocationView(
            mdb.catalogFileExtentRecord[0].offset,
            mdb.catalogFileByteLength));
        });
    },
  };
  
  return HFSByteSink;

});
