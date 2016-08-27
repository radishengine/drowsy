define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  var typeNames = {};
  typeNames[0] = 'user';
  typeNames[1] = 'help';
  typeNames[4] = 'button';
  typeNames[5] = 'checkbox';
  typeNames[6] = 'radiobutton';
  typeNames[7] = 'control';
  typeNames[8] = 'statictext';
  typeNames[16] = 'editabletext';
  typeNames[32] = 'icon';
  typeNames[64] = 'picture';

  return function(resource) {
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    resource.dataObject = new Array(dv.getUint16(0, false) + 1);
    var pos = 2;
    for (var i = 0; i < resource.dataObject.length; i++) {
      var itemType = resource.data[pos + 12];
      var itemEnabled = !!(itemType & 0x80);
      itemType = typeNames[itemType & 0x7f];
      if (!itemType) {
        console.error('unknown item type: ' + (resource.data[pos + 12] & 0x7f));
        return;
      }
      if (itemType === 'help') {
        var helpItemType;
        switch(helpItemType = dv.getUint16(pos + 14, false)) {
          case 1: helpItemType = 'HMScanhdlg'; break;
          case 2: helpItemType = 'HMScanhrct'; break;
          case 8: helpItemType = 'HMScanAppendhdlg'; break;
          default:
            console.error('unknown help item type: ' + helpItemType);
            break;
        }
        resource.dataObject[i] = {
          type: helpItemType,
          resourceID: dv.getUint16(pos + 16, false),
        };
        if (helpItemType === 'HMScanAppendhdlg') {
          resource.dataObject[i].itemNumber = dv.getUint16(pos + 18, false);
        }
        pos += 13 + resource.data[13];
        continue;
      }
      resource.dataObject[i] = {
        type: itemType,
        rectangle: {
          top: dv.getInt16(pos + 4, false),
          left: dv.getInt16(pos + 6, false),
          bottom: dv.getInt16(pos + 8, false),
          right: dv.getInt16(pos + 10, false),
        },
      };
      switch(itemType) {
        case 'user': pos += 14; break;
        case 'control': case 'icon': case 'picture':
          resource.dataObject[i].resourceID = dv.getUint16(pos + 14, false);
          pos += 16;
          break;
        case 'button': case 'checkbox': case 'radiobutton': case 'statictext': case 'editabletext':
          var text = macintoshRoman(resource.data, pos + 14, resource.data[pos + 13]);
          resource.dataObject[i].text = text;
          pos += 13 + 1 + text.length + (1 + text.length) % 2;
          break;
        default:
          console.error('unsupported item type: ' + itemType);
          return;
      }
    }
  }

});
