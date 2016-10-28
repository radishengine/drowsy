define(['Format', '../chunk/iso-9660'], function(Format, chunkTypes) {

  'use strict';
  
  function split(segment, entries) {
    function doVolumeDescriptor(n) {
      var descriptorOffset = 2048 * (0x10 + n);
      var descriptorSegment = segment.getSegment('chunk/iso-9660; which=volume-descriptor', descriptorOffset, 2048);
      return descriptorSegment.getStruct().then(function(descriptor) {
        if (!descriptor.hasValidSignature) {
          return Promise.reject('ISO 9660 volume descriptor signature not found');
        }
        entries.add(descriptorSegment);
        switch (descriptor.descriptorType) {
          case 'terminator':
            // i.e. don't call doVolumeDescriptor for the next n
            return;
          case 'volume':
            var formatName = 'recursive/iso-9660';
            var formatParameters = {
              volume: descriptor.isPrimaryVolume ? 'primary' : 'supplementary',
              offset: descriptorOffset + descriptor.body.offsetof_rootDirectory,
              length: descriptor.body.sizeof_rootDirectory,
            };
            if (descriptor.body.blockByteLength !== 2048) {
              formatParameters['block-size'] = descriptor.body.blockByteLength;
            }
            var volumeSegment = segment.getSegment(
              Format(formatName, formatParameters),
              0,
              descriptor.body.blockByteLength * descriptor.body.blockCount);
            entries.add(volumeSegment);
            return doVolumeDescriptor(n + 1);
          default:
            return doVolumeDescriptor(n + 1);
        }
      });
    }
    return doVolumeDescriptor(0);
  }
  
  return {
    split: split,
  };

});
