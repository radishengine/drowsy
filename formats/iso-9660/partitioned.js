define(['Format'], function(Format) {

  'use strict';
  
  const BLOCK_SIZE = 2048;
  const RECORD_FMT = Format('iso-9660/chunk', {which:'volume-descriptor'});
  
  return {
    split: function(segment, entries) {
      function processRecord(blockAddress) {
        return segment
        .getSegment(RECORD_FMT, blockAddress * BLOCK_SIZE, BLOCK_SIZE)
        .getStruct()
        .then(function(record) {
          switch (record.descriptorType) {
            case 'volume':
              var format = Format('iso-9660/volume', {
                'root-segment': (blockAddress * BLOCK_SIZE) + ',' + BLOCK_SIZE,
              });
              entries.add(segment.getSegment(format));
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
