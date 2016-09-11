define(['mac/roman', 'mac/date'], function(macRoman, macDate) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var alias = new AliasView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      item.setDataObject(alias);
    });
  }
  
  function AliasView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  AliasView.prototype = {
    toJSON: function() {
      var obj = {
        creator: this.creator,
        recordCount: this.recordCount,
        recordVersion: this.recordVersion,
        aliasKind: this.aliasKind,
        volumeName: this.volumeName,
        creationDate: this.creationDate,
        fileSystem: this.fileSystem,
        driveType: this.driveType,
        parentFolderID: this.parentFolderID,
        fileNameString: this.fileNameString,
        fileID: this.fileID,
        fileCreatedDate: this.fileCreatedDate,
        fileType: this.fileType,
        fileCreaetor: this.fileCreator,
        nextLevelUp: this.nextLevelUp,
        nextLevelDown: this.nextLevelDown,
        volumeAttributes: this.volumeAttributes,
        volumeSystemID: this.volumeSystemID,
      };
      for (var i = 0; i < this.extraStrings.length; i++) {
        obj[this.extraStrings[i].key] = this.extraStrings[i].value;
      }
      obj.resourceType = this.resourceType;
      obj.resourceID = this.resourceID;
      return obj;
    },
    get creator() {
      return macRoman(this.bytes, 0, 4);
    },
    get recordCount() {
      return this.dataView.getUint16(4, false);
    },
    get recordVersion() {
      return this.dataView.getUint16(6, false);
    },
    get aliasKind() {
      var kind = this.dataView.getUint16(8, false);
      switch(kind) {
        case 0: return 'file';
        case 1: return 'folder';
        default: return kind;
      }
    },
    get volumeName() {
      return macRoman(this.bytes, 11, bytes[10]);
    },
    get creationDate() {
      return macDate(this.dataView, 38);
    },
    get fileSystem() {
      var fs = macRoman(this.bytes, 42, 2);
      switch(fs) {
        case 'BD': return 'hfs';
        case 'RW': return 'macintosh';
        default: return fs;
      }
    },
    get driveType() {
      var driveType = this.dataView.getUint16(44, false);
      switch(driveType) {
        case 0: return 'fixedHardDrive'; break;
        case 1: return 'networkDisk'; break;
        case 2: return 'floppy400K'; break;
        case 3: return 'floppy800K'; break;
        case 4: return 'floppy1_4M'; break;
        case 5: return 'otherEjectableMedia'; break;
        default: return driveType;
      }
    },
    get parentFolderID() {
      return this.dataView.getUint32(46, false);
    },
    get fileNameString() {
      return macRoman(this.bytes, 51, this.bytes[50]);
    },
    get fileID() {
      return this.dataView.getUint32(114, false);
    },
    get fileCreatedDate() {
      return macDate(this.dataView, 118, false);
    },
    get fileType() {
      var fourCC = macRoman(this.bytes, 122, 4);
      if (fourCC === '\0\0\0\0') return null;
      return fourCC;
    },
    get fileCreator() {
      var fourCC = macRoman(this.bytes, 126, 4);
      if (fourCC === '\0\0\0\0') return null;
      return fourCC;
    },
    get nextLevelUp() {
      return this.getInt16(130, false);
    },
    get nextLevelDown() {
      return this.getInt16(132, false);
    },
    get volumeAttributes() {
      /*
        software locked FS = 0x8000
        copy protected FS = 0x4000
        unmounted cleanly = 0x0100
        hardware locked = 0x0080
        busy = 0x0040
        fault was found = 0x0007
      */   
      return this.getUint32(134, false);
    },
    get volumeFileSystemID() {
      var fs = macRoman(this.bytes, 136);
      switch(fs) {
        case '\0\0': return null;
        case 'JH': return 'redBookAudio';
        case 'AG': return 'iso9660';
        case 'IS': return 'microsoftFAT';
        case 'Jo': return 'microsoftJoliet';
        default: return fs;
      }
    },
    // 10 reserved bytes
    get extraStrings() {
      var pos = 150;
      var values = [];
      for (;;) {
        var valueID = this.dataView.getInt16(pos, false);
        var len = this.dataView.getUint16(pos + 2, false);
        var afterPos = pos + 4 + len + len % 2;
        if (valueID === -1) {
          values.afterPos = endPos;
          break;
        }
        var valueName;
        switch(valueID) {
          case 0: valueName = 'directoryName'; break;
          case 1: valueName = 'directoryIDs'; break;
          case 2: valueName = 'absolutePath'; break;
          case 3: valueName = 'appleShareZoneName'; break;
          case 4: valueName = 'appleShareServerName'; break;
          case 5: valueName = 'appleShareUserName'; break;
          case 6: valueName = 'driverName'; break;
          case 9: valueName = 'revisedAppleShareInfo'; break;
          case 10: valueName = 'appleRemoteAccessDialupInfo'; break;
        }
        var value;
        if (valueName === 'directoryIDs') {
          value = [];
          for (var i = 0; i < len/4; i++) {
            ids.push(this.dataView.getUint32(pos + 4 + 4*i, false));
          }
        }
        else {
          value = macRoman(this.bytes, pos + 4, len);
        }
        values.push({
          key: valueName,
          value: value,
        });
        pos += afterPos;
      }
      Object.defineProperty(this, 'extraStrings', {value:values});
      return values;
    },
    get resourceType() {
      return macRoman(this.bytes, this.extraStrings.afterPos, 4);
    },
    get resourceID() {
      return this.dataView.getInt16(this.extraStrings.afterPo + 4);
    },
  };
  
  return open;

});
