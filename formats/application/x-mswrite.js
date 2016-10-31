define(['DataSegment', 'Format'], function(DataSegment, Format) {

  'use strict';
  
  var PAGE_BYTES = 128;
  
  function split(context, entries) {
    return context.getBytes(0, FileHeaderView.byteLength).then(function(rawHeader) {
      var header = new FileHeaderView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
      if (!header.hasValidSignature) return Promise.reject('not a valid Write file');
      if (header.isWordFile) return Promise.reject('Word documents not yet supported'); // TODO
      var promises = [];
      if (entries.accepted('chunk/mswrite') && header.textLength > 0) {
        /* windows-1252 text with binary/OLE stuff mixed in */
        entries.add(context.getSegment('application/x-mswrite-text', header.textOffset, header.textLength));
      }
      var pos, end;
      if (entries.accepted('chunk/mswrite; which=chars')) {
        for (pos = header.characterInfoOffset, end = header.paragraphInfoOffset; pos < end; pos += PAGE_BYTES) {
          entries.add(context.getSegment('application/x-mswrite-page; type=charinfo', pos, PAGE_BYTES));
        }
      }
      if (entries.accepted('chunk/mswrite; which=paragraphs')) {
        for (pos = header.paragraphInfoOffset, end = header.footnoteTableOffset; pos < end; pos += PAGE_BYTES) {
          entries.add(context.getSegment('application/x-mswrite-page; type=paragraphs', pos, PAGE_BYTES));
        }
      }
      if (entries.accepted('chunk/mswrite; which=footnotes')) {
        for (pos = header.footnoteTableOffset, end = header.sectionTableOffset; pos < end; pos += PAGE_BYTES) {
          entries.add(context.getSegment('application/x-mswrite-page; type=footnotes', pos, PAGE_BYTES));
        }
      }
      if (entries.accepted('chunk/mswrite; which=sections')) {
        for (pos = header.sectionTableOffset, end = header.pageTableOffset; pos < end; pos += PAGE_BYTES) {
          entries.add(context.getSegment('application/x-mswrite-page; type=sections', pos, PAGE_BYTES));
        }
      }
      if (entries.accepted('chunk/mswrite; which=sections')) {
        for (pos = header.sectionTableOffset, end = header.pageTableOffset; pos < end; pos += PAGE_BYTES) {
          entries.add(context.getSegment('application/x-mswrite-page; type=sections', pos, PAGE_BYTES));
        }
      }
      if (entries.accepted('chunk/mswrite; which=pages')) {
        for (pos = header.pageTableOffset, end = header.fontNameTableOffset; pos < end; pos += PAGE_BYTES) {
          entries.add(context.getSegment('application/x-mswrite-page; type=pages', pos, PAGE_BYTES));
        }
      }
      if (entries.accepted('chunk/mswrite; which=fonts')) {
        for (pos = header.fontNameTableOffset, end = header.totalLength; pos < end; pos += PAGE_BYTES) {
          entries.add(context.getSegment('application/x-mswrite-page; type=fonts', pos, PAGE_BYTES));
        }
      }
      if (entries.accepted('text/html')) {
        var htmlbuf = [];
        htmlbuf.push('<h1>Hello</h1>');
        htmlbuf = htmlbuf.join('');
        var enc = new TextEncoder('utf-8');
        var data = enc.encode(htmlbuf);
        entries.add(DataSegment.from(data, Format('text/html', {charset:'utf-8'})));
      }
    });
  }
  
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
    // bytePattern: /^[\x31\x32]\xBE.{94}(?!\x00\x00\x00\x00).{32}.{128}*$/,
  };

});
