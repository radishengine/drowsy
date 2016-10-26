define(function() {

  'use strict';
  
  function FileHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  FileHeaderFile.prototype = {
    get signature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 2));
    },
    get hasValidSignature() {
      return /^(B[MA]|PT|C[IP]|IC)$/.test(this.signature);
    },
    get fileByteLength() {
      return this.dv.getUint32(2, true);
    },
    // 4 reserved bytes
    get imageDataOffset() {
      return this.dv.getUint32(10, true);
    },
  };
  FileHeaderFile.byteLength = 14;
  
  return {
    bytePattern: /^(B[MA]|PT|C[IP]|IC)/,
  };

});
