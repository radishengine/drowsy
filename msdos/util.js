define(function() {

  'use strict';
  
  return {
    getTimeAndDate: function(dataView, offset) {
      var d = new Date();
      this.assignTimeFromUint16(dataView.getUint16(offset, true));
      this.assignDateFromUint16(dataView.getUInt16(offset + 2, true));
      return d;
    },
    assignTimeFromUint16: function(d, u16) {
      d.setSeconds((u16 & 0x1f) << 1);
      d.setMinutes((u16 >> 5) & 0x3f);
      d.setHours((u16 >> 11) & 0x1f);
    },
    assignDateFromUint16: function(d, u16) {
      d.setDate(u16 & 0x1f);
      d.setMonth((u16 >> 5) & 0xf);
      d.setFullYear(1980 + (u16 >> 9));
    },
  };

});
