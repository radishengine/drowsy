define(function(){

  'use strict';
  
  function HeaderView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  HeaderView.prototype = {
    get hasValidSignature() {
      return this.dataView.getUint16(0, false) === 0x0E0F;
    },
    get sectorsPerTrack() {
      return this.dataView.getUint16(2, false);
    },
    get sideCount() {
      return this.dataView.getUint16(4, false) + 1;
    },
    get firstTrack() {
      return this.dataView.getUint16(6, false);
    },
    get lastTrack() {
      return this.dataView.getUint16(8, false);
    },
  };
  
  return {
    getStructView: function(format) {
      return HeaderView;
    },
  };

});
