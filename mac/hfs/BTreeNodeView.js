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
    this.dataView = new DataView(buffer, byteOffset, NODE_BYTES);
    this.bytes = new Uint8Array(buffer, byteOffset, NODE_BYTES);
  }
  BTreeNodeView.prototype = {
    get nodeType() {
      switch(this.bytes[8]) {
        case 0: return 'index';
        case 1: return 'header';
        case 2: return 'map';
        case 0xff: return 'leaf';
        default: return 'unknown';
      }
    },
    get rawRecords() {
      var records = new Array(this.dataView.getUint16(10, false));
      for (var i = 0; i < records.length; i++) {
        records[i] = this.bytes.subarray(
          this.dataView.getUint16(NODE_BYTES - 2*(i+1), false),
          this.dataView.getUint16(NODE_BYTES - 2*(i+2), false));
      }
      Object.defineProperty(this, 'rawRecords', {value:records});
      return records;
    },
    get forwardLink() {
      return this.dataView.getInt32(0, false);
    },
    get backwardLink() {
      return this.dataView.getInt32(4, false);
    },
    get depth() {
      return this.bytes[9];
    },
    get records() {
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
  };
  
  function IndexRecordView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  IndexRecordView.prototype = {
    get isDeleted() {
      return !(this.bytes.length && this.bytes[0]);
    },
    get parentFolderID() {
      return this.dataView.getUint32(2, false);
    },
    get name() {
      return macintoshRoman(this.bytes, 7, this.bytes[6]);
    },
    get nodeNumber() {
      return this.dataView.getUint32(1 + this.bytes[0], false);
    },
  };
  
  function HeaderRecordView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  HeaderRecordView.prototype = {
    get treeDepth() {
      return this.dataView.getUint16(0, false);
    },
    get rootNodeNumber() {
      return this.dataView.getUint32(2, false);
    },
    get leafRecordCount() {
      return this.dataView.getUint32(6, false);
    },
    get firstLeaf() {
      return this.dataView.getUint32(10, false);
    },
    get lastLeaf() {
      return this.dataView.getUint32(14, false);
    },
    get nodeByteLength() {
      return this.dataView.getUint16(18, false); // always 512?
    },
    get maxKeyByteLength() {
      return this.dataView.getUint16(20, false);
    },
    get nodeCount() {
      return this.dataView.getUint32(22, false);
    },
    get freeNodeCount() {
      return this.dataView.getUint32(26, false);
    },
  };
  
  function MapRecordView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  };
  MapRecordView.prototype = {
    get nodeCount() {
      return this.bytes.length * 8;
    },
    getIsNodeUsed: function(index) {
      var byte = index >> 3, bit = (0x80 >> (index & 7));
      if (byte < 0 || byte >= this.bytes.length) {
        throw new RangeError('map index out of range: ' + index + ' (size: ' + this.nodeCount + ')');
      }
      return !!(this.bytes[byte] & bit);
    },
  };
  
  function LeafRecordView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    
    if (!this.isDeleted) {
      var dataOffset = 1 + this.bytes[0];
      dataOffset += dataOffset % 2;
      var dataLength = byteLength - dataOffset;
      this.dataDataView = new DataView(buffer, byteOffset + dataOffset, dataLength);
      this.dataBytes = new Uint8Array(buffer, byteOffset + dataOffset, dataLength);
    }
  }
  LeafRecordView.prototype = {
    get isDeleted() {
      return !(this.bytes.length && this.bytes[0]);
    },
    get parentFolderID() {
      return this.dataView.getUint32(2, false);
    },
    get name() {
      return macintoshRoman(this.bytes, 7, this.bytes[6]);
    },
    get leafType() {
      switch (this.dataBytes[0]) {
        case 1: return 'folder';
        case 2: return 'file';
        case 3: return 'folderthread';
        case 4: return 'filethread';
        default: return 'unknown';
      }
    },
    get fileInfo() {
      if (this.leafType !== 'file') return null;
      var fileInfo = new FileInfoView(
        this.dataBytes.buffer,
        this.dataBytes.byteOffset,
        this.dataBytes.byteLength);
      Object.defineProperty(this, 'fileInfo', {value:fileInfo});
      return fileInfo;
    },
    get folderInfo() {
      if (this.leafType !== 'folder') return null;
      var folderInfo = new FolderInfoView(
        this.dataBytes.buffer,
        this.dataBytes.byteOffset,
        this.dataBytes.byteLength);
      Object.defineProperty(this, 'folderInfo', {value:folderInfo});
      return folderInfo;
    },
    get fileThreadInfo() {
      if (this.leafType !== 'filethread') return null;
      var threadInfo = new ThreadInfoView(
        this.dataBytes.buffer,
        this.dataBytes.byteOffset,
        this.dataBytes.byteLength);
      Object.defineProperty(this, 'fileThreadInfo', {value:threadInfo});
      return threadInfo;
    },
    get folderThreadInfo() {
      if (this.leafType !== 'folderthread') return null;
      var threadInfo = new ThreadInfoView(
        this.dataBytes.buffer,
        this.dataBytes.byteOffset,
        this.dataBytes.byteLength);
      Object.defineProperty(this, 'folderThreadInfo', {value:threadInfo});
      return threadInfo;
    },
  };
  
  function FileInfoView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new UintArray(buffer, byteOffset, byteLength);
  }
  FileInfoView.prototype = {
    get locked() {
      return  !!(record[2] & 0x01);
    },
    get hasThreadRecord() {
      return  !!(record[2] & 0x02);
    },
    get recordUsed() {
      return  !!(record[2] & 0x80);
    },
    get type() {
      var type = macintoshRoman(this.bytes, 4, 4);
      return (type === '\0\0\0\0') ? null : type;
    },
    get creator() {
      var creator = macintoshRoman(this.bytes, 8, 4);
      return (creator === '\0\0\0\0') ? null : creator;
    },
    get isOnDesk() {
      return !!(0x0001 & this.dataView.getUint16(12, false));
    },
    get color() {
      return !!(0x000E & this.dataView.getUint16(12, false));
    },
    get requireSwitchLaunch() {
      return !!(0x0020 & this.dataView.getUint16(12, false));
    },
    get isShared() {
      return !!(0x0040 & this.dataView.getUint16(12, false));
    },
    get hasNoINITs() {
      return !!(0x0080 & this.dataView.getUint16(12, false));
    },
    get hasBeenInited() {
      return !!(0x0100 & this.dataView.getUint16(12, false));
    },
    get hasCustomIcon() {
      return !!(0x0400 & this.dataView.getUint16(12, false));
    },
    get isStationery() {
      return !!(0x0800 & this.dataView.getUint16(12, false));
    },
    get isNameLocked() {
      return !!(0x1000 & this.dataView.getUint16(12, false));
    },
    get hasBundle() {
      return !!(0x2000 & this.dataView.getUint16(12, false));
    },
    get isInvisible() {
      return !!(0x4000 & this.dataView.getUint16(12, false));
    },
    get isAlias() {
      return !!(0x8000 & this.dataView.getUint16(12, false));
    },
    get id() {
      return this.dataView.getUInt32(20, false);
    },
    get iconPosition() {
      var position = {
        v: this.dataView.getInt16(14, false),
        h: this.dataView.getInt16(16, false),
      };
      return !(position.v && position.h) ? 'default' : position;
    },
    get dataForkInfo() {
      return new ForkInfo(this.bytes.buffer, this.bytes.byteOffset + 24);
    },
    get resourceForkInfo() {
      return new ForkInfo(this.bytes.buffer, this.bytes.byteOffset + 34);
    },
    get createdAt() {
      return macintoshDate(this.dataView, 44);
    },
    get modifiedAt() {
      return macintoshDate(this.dataView, 48);
    },
    get backupAt() {
      return macintoshDate(this.dataView, 52);
    },
    // 56: fxInfoReserved (8 bytes)
    get fxinfoFlags() {
      return this.dataView.getUint16(64, false);
    },
    get putAwayFolderID() {
      return this.dataView.getUint32(68, false);
    },
    get clumpSize() {
      return this.dataView.getUint16(72, false);
    },
    get dataForkFirstExtentRecord() {
      return extentDataRecord(this.dataView, 74);
    },
    get resourceForkFirstExtentRecord() {
      return extentDataRecord(this.dataView, 86);
    },
  };
  
  function ForkInfoView(buffer, byteOffset) {
    this.dataView = new DataView(buffer, byteOffset, 6);
  }
  ForkInfoView.prototype = {
    get firstAllocationBlock() {
      return this.dataView.getUint16(0, false);
    },
    get logicalEOF() {
      return this.dataView.getUint32(2, false);
    },
    get physicalEOF() {
      return this.dataView.getUint32(6, false);
    },
  };
  
  function FolderInfoView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  FolderInfoView.prototype = {
    get flags() {
      return this.dataView.getUint16(2, false);
    },
    get id() {
      return this.dataView.getUint32(6, false);
    },
    get modifiedAt() {
      return macintoshDate(this.dataView, 14);
    },
    get iconPosition() {
      var position = {
        v: this.dataView.getInt16(32, false),
        h: this.dataView.getInt16(34, false),
      };
      if (position.v === 0 && position.h === 0) {
        return 'default';
      }
      return position;
    },
    get windowRect() {
      return new RectView(this.dataView.buffer, this.dataView.byteOffset + 22);
    },
    get isOnDesk() {
      return !!(this.dataView.getUint16(30, false) & 0x0001);
    },
    get isColor() {
      return !!(this.dataView.getUint16(30, false) & 0x000E);
    },
    get requiresSwitchLaunch() {
      return !!(this.dataView.getUint16(30, false) & 0x0020);
    },
    get hasCustomIcon() {
      return !!(this.dataView.getUint16(30, false) & 0x0400);
    },
    get isNameLocked() {
      return !!(this.dataView.getUint16(30, false) & 0x1000);
    },
    get hasBundle() {
      return !!(this.dataView.getUint16(30, false) & 0x2000);
    },
    get isInvisible() {
      return !!(this.dataView.getUint16(30, false) & 0x4000);
    },
    get scrollPosition() {
      var position = {
        v: this.dataView.getInt16(38, false),
        h: this.dataView.getInt16(40, false),
      };
      return position;
    },
    // dinfoReserved: dv.getInt16(36, false),
    // dxinfoReserved: dv.getInt32(42, false),
    get dxinfoFlags() {
      return this.dataView.getUint16(46, false);
    },
    get dxinfoComment() {
      return this.dataView.getUint16(48, false);
    },
    get fileCount() {
      return this.dataView.getUint16(4, false);
    },
    get createdAt() {
      return macintoshDate(this.dataView, 10);
    },
    get backupAt() {
      return macintoshDate(this.dataView, 18);
    },
    get putAwayFolderID() {
      return this.dataView.getInt32(50, false);
    },
  };
  
  function ThreadInfoView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  ThreadInfoView.prototype = {
    get parentFolderID() {
      this.dataView.getUint32(10, false);
    },
    get parentFolderName() {
      return macintoshRoman(this.bytes, 15, this.bytes[14]);
    },
  };

  return BTreeNodeView;

});
