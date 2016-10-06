define(function() {
  
  'use strict';
  
  function split(segment, entries) {
    var mdbSegment = segment.getSegment('chunk/mac-hfs; which=master-directory-block', 512 * 2, 512);
    return mdbSegment.getStruct()
    .then(function(masterDirectoryBlock) {
      if (!masterDirectoryBlock.hasValidSignature) {
        return Promise.reject('not an HFS volume');
      }
      entries.add(mdbSegment);
      var allocationType = 'chunk/mac-hfs; part=allocation';
      var allocChunkSize = masterDirectoryBlock.allocationChunkByteLength;
      allocationType += '; chunk=' + allocChunkSize;
      function extentString(byteLength, extents) {
        var list = [];
        while (byteLength > 0) {
          var extent = extents.shift();
          if (!extent) {
            throw new Error('insufficient space given by extents');
          }
          var length = Math.min(byteLength, extent.length * allocChunkSize);
          list.push('(' + (extent.offset * allocChunkSize) + ',' + length + ')');
          byteLength -= length;
        }
        return list.join('');
      }
      if (masterDirectoryBlock.catalogFileByteLength > 0) {
        allocationType += '; catalog=' + extentString(
          masterDirectoryBlock.catalogFileByteLength,
          masterDirectoryBlock.catalogFileExtentRecord);
      }
      if (masterDirectoryBlock.extentsOverflowFileByteLength > 0) {
        allocationType += '; overflow=' + extentString(
          masterDirectoryBlock.extentsOverflowFileByteLength,
          masterDirectoryBlock.extentsOverflowFileExtentRecord);
      }
      var allocationSegment = segment.getSegment(allocationType,
        masterDirectoryBlock.firstAllocationBlock,
        masterDirectoryBlock.allocationChunkCount * masterDirectoryBlock.allocationChunkByteLength);
      entries.add(allocationSegment);
    });
  }
  
  function mount(segment, volume) {
    return segment.split(function(entry) {
      if (entry.typeName === 'volume/hfs' && entry.getTypeParameter('part') === 'allocation') {
        console.log(entry.type);
      }
    });
  }
  
  return {
    split: split,
    mount: mount,
  };
  
});
