define(['Format', './chunk'], function(Format, chunkTypes) {

  'use strict';
  
  const RECORD_FMT = Format('iso-9660/chunk', {which:'folder', 'is-root':'true'});

  function split(segment, entries) {
    var root = (segment.format.parameters['root-segment'] || '').match(/^\s*(\d+)\s*,(\d+)\s*$/);
    if (!root) {
      return Promise.reject('root-segment parameter must be specified as a pair of decimal numbers');
    }
    var rootOffset = +root[1], rootLength = +root[2];
    var parentBlockAddress = +(segment.format.parameters['parent'] || -1);
    var blockSize = +(segment.format.parameters['block-size'] || 2048);
    var rootSegment = segment.getSegment(
      RECORD_FMT,
      rootOffset, rootLength);
    entries.add(rootSegment);
    return rootSegment.getStruct().then(function(folder) {
      var folderBlockAddress = folder.dataBlockAddress;
      return segment.getBytes(blockSize * folderBlockAddress, folder.dataByteLength)
      .then(function(raw) {
        for (var pos = 0; pos < raw.length; ) {
          if (raw[pos] === 0) {
            pos += blockSize - (pos % blockSize);
            if (pos >= raw.length) break;
          }
          var record = new chunkTypes.DirectoryRecordView(
            raw.buffer,
            raw.byteOffset + pos,
            raw.byteLength - pos);
          if (record.isDirectory) {
            if (record.dataBlockAddress !== parentBlockAddress && record.dataBlockAddress !== folderBlockAddress) {
              var format = Format('iso-9660/folder', {
                'root-segment': (folderBlockAddress * blockSize + pos) + ',' + record.length,
                'block-size': blockSize,
                'parent': folderBlockAddress,
              });
              entries.add(segment.getSegment(format));
            }
          }
          else {
            if (record.isAssociatedFile) {
              // TODO: handle associated files
            }
            else {
              var format = Format('iso-9660/file', {
                'record-segment': (folderBlockAddress * blockSize + pos) + ',' + record.length,
                'data-segment': (blockSize * record.dataBlockAddress) + ',' + record.dataByteLength,
              });
              entries.add(segment.getSegment(format));
            }
          }
          pos += record.length;
        }
      });
    });
  }

  return {
    split: split,
    getDisplayName: function(segment) {
      return segment.split(RECORD_FMT)
      .then(function(records) {
        if (records.length === 0) {
          return Promise.reject('record not found');
        }
        return records[0].getStruct();
      })
      .then(function(record) {
        return record.name;
      });
    },
  };

});
