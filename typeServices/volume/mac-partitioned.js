define(function() {

  'use strict';
  
  function split(segment, entries) {
    function doPartition(n) {
      var partitionRecord = byteSource.getSegment('chunk/mac-partition-map', 512 * n, 512);
      return partitionRecord.getStruct().then(function(partition) {
        if (!partition.hasValidTag) {
          return Promise.reject('invalid partition map signature');
        }
        entries.add(partitionRecord);
        entries.add(segment.getSegment(
          partitionRecord.partitionSegmentType,
          512 * partitionRecord.blockOffset,
          512 * partitionRecord.blockCount));
        if (n < partition.totalPartitionCount) {
          return doPartition(n + 1);
        }
      });
    }
    return doPartition(1);
  }
  
  return {
    split: split,
  };

});
