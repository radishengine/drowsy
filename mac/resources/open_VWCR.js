define(function() {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var chunks = [];
      var pos = 0;
      while (pos < bytes.length) {
        var chunkLength = bytes[pos++];
        chunks.push(new EntryView(bytes.buffer, bytes.byteOffset + pos, chunkLength));
        pos += chunkLength;
      }
      item.setItemObject(chunks);
    });
  }
  
  function EntryView(buffer, byteOffset, byteLength) {
    if (byteLength < EntryView.byteLength) {
      var bytes = new Uint8Array(EntryView.byteLength);
      bytes.set(new Uint8Array(buffer, byteOffset, byteLength));
      buffer = bytes.buffer;
      byteOffset = bytes.byteOffset;
      byteLength = bytes.byteLength;
    }
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  EntryView.byteLength = 0x1E;
  EntryView.prototype = {
    toJSON: function() {
      return {
        unknown_0x00: this.unknown_0x00,
        unknown_0x01: this.unknown_0x01,
        unknown_0x02: this.unknown_0x02,
        unknown_0x03: this.unknown_0x03,
        unknown_0x04: this.unknown_0x04,
        unknown_0x06: this.unknown_0x06,
        unknown_0x08: this.unknown_0x08,
        unknown_0x0A: this.unknown_0x0A,
        unknown_0x0C: this.unknown_0x0C,
        unknown_0x0E: this.unknown_0x0E,
        unknown_0x10: this.unknown_0x10,
        unknown_0x12: this.unknown_0x12,
        unknown_0x14: this.unknown_0x14,
        unknown_0x16: this.unknown_0x16,
        unknown_0x18: this.unknown_0x18,
        unknown_0x1A: this.unknown_0x1A,
        unknown_0x1C: this.unknown_0x1C,
      };
    },
    get unknown_0x00() {
      return this.dataView.getUint8(0);
    },
    get unknown_0x01() {
      return this.dataView.getUint8(1);
    },
    get unknown_0x02() {
      return this.dataView.getUint8(2);
    },
    get unknown_0x03() {
      return this.dataView.getUint8(3);
    },
    get unknown_0x04() {
      return this.dataView.getInt16(4, false);
    },
    get unknown_0x06() {
      return this.dataView.getInt16(6, false);
    },
    get unknown_0x08() {
      return this.dataView.getInt16(8, false);
    },
    get unknown_0x0A() {
      return this.dataView.getInt16(0xA, false);
    },
    get unknown_0x0C() {
      return this.dataView.getInt16(0xC, false);
    },
    get unknown_0x0E() {
      return this.dataView.getInt16(0xE, false);
    },
    get unknown_0x10() {
      return this.dataView.getInt16(0x10, false);
    },
    get unknown_0x12() {
      return this.dataView.getInt16(0x12, false);
    },
    get unknown_0x14() {
      return this.dataView.getInt16(0x14, false);
    },
    get unknown_0x16() {
      return this.dataView.getInt16(0x16, false);
    },
    get unknown_0x18() {
      return this.dataView.getInt16(0x18, false);
    },
    get unknown_0x1A() {
      return this.dataView.getInt16(0x1A, false);
    },
    get unknown_0x1C() {
      return this.dataView.getInt16(0x1C, false);
    },
  };

  return open;

});
