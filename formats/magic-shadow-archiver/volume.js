define(['Format'], function(Format) {

  'use strict';
  
  const SECTOR_BYTES = 512;
  const HEADER_FORMAT = Format('magic-shadow-archiver/header');
  const TRACK_FORMAT = Format('magic-shadow-archiver/track');
  const COMPRESSED_TRACK_FORMAT = Format('magic-shadow-archiver/compressed-track');
  
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
            if (trackLength === TRACK_BYTES) {
              // uncompressed
              entries.add(segment.getSegment(TRACK_FORMAT, offset + 2, trackLength));
            }
            else {
              entries.add(segment.getSegment(COMPRESSED_TRACK_FORMAT, offset + 2, trackLength));
            }
            offset += 2 + trackLength;
            doTrack(n + 1);
          });
        }
        return doTrack(header.firstTrack);
      });
    },
  };

});
