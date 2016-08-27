define(function() {

  'use strict';
  
  return function(resource) {
    var styl = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    var styleCount = styl.getUint16(0, false);
    resource.dataObject = [];
    for (var istyle = 0; istyle < styleCount; istyle++) {
      var offset = 2 + istyle*20;
      var entry = {
        startChar: styl.getUint32(offset, false),
        height: styl.getUint16(offset + 4, false),
        ascent: styl.getUint16(offset + 6, false),
        fontID: styl.getUint16(offset + 8, false),
        size: styl.getUint16(offset + 12, false),
        color: 'rgb(' + styl.getUint8(offset + 14, false)
          + ', ' + styl.getUint8(offset + 16, false)
          + ', ' + styl.getUint8(offset + 18, false) + ')',
      };
      var face = styl.getUint16(offset + 10, false);
      if (face & 0x0100) entry.bold = true;
      if (face & 0x0200) entry.italic = true;
      if (face & 0x0400) entry.underline = true;
      if (face & 0x1000) entry.shadow = true;
      if (face & 0x2000) entry.condense = true;
      if (face & 0x4000) entry.extend = true;
      resource.dataObject.push(entry);
    }  
  };
  
});
