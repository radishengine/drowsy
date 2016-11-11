define(['DataSegment'], function(DataSegment) {

  'use strict';
  
  return {
    split: function(segment, entries) {
      var fullLength = segment.format.parameters.full;
      if (isNaN(fullLength)) {
        return Promise.reject('full length must be specified');
      }
      var whichTrack = segment.format.parameters.which;
      if (isNaN(whichTrack)) {
        return Promise.reject('track number must be specified');
      }
      var uncompressedBytes = new Uint8Array(fullLength);
      var trackSegment = DataSegment.from(uncompressedBytes, ['magic-shadow-archiver/track', {which:whichTrack}]);
      return segment.getBytes().then(function(bytes) {
        var j = 0;
        for (var i = 0; i < bytes.length; i++) {
          if (bytes[i] === 0xE5) {
            var repByte = bytes[i + 1];
            var runEnd = j + (bytes[i + 2] << 8) + bytes[i + 3];
            i += 4;
            while (j < runEnd) {
              uncompressedBytes[j++] = repByte;
            }
          }
          else {
            uncompressedBytes[j++] = bytes[i++];
          }
        }
        entries.add(trackSegment);
      });
    },
  };

});
