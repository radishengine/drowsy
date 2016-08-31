define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  function nullTerminate(str) {
    return str.replace(/\0.*/, '');
  }
  
  function PartitionRecordView(buffer, byteOffset) {
    this.dataView = new DataView(buffer, byteOffset || 0, PartitionRecordView.byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset || 0, PartitionRecordView.byteLength);
  }
  PartitionRecordView.prototype = {
    get hasValidTag() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === 'PM\0\0';
    },
    get totalPartitionCount() {
      return this.dataView.getInt32(4, false),
    },
    get blockOffset() {
      return this.dataView.getInt32(8, false);
    },
    get blockCount() {
      return this.dataView.getInt32(12, false);
    },
    get name() {
      return nullTerminate(macintoshRoman(this.bytes, 16, 32));
    },
    get type() {
      return nullTerminate(macintoshRoman(this.bytes, 48, 32));
    },
    get status() {
      return this.dataView.getInt32(88, false);
    },
    get dataArea() {
      var blockCount = this.dataView.getInt32(84, false);
      if (!blockCount) return null;
      return {
        blockCount: blockCount,
        blockOffset: this.dataView.getInt32(80, false),
      };
    },
    get bootCode() {
      var byteLength = this.dataView.getInt32(96, false);
      if (!byteLength) return null;
      return {
        byteLength: byteLength,
        blockOffset: this.dataView.getInt32(92, false),
        loadAddress: this.dataView.getInt32(100, false),
        entryPoint: this.dataView.getInt32(108, false),
        checksum: this.dataView.getInt32(116, false),
      };
    },
    get processorType() {
      return nullTerminate(macintoshRoman(this.bytes, 124, 16));
    },
  };
  PartitionRecordView.byteLength = 140;
  
  return PartitionRecordView;

});
