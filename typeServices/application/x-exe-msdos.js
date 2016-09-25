define(function() {

  'use strict';
  
  var PARAGRAPH_BYTES = 16;
  
  function DOSHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  DOSHeaderView.prototype = {
    get hasValidSignature() {
      return this.dv.getUint16(0, true) === 0x5a4d; /* MZ */
    },
    get bytesInLastBlock() {
      return this.dv.getUint16(2, true);
    },
    get blockCount() {
      return this.dv.getUint16(4, true);
    },
    get relocationCount() {
      return this.dv.getUint16(6, true);
    },
    get headerSizeInParagraphs() {
      return this.dv.getUint16(8, true);
    },
    get headerByteLength() {
      return this.headerByteInParagraphs * PARAGRAPH_BYTES;
    },
    get minExtraParagraphs() {
      return this.dv.getUint16(10, true);
    },
    get maxExtraParagraphs() {
      return this.dv.getUint16(12, true);
    },
    get ss() {
      return this.dv.getUint16(14, true);
    },
    get sp() {
      return this.dv.getUint16(16, true);
    },
    get checksum() {
      return this.dv.getUint16(18, true);
    },
    get ip() {
      return this.dv.getUint16(20, true);
    },
    get initialRelativeCSValue() {
      return this.dv.getUint16(22, true);
    },
    get relocationTableOffset() {
      return this.dv.getUint16(24, true);
    },
    get overlayNumber() {
      return this.dv.getUint16(26, true);
    },
    // 4 reserved words
    get oemIdentifier() {
      return this.dv.getUint16(36, true);
    },
    get oemInfo() {
      return this.dv.getUint16(38, true);
    },
    // 10 reserved words
    get newHeaderAddress() {
      return this.dv.getUint32(60, true);
    },
  };
  DOSHeaderView.byteLength = 64;  
  
  return {
  };

});
