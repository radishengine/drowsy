define(function() {

  'use strict';
  
  function OffsetTableView(buffer, byteSource, byteLength) {
    this.bytes = new Uint8Array(buffer, byteSource, byteLength);
    this.dataView = new DataView(buffer, byteSource, byteLength);
  }
  OffsetTableView.prototype = {
    get version() {
      // TrueType outlines in OpenType font: '\x00\x01\x00\x00
      // CFF data (v1 or 2) in OpenType font: 'OTTO'
      // Apple TrueType: 'true', 'typ1'
      return String.fromCharCode.apply(this.bytes.subarray(0, 4));
    },
    get tableCount() {
      return this.dv.getUint16(4, false);
    },
    get searchRange() {
      return this.dv.getUint16(6, false); // (maximum power of 2 <= numTables) x 16
    },
    get entrySelector() {
      return this.dv.getUint16(8, false); // Log2(maximum power of 2 <= numTables)
    },
    get rangeShift() {
      return this.dv.getUint16(10, false); // NumTables x 16-searchRange
    },
  };
  OffsetTableView.byteLength = 12;
  
  function TableRecordEntry(buffer, byteSource, byteLength) {
    this.bytes = new Uint8Array(buffer, byteSource, byteLength);
    this.dataView = new DataView(buffer, byteSource, byteLength);
  }
  TableRecordEntry.prototype = {
    get tag() {
      return String.fromCharCode.apply(this.bytes.subarray(0, 4));
    },
    get checksum() {
      return this.dv.getInt32(4, false);
    },
    get byteOffset() {
      return this.dv.getUint32(6, false);
    },
    get byteLength() {
      return this.dv.getUint32(8, false);
    },
  };
  
  return {
    getStructView: function(segment) {
      if (segment.getTypeParameter('which') === 'offset-table') {
        return OffsetTableView;
      }
      return null;
    },
  };

});
