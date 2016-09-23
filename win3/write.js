define(function() {

  'use strict';
  
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
    
    // bytes of actual text plus 128, the bytes in one sector
    get fcMac() {
      return this.dv.getUint32(14, true);
    },
    get characterInfoFirstPageNumber() {
      return (this.dv.getUint32(14, true) + 0x7f) >>> 7;
    },
    get paragraphInfoFirstPageNumber() {
      return this.dv.getUint16(18, true);
    },
    get paragraphInfoLastPageNumber() {
      return this.dv.getUint16(20, true) - 1;
    },
    get footnoteTablePageNumber() {
      var page = this.dv.getUint16(20, true);
      return (page === this.dv.getInt16(22, true)) ? -1 : page;
    },
    get sectionPropertyPageNumber() {
      var page = this.dv.getUint16(22, true);
      return (page === this.dv.getUint16(24, true)) ? -1 : page;
    },
    get sectionTablePageNumber() {
      var page = this.dv.getUint16(24, true);
      return (page === this.dv.getUint16(26, true)) ? -1 : page;
    },
    get pageTablePageNumber() {
      var page = this.dv.getUint16(26, true);
      return (page === this.dv.getUint16(28, true)) ? -1 : page;
    },
    get fontNameTablePageNumber() {
      var page = this.dv.getInt16(28, true);
      return (page === this.dv.getUint16(96, true)) ? -1 : page;
    },
    // 66 bytes reserved (Word compatibility)
    get pageCount() {
      return this.dv.getInt16(96, true);
    },
    // reserved uint16 x15
  };
  HeaderView.byteLength = 128;
  
  return {
    FileHeaderView: WriteFileHeaderView,
  };

});
