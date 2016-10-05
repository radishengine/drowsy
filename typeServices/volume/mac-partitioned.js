define(function() {

  'use strict';
  
  function split(segment, entries) {
    function doPartition(n) {
      var partitionRecord = byteSource.getSegment('chunk/mac-partition-map', 512 * n, 512);
      var promises = [];
      return partitionRecord.getStruct().then(function(partition) {
        if (!partition.hasValidTag) {
          return Promise.reject('invalid partition map signature');
        }
        entries.add(partitionRecord);
        var partitionSegment = segment.getSegment(
          partitionRecord.partitionSegmentType,
          512 * partitionRecord.blockOffset,
          512 * partitionRecord.blockCount);
        if (partitionSegment.typeName === 'volume/ambiguous') {
          promises.push(partitionSegment.split(function(entry) {
            entries.add(entry);
          }));
        }
        else {
          entries.add(partitionSegment);
        }
        if (n < partition.totalPartitionCount) {
          return doPartition(n + 1);
        }
      })
      .then(function() {
        return Promise.all(promises);
      });
    }
    return doPartition(1);
  }
  
  return {
    split: split,
  };

});
