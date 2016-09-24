define(function() {

  'use strict';
  
  function split() {
    var context = this;
    return context.getBytes(0, FileHeaderView.byteLength).then(function(rawHeader) {
      var header = new FileHeaderView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
      if (!header.hasValidSignature) return Promise.reject('not a valid Write file');
      if (header.isWordFile) return Promise.reject('Word documents not yet supported'); // TODO
      var promises = [];
      if (header.textLength > 0) {
        /* windows-1252 text with binary/OLE stuff mixed in */
        context.addEntry(context.getSegment(header.textOffset, header.textLength), {
          type: 'application/x-mswrite-text-data',
        });
      }
      if (header.characterInfoLength > 0) {
        context.addEntry(context.getSegment(header.characterInfoOffset, header.characterInfoLength), {
          type: 'application/x-mswrite-character-info',
        });
      }
      if (header.paragraphInfoLength > 0) {
        context.addEntry(context.getSegment(header.paragraphInfoOffset, header.paragraphInfoLength), {
          type: 'application/x-mswrite-paragraph-info',
        });
      }
      if (header.footnoteTableLength > 0) {
        context.addEntry(context.getSegment(header.footnoteTableOffset, header.footnoteTableLength), {
          type: 'application/x-mswrite-footnote-table',
        });
      }
      if (header.sectionTableLength > 0) {
        context.addEntry(context.getSegment(header.sectionTableOffset, header.sectionTableLength), {
          type: 'application/x-mswrite-section-table',
        });
      }
      if (header.pageTableLength > 0) {
        context.addEntry(context.getSegment(header.pageTableOffset, header.pageTableLength), {
          type: 'application/x-mswrite-page-table',
        });
      }
      if (header.fontNameTableLength > 0) {
        context.addEntry(context.getSegment(header.fontNameTableOffset, header.fontNameTableLength), {
          type: 'application/x-mswrite-font-name-table',
        });
      }
    });
  }
  
  var PAGE_BYTES = 128;
  
  function FileHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  FileHeaderView.prototype = {
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
    get characterInfoLength() {
      return this.paragraphInfoOffset - this.characterInfoOffset;
    },
    get paragraphInfoOffset() {
      return PAGE_BYTES * this.dv.getUint16(18, true);
    },
    get paragraphInfoLength() {
      return PAGE_BYTES * (this.dv.getUint16(20, true) - this.dv.getUint16(18, true));
    },
    get footnoteTableOffset() {
      return PAGE_BYTES * this.dv.getUint16(20, true);
    },
    get footnoteTableLength() {
      return PAGE_BYTES * (this.dv.getUint16(22, true) - this.dv.getUint16(20, true));
    },
    get sectionTableOffset() {
      return PAGE_BYTES * this.dv.getUint16(22, true);
    },
    get sectionTableLength() {
      return PAGE_BYTES * (this.dv.getUint16(24, true) - this.dv.getUint16(22, true));
    },
    get pageTableOffset() {
      return PAGE_BYTES * this.dv.getUint16(26, true);
    },
    get pageTableLength() {
      return PAGE_BYTES * (this.dv.getUint16(28, true) - this.dv.getUint16(26, true));
    },
    get fontNameTableOffset() {
      return PAGE_BYTES * this.dv.getInt16(28, true);
    },
    get fontNameTableLength() {
      return PAGE_BYTES * (this.dv.getInt16(96, true) - this.dv.getInt16(28, true));
    },
    // 66 bytes reserved (Word compatibility)
    get totalLength() {
      return PAGE_BYTES * this.dv.getInt16(96, true);
    },
    // reserved uint16 x15
  };
  FileHeaderView.byteLength = PAGE_BYTES;
  
  return {
    split: split,
  };

});
