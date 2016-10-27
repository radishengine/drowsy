define(function() {
  
  function PrefixChunk(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  PrefixChunk.prototype = {
    get subchunkCount() {
      return this.dv.getUint16(0, true);
    },
    // reserved: 2 bytes
  };
  PrefixChunk.byteLength = 4;
  PrefixChunk.signature = 0xF100;
  
  function FrameTypeChunk(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  FrameTypeChunk.prototype = {
    get subchunkCount() {
      return this.dv.getUint16(0, true);
    },
    get duration() {
      var value = this.dv.getUint16(2, true);
      return value === 0 ? 'default' : value;
    },
    // reserved: 2 bytes
    
    // width & height overrides: EGI 4.0+ extension
    get width() {
      var value = this.dv.getUint16(6, true);
      return value === 0 ? 'default' : value;
    },
    get height() {
      var value = this.dv.getUint16(6, true);
      return value === 0 ? 'default' : value;
    },
  };
  
  function SegmentTableChunk(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  SegmentTableChunk.prototype = {
    get subchunkCount() {
      return this.dv.getUint16(0, true);
    },
  };
  SegmentTableChunk.byteLength = 2;
  
  return {
    getStructView: function(segment) {
      switch (segment.format.parameters['type']) {
        case 'prefix': return PrefixChunk;
        case 'frame-type': return FrameTypeChunk;
        case 'segment-table': return SegmentTableChunk;
        default: return null;
      }
    },
  }l
  
});
