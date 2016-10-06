define(function() {

  'use strict';
  
  function split(segment, entries) {
    function doPartition(n) {
      var partitionRecord = segment.getSegment('chunk/mac-partition-map', 512 * n, 512);
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
  
  function mount(segment, volume) {
    return segment.split().then(function(partitions) {
      return Promise.all(partitions.map(function(partition) {
        return partition.getCapabilities()
        .then(function(capabilities) {
          return (capabilities.mount) ? partition : null;
        });
      }));
    })
    .then(function(mountables) {
      mountables = mountables.filter(function(v){ return v !== null; });
      if (mountables.length === 0) {
        return Promise.reject('no mountable partition found');
      }
      if (mountables.length > 1) {
        console.log('multiple mountable partitions found:', mountables);
        console.log('(using the first one)');
      }
      return mountables[0].mount(volume);
    });
  }
  
  return {
    split: split,
    mount: mount,
  };

});
