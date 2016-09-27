define(function() {

  'use strict';
  
  function split(entries) {
    var rootSegment = this;
    return rootSegment.getBytes(0, 9)
    .then(function(rawPartialHeader) {
      var headerSize = 8 + Math.min(1, Math.ceil((rawPartialHeader[8] >>> 3) / 2)) + 4;
      if (entries.accepts('application/x-swf-header')) {
        entries.add(rootSegment.getSegment('application/x-swf-header', 0, headerSize));
      }
      return rootSegment.getBytes(0, headerSize);
    })
    .then(function(rawHeader) {
      var header = new SWFHeaderView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
    });
  }
  
  function SWFHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  SWFHeaderView.prototype = {
    get signature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 3));
    },
    get hasValidSignature() {
      return /^[FCZ]WS$/.test(this.signature);
    },
    get compression() {
      switch (this.signature) {
        case 'FWS': return false;
        case 'CWS': return 'zlib';
        case 'ZWS': return 'lzma';
      }
    },
    get version() {
      return this.bytes[3];
    },
    get fileLength() {
      return this.dv.getUint32(4, true);
    },
    get offsetof_frameRect() {
      return 8;
    },
    // note: x & y of frameRect are always zero, so it is really just width and height
    get sizeof_frameRect() {
      return Math.min(1, Math.ceil((this.bytes[8] >>> 3) / 2));
    },
    get framesPerSecond() {
      return this.dv.getUint16(this.offsetof_frameRect + this.sizeof_frameRect, true);
    },
    get frameCount() {
      return this.dv.getUint16(this.offsetof_frameRect + this.sizeof_frameRect + 2, true);
    },
  };
  
  return {
    split: split,
  };

});
