define(function() {

  'use strict';
  
  function CodeTableView(buffer, byteOffset, byteLength) {
    if (arguments.length === 1) {
      if (typeof arguments[0] === 'number') {
        this.bytes = new Uint8Array(arguments[0] * 4);
      }
      else if (ArrayBuffer.isView(arguments[0])) {
        this.bytes = new Uint8Array(arguments[0].buffer, arguments[0].byteOffset, arguments[0].byteLength);
      }
      buffer = this.bytes.buffer;
      byteOffset = this.bytes.byteOffset;
      byteLength = this.bytes.byteLength;
    }
    else {
      this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    }
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  CodeTableView.prototype = {
    get length() {
      return this.bytes.length / 4;
    },
    getEntries: function(n, count) {
      if (arguments.length === 0) return this.bytes;
      if (arguments.length === 1) return this.bytes.subarray(n * 4);
      return this.bytes.subarray(n * 4, (n + count) * 4);
    },
    setEntries: function(n, entries) {
      this.bytes.set(entries, n * 4);
    },
    getEntry: function(n) {
      return this.getEntries(1);
    },
    setEntry: function(n, entry) {
      this.setEntries(n, entry);
    },
    setOpBitsVal: function(n, op, bits, val) {
      this.bytes.set([op, bits, val & 0xff, (val >> 8) & 0xff], n * 4);
    },
    getOp: function(n) {
      return this.bytes[n * 4];
    },
    setOp: function(n, v) {
      this.bytes[n * 4] = v;
    },
    getBits: function(n) {
      return this.bytes[n*4 + 1];
    },
    setBits: function(n, v) {
      this.bytes[n*4 + 1] = v;
    },
    getVal: function(n) {
      return this.dataView.getUint16(n*4 + 2, true);
    },
    setVal: function(n, v) {
      this.dataView.setUint16(n*4 + 2, v);
    },
  };

  return CodeTableView;

});
