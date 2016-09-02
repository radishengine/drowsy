define(['mac/roman', 'mac/date', 'mac/RectView'], function(macintoshRoman, macintoshDate, RectView) {

  'use strict';
  
  var NODE_BYTES = 512;
  
  function extentDataRecord(dv, offset) {
    var record = [];
    for (var i = 0; i < 3; i++) {
      record.push({
        offset: dv.getUint16(offset + i*4, false),
        length: dv.getUint16(offset + i*4 + 2, false),
      });
    }
    return record;
  }
  
  function BTreeNodeView(buffer, byteOffset) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, NODE_BYTES)},
      bytes: {value:new Uint8Array(buffer, byteOffset, NODE_BYTES)},
    });
  }
  Object.defineProperties(BTreeNodeView.prototype, {
    nodeType: {
      get: function() {
        switch(this.bytes[8]) {
          case 0: return 'index';
          case 1: return 'header';
          case 2: return 'map';
          case 0xff: return 'leaf';
          default: return 'unknown';
        }
      },
      enumerable: true,
    },
    rawRecords: {
      get: function() {
        var records = new Array(this.dataView.getUint16(10, false));
        for (var i = 0; i < records.length; i++) {
          records[i] = this.bytes.subarray(
            this.dataView.getUint16(NODE_BYTES - 2*(i+1), false),
            this.dataView.getUint16(NODE_BYTES - 2*(i+2), false));
        }
        Object.defineProperty(this, 'rawRecords', {value:records});
        return records;
      },
    },
    forwardLink: {
      get: function() {
        return this.dataView.getInt32(0, false);
      },
      enumerable: true,
    },
    backwardLink: {
      get: function() {
        return this.dataView.getInt32(4, false);
      },
      enumerable: true,
    },
    depth: {
      get: function() {
        return this.bytes[9];
      },
      enumerable: true,
    },
    records: {
      get: function() {
        var records;
        switch (this.nodeType) {
          case 'index':
            records = this.rawRecords
            .map(function(recordBytes) {
              return new IndexRecordView(recordBytes.buffer, recordBytes.byteOffset, recordBytes.byteLength);
            })
            .filter(function(indexRecord) {
              return !indexRecord.isDeleted;
            });
            break;
          case 'header':
            if (this.rawRecords.length !== 3) {
              throw new Error('B*Tree header node: expected 3 records, got ' + this.rawRecords.length);
            }
            var rawHeader = this.rawRecords[0], rawMap = this.rawRecords[2];
            records = [
              new HeaderRecordView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength),
              'unused',
              new MapRecordView(rawMap.buffer, rawMap.byteOffset, rawMap.byteLength),
            ];
            break;
          case 'map':
            records = this.rawRecords
            .map(function(rawMap) {
              return new MapRecordView(rawMap.buffer, rawMap.byteOffset, rawMap.byteLength)
            });
            break;
          case 'leaf':
            records = this.rawRecords
            .map(function(rawLeaf) {
              return new LeafRecordView(rawLeaf.buffer, rawLeaf.byteOffset, rawLeaf.byteLength);
            })
            .filter(function(leaf) {
              return !leaf.isDeleted;
            });
            break;
          default: return null;
        }
        Object.defineProperty(this, 'records', {value:records});
        return records;
      },
      enumerable: true,
    },
  });

  function IndexRecordView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
      bytes: {value:new Uint8Array(buffer, byteOffset, byteLength)},
    });
  }
  Object.defineProperties(IndexRecordView.prototype, {
    isDeleted: {
      get: function() {
        return !(this.bytes.length && this.bytes[0]);
      },
      enumerable: true,
    },
    parentFolderID: {
      get: function() {
        return this.dataView.getUint32(2, false);
      },
      enumerable: true,
    },
    name: {
      get: function() {
        return macintoshRoman(this.bytes, 7, this.bytes[6]);
      },
      enumerable: true,
    },
    nodeNumber: {
      get: function() {
        return this.dataView.getUint32(1 + this.bytes[0], false);
      },
      enumerable: true,
    },
  });
  
  function HeaderRecordView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  Object.defineProperties(HeaderRecordView.prototype, {
    treeDepth: {
      get: function() {
        return this.dataView.getUint16(0, false);
      },
      enumerable: true,
    },
    rootNodeNumber: {
      get: function() {
        return this.dataView.getUint32(2, false);
      },
      enumerable: true,
    },
    leafRecordCount: {
      get: function() {
        return this.dataView.getUint32(6, false);
      },
      enumerable: true,
    },
    firstLeaf: {
      get: function() {
        return this.dataView.getUint32(10, false);
      },
      enumerable: true,
    },
    lastLeaf: {
      get: function() {
        return this.dataView.getUint32(14, false);
      },
      enumerable: true,
    },
    nodeByteLength: {
      get: function() {
        return this.dataView.getUint16(18, false); // always 512?
      },
      enumerable: true,
    },
    maxKeyByteLength: {
      get: function() {
        return this.dataView.getUint16(20, false);
      },
      enumerable: true,
    },
    nodeCount: {
      get: function() {
        return this.dataView.getUint32(22, false);
      },
      enumerable: true,
    },
    freeNodeCount: {
      get: function() {
        return this.dataView.getUint32(26, false);
      },
      enumerable: true,
    },
  });
  
  function MapRecordView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      bytes: {value:new Uint8Array(buffer, byteOffset, byteLength)},
    });
  };
  MapRecordView.prototype = {
    getIsNodeUsed: function(index) {
      var byte = index >> 3, bit = (0x80 >> (index & 7));
      if (byte < 0 || byte >= this.bytes.length) {
        throw new RangeError('map index out of range: ' + index + ' (size: ' + this.nodeCount + ')');
      }
      return !!(this.bytes[byte] & bit);
    },
  };
  Object.defineProperties(MapRecordView.prototype, {
    nodeCount: {
      get: function() {
        return this.bytes.length * 8;
      },
      enumerable: true,
    },
  });
  
  function LeafRecordView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
      bytes: {value:new Uint8Array(buffer, byteOffset, byteLength)},
    })
    
    if (!this.isDeleted) {
      var dataOffset = 1 + this.bytes[0];
      dataOffset += dataOffset % 2;
      var dataLength = byteLength - dataOffset;
      Object.defineProperties(this, {
        dataDataView: {value:new DataView(buffer, byteOffset + dataOffset, dataLength)},
        dataBytes: {value:new Uint8Array(buffer, byteOffset + dataOffset, dataLength)},
      });
    }
  }
  Object.defineProperties(LeafRecordView.prototype, {
    isDeleted: {
      get: function() {
        return !(this.bytes.length && this.bytes[0]);
      },
      enumerable: true,
    },
    parentFolderID: {
      get: function() {
        return this.dataView.getUint32(2, false);
      },
      enumerable: true,
    },
    name: {
      get: function() {
        return macintoshRoman(this.bytes, 7, this.bytes[6]);
      },
      enumerable: true,
    },
    leafType: {
      get: function() {
        switch (this.dataBytes[0]) {
          case 1: return 'folder';
          case 2: return 'file';
          case 3: return 'folderthread';
          case 4: return 'filethread';
          default: return 'unknown';
        }
      },
      enumerable: true,
    },
    fileInfo: {
      get: function() {
        if (this.leafType !== 'file') return null;
        var fileInfo = new FileInfoView(
          this.dataBytes.buffer,
          this.dataBytes.byteOffset,
          this.dataBytes.byteLength);
        Object.defineProperty(this, 'fileInfo', {value:fileInfo});
        return fileInfo;
      },
      enumerable: true,
    },
    folderInfo: {
      get: function() {
        if (this.leafType !== 'folder') return null;
        var folderInfo = new FolderInfoView(
          this.dataBytes.buffer,
          this.dataBytes.byteOffset,
          this.dataBytes.byteLength);
        Object.defineProperty(this, 'folderInfo', {value:folderInfo});
        return folderInfo;
      },
      enumerable: true,
    },
    threadInfo: {
      get: function() {
        if (this.leafType !== 'filethread' && this.leafType !== 'folderthread') return null;
        var threadInfo = new ThreadInfoView(
          this.dataBytes.buffer,
          this.dataBytes.byteOffset,
          this.dataBytes.byteLength);
        Object.defineProperty(this, 'threadInfo', {value:threadInfo});
        return threadInfo;
      },
      enumerable: true,
    },
  });
  
  function FileInfoView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
      bytes: {value:new Uint8Array(buffer, byteOffset, byteLength)},
    });
  }
  Object.defineProperties(FileInfoView.prototype, {
    locked: {
      get: function() {
        return  !!(record[2] & 0x01);
      },
      enumerable: true,
    },
    hasThreadRecord: {
      get: function() {
        return  !!(record[2] & 0x02);
      },
      enumerable: true,
    },
    recordUsed: {
      get: function() {
        return  !!(record[2] & 0x80);
      },
      enumerable: true,
    },
    type: {
      get: function() {
        var type = macintoshRoman(this.bytes, 4, 4);
        return (type === '\0\0\0\0') ? null : type;
      },
      enumerable: true,
    },
    creator: {
      get: function() {
        var creator = macintoshRoman(this.bytes, 8, 4);
        return (creator === '\0\0\0\0') ? null : creator;
      },
      enumerable: true,
    },
    isOnDesk: {
      get: function() {
        return !!(0x0001 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    color: {
      get: function() {
        return !!(0x000E & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    requireSwitchLaunch: {
      get: function() {
        return !!(0x0020 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    isShared: {
      get: function() {
        return !!(0x0040 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    hasNoINITs: {
      get: function() {
        return !!(0x0080 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    hasBeenInited: {
      get: function() {
        return !!(0x0100 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    hasCustomIcon: {
      get: function() {
        return !!(0x0400 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    isStationery: {
      get: function() {
        return !!(0x0800 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    isNameLocked: {
      get: function() {
        return !!(0x1000 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    hasBundle: {
      get: function() {
        return !!(0x2000 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    isInvisible: {
      get: function() {
        return !!(0x4000 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    isAlias: {
      get: function() {
        return !!(0x8000 & this.dataView.getUint16(12, false));
      },
      enumerable: true,
    },
    id: {
      get: function() {
        return this.dataView.getUInt32(20, false);
      },
      enumerable: true,
    },
    iconPosition: {
      get: function() {
        var position = {
          v: this.dataView.getInt16(14, false),
          h: this.dataView.getInt16(16, false),
        };
        return !(position.v && position.h) ? 'default' : position;
      },
      enumerable: true,
    },
    dataForkInfo: {
      get: function() {
        return new ForkInfoView(this.bytes.buffer, this.bytes.byteOffset + 24);
      },
      enumerable: true,
    },
    resourceForkInfo: {
      get: function() {
        return new ForkInfoView(this.bytes.buffer, this.bytes.byteOffset + 34);
      },
      enumerable: true,
    },
    createdAt: {
      get: function() {
        return macintoshDate(this.dataView, 44);
      },
      enumerable: true,
    },
    modifiedAt: {
      get: function() {
        return macintoshDate(this.dataView, 48);
      },
      enumerable: true,
    },
    backupAt: {
      get: function() {
        return macintoshDate(this.dataView, 52);
      },
      enumerable: true,
    },
    // 56: fxInfoReserved (8 bytes)
    fxinfoFlags: {
      get: function() {
        return this.dataView.getUint16(64, false);
      },
      enumerable: true,
    },
    putAwayFolderID: {
      get: function() {
        return this.dataView.getUint32(68, false);
      },
      enumerable: true,
    },
    clumpSize: {
      get: function() {
        return this.dataView.getUint16(72, false);
      },
      enumerable: true,
    },
    dataForkFirstExtentRecord: {
      get: function() {
        return extentDataRecord(this.dataView, 74);
      },
      enumerable: true,
    },
    resourceForkFirstExtentRecord: {
      get: function() {
        return extentDataRecord(this.dataView, 86);
      },
      enumerable: true,
    },
  });
  
  function ForkInfoView(buffer, byteOffset) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, 10)},
    });
  }
  ForkInfoView.prototype = {
    firstAllocationBlock: {
      get: function() {
        return this.dataView.getUint16(0, false);
      },
      enumerable: true,
    },
    logicalEOF: {
      get: function() {
        return this.dataView.getUint32(2, false);
      },
      enumerable: true,
    },
    physicalEOF: {
      get: function() {
        return this.dataView.getUint32(6, false);
      },
      enumerable: true,
    },
  };
  
  function FolderInfoView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  Object.defineProperties(FolderInfoView.prototype, {
    flags: {
      get: function() {
        return this.dataView.getUint16(2, false);
      },
      enumerable: true,
    },
    id: {
      get: function() {
        return this.dataView.getUint32(6, false);
      },
      enumerable: true,
    },
    modifiedAt: {
      get: function() {
        return macintoshDate(this.dataView, 14);
      },
      enumerable: true,
    },
    iconPosition: {
      get: function() {
        var position = {
          v: this.dataView.getInt16(32, false),
          h: this.dataView.getInt16(34, false),
        };
        if (position.v === 0 && position.h === 0) {
          return 'default';
        }
        return position;
      },
      enumerable: true,
    },
    windowRect: {
      get: function() {
        return new RectView(this.dataView.buffer, this.dataView.byteOffset + 22);
      },
      enumerable: true,
    },
    isOnDesk: {
      get: function() {
        return !!(this.dataView.getUint16(30, false) & 0x0001);
      },
      enumerable: true,
    },
    isColor: {
      get: function() {
        return !!(this.dataView.getUint16(30, false) & 0x000E);
      },
      enumerable: true,
    },
    requiresSwitchLaunch: {
      get: function() {
        return !!(this.dataView.getUint16(30, false) & 0x0020);
      },
      enumerable: true,
    },
    hasCustomIcon: {
      get: function() {
        return !!(this.dataView.getUint16(30, false) & 0x0400);
      },
      enumerable: true,
    },
    isNameLocked: {
      get: function() {
        return !!(this.dataView.getUint16(30, false) & 0x1000);
      },
      enumerable: true,
    },
    hasBundle: {
      get: function() {
        return !!(this.dataView.getUint16(30, false) & 0x2000);
      },
      enumerable: true,
    },
    isInvisible: {
      get: function() {
        return !!(this.dataView.getUint16(30, false) & 0x4000);
      },
      enumerable: true,
    },
    scrollPosition: {
      get: function() {
        var position = {
          v: this.dataView.getInt16(38, false),
          h: this.dataView.getInt16(40, false),
        };
        return position;
      },
      enumerable: true,
    },
    // dinfoReserved: dv.getInt16(36, false),
    // dxinfoReserved: dv.getInt32(42, false),
    dxinfoFlags: {
      get: function() {
        return this.dataView.getUint16(46, false);
      },
      enumerable: true,
    },
    dxinfoComment: {
      get: function() {
        return this.dataView.getUint16(48, false);
      },
      enumerable: true,
    },
    fileCount: {
      get: function() {
        return this.dataView.getUint16(4, false);
      },
      enumerable: true,
    },
    createdAt: {
      get: function() {
        return macintoshDate(this.dataView, 10);
      },
      enumerable: true,
    },
    backupAt: {
      get: function() {
        return macintoshDate(this.dataView, 18);
      },
      enumerable: true,
    },
    putAwayFolderID: {
      get: function() {
        return this.dataView.getInt32(50, false);
      },
      enumerable: true,
    },
  });
  
  function ThreadInfoView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)}),
      bytes: {value:new Uint8Array(buffer, byteOffset, byteLength)}),
    });
  }
  Object.defineProperties(ThreadInfoView.prototype, {
    parentFolderID: {
      get: function() {
        return this.dataView.getUint32(10, false);
      },
      enumerable: true,
    },
    parentFolderName: {
      get: function() {
        return macintoshRoman(this.bytes, 15, this.bytes[14]);
      },
      enumerable: true,
    },
  });

  return BTreeNodeView;

});
