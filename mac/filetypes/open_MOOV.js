define(['itemObjectModel', 'mac/roman'], function(itemOM, macRoman) {

  'use strict';
  
  function open(item) {
    function onAtom(item, byteSource) {
      return byteSource.slice(0, 8).getBytes().then(function(headerBytes) {
        var length = new DataView(headerBytes.buffer, headerBytes.byteOffset, 4).getUint32(0, false);
        var name = macRoman(headerBytes, 4, 4);
        var atomItem = itemOM.createItem(name);
        item.addItem(atomItem);
        if (length > 8) {
          atomItem.byteSource = byteSource.slice(8, length);
          switch (name) {
            case 'moov': case 'trak': case 'clip': case 'udta': case 'matt':
            case 'edts': case 'mdia': case 'minf': case 'stbl': case 'tref':
            case 'imap': case 'dinf':
              atomItem.startAddingItems();
              onAtom(atomItem, atomItem.byteSource);
              break;
          }
        }
        if (byteSource.byteLength >= (length + 8)) {
          return onAtom(item, byteSource.slice(length));
        }
      });
    }
    return onAtom(item, item.byteSource);
  }
  
  return open;

});
