define(function() {

  'use strict';
  
  function ResourceHeaderView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  ResourceHeaderView.prototype = {
    get dataOffset() {
      return this.dataView.getUint32(0, false);
    },
    get mapOffset() {
      return this.dataView.getUint32(4, false);
    },
    get dataLength() {
      return this.dataView.getUint32(8, false);
    },
    get mapLength() {
      return this.dataView.getUint32(12, false);
    },
  };
  ResourceHeaderView.byteLength = 16;
  
  return ResourceHeaderView;

});
