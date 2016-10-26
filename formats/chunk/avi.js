define(function() {

  'use strict';
  
  function MainHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  MainHeaderView.prototype = {
    get microsecondsPerFrame() {
      return this.dv.getUint32(0, true);
    },
    get maxBytesPerSecond() {
      return this.dv.getUint32(4, true);
    },
    get paddingGranularity() {
      return this.dv.getUint32(8, true);
    },
    get flags() {
      return this.dv.getUint32(12, true);
    },
    get hasIndex() {
      return !!(this.flags & 0x10);
    },
    get mustUseIndex() {
      return !!(this.flags & 0x20);
    },
    get isInterleaved() {
      return !!(this.flags & 0x100);
    },
    get trustCKType() {
      return !!(this.flags & 0x800);
    },
    get wasCaptureFile() {
      return !!(this.flags & 0x10000);
    },
    get copyrighted() {
      return !!(this.flags & 0x20000);
    },
    get totalFrameCount() {
      return this.dv.getUint32(16, true);
    },
    get initialFrameCount() {
      return this.dv.getUint32(20, true);
    },
    get streamCount() {
      return this.dv.getUint32(24, true);
    },
    get suggestedBufferSize() {
      return this.dv.getUint32(28, true);
    },
    get width() {
      return this.dv.getUint32(32, true);
    },
    get height() {
      return this.dv.getUint32(36, true);
    },
    get scale() {
      return this.dv.getUint32(40, true);
    },
    get rate() {
      return this.dv.getUint32(44, true);
    },
    get start() {
      return this.dv.getUint32(48, true);
    },
    get length() {
      return this.dv.getUint32(52, true);
    },
  };
  MainHeaderView.signature = 'avih';
  MainHeaderView.byteLength = 56;
  
  function StreamHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  StreamHeaderView.prototype = {
    get type() {
      return String.fromCharCode(this.bytes.subarray(0, 4)); // vids, auds, mids (midi), txts (subtitle)
    },
    get codec() {
      return String.fromCharCode(this.bytes.subarray(4, 8));
    },
    get flags() {
      return this.dv.getUint32(8, true);
    },
    get isEnabled() {
      return !(this.flags & 1);
    },
    get isVideoWithPaletteChanges() {
      return !!(this.flags & 0x10000);
    },
    get priority() {
      return this.dv.getUint16(12, true);
    },
    get language() {
      return this.dv.getUint16(14, true);
    },
    get initialFrames() {
      return this.dv.getUint32(16, true);
    },
    get scale() {
      return this.dv.getUint32(20, true);
    },
    get rate() {
      return this.dv.getUint32(24, true);
    },
    get framesPerSecond() { return this.rate / this.scale },
    get samplesPerSecond() { return this.rate / this.scale },
    get start() {
      return this.dv.getUint32(28, true);
    },
    get length() {
      return this.dv.getUint32(32, true);
    },
    get suggestedBufferSize() {
      return this.dv.getUint32(36, true);
    },
    get quality() {
      return this.dv.getUint32(40, true);
    },
    get sampleSize() {
      return this.dv.getUint32(44, true);
    },
    get left() {
      return this.dv.getInt32(48, true);
    },
    get top() {
      return this.dv.getInt32(52, true);
    },
    get right() {
      return this.dv.getInt32(56, true);
    },
    get bottom() {
      return this.dv.getInt32(60, true);
    },
  };
  StreamHeaderView.signature = 'strh';
  StreamHeaderView.byteLength = 64;
  
  return {
  };

});
