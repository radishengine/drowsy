define(function() {

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
    HeaderView: HeaderView,
    getStructView: function(segment) {
      switch (segment.getTypeParameter('which')) {
        case 'header': return HeaderView;
        default: return null;
      }
    },
  };

});
