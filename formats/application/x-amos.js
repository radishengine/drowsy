define(function() {

  'use strict';
  
  function split(segment, entries) {
    var headerSegment = segment.getSegment('application/x-amos; chunk=header', 0, AmosHeaderView.byteLength);
    return headerSegment.getStruct().then(function(header) {
      if (!header.hasValidSignature) return Promise.reject('AMOS file signature not found');
      if (entries.accepted(headerSegment.type)) entries.add(headerSegment);
      var tokenDataSegment = segment.getSegment(
        'application/x-amos; chunk=tokens',
        AmosHeaderView.byteLength,
        header.tokenDataLength);
      if (entries.accepted(tokenDataSegment.type)) entries.add(tokenDataSegment);
      return segment.getSegment('application/x-amos-bank', AmosHeaderView.byteLength + header.tokenDataLength).split();
    });
  }
  
  function AmosHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  AmosHeaderView.prototype = {
    get signature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 16));
    },
    get hasValidSignature() {
      return /^AMOS (Pro1[01]1[vV]\0\0\0\0|Basic [vV](134 |1\.3 |1\.23|1\.00))$/.test(this.signature);
    },
    get isTested() {
      return this.signature[10] === 'V';
    },
    get tokenDataLength() {
      return this.dv.getUint32(16, false);
    },
  };
  AmosHeaderView.byteLength = 20;
  
  return {
    split: split,
    getStructView: function(segment) {
      switch (segment.getTypeParameter('chunk')) {
        case 'header': return AmosHeaderView;
      }
    },
  };

});
