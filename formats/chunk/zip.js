define(['../../msdos/util.js'], function(dosUtil) {

  'use strict';
  
  function TrailerView(buffer, byteSource, byteLength) {
    this.dv = new DataView(buffer, byteSource, byteLength);
    this.bytes = new Uint8Array(buffer, byteSource, byteLength);
  }
  TrailerView.prototype = {
    get hasValidSignature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === TrailerView.signature;
    },
    get partNumber() {
      return this.dv.getUint16(4, true);
    },
    get centralDirFirstPart() {
      return this.dv.getUint16(6, true);
    },
    get partEntryCount() {
      return this.dv.getUint16(8, true);
    },
    get totalEntryCount() {
      return this.dv.getUint16(10, true);
    },
    get centralDirByteLength() {
      return this.dv.getUint32(12, true);
    },
    get centralDirFirstOffset() {
      return this.dv.getUint32(16, true);
    },
    get commentByteLength() {
      return this.dv.getUint16(20, true);
    },
  };
  TrailerView.signature = 'PK\x05\x06';
  TrailerView.byteLength = 22;
  TrailerView.minLength = 22;
  TrailerView.maxLength = 22 + 0xffff;
  
  function CentralRecordView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  CentralRecordView.prototype = {
    get hasValidSignature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === CentralRecordView.signature;
    },
    get creationSystem() {
      var systemCode = this.dv.getUint8(5);
      switch(systemCode) {
        case 0: return 'fat'; // FAT / VFAT / FAT32: MS-DOS and OS/2
        case 1: return 'amiga';
        case 2: return 'openVMS';
        case 3: return 'unix';
        case 4: return 'vm/cms';
        case 5: return 'atariST';
        case 6: return 'hpfs'; // OS/2
        case 7: return 'mac';
        case 8: return 'z';
        case 9: return 'cp/m';
        case 10: return 'ntfs';
        case 11: return 'mvs';
        case 12: return 'vse';
        case 13: return 'acorn';
        case 14: return 'vfat';
        case 15: return 'mvsAlternate';
        case 16: return 'beOS';
        case 17: return 'tandem';
        case 18: return 'os/400';
        case 19: return 'osx'; // darwin
        default: return systemCode;
      }
    },
    get zipSpecificationVersion() {
      return this.dv.getUint8(4);
    },
    get requiredPKZipVersion() {
      return this.dv.getUint16(6, true) / 10;
    },
    get flags() {
      return this.dv.getUint16(8, true);
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
    get hasUTF8Encoding() {
      return !!(this.flags & (1 << 11));
    },
    get hasMaskHeaderValues() {
      return !!(this.flags & (1 << 13));
    },
    get compressionMethod() {
      var methodCode = this.dv.getUint16(10, true);
      switch(methodCode) {
        case 0: return 'none';
        case 1: return 'shrunk';
        case 2: return 'factor1';
        case 3: return 'factor2';
        case 4: return 'factor3';
        case 5: return 'factor4';
        case 6: return 'imploded';
        case 8: return 'deflated';
        case 9: return 'enhancedDeflated';
        case 10: return 'dclImploded';
        case 12: return 'bzip2';
        case 14: return 'lzma';
        case 18: return 'terse';
        case 19: return 'lz77';
        case 98: return 'ppmd';
        default: return methodCode;
      }
    },
    get modifiedAt() {
      return dosUtil.getTimeAndDate(this.dv, 12);
    },
    get crc32() {
      return ('0000000' + this.dv.getUint32(16, true).toString(16).toUpperCase()).slice(-8);
    },
    get compressedByteLength32() {
      return this.dv.getUint32(20, true);
    },
    get uncompressedByteLength32() {
      return this.dv.getUint32(24, true);
    },
    get isZip64() {
      return this.compressedByteLength32 === 0xffffffff && this.uncompressedByteLength32 === 0xffffffff;
    },
    get pathByteLength() {
      return this.dv.getUint16(28, true);
    },
    get extraByteLength() {
      return this.dv.getUint16(30, true);
    },
    get commentByteLength() {
      return this.dv.getUint16(32, true);
    },
    get firstDiskNumber() {
      return this.dv.getUint16(34, true);
    },
    get internalAttributes() {
      return this.dv.getUint16(36, true);
    },
    get isApparentlyTextFile() {
      return !!(this.internalAttributes && (1 << 0));
    },
    get hasControlFieldRecordsBeforeLogicalRecords() {
      return !!(this.internalAttributes && (1 << 2));
    },
    get externalAttributes() {
      return this.dv.getUint32(38, true);
    },
    get localRecordOffset() {
      return this.dv.getUint32(42, true);
    },
    get pathPos() {
      return CentralRecordView.fixedByteLength;
    },
    get decode() {
      return this.hasUTF8Encoding ? utf_8.decode : dosUtil.decodeLatinUS;
    },
    get path() {
      return this.decode(this.bytes, this.pathPos, this.pathByteLength);
    },
    get extraPos() {
      return this.pathPos + this.pathByteLength;
    },
    get commentPos() {
      return this.extraPos + this.extraByteLength;
    },
    get comment() {
      return this.decode(this.bytes, this.commentPos, this.commentByteLength);
    },
    get byteLength() {
      return this.pathPos + this.pathByteLength + this.extraByteLength + this.commentByteLength;
    },
  };
  CentralRecordView.signature = 'PK\x01\x02';
  CentralRecordView.fixedByteLength = 46;
  CentralRecordView.minLength = 46;
  CentralRecordView.maxLength = 46 + 0xffff + 0xffff + 0xffff;
  
  function LocalRecordView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  LocalRecordView.prototype = {
    get hasValidSignature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === LocalRecordView.signature;
    },
    get version() {
      return this.dv.getUint16(4, true) / 10;
    },
    get flags() {
      return this.dv.getUint16(6, true) / 10;
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
    get hasUTF8Encoding() {
      return !!(this.flags & (1 << 11));
    },
    get hasMaskHeaderValues() {
      return !!(this.flags & (1 << 13));
    },
    get compressionMethod() {
      var methodCode = this.dv.getUint16(8, true);
      switch(methodCode) {
        case 0: return 'none';
        case 1: return 'shrunk';
        case 2: return 'factor1';
        case 3: return 'factor2';
        case 4: return 'factor3';
        case 5: return 'factor4';
        case 6: return 'imploded';
        case 8: return 'deflated';
        case 9: return 'enhancedDeflated';
        case 10: return 'dclImploded';
        case 12: return 'bzip2';
        case 14: return 'lzma';
        case 18: return 'terse';
        case 19: return 'lz77';
        case 98: return 'ppmd';
        default: return methodCode;
      }
    },
    get modifiedAt() {
      return dosUtil.getTimeAndDate(this.dv, 0xA);
    },
    get crc32() {
      return ('0000000' + this.dv.getUint32(0xE, true).toString(16).toUpperCase()).slice(-8);
    },
    get compressedByteLength32() {
      return this.dv.getUint32(0x12, true);
    },
    get uncompressedByteLength32() {
      return this.dv.getUint32(0x16, true);
    },
    get isZip64() {
      return this.compressedByteLength32 === 0xffffffff && this.uncompressedByteLength32 === 0xffffffff;
    },
    get pathPos() {
      return LocalRecordView.fixedByteLength;
    },
    get decode() {
      return this.hasUTF8Encoding ? utf_8.decode : dosUtil.decodeLatinUS;
    },
    get path() {
      return this.decode(this.bytes, this.pathPos, this.pathByteLength);
    },
    get pathByteLength() {
      return this.dv.getInt16(0x1a, true);
    },
    get extraByteLength() {
      return this.dv.getInt16(0x1c, true);
    },
    get byteLength() {
      return LocalRecordView.fixedByteLength + this.pathByteLength + this.extraByteLength + this.compressedByteLength32;
    },
  };
  LocalRecordView.fixedByteLength = 0x1e;
  LocalRecordView.signature = 'PK\x03\x04';
  LocalRecordView.minLength = 0x1e;
  LocalRecordView.maxLength = Infinity; // effectively, with zip64
  
  return {
    getStructView: function(segment) {
      switch (segment.getTypeParameter('type')) {
        case 'trailer': return TrailerView;
        case 'central': return CentralRecordView;
        case 'local': return LocalRecordView;
        default: return null;
      }
    },
  };

});
