define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var dataObject = {
        id: dv.getUint16(0, false),
        definitionProcedureResourceID: dv.getUint16(6, false),
        enabledState: dv.getUint32(10, false),
        title: macintoshRoman(bytes, 15, bytes[14]),
      };
      var pos = 15 + bytes[14];
      if (dataObject.definitionProcedureResourceID === 0) {
        delete dataObject.definitionProcedureResourceID;
        dataObject.items = [];
        while (pos < bytes.length && bytes[pos] !== 0) {
          var text = macintoshRoman(bytes, pos + 1, bytes[pos]);
          pos += 1 + text.length;
          var menuItem = {
            text: text,
            iconNumberOrScriptCode: bytes[pos],
            keyboardEquivalent: bytes[pos + 1],
            markingCharacterOrSubmenuID: bytes[pos + 2],
            style: bytes[pos + 3],
          };
          dataObject.items.push(menuItem);
          pos += 4;
        }
      }
      else {
        dataObject.itemData = atob(String.fromCharCode.apply(null, bytes.subarray(pos)));
      }
      item.setDataObject(dataObject);
    });
  };

});
