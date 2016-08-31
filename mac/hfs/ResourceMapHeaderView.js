define(function() {

  'use strict';
  
  function ResourceMapHeaderView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  ResourceMapHeaderView.prototype = {
    get isReadOnly() {
      return !!(this.getUint16(0, false) & 0x0080);
    },
    get typeListOffset() {
      return this.getUint16(2, false);
    },
    get nameListOffset() {
      return this.getUint16(4, false);
    },
    get typeCount() {
      return this.getInt16(6, false) + 1;
    },
  };
  ResourceMapHeaderView.byteOffset = 22;
  ResourceMapHeaderView.byteLength = 8;
  
  return ResourceMapHeaderView;

});
