define(function() {

  'use strict';
  
  var NODE_BYTES = 512;

  function BTreeNodeView(buffer, byteOffset) {
    this.dataView = new DataView(buffer, byteOffset, NODE_BYTES);
    this.bytes = new Uint8Array(buffer, byteOffset, NODE_BYTES);
  }
  BTreeNodeView.prototype = {
    get nodeType() {
      switch(this.bytes[8]) {
        case 0: return 'index';
        case 1: return 'header';
        case 2: return 'map';
        case 0xff: return 'leaf';
        default: return 'unknown';
      }
    },
    get rawRecords() {
      var records = new Array(this.dataView.getUint16(10, false));
      for (var i = 0; i < records.length; i++) {
        records[i] = this.bytes.subarray(
          this.dataView.getUint16(NODE_BYTES - 2*(i+1), false),
          this.dataView.getUint16(NODE_BYTES - 2*(i+2), false));
      }
      Object.defineProperty(this, 'rawRecords', {value:records});
      return records;
    },
    get forwardLink() {
      return this.dataView.getInt32(0, false);
    },
    get backwardLink() {
      return this.dataView.getInt32(4, false);
    },
    get headerInfo() {
      if (this.nodeType !== 'header') return null;
      var headerInfo = new BTreeHeaderView(this.rawRecords[0].buffer, this.rawRecords[0].byteOffset);
      Object.defineProperty(this, 'headerInfo', {value:headerInfo});
      return headerInfo;
    },
  };
  
  function BTreeHeaderView(buffer, byteOffset) {
    this.dataView = new DataView(buffer, byteOffset, BTreeHeaderView.byteLength);
  }
  BTreeHeaderView.prototype = {
    get treeDepth() {
      return this.dataView.getUint16(0, false);
    },
    get rootNodeNumber() {
      return this.dataView.getUint32(2, false);
    },
    get leafRecordCount() {
      return this.dataView.getUint32(6, false);
    },
    get firstLeaf() {
      return this.dataView.getUint32(10, false);
    },
    get lastLeaf() {
      return this.dataView.getUint32(14, false);
    },
    get nodeByteLength() {
      return this.dataView.getUint16(18, false); // always 512?
    },
    get maxKeyByteLength() {
      return this.dataView.getUint16(20, false);
    },
    get nodeCount() {
      return this.dataView.getUint32(22, false);
    },
    get freeNodeCount() {
      return this.dataView.getUint32(26, false);
    },
  };
  BTreeHeaderView.byteLength = 30;
  
  return BTreeNodeView;

});
