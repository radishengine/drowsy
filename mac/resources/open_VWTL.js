define(function() {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
    
      var list = new Array(bytes.length / EntryView.byteLength);
      
      for (var i = 0; i < list.length; i++) {
        list[i] = new EntryView(
          bytes.buffer,
          bytes.byteOffset + i * EntryView.byteLength,
          EntryView.byteLength);
      }
      
      item.setDataObject(list);
    
    });
  }
  
  function EntryView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  EntryView.byteLength = 14;
  EntryView.prototype = {
    toJSON: function() {
      return {
        unknown_0x00: this.unknown_0x00,
        unknown_0x02: this.unknown_0x02,
        unknown_0x03: this.unknown_0x03,
        unknown_0x04: this.unknown_0x04,
        unknown_0x06: this.unknown_0x06,
        unknown_0x08: this.unknown_0x08,
        unknown_0x0A: this.unknown_0x0A,
        unknown_0x0C: this.unknown_0x0C,
      };
    },
    get unknown_0x00() {
      return this.dataView.getInt16(0x00, false);
    },
    get unknown_0x02() {
      return this.dataView.getUint8(0x02, false);
    },
    get unknown_0x03() {
      return this.dataView.getUint8(0x03, false);
    },
    get unknown_0x04() {
      return this.dataView.getInt16(0x04, false);
    },
    get unknown_0x06() {
      return this.dataView.getInt16(0x06, false);
    },
    get unknown_0x08() {
      return this.dataView.getInt16(0x08, false);
    },
    get unknown_0x0A() {
      return this.dataView.getInt16(0x0A, false);
    },
    get unknown_0x0C() {
      return this.dataView.getInt16(0x0C, false);
    },
  };
  
  return item;

});
