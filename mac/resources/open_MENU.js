define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(resource) {
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    resource.dataObject = {
      id: dv.getUint16(0, false),
      definitionProcedureResourceID: dv.getUint16(6, false),
      enabledState: dv.getUint32(10, false),
      title: macintoshRoman(resource.data, 15, resource.data[14]),
    };
    var pos = 15 + resource.data[14];
    if (resource.dataObject.definitionProcedureResourceID === 0) {
      delete resource.dataObject.definitionProcedureResourceID;
      resource.dataObject.items = [];
      while (pos < resource.data.length && resource.data[pos] !== 0) {
        var text = macintoshRoman(resource.data, pos + 1, resource.data[pos]);
        text += 1 + text.length;
        var item = {
          text: text,
          iconNumberOrScriptCode: resource.data[pos],
          keyboardEquivalent: resource.data[pos + 1],
          markingCharacterOrSubmenuID: resource.data[pos + 2],
          style: resource.data[pos + 3],
        };
        resource.dataObject.items.push(item);
        pos += 4;
      }
    }
    else {
      resource.dataObject.itemData = atob(String.fromCharCode.apply(null, resource.data.subarray(pos)));
    }
  };

});
