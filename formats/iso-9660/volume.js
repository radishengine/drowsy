define(['Format'], function(Format) {

  'use strict';
  
  const PARTITION_FMT = Format('iso-9660/chunk', {which:'volume-descriptor'});
  
  return {
    getDisplayName: function(segment) {
      return segment.split(PARTITION_FMT).then(function(partitions) {
        if (partitions.length === 0) {
          return Promise.reject('no partition record found');
        }
        return partitions[0].getStruct().then(function(partition) {
          return partition.body.identifier;
        });
      });
    },
    getTimestamp: function(segment) {
      return segment.split(PARTITION_FMT).then(function(partitions) {
        if (partitions.length === 0) {
          return Promise.reject('no partition record found');
        }
        return partitions[0].getStruct().then(function(partition) {
          return partition.body.modifiedAt;
        });
      });
    },
    split: function split(segment, entries) {
      var root = (segment.format.parameters['root-segment'] || '').match(/^\s*(\d+)\s*,\s*(\d+)\s*$/);
      if (!root) {
        return Promise.reject('root-segment parameter must be specified as a pair of decimal numbers');
      }
      var partitionOffset = +root[1], partitionLength = +root[2];
      var partitionSegment = segment.getSegment(PARTITION_FMT, partitionOffset, partitionLength);
      entries.add(partitionSegment);
      return partitionSegment.getStruct().then(function(partition) {
        var rootFolder = segment.getSegment(Format('iso-9660/folder', {
          'root-segment':
            (partitionOffset + partition.body.offsetof_rootDirectory)
            + ',' + partition.body.sizeof_rootDirectory,
        }));
        entries.add(rootFolder);
      });
    },
  };

});
