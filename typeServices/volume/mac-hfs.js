define(['DataSegment'], function(DataSegment) {
  
  'use strict';
  
  function getSegmentFromExtents(allocationSegment, chunkSize, type, byteLength, extents) {
    if (byteLength === 0) return new DataSegment.Empty(type);
    if (byteLength <= chunkSize * extents[0].length) {
      return allocationSegment.getSegment(type, chunkSize * extents[0].offset, chunkSize * extents[0].length);
    }
    var list = [], i = 0;
    do {
      if (i > extents.length) throw new Error('insufficient space in extents');
      var offset = chunkSize * extents[i].offset, len = Math.min(byteLength, chunkSize * extents[i].length);
      list.push(allocationSegment.getSegment(allocationSegment.type, offset, len));
      byteLength -= len;
      i++;
    } while (byteLength > 0);
    return DataSegment.from(list, type);
  }
  
  function split(segment, entries) {
    var mdbSegment = segment.getSegment('chunk/mac-hfs; which=master-directory-block', 512 * 2, 512);
    return mdbSegment.getStruct()
    .then(function(masterDirectoryBlock) {
      if (!masterDirectoryBlock.hasValidSignature) {
        return Promise.reject('not an HFS volume');
      }
      entries.add(mdbSegment);
      var allocationType = 'chunk/mac-hfs; which=allocation';
      var allocChunkSize = masterDirectoryBlock.allocationChunkByteLength;
      allocationType += '; chunk=' + allocChunkSize;
      var allocSegment = segment.getSegment(allocationType,
        masterDirectoryBlock.firstAllocationBlock,
        masterDirectoryBlock.allocationChunkCount * masterDirectoryBlock.allocationChunkByteLength);
      entries.add(getSegmentFromExtents(
        allocSegment,
        allocChunkSize,
        'volume/mac-hfs; part=catalog',
        masterDirectoryBlock.catalogFileByteLength,
        masterDirectoryBlock.catalogFileExtentRecord));
      entries.add(getSegmentFromExtents(
        allocSegment,
        allocChunkSize,
        'volume/mac-hfs; part=overflow',
        masterDirectoryBlock.extentsOverflowFileByteLength,
        masterDirectoryBlock.extentsOverflowFileExtentRecord));
    });
  }
  
  function mount(segment, volume) {
    return segment.split().then(function(parts) {
      console.log(parts);
    });
  }
  
  return {
    split: split,
    mount: mount,
  };
  
});
