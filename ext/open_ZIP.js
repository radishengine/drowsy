define(['msdos/util'], function(dosUtil) {

  'use strict';
  
  function open() {
    this.addExplorer(function(expedition) {
      var pos = 0;
      function onLocalFileHeader(bytes) {
        var localFile = new LocalFileHeaderView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (!localFile.hasValidSignature) {
          return expedition.abandon('invalid Local File Header signature');
        }
        
      }
      this.byteSource.slice(pos, pos + 0x1d).then(onLocalFileHeader);
    });
  }
  
  function LocalFileHeaderView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  LocalFileHeaderView.prototype = {
    get hasValidSignature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === 'PK\3\4';
    },
    get version() {
      return this.getUint16(4, true) / 10;
    },
    get flags() {
      return this.getUint16(6, true) / 10;
    },
    get isEncrypted() {
      return !!(this.flags & (1 << 0));
    },
    get usesCompressionOption1() {
      return !!(this.flags & (1 << 1));
    },
    get usesCompressionOption2() {
      return !!(this.flags & (1 << 2));
    },
    get hasDataDescriptor() {
      return !!(this.flags & (1 << 3));
    },
    get hasEnhancedDeflation() {
      return !!(this.flags & (1 << 4));
    },
    get hasCompressedPatchedData() {
      return !!(this.flags & (1 << 5));
    },
    get hasStrongEncryption() {
      return !!(this.flags & (1 << 6));
    },
    get hasLanguageEncoding() {
      return !!(this.flags & (1 << 11));
    },
    get hasMaskHeaderValues() {
      return !!(this.flags & (1 << 13));
    },
  };
  
  return open;

});
