define(['Format'], function(Format) {

  'use strict';
  
  const BLOCK_SIZE = 2048;
  const RECORD_FMT = Format('chunk/iso-9660', {which:'volume-descriptor'});
  
  return {
    split: function(segment, entries) {
      function processRecord(blockAddress) {
        return segment.getSegment(RECORD_FMT, blockAddress * BLOCK_SIZE, BLOCK_SIZE)
        .getStruct().then(function(record) {
          switch (record.descriptorType) {
            case 'volume':
              entries.add(segment.getSegment(['volume/iso-9660', {
                'root-segment': (blockAddress * BLOCK_SIZE) + ',' + BLOCK_SIZE,
              }]));
              // continue iteration
              return processRecord(blockAddress + 1);
            case 'terminator':
              // prevent further iteration
              return;
            default:
              // continue iteration
              return processRecord(blockAddress + 1);
          }
        });
      }
      return processRecord(16);
    },
  };

});
