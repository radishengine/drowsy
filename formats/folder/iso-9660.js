define(['../chunk/iso-9660'], function(chunkTypes) {

  'use strict';

  function split(segment, entries) {
    var offset = +segment.format.parameters['offset'];
    var length = +segment.format.parameters['length'];
    var blockSize = +(segment.format.parameters['block-size'] || 2048);
    var rootFolderSegment = segment.getSegment('chunk/iso-9660; which=folder', offset, length);
    entries.add(folderSegment);
    return rootFolderSegment.getStruct().then(function(folder) {
      var folderBlock = folder.dataBlockAddress;
      return segment.getBytes(blockSize * folderBlock, folder.dataByteLength)
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
          if (!record.isDirectory) {
            entries.add(segment.getSegment(
              'chunk/iso-9660; which=file',
              blockSize * folderBlock + pos,
              record.byteLength));
          }
          else if (record.dataBlockAddress !== parentBlock && record.dataBlockAddress !== folderBlock) {
            entries.add(segment.getSegment(
              'chunk/iso-9660; which=folder',
              blockSize * folderBlock + pos,
              record.byteLength));
          }
          pos += record.byteLength;
        }
        if (promises) return Promise.all(promises);
      });
    });
  }

  return {
    split: split,
  };

});
