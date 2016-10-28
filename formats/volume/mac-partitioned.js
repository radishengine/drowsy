define(['Format'], function(Format) {

  'use strict';
  
  const BLOCK_SIZE = 512;
  const PARTITIONS_FMT = Format('chunk/mac-partition-map');
  
  function split(segment, entries) {
    function doPartition(n) {
      var partitionMapSegment = segment.getSegment(PARTITIONS_FMT, BLOCK_SIZE * n, BLOCK_SIZE);
      var promises = [];
      return partitionMapSegment.getStruct().then(function(partitionInfo) {
        if (!partitionInfo.hasValidTag) {
          return Promise.reject('invalid partition map signature');
        }
        entries.add(partitionMapSegment);
        /*
        var partitionSegment = segment.getSegment(
          partitionInfo.partitionSegmentType,
          512 * partitionInfo.blockOffset,
          512 * partitionInfo.blockCount);
        if (partitionSegment.format.name === 'volume/ambiguous') {
          promises.push(partitionSegment.split(function(entry) {
            entries.add(entry);
          }));
        }
        else {
          entries.add(partitionSegment);
        }
        */
        if (n < partitionInfo.totalPartitionCount) {
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
