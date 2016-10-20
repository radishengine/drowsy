define(['../chunk/midi'], function(chunks) {

  'use strict';
  
  function split(segment, entries) {
    var headerSegment = segment.getSegment('chunk/midi; which=header', 0, chunks.HeaderView.byteLength);
    return headerSegment.getStruct().then(function(header) {
      if (!header.hasValidSignature) return Promise.reject('not a valid MIDI header');
      if (!header.hasValidDataLength) return Promise.reject('MIDI header is unexpected length');
      entries.add(headerSegment);
      var pos = chunks.HeaderView.byteLength;
      function onTrack(rawHeader) {
        if (rawHeader.length === 0) return;
        if (String.fromCharCode(rawHeader[0], rawHeader[1], rawHeader[2], rawHeader[3]) !== 'MTrk') {
          return Promise.reject('not a valid MIDI track');
        }
        var trackLength = (rawHeader[4] << 24) | (rawHeader[5] << 16) | (rawHeader[6] << 8) | rawHeader[7];
        pos += 8;
        entries.add(segment.getSegment('chunk/midi; which=track', pos, trackLength));
        pos += trackLength;
        return segment.getBytes(pos, 0, 8).then(onTrack);
      }
      return segment.getBytes(pos, 0, 8).then(onTrack);
    });
  }
  
  return {
    bytePattern: /^MThd\x00\x00\x00\x06.{6}MTrk.{4}/,
    split: split,
  };

});
