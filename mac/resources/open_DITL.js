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

  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var len = dv.getInt16(0, false) + 1;
      if (len < 0) {
        return Promise.reject('DITL resource has invalid length');
      }
      var dataObject = new Array(len);
      var pos = 2;
      for (var i = 0; i < dataObject.length; i++) {
        var itemType = bytes[pos + 12];
        var itemEnabled = !!(itemType & 0x80);
        itemType = typeNames[itemType & 0x7f];
        if (!itemType) {
          return Promise.reject('unknown item type: ' + (bytes[pos + 12] & 0x7f));
        }
        if (itemType === 'help') {
          var helpItemType;
          switch(helpItemType = dv.getUint16(pos + 14, false)) {
            case 1: helpItemType = 'HMScanhdlg'; break;
            case 2: helpItemType = 'HMScanhrct'; break;
            case 8: helpItemType = 'HMScanAppendhdlg'; break;
            default:
              return Promise.reject('unknown help item type: ' + helpItemType);
          }
          dataObject[i] = {
            type: helpItemType,
            resourceID: dv.getUint16(pos + 16, false),
          };
          if (helpItemType === 'HMScanAppendhdlg') {
            dataObject[i].itemNumber = dv.getUint16(pos + 18, false);
          }
          pos += 13 + bytes[13];
          continue;
        }
        dataObject[i] = {
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
            dataObject[i].resourceID = dv.getUint16(pos + 14, false);
            pos += 16;
            break;
          case 'button': case 'checkbox': case 'radiobutton': case 'statictext': case 'editabletext':
            var text = macintoshRoman(bytes, pos + 14, bytes[pos + 13]);
            dataObject[i].text = text;
            pos += 13 + 1 + text.length + (text.length % 2);
            break;
          default:
            return Promise.reject('unsupported item type: ' + itemType);
        }
      }
      item.setDataObject(dataObject);
    });
  };

});
