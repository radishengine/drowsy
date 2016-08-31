define(function() {

  'use strict';
  
  function RectView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset || 0, byteLength || RectView.byteLength);
  }
  RectView.prototype = {
    get top()    { return this.dataView.getInt16(0, false); },
    get left()   { return this.dataView.getInt16(2, false); },
    get bottom() { return this.dataView.getInt16(4, false); },
    get right()  { return this.dataView.getInt16(6, false); },
  };
  RectView.byteLength = 8;
  
  return RectView;

});
