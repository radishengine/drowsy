define(['mac/date', 'mac/roman'], function(macDate, macRoman) {

  'use strict';
  
  var BLOCK_BYTES = 512;
  
  function nullTerminate(str) {
    return str.replace(/\0.*/, '');
  }
  
  function extentDataRecord(dv, offset) {
    var record = [];
    for (var i = 0; i < 3; i++) {
      record.push({
        offset: dv.getUint16(offset + i*4, false),
        length: dv.getUint16(offset + i*4 + 2, false),
      });
    }
    return record;
  }  
  
  function MasterDirectoryBlockView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  MasterDirectoryBlockView.prototype = {
    get signature() {
      return String.fromCharCode(this.bytes[0], this.bytes[1]);
    },
    get hasValidSignature() {
      return this.signature === 'BD';
    },
    get createdAt() {
      return macDate(this.dv, 2);
    },
    get lastModifiedAt() {
      return macDate(this.dv, 6);
    },
    get flags() {
      return this.dv.getUint16(10, false);
    },
    get isLockedByHardware() {
      return !!( this.flags & (1 << 7) );
    },
    get wasUnmountedSuccessfully() {
      return !!( this.flags & (1 << 8) );
    },
    get hasHadBadBlocksSpared() {
      return !!( this.flags & (1 << 9) );
    },
    get isLockedBySoftware() {
      return !!( this.flags & (1 << 15) );
    },
    get rootFileCount() {
      return this.dv.getUint16(12, false);
    },
    get bitmapBlockOffset() {
      return this.dv.getUint16(14, false); // always 3?
    },
    get nextAllocationSearch() {
      return this.dv.getUint16(16, false); // used internally
    },
    get allocationChunkCount() {
      return this.dv.getUint16(18, false);
    },
    get allocationChunkByteLength() {
      return this.dv.getUint32(20, false); // always multiple of BLOCK_BYTES
    },
    get allocationChunkBlockLength() {
      return this.allocationBlockByteLength / BLOCK_BYTES;
    },
    get defaultClumpSize() {
      return this.dv.getInt32(24, false);
    },
    get firstAllocationBlock() {
      return this.dv.getUint16(28, false);
    },
    get nextUnusedCatalogNodeId() {
      return this.dv.getInt32(30, false); // catalog node: file or folder
    },
    get unusedAllocationBlockCount() {
      return this.dv.getUint16(34, false);
    },
    get name() {
      return nullTerminate(macRoman(this.bytes, 36 + 1, this.bytes[36]));
    },
    get lastBackupAt() {
      return macDate(this.dv, 64);
    },
    get backupSequenceNumber() {
      return this.dv.getUint16(68, false); // used internally
    },
    get writeCount() {
      return this.dv.getInt32(70, false);
    },
    get extentsOverflowFileClumpSize() {
      return this.dv.getInt32(74, false);
    },
    get catalogFileClumpSize() {
      return this.dv.getInt32(78, false);
    },
    get rootFolderCount() {
      return this.dv.getUint16(82, false);
    },
    get fileCount() {
      return this.dv.getInt32(84, false);
    },
    get folderCount() {
      return this.dv.getInt32(88, false);
    },
    get finderInfo() {
      return new Int32Array(this.dv.buffer, this.dv.byteOffset + 92, 8);
    },
    get cacheBlockCount() {
      return this.dv.getUint16(124, false); // used internally
    },
    get bitmapCacheBlockCount() {
      return this.dv.getUint16(126, false); // used internally
    },
    get commonCacheBlockCount() {
      return this.dv.getUint16(128, false); // used internally
    },
    get extentsOverflowFileByteLength() {
      return this.dv.getInt32(130, false);
    },
    get extentsOverflowFileExtentRecord() {
      return extentDataRecord(this.dv, 134);
    },
    get catalogFileByteLength() {
      return this.dv.getInt32(146, false);
    },
    get catalogFileExtentRecord() {
      return extentDataRecord(this.dv, 150);
    },
  };
  MasterDirectoryBlockView.byteLength = 162;

  return {
    getStructView: function(segment) {
      switch (segment.format.parameters['which']) {
        case 'master-directory-block': return MasterDirectoryBlockView;
        default: return null;
      }
    },
    MasterDirectoryBlockView: MasterDirectoryBlockView,
  };

});
