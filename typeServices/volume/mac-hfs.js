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
      entries.add(allocSegment);
      entries.add(getSegmentFromExtents(
        allocSegment,
        allocChunkSize,
        'chunk/mac-hfs-btree; tree=catalog',
        masterDirectoryBlock.catalogFileByteLength,
        masterDirectoryBlock.catalogFileExtentRecord));
      entries.add(getSegmentFromExtents(
        allocSegment,
        allocChunkSize,
        'chunk/mac-hfs-btree; tree=overflow',
        masterDirectoryBlock.extentsOverflowFileByteLength,
        masterDirectoryBlock.extentsOverflowFileExtentRecord));
    });
  }
  
  function mount(segment, volume) {
    return segment.split().then(function(parts) {
      var allocation, catalog, overflow, chunkSize;
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].typeName === 'chunk/mac-hfs' && parts[i].getTypeParameter('which') === 'allocation') {
          allocation = parts[i];
          chunkSize = +allocation.getTypeParameter('chunk');
          if (isNaN(chunkSize)) return Promise.reject('chunk parameter must be set on allocation table');
        }
        else if (parts[i].typeName === 'chunk/mac-hfs-btree') {
          switch(parts[i].getTypeParameter('tree')) {
            case 'catalog': catalog = parts[i]; break;
            case 'overflow': overflow = parts[i]; break;
          }
        }
      }
      if (!(allocation && catalog && overflow)) {
        return Promise.reject('HFS split did not yield allocation, catalog and overflow');
      }
      console.log(allocation, catalog, overflow, chunkSize);
    });
  }
  
  return {
    split: split,
    mount: mount,
  };
  
});
