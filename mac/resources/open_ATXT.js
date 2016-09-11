define(['mac/roman'], function(macRoman) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      item.setDataObject(new TextView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    });
  };
  
  function TextView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  };
  TextView.prototype = {
    toJSON: function() {
      return {
        top: this.top,
        left: this.left,
        bottom: this.bottom,
        right: this.right,
        fontType: this.fontType,
        fontSize: this.fontSize,
        text: this.text,
      };
    },
    get top() {
      return this.dataView.getInt16(0, false);
    },
    get left() {
      return this.dataView.getInt16(2, false);
    },
    get bottom() {
      return this.dataView.getInt16(4, false);
    },
    get right() {
      return this.dataView.getInt16(6, false);
    },
    get fontType() {
      return this.dataView.getUint16(8, false);
    },
    get fontSize() {
      return this.dataView.getUint16(10, false);
    },
    get text() {
      return macRoman(this.bytes, 12);
    },
  };
  
  return open;

});
