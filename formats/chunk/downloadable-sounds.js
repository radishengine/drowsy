define(function() {
  
  'use strict';
  
  function Articulator(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  Articulator.prototype = {
    get connectionBlockCount() {
      return this.dv.getUint32(0, false);
    },
    get connectionBlocks() {
      var list = new Array(this.connectionBlockCount);
      var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset + 4;
      for (var i = 0; i < list.length; i++) {
        list[i] = new ConnectionBlock(buffer, byteOffset, ConnectionBlock.byteLength);
        byteOffset += ConnectionBlock.byteLength;
      }
      Object.defineProperty(this, 'connectionBlocks', {value:list});
      return Object.freeze(list);
    },
  };
  
  function ConnectionBlock(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  ConnectionBlock.prototype = {
    get source() {
      return this.dv.getUint16(0, false);
    },
    get control() {
      return this.dv.getUint16(2, false);
    },
    get destination() {
      return this.dv.getUint16(4, false);
    },
    get transform() {
      return this.dv.getUint16(6, false);
    },
    get scalingValue() {
      return this.dv.getInt32(8, false);
    },
  };
  Object.defineProperty(ConnectionBlock, 'byteLength', {value:12});
  
  return {
    getTypeStruct: function(segment) {
      switch (segment.getTypeParameter('which')) {
        case 'articulator': return Articulator;
        default: return null;
      }
    },
  };
  
});
