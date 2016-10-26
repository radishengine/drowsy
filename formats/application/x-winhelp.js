define(function() {

  'use strict';
  
  function split(entries) {
    var context = this;
    return context.getBytes(0, WinHelpHeaderView.byteLength)
    .then(function(rawHeader) {
      var header = new WinHelpHeaderView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
      if (!header.hasValidSignature) return Promise.reject('winhelp file signature not found');
    });
  }
  
  function WinHelpHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  WinHelpHeaderView.prototype = {
    get hasValidSignature() {
      return this.dv.getInt32(0, true) === 0x35F3F;
    },
    get internalDirectoryOffset() {
      return this.dv.getInt32(4, true);
    },
    get firstFreeBlockOffset() {
      return this.dv.getInt32(8, true); // -1 if none
    },
    get entireFileSize() {
      return this.dv.getInt32(12, true);
    },
  };
  WinHelpHeaderView.byteLength = 16;
  
  function WinHelpFileHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  WinHelpFileHeaderView.prototype = {
    get totalByteLength() {
      return this.dv.getInt32(0, true);
    },
    get usedByteLength() {
      return this.dv.getInt32(4, true);
    },
    get flags() {
      return this.dv.getUint8(8);
    },
  };
  WinHelpFileHeaderView.byteLength = 9;
  
  function BTreeHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  BTreeHeaderView.prototype = {
    get hasValidSignature() {
      return this.dv.getUint16(0, true) === 0x293B;
    },
    get flags() {
      return this.dv.getUint16(2, true);
    },
    get isDirectory() {
      return !!(this.flags & 0x0400);
    },
    get pageSize() {
      return this.dv.getUint16(4, true);
    },
    get dataFormat() {
      return String.fromCharCode.apply(null, this.bytes.subarray(6, 6 + 16)).replace(/\0.*$/, '');
    },
    // 22: unused two bytes (must be zero)
    get pageSplits() {
      return this.dv.getUint16(24, true);
    },
    get rootPageNumber() {
      return this.dv.getUint16(26, true);
    },
    // 28: always 0xFFFF
    get totalPageCount() {
      return this.dv.getUint16(30, true);
    },
    get treeLevelCount() {
      return this.dv.getUint16(32, true);
    },
    get treeEntryCount() {
      return this.dv.getUInt16(34, true);
    },
  };
  BTreeHeaderView.byteLength = 38;
  
  return {
    split: split,
  };

});
