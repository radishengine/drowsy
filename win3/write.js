define(function() {

  'use strict';
  
  var PAGE_BYTES = 128;
  
  function WriteFileHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  WriteFileHeaderView.prototype = {
    get hasValidSignature() {
      return this.signature === 0xBE31 || this.signature === 0xBE32;
    },
    get isWordFile() {
      return this.pageCount === 0;
    },
    get containsOLE() {
      return this.signature === 0xBE32;
    },

    get signature() {
      return this.dv.getUint16(0, true);
    },
    // 0x02: must be 0x0000
    // 0x04: must be 0x00AB
    // reserved uint16 x4
    
    get textOffset() {
      return PAGE_BYTES;
    },
    get textLength() {
      return this.dv.getUint32(14, true);
    },
    get characterInfoOffset() {
      return this.textOffset + PAGE_BYTES * Math.ceil(this.textByteLength / PAGE_BYTES);
    },
    get characterInfoBlockLength() {
      return this.paragraphInfoOffset - this.characterInfoOffset;
    },
    get paragraphInfoOffset() {
      return PAGE_BYTES * this.dv.getUint16(18, true);
    },
    get paragraphInfoBlockLength() {
      return PAGE_BYTES * (this.dv.getUint16(20, true) - this.dv.getUint16(18, true));
    },
    get footnoteTableOffset() {
      return PAGE_BYTES * this.dv.getUint16(20, true);
    },
    get footnoteTableBlockLength() {
      return PAGE_BYTES * (this.dv.getUint16(22, true) - this.dv.getUint16(20, true));
    },
    get sectionPropertyOffset() {
      return PAGE_BYTES * this.dv.getUint16(22, true);
    },
    get sectionTableBlockLength() {
      return PAGE_BYTES * (this.dv.getUint16(24, true) - this.dv.getUint16(22, true));
    },
    get pageTableOffset() {
      return PAGE_BYTES * this.dv.getUint16(26, true);
    },
    get pageTableBlockLength() {
      return PAGE_BYTES * (this.dv.getUint16(28, true) - this.dv.getUint16(26, true));
    },
    get fontNameTableOffset() {
      return PAGE_BYTES * this.dv.getInt16(28, true);
    },
    get fontNameTableBlockLength() {
      return PAGE_BYTES * (this.dv.getInt16(96, true) - this.dv.getInt16(28, true));
    },
    // 66 bytes reserved (Word compatibility)
    get totalBlockLength() {
      return PAGE_BYTES * this.dv.getInt16(96, true);
    },
    // reserved uint16 x15
  };
  HeaderView.byteLength = PAGE_BYTES;
  
  return {
    FileHeaderView: WriteFileHeaderView,
  };

});
