define(function() {

  'use strict';
  
  function split(entries) {
    var rootSegment = this;
    var pos = 0;
    function onPage(rawHeader) {
      var header = new OggPageHeaderView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
      return rootSegment.getBytes(pos, header.segmentCount)
      .then(function(segmentLengths) {
        var totalLength = OffPageHeaderView.byteLength + segmentLengths.length;
        for (var i = 0; i < segmentLengths.length; i++) {
          totalLength += segmentLengths[i];
        }
        if (entries.accepted('application/x-ogg-page')) {
          entries.add(new Segment('application/x-ogg-page', pos, totalLength));
        }
        pos += totalLength;
        return rootSegment.getBytes(pos, OggPageHeaderView.byteLength).then(onPage);
      });
    }
    return rootSegment.getBytes(pos, OggPageHeaderView.byteLength).then(onPage);
  }
  
  function OggPageHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  OggPageHeaderView.prototype = {
    get signature() {
      return String.fromCharCode.apply(this.bytes.subarray(0, 4));
    },
    get hasValidSignature() {
      return this.signature === 'OggS';
    },
    get versionNumber() {
      return this.bytes[4];
    },
    get flags() {
      return this.bytes[5];
    },
    get isContinuation() {
      return !!(this.flags & 1);
    },
    get isFirst() {
      return !!(this.flags & 2);
    },
    get isLast() {
      return !!(this.flags & 4);
    },
    // 8 bytes for granule position
    get bitstreamSerialNumber() {
      return this.dv.getInt32(14, true);
    },
    get sequenceNumber() {
      return this.dv.getInt32(18, true);
    },
    get checksum() {
      return this.dv.getInt32(22, true);
    },
    get segmentCount() {
      return this.bytes[26];
    },
  };
  OggPageView.byteLength = 27;
  
  return {
    split: split,
    bytePattern: /^OggS/,
  };

});
