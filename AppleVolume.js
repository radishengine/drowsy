
define(['ByteSource'], function(ByteSource) {

  'use strict';
  
  var PHYSICAL_BLOCK_BYTES = 512;
  var BTREE_NODE_BYTES = 512;
  
  var MAC_CHARSET_128_255
    = '\xC4\xC5\xC7\xC9\xD1\xD6\xDC\xE1\xE0\xE2\xE4\xE3\xE5\xE7\xE9\xE8'
    + '\xEA\xEB\xED\xEC\xEE\xEF\xF1\xF3\xF2\xF4\xF6\xF5\xFA\xF9\xFB\xFC'
    + '\u2020\xB0\xA2\xA3\xA7\u2022\xB6\xDF\xAE\xA9\u2122\xB4\xA8\u2260\xC6\xD8'
    + '\u221E\xB1\u2264\u2265\xA5\xB5\u2202\u2211\u220F\u03C0\u222B\xAA\xBA\u03A9\xE6\xF8'
    + '\xBF\xA1\xAC\u221A\u0192\u2248\u2206\xAB\xBB\u2026\xA0\xC0\xC3\xD5\u0152\u0153'
    + '\u2013\u2014\u201C\u201D\u2018\u2019\xF7\u25CA\xFF\u0178\u2044\u20AC\u2039\u203A\uFB01\uFB02'
    + '\u2021\xB7\u201A\u201E\u2030\xC2\xCA\xC1\xCB\xC8\xCD\xCE\xCF\xCC\xD3\xD4'
    + '\uF8FF\xD2\xDA\xDB\xD9\u0131\u02C6\u02DC\xAF\u02D8\u02D9\u02DA\xB8\u02DD\u02DB\u02C7';
  
  function macintoshRoman(u8array, offset, length) {
    switch(arguments.length) {
      case 2: u8array = u8array.subarray(offset); break;
      case 3: u8array = u8array.subarray(offset, offset + length); break;
    }
    return String.fromCharCode.apply(null, u8array)
      .replace(/[\x80-\xFF]/g, function(c) {
        return MAC_CHARSET_128_255[c.charCodeAt(0) - 128];
      });
  }
  
  function macintoshDate(dv, offset) {
    var offset = dv.getUint32(offset, false);
    if (offset === 0) return null;
    return new Date(new Date(1904, 0).getTime() + offset * 1000);
  }
  
  function nullTerminate(str) {
    return str.replace(/\0.*/, '');
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
  
  function AppleVolume(byteSource) {
    this.byteSource = byteSource;
  }
  AppleVolume.prototype = {
    read: function(reader) {
      this.readPartitions(this.byteSource, reader);
    },
    readPartitions: function(byteSource, reader) {
      var self = this;
      function doPartition(n) {
        byteSource.slice(PHYSICAL_BLOCK_BYTES * n, PHYSICAL_BLOCK_BYTES * (n+1)).read({
          onbytes: function(bytes) {
            if (macintoshRoman(bytes, 0, 4) !== 'PM\0\0') {
              console.error('invalid partition map signature');
              return;
            }
            var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            var mapBlockCount = dv.getInt32(4, false);
            var partitionInfo = {
              blockOffset: dv.getInt32(8, false),
              blockCount: dv.getInt32(12, false),
              type: nullTerminate(macintoshRoman(bytes, 48, 32)),
              status: dv.getInt32(88, false),
            };
            var dataAreaBlockCount = dv.getInt32(84, false);
            if (dataAreaBlockCount > 0) {
              partitionInfo.dataArea = {
                blockCount: dataAreaBlockCount,
                blockOffset: dv.getInt32(80, false),
              };
            }
            var bootCodeByteLength = dv.getInt32(96, false);
            if (bootCodeByteLength > 0) {
              partitionInfo.bootCode = {
                byteLength: bootCodeByteLength,
                blockOffset: dv.getInt32(92, false),
                loadAddress: dv.getInt32(100, false),
                entryPoint: dv.getInt32(108, false),
                checksum: dv.getInt32(116, false),
              };
            }
            var partitionName = nullTerminate(macintoshRoman(bytes, 16, 32));
            if (partitionName) partitionInfo.name = partitionName;
            var processorType = nullTerminate(macintoshRoman(bytes, 124, 16));
            if (processorType) partitionInfo.processorType = processorType;
            switch (partitionInfo.type) {
              case 'Apple_HFS':
                self.readHFS(
                  byteSource.slice(
                    PHYSICAL_BLOCK_BYTES * partitionInfo.blockOffset,
                    PHYSICAL_BLOCK_BYTES * (partitionInfo.blockOffset + partitionInfo.blockCount)),
                  reader);
                break;
            }
            if (typeof reader.onpartition === 'function') {
              reader.onpartition(partitionInfo);
            }
            if (n < mapBlockCount) {
              doPartition(n + 1);
            }
          },
        });
        
      }
      doPartition(1);
    },
    readHFS: function(byteSource, reader) {
      var self = this;
      // first 2 blocks are boot blocks
      var masterDirectoryBlock = byteSource.slice(PHYSICAL_BLOCK_BYTES * 2, PHYSICAL_BLOCK_BYTES * (2+1));
      masterDirectoryBlock.read({
        onbytes: function(bytes) {
          if (macintoshRoman(bytes, 0, 2) !== 'BD') {
            console.error('HFS master directory block signature not found');
            return;
          }
          var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          var volumeInfo = {
            createdAt: macintoshDate(dv, 2),
            lastModifiedAt: macintoshDate(dv, 6),
            attributes: dv.getUint16(10, false),
            rootFileCount: dv.getUint16(12, false),
            bitmapBlockOffset: dv.getUint16(14, false), // always 3?
            nextAllocationSearch: dv.getUint16(16, false), // used internally
            allocationBlockCount: dv.getUint16(18, false),
            allocationBlockByteLength: dv.getInt32(20, false), // size of one block, always multiple of 512
            defaultClumpSize: dv.getInt32(24, false),
            allocationBlocksOffset: dv.getUint16(28, false),
            nextUnusedCatalogNodeId: dv.getInt32(30, false), // catalog node: file or folder
            unusedAllocationBlockCount: dv.getUint16(34, false),
            name: nullTerminate(macintoshRoman(bytes, 36 + 1, bytes[36])),
            lastBackupAt: macintoshDate(dv, 64),
            backupSequenceNumber: dv.getUint16(68, false), // used internally
            writeCount: dv.getInt32(70, false),
            extentsOverflowFileClumpSize: dv.getInt32(74, false),
            catalogFileClumpSize: dv.getInt32(78, false),
            rootFolderCount: dv.getUint16(82, false),
            fileCount: dv.getInt32(84, false),
            folderCount: dv.getInt32(88, false),
            finderInfo: [
              dv.getInt32(92, false),
              dv.getInt32(96, false),
              dv.getInt32(100, false),
              dv.getInt32(104, false),
              dv.getInt32(108, false),
              dv.getInt32(112, false),
              dv.getInt32(116, false),
              dv.getInt32(120, false),
            ],
            cacheBlockCount: dv.getUint16(124, false), // used internally
            bitmapCacheBlockCount: dv.getUint16(126, false), // used internally
            commonCacheBlockCount: dv.getUint16(128, false), // used internally
            extentsOverflowFileByteLength: dv.getInt32(130, false),
            extentsOverflowFileExtentRecord: extentDataRecord(dv, 134),
            catalogFileByteLength: dv.getInt32(146, false),
            catalogFileExtentRecord: extentDataRecord(dv, 150),
          };
          if (typeof reader.onvolumestart === 'function') {
            reader.onvolumestart(volumeInfo);
          }
          var allocationBlocksAt = PHYSICAL_BLOCK_BYTES * volumeInfo.allocationBlocksOffset;
          var allocationBlocksLen = volumeInfo.allocationBlockByteLength * volumeInfo.allocationBlockCount;
          var allocationBlocks = byteSource.slice(allocationBlocksAt, allocationBlocksAt + allocationBlocksLen);
          allocationBlocks.blockSize = volumeInfo.allocationBlockByteLength;
          var catalogExtents = volumeInfo.catalogFileExtentRecord[0];
          catalogExtents = allocationBlocks.slice(
            allocationBlocks.blockSize * catalogExtents.offset,
            allocationBlocks.blockSize * (catalogExtents.offset + catalogExtents.length));
          self.readCatalog(catalogExtents, {
            
          });
        }
      });
    },
    readCatalog: function(byteSource, reader) {
      var self = this;
      this.readBTreeNode(byteSource.slice(0, BTREE_NODE_BYTES), {
        onheadernode: function(headerNode) {
          var rootNode = byteSource.slice(
            headerNode.rootNodeNumber * BTREE_NODE_BYTES,
            (headerNode.rootNodeNumber + 1) * BTREE_NODE_BYTES);
          self.readBTreeNode(rootNode, this);
        },
        onindexnode: function(indexNode) {
          console.log(indexNode);
          for (var i = 0; i < indexNode.pointers.length; i++) {
            var pointer = indexNode.pointers[i];
            var pointedBytes = byteSource.slice(
              pointer.nodeNumber * BTREE_NODE_BYTES,
              (pointer.nodeNumber + 1) * BTREE_NODE_BYTES);
            self.readBTreeNode(pointedBytes, this);
          }
        },
      });
    },
    readBTreeNode: function(byteSource, reader) {
      var self = this;
      byteSource.read({
        onbytes: function(bytes) {
          var node = {};
          var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          var records = new Array(dv.getUint16(10, false));
          for (var i = 0; i < records.length; i++) {
            records[i] = bytes.subarray(
              dv.getUint16(BTREE_NODE_BYTES - 2*(i+1), false),
              dv.getUint16(BTREE_NODE_BYTES - 2*(i+2), false));
          }
          var forwardLink = dv.getInt32(0, false);
          var backwardLink = dv.getInt32(4, false);
          if (forwardLink !== 0) node.forwardLink = forwardLink;
          if (backwardLink !== 0) node.backwardLink = backwardLink;
          node.depth = bytes[9];
          switch(bytes[8]) {
            case 0: // index
              node.pointers = [];
              for (var i = 0; i < records.length; i++) {
                var recordBytes = records[i];
                var keyLength;
                if (recordBytes.length === 0 || (keyLength = recordBytes[0]) === 0) {
                  // deleted record
                  continue;
                }
                var dv = new DataView(recordBytes.buffer, recordBytes.byteOffset, recordBytes.byteLength);
                var parentDirectoryID = dv.getUint32(2, false);
                var name = macintoshRoman(recordBytes, 7, recordBytes[6]);
                var nodeNumber = dv.getUint32(1 + keyLength, false);
                node.pointers.push({name:name, nodeNumber:nodeNumber, parentDirectoryID:parentDirectoryID});
              }
              if (typeof reader.onindexnode === 'function') {
                reader.onindexnode(node);
              }
              break;
            case 1: // header
              if (records.length !== 3) {
                console.error('header node: expected 3 records, got ' + recordCount);
                return;
              }
              var recordDV = new DataView(records[0].buffer, records[0].byteOffset, records[0].byteLength);
              node.treeDepth = recordDV.getUint16(0, false);
              node.rootNodeNumber = recordDV.getUint32(2, false);
              node.leafRecordCount = recordDV.getUint32(6, false);
              node.firstLeaf = recordDV.getUint32(10, false);
              node.lastLeaf = recordDV.getUint32(14, false);
              node.nodeByteLength = recordDV.getUint16(18, false); // always 512?
              node.maxKeyByteLength = recordDV.getUint16(20, false);
              node.nodeCount = recordDV.getUint32(22, false);
              node.freeNodeCount = recordDV.getUint32(26, false);
              node.bitmap = records[2];
              if (typeof reader.onheadernode === 'function') {
                reader.onheadernode(node);
              }
              break;
            case 2: // map
              console.error('NYI: map node');
              break;
            case 0xff: // leaf
              for (var i = 0; i < records.length; i++) {
                var record = records[i];
                var keyLength;
                if (record.length === 0 || (keyLength = record[0]) === 0) {
                  // deleted record
                  continue;
                }
                var dv = new DataView(record.buffer, record.byteOffset, record.byteLength);
                var nodeNumber = dv.getUint32(2, false);
                var name = macintoshRoman(record, 7, record[6]);
                var offset = 1 + keyLength;
                offset = offset + (offset % 2);
                record = record.subarray(offset);
                dv = new DataView(record.buffer, record.byteOffset, record.byteLength);
                switch(record[0]) {
                  case 1: // folder
                    console.error('NYI: folder leaf record');
                    break;
                  case 2: // file
                    var fileInfo = {
                      flags: record[2],
                      type: record[3],
                      finfoType: macintoshRoman(record, 4, 4),
                      finfoCreator: macintoshRoman(record, 8, 4),
                      finfoFlags: dv.getUint16(12, false),
                      finfoPointV: dv.getInt16(14, false),
                      finfoPointH: dv.getInt16(16, false),
                      id: dv.getUint32(20, false),
                      dataBlock: {
                        firstAllocationBlock: dv.getUint16(24, false),
                        logicalEOF: dv.getUint32(26, false),
                        physicalEOF: dv.getUint32(30, false),
                      },
                      createdAt: macintoshDate(dv, 34),
                      modifiedAt: macintoshDate(dv, 38),
                      backupAt: macintoshDate(dv, 42),
                      fxinfoFlags: dv.getUint16(54, false),
                      putAwayFolderID: dv.getUint32(58, false),
                      clumpSize: dv.getUint16(62),
                      dataForkFirstExtentRecord: extentDataRecord(dv, 64),
                      resourceForkFirstExtentRecord: extentDataRecord(dv, 76),
                    };
                    console.log(fileInfo);
                    break;
                  default:
                    console.error('unknown folder record type: ' + dv.getUint8(0));
                    break;
                }
              }
              if (bytes)
              if (typeof reader.onleafnode === 'function') {
                reader.onleafnode(node);
              }
              break;
            default:
              console.error('unknown node type: ' + bytes[8]);
              break;
          }
        }
      });
    },
  };
  
  return AppleVolume;

});
