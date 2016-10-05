define(['mac/roman'], function(macRoman) {

  'use strict';
  
  function nullTerminate(str) {
    return str.replace(/\0.*/, '');
  }
  
  function PartitionRecordView(buffer, byteOffset) {
    this.dv = new DataView(buffer, byteOffset || 0, PartitionRecordView.byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset || 0, PartitionRecordView.byteLength);
  }
  PartitionRecordView.prototype = {
    get hasValidTag() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === 'PM\0\0';
    },
    get totalPartitionCount() {
      return this.dv.getInt32(4, false);
    },
    get blockOffset() {
      return this.dv.getInt32(8, false);
    },
    get blockCount() {
      return this.dv.getInt32(12, false);
    },
    get name() {
      return nullTerminate(macRoman(this.bytes, 16, 32));
    },
    get type() {
      return nullTerminate(macRoman(this.bytes, 48, 32));
    },
    get status() {
      return this.dv.getInt32(88, false);
    },
    get dataArea() {
      var blockCount = this.dv.getInt32(84, false);
      if (!blockCount) return null;
      return {
        blockCount: blockCount,
        blockOffset: this.dv.getInt32(80, false),
      };
    },
    get bootCode() {
      var byteLength = this.dv.getInt32(96, false);
      if (!byteLength) return null;
      return {
        byteLength: byteLength,
        blockOffset: this.dv.getInt32(92, false),
        loadAddress: this.dv.getInt32(100, false),
        entryPoint: this.dv.getInt32(108, false),
        checksum: this.dv.getInt32(116, false),
      };
    },
    get processorType() {
      return nullTerminate(macRoman(this.bytes, 124, 16));
    },
  };
  
  return {
    getStructView: function() {
      return PartitionRecordView;
    },
  };

});
