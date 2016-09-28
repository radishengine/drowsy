define(function() {

  'use strict';
  
  function split(entries) {
    var rootSegment = this;
    var headerSegment = rootSegment.getSegment('audio/x-midi-header', 0, HeaderView.byteLength);
    return headerSegment.getBytes().then(function(rawHeader) {
      var header = new HeaderView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
      if (!header.hasValidSignature) return Promise.reject('not a valid MIDI header');
      if (!header.hasValidDataLength) return Promise.reject('MIDI header is unexpected length');
      entries.add(headerSegment);
      var pos = HeaderView.byteLength;
      function onTrack(rawHeader) {
        if (String.fromCharCode(rawHeader[0], rawHeader[1], rawHeader[2], rawHeader[3]) !== 'MTrk') {
          return Promise.reject('not a valid MIDI track');
        }
        var trackLength = (rawHeader[4] << 24) | (rawHeader[5] << 16) | (rawHeader[6] << 8) | rawHeader[7];
        pos += 8;
        entries.add(rootSegment.getSegment(pos, trackLength));
        pos += trackLength;
        return rootSegment.getBytes(pos, 8).then(onTrack);
      }
      return rootSegment.getBytes(pos, 8).then(onTrack);
    });
  }
  
  function HeaderView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  HeaderView.prototype = {
    get signature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4));
    },
    get hasValidSignature() {
      return this.signature === 'MThd';
    },
    get dataLength() {
      return this.dv.getUint32(4, false);
    },
    get hasValidDataLength() {
      return this.dataLength === 6;
    },
    get format() {
      var value = this.dv.getUint16(8, false);
      switch (value) {
        case 0: return 'singleTrack';
        case 1: return 'multipleTrack';
        case 2: return 'multipleSong';
        default: return value;
      }
    },
    get trackCount() {
      return this.dv.getUint16(10, false);
    },
    get deltaTimeValue() {
      return Math.abs(this.getUint16(12, false));
    },
    get deltaTimeUnits() {
      return this.getUint16(12, false) >= 0 ? 'ticksPerBeat' : 'smpte';
    },
  };
  HeaderView.byteLength = 8 + 6;
  
  return {
    bytePattern: /^MThd\x00\x00\x00\x06.{6}MTrk.{4}/;
  };

});
