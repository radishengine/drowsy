define(['mac/roman', 'mac/date', 'mac/RectView'], function(macRoman, macDate, RectView) {

  'use strict';
  
  var NODE_BYTES = 512;
  
  function split(segment, entries) {
    if (segment.getTypeParameter('node')) return Promise.resolve(null);
    var tree = segment.getTypeParameter('tree');
    var leafType = 'chunk/mac-hfs-btree; tree=' + tree + '; node=leaf';
    var headerSegment = segment.getSegment('chunk/mac-hfs-btree; tree=' + tree + '; node=header');
    return headerSegment.getStruct().then(function(header) {
      if (header.type !== 'header') return Promise.reject('not a valid B*Tree');
      entries.add(header);
      var map = header.records[2];
      header = header.records[0];
      // TODO: entries filtering to specify whether index nodes should be included or not
      function doLeaf(nodeNumber) {
        var leafSegment = segment.getSegment(leafType, NODE_BYTES * nodeNumber, NODE_BYTES);
        return leafSegment.getStruct().then(function(leaf) {
          if (leaf.type !== 'leaf') return Promise.reject('non-leaf node in the leaf chain');
          entries.add(leaf);
          if (leaf.nextNodeNumber !== 0) {
            doLeaf(leaf.nextNodeNumber);
          }
        });
      }
      return doLeaf(header.firstLeaf);
    });
  }
  
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
    this.dv = new DataView(buffer, byteOffset, NODE_BYTES);
    this.bytes = new Uint8Array(buffer, byteOffset, NODE_BYTES);
  }
  BTreeNodeView.prototype = {
    get typeCode() {
      return this.bytes[8];
    },
    get type() {
      switch (this.typeCode) {
        case 0: return 'index';
        case 1: return 'header';
        case 2: return 'map';
        case 0xff: return 'leaf';
        default: return 'unknown';
      }
    },
    get rawRecords() {
      var records = new Array(this.dv.getUint16(10, false));
      for (var i = 0; i < records.length; i++) {
        records[i] = this.bytes.subarray(
          this.dv.getUint16(NODE_BYTES - 2*(i+1), false),
          this.dv.getUint16(NODE_BYTES - 2*(i+2), false));
      }
      Object.defineProperty(this, 'rawRecords', {value:records});
      return records;
    },
    get nextNodeNumber() {
      return this.dv.getInt32(0, false);
    },
    get previousNodeNumber() {
      return this.dv.getInt32(4, false);
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
            return new IndexRecordView(
              recordBytes.buffer,
              recordBytes.byteOffset,
              recordBytes.byteLength);
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
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  IndexRecordView.prototype = {
    get isDeleted() {
      return !(this.bytes.length > 0 && this.bytes[0]);
    },
    get parentFolderID() {
      return this.dv.getUint32(2, false);
    },
    get name() {
      return macRoman(this.bytes, 7, this.bytes[6]);
    },
    get nodeNumber() {
      return this.dv.getUint32(1 + this.bytes[0], false);
    },
  };
  
  function HeaderRecordView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  HeaderRecordView.prototype = {
    get treeDepth() {
      return this.dv.getUint16(0, false);
    },
    get rootNodeNumber() {
      return this.dv.getUint32(2, false);
    },
    get leafRecordCount() {
      return this.dv.getUint32(6, false);
    },
    get firstLeaf() {
      return this.dv.getUint32(10, false);
    },
    get lastLeaf() {
      return this.dv.getUint32(14, false);
    },
    get nodeByteLength() {
      return this.dv.getUint16(18, false); // always 512?
    },
    get maxKeyByteLength() {
      return this.dv.getUint16(20, false);
    },
    get nodeCount() {
      return this.dv.getUint32(22, false);
    },
    get freeNodeCount() {
      return this.dv.getUint32(26, false);
    },
  };
  
  function MapRecordView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  };
  MapRecordView.prototype = {
    getIsNodeUsed: function(index) {
      var byte = index >> 3, bit = (0x80 >> (index & 7));
      if (byte < 0 || byte >= this.bytes.length) {
        throw new RangeError('map index out of range: '+index+' (size: '+this.nodeCount+')');
      }
      return !!(this.bytes[byte] & bit);
    },
    get nodeCount() {
      return this.bytes.length * 8;
    },
  };
  
  function LeafRecordView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    
    if (!this.isDeleted) {
      var dataOffset = 1 + this.bytes[0];
      dataOffset += dataOffset % 2;
      var dataLength = byteLength - dataOffset;
      this.dataBytes = new Uint8Array(buffer, byteOffset + dataOffset, dataLength);
    }
  }
  LeafRecordView.prototype = {
    get isDeleted() {
      return !(this.bytes.length > 0 && this.bytes[0]);
    },
    get overflowForkType() {
      switch (this.bytes[1]) {
        case 0x00: return 'data';
        case 0xFF: return 'resource';
        default: return 'unknown';
      }
    },
    get overflowFileID() {
      return this.dv.getUint32(2, false);
    },
    get parentFolderID() {
      return this.dv.getUint32(2, false);
    },
    get overflowStartingFileAllocationBlock() {
      return this.dv.getUint32(6, false);
    },
    get name() {
      return macRoman(this.bytes, 7, this.bytes[6]);
    },
    get overflowExtentDataRecord() {
      return extentDataRecord(this.dv, 1 + this.bytes[0]);
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
    get threadInfo() {
      if (!/^(file|folder)thread$/.test(this.leafType)) return null;
      var threadInfo = new ThreadInfoView(
        this.dataBytes.buffer,
        this.dataBytes.byteOffset,
        this.dataBytes.byteLength);
      Object.defineProperty(this, 'threadInfo', {value:threadInfo});
      return threadInfo;
    },
  };
  
  function FileInfoView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
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
      var type = macRoman(this.bytes, 4, 4);
      return (type === '\0\0\0\0') ? null : type;
    },
    get creator() {
      var creator = macRoman(this.bytes, 8, 4);
      return (creator === '\0\0\0\0') ? null : creator;
    },
    get isOnDesk() {
      return !!(0x0001 & this.dv.getUint16(12, false));
    },
    get color() {
      return !!(0x000E & this.dv.getUint16(12, false));
    },
    get requireSwitchLaunch() {
      return !!(0x0020 & this.dv.getUint16(12, false));
    },
    get isShared() {
      return !!(0x0040 & this.dv.getUint16(12, false));
    },
    get hasNoINITs() {
      return !!(0x0080 & this.dv.getUint16(12, false));
    },
    get hasBeenInited() {
      return !!(0x0100 & this.dv.getUint16(12, false));
    },
    get hasCustomIcon() {
      return !!(0x0400 & this.dv.getUint16(12, false));
    },
    get isStationery() {
      return !!(0x0800 & this.dv.getUint16(12, false));
    },
    get isNameLocked() {
      return !!(0x1000 & this.dv.getUint16(12, false));
    },
    get hasBundle() {
      return !!(0x2000 & this.dv.getUint16(12, false));
    },
    get isInvisible() {
      return !!(0x4000 & this.dv.getUint16(12, false));
    },
    get isAlias() {
      return !!(0x8000 & this.dv.getUint16(12, false));
    },
    get id() {
      return this.dv.getUint32(20, false);
    },
    get iconPosition() {
      var position = {
        v: this.dv.getInt16(14, false),
        h: this.dv.getInt16(16, false),
      };
      return !(position.v && position.h) ? 'default' : position;
    },
    get dataForkInfo() {
      return new ForkInfoView(this.bytes.buffer, this.bytes.byteOffset + 24);
    },
    get resourceForkInfo() {
      return new ForkInfoView(this.bytes.buffer, this.bytes.byteOffset + 34);
    },
    get createdAt() {
      return macDate(this.dv, 44);
    },
    get modifiedAt() {
      return macDate(this.dv, 48);
    },
    get backupAt() {
      return macDate(this.dv, 52);
    },
    // 56: fxInfoReserved (8 bytes)
    get fxinfoFlags() {
      return this.dv.getUint16(64, false);
    },
    get putAwayFolderID() {
      return this.dv.getUint32(68, false);
    },
    get clumpSize() {
      return this.dv.getUint16(72, false);
    },
    get dataForkFirstExtentRecord() {
      return extentDataRecord(this.dv, 74);
    },
    get resourceForkFirstExtentRecord() {
      return extentDataRecord(this.dv, 86);
    },
  };
  
  function ForkInfoView(buffer, byteOffset) {
    this.dv = new DataView(buffer, byteOffset, 10);
  }
  ForkInfoView.prototype = {
    get firstAllocationBlock() {
      return this.dv.getUint16(0, false);
    },
    get logicalEOF() {
      return this.dv.getUint32(2, false);
    },
    get physicalEOF() {
      return this.dv.getUint32(6, false);
    },
  };
  
  function FolderInfoView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  FolderInfoView.prototype = {
    get flags() {
      return this.dv.getUint16(2, false);
    },
    get id() {
      return this.dv.getUint32(6, false);
    },
    get modifiedAt() {
      return macDate(this.dv, 14);
    },
    get iconPosition() {
      var position = {
        v: this.dv.getInt16(32, false),
        h: this.dv.getInt16(34, false),
      };
      if (position.v === 0 && position.h === 0) {
        return 'default';
      }
      return position;
    },
    get windowRect() {
      return new RectView(this.dv.buffer, this.dv.byteOffset + 22);
    },
    get isOnDesk() {
      return !!(this.dv.getUint16(30, false) & 0x0001);
    },
    get isColor() {
      return !!(this.dv.getUint16(30, false) & 0x000E);
    },
    get requiresSwitchLaunch() {
      return !!(this.dv.getUint16(30, false) & 0x0020);
    },
    get hasCustomIcon() {
      return !!(this.dv.getUint16(30, false) & 0x0400);
    },
    get isNameLocked() {
      return !!(this.dv.getUint16(30, false) & 0x1000);
    },
    get hasBundle() {
      return !!(this.dv.getUint16(30, false) & 0x2000);
    },
    get isInvisible() {
      return !!(this.dv.getUint16(30, false) & 0x4000);
    },
    get scrollY() {
      return this.dv.getInt16(38, false);
    },
    get scrollX() {
      return this.dv.getInt16(40, false);
    },
    // dinfoReserved: dv.getInt16(36, false),
    // dxinfoReserved: dv.getInt32(42, false),
    get dxinfoFlags() {
      return this.dv.getUint16(46, false);
    },
    get dxinfoComment() {
      return this.dv.getUint16(48, false);
    },
    get fileCount() {
      return this.dv.getUint16(4, false);
    },
    get createdAt() {
      return macDate(this.dv, 10);
    },
    get backupAt() {
      return macDate(this.dv, 18);
    },
    get putAwayFolderID() {
      return this.dv.getInt32(50, false);
    },
  };
  
  function ThreadInfoView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  ThreadInfoView.prototype = {
    get parentFolderID() {
      return this.dv.getUint32(10, false);
    },
    get parentFolderName() {
      return macRoman(this.bytes, 15, this.bytes[14]);
    },
  };
  
  return {
    getStructView: function(segment) {
      if (segment.getTypeParameter('node')) return BTreeNodeView;
      return null;
    },
    canSplit: function(segment) {
      return !segment.getTypeParameter('node');
    },
    NodeView: BTreeNodeView,
    split: split,
  };

});
