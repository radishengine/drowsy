define(['mac/date', 'mac/roman'], function(macintoshDate, macintoshRoman) {

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
  
  function MasterDirectoryBlockView(buffer, byteOffset) {
    this.dataView = new DataView(buffer, byteOffset || 0, BLOCK_BYTES);
    this.bytes = new Uint8Array(buffer, byteOffset || 0, BLOCK_BYTES);
  }
  MasterDirectoryBlockView.prototype = {
    get hasValidTag() {
      return String.fromCharCode(this.bytes[0], this.bytes[1]) === 'BD';
    },
    get createdAt() {
      return macintoshDate(this.dataView, 2);
    },
    get lastModifiedAt() {
      return macintoshDate(this.dataView, 6);
    },
    get isLockedByHardware() {
      return !!( this.dataView.getUint16(10, false) & (1 << 7) );
    },
    get wasUnmountedSuccessfully() {
      return !!( this.dataView.getUint16(10, false) & (1 << 8) );
    },
    get hasHadBadBlocksSpared() {
      return !!( this.dataView.getUint16(10, false) & (1 << 9) );
    },
    get isLockedBySoftware() {
      return !!( this.dataView.getUint16(10, false) & (1 << 15) );
    },
    get rootFileCount() {
      return this.dataView.getUint16(12, false);
    },
    get bitmapBlockOffset() {
      return this.dataView.getUint16(14, false); // always 3?
    },
    get nextAllocationSearch() {
      return this.dataView.getUint16(16, false); // used internally
    },
    get allocationChunkCount() {
      return this.dataView.getUint16(18, false);
    },
    get allocationChunkByteLength() {
      return this.dataView.getUint32(20, false); // always multiple of BLOCK_BYTES
    },
    get allocationChunkBlockLength() {
      return this.allocationBlockByteLength / BLOCK_BYTES;
    },
    get defaultClumpSize() {
      return this.dataView.getInt32(24, false);
    },
    get firstAllocationBlock() {
      return this.dataView.getUint16(28, false);
    },
    get nextUnusedCatalogNodeId() {
      return this.dataView.getInt32(30, false); // catalog node: file or folder
    },
    get unusedAllocationBlockCount() {
      return this.dataView.getUint16(34, false);
    },
    get name() {
      return nullTerminate(macintoshRoman(bytes, 36 + 1, bytes[36]));
    },
    get lastBackupAt() {
      return macintoshDate(this.dataView, 64);
    },
    get backupSequenceNumber() {
      return this.dataView.getUint16(68, false); // used internally
    },
    get writeCount() {
      return this.dataView.getInt32(70, false);
    },
    get extentsOverflowFileClumpSize() {
      return this.dataView.getInt32(74, false);
    },
    get catalogFileClumpSize() {
      return this.dataView.getInt32(78, false);
    },
    get rootFolderCount() {
      return this.dataView.getUint16(82, false);
    },
    get fileCount() {
      return this.dataView.getInt32(84, false);
    },
    get folderCount() {
      return this.dataView.getInt32(88, false);
    },
    get finderInfo() {
      return new Int32Array(this.dataView.buffer, this.dataView.byteOffset + 92, 8);
    },
    get cacheBlockCount() {
      return this.dataView.getUint16(124, false); // used internally
    },
    get bitmapCacheBlockCount() {
      return this.dataView.getUint16(126, false); // used internally
    },
    get commonCacheBlockCount() {
      return this.dataView.getUint16(128, false); // used internally
    },
    get extentsOverflowFileByteLength() {
      return this.dataView.getInt32(130, false);
    },
    get extentsOverflowFileExtentRecord() {
      return extentDataRecord(this.dataView, 134);
    },
    get catalogFileByteLength() {
      return this.dataView.getInt32(146, false);
    },
    get catalogFileExtentRecord() {
      return extentDataRecord(this.dataView, 150);
    },
  };
  MasterDirectoryBlockView.byteLength = 162;

  return MasterDirectoryBlockView;  

});
