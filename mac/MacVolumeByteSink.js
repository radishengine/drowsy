define(['mac/hfs/PartitionRecordView', 'mac/hfs/HFSByteSink'], function(PartitionRecordView, HFSByteSink) {

  'use strict';
  
  var BLOCK_BYTES = 512;
  
  function MacVolumeByteSink(byteSource) {
    this.byteSource = byteSource;
  }
  MacVolumeByteSink.prototype = {
    getRawBlock: function(number, knownLength) {
      var offset = number * BLOCK_BYTES;
      var length = knownLength || BLOCK_BYTES;
      return this.byteSource.slice(offset, offset+length).getBytes();
    },
    blockView: function(offset, length) {
      return this.byteSource.slice(offset * BLOCK_BYTES, (offset + length) * BLOCK_BYTES);
    },
    getFileSystem: function() {
      var blockNumber = 0;
      var self = this;
      function findFileSystemPartition(partitionBytes) {
        var partition = new PartitionRecordView(partitionBytes.buffer, partitionBytes.byteOffset);
        if (!partition.hasValidTag) {
          return Promise.reject('invalid partition header tag');
        }
        if (partition.type === 'Apple_HFS') {
          var dataArea = partition.dataArea;
          if (!dataArea) {
            return Promise.reject('partition record has no data area');
          }
          dataArea = self.blockView(dataArea.blockOffset, dataArea.blockCount);
          return dataArea.slice(BLOCK_BYTES*2, BLOCK_BYTES*2 + 2)
            .then(function(tag) {
              switch(tag = String.fromCharCode(tag[0], tag[1])) {
                case 'BD':
                  return new HFSByteSink(dataArea);
                case 'H+':
                  return Promise.reject('HFS+ not yet supported');
                default:
                  return Promise.reject('Apple_HFS volume tag not recognized: ' + tag);
              }
            });
        }
        if (++blockNumber > partition.totalPartitionCount) {
          return Promise.reject('no file system partition found');
        }
        return this.getRawBlock(blockNumber, PartitionRecordView.byteLength).then(findFileSystemPartition);
      }
      return this.getRawBlock(blockNumber, PartitionRecordView.byteLength)
        .then(findFileSystemPartition)
        .then(null, function() {
          var hfs = new HFSByteSink(self.byteSource);
          return hfs.getMasterDirectoryBlock()
            .then(function(mdb) {
              if (!mdb.hasValidTag) {
                return Promise.reject('not an HFS volume');
              }
              return hfs;
            });
        });
    },
  };
  
  return MacVolumeByteSink;

});
