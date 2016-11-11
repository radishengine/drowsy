define(['Format'], function(Format) {

  'use strict';
  
  const SECTOR_BYTES = 512;
  const HEADER_FORMAT = Format('magic-shadow-archiver/header');
  
  return {
    split: function(segment, entries) {
      return segment.getSegment(HEADER_FORMAT, 0, 10).getStruct()
      .then(function(header) {
        if (!header.hasValidSignature) {
          return Promise.reject('invalid MSA');
        }
        const TRACK_BYTES = SECTOR_BYTES * header.sectorsPerTrack;
        var offset = 10;
        function doTrack(n) {
          if (n > header.lastTrack) return;
          return segment.getUint16(offset, false)
          .then(function(trackLength) {
            var trackFormat;
            if (trackLength === TRACK_BYTES) {
              trackFormat = Format('magic-shadow-archiver/track', {which:n});
            }
            else {
              trackFormat = Format('magic-shadow-archiver/compressed-track', {which:n, full:TRACK_BYTES});
            }
            entries.add(segment.getSegment(trackFormat, offset + 2, trackLength));
            offset += 2 + trackLength;
            return doTrack(n + 1);
          });
        }
        return doTrack(header.firstTrack);
      });
    },
  };

});
