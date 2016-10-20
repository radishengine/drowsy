define(function() {

  'use strict';
  
  function split(entries) {
    var rootSegment = this;
    var headerSegment = rootSegment.getSegment('audio/x-midi-header', 0, HeaderView.byteLength);
    return headerSegment.getBytes().then(function(rawHeader) {
      var header = new HeaderView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
      if (!header.hasValidSignature) return Promise.reject('not a valid MIDI header');
      if (!header.hasValidDataLength) return Promise.reject('MIDI header is unexpected length');
      if (entries.accepted('audio/x-midi-header')) {
        entries.add(headerSegment);
      }
      var pos = HeaderView.byteLength;
      function onTrack(rawHeader) {
        if (rawHeader.length === 0) {
          return;
        }
        if (String.fromCharCode(rawHeader[0], rawHeader[1], rawHeader[2], rawHeader[3]) !== 'MTrk') {
          return Promise.reject('not a valid MIDI track');
        }
        var trackLength = (rawHeader[4] << 24) | (rawHeader[5] << 16) | (rawHeader[6] << 8) | rawHeader[7];
        pos += 8;
        entries.add(rootSegment.getSegment('chunk/midi; which=track', pos, trackLength));
        pos += trackLength;
        return rootSegment.getBytes(pos, 0, 8).then(onTrack);
      }
      return rootSegment.getBytes(pos, 0, 8).then(onTrack);
    });
  }
  
  return {
    bytePattern: /^MThd\x00\x00\x00\x06.{6}MTrk.{4}/,
    split: split,
  };

});
