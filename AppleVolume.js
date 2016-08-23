
define(['ByteSource'], function(ByteSource) {

  'use strict';
  
  var PHYSICAL_BLOCK_BYTES = 512;
  
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
          self.readBTreeHeaderNode(
            byteSource.slice(
              PHYSICAL_BLOCK_BYTES * volumeInfo.allocationBlocksOffset
                + volumeInfo.allocationBlockByteLength * volumeInfo.catalogFileExtentRecord[0].offset,
              PHYSICAL_BLOCK_BYTES * volumeInfo.allocationBlocksOffset
                + volumeInfo.allocationBlockByteLength * volumeInfo.catalogFileExtentRecord[0].offset
                + 512),
            {
              onheaderrecord: function(headerRecord) {
                self.readBTreeIndexNode(
                  byteSource.slice(
                    PHYSICAL_BLOCK_BYTES * volumeInfo.allocationBlocksOffset
                      + 512 * headerRecord.rootNodeNumber,
                    PHYSICAL_BLOCK_BYTES * volumeInfo.allocationBlocksOffset
                      + 512 * headerRecord.rootNodeNumber
                      + 512),
                  {
                    onindexrecord: function(indexRecord) {
                      console.log(indexRecord);
                    }
                  });
              },
            });
        }
      });
    },
    readBTreeIndexNode: function(byteSource, reader) {
      var records = [];
      this.readBTreeNode(byteSource, {
        onnodestart: function(descriptor) {
          if (descriptor.type !== 'index') {
            console.error('expected index node, got type: ' + descriptor.type);
          }
          console.log(descriptor);
        },
        onnoderecord: function(record) {
          records.push(record);
        },
        onnodeend: function() {
        },
      });
    },
    readBTreeHeaderNode: function(byteSource, reader) {
      var records = [];
      this.readBTreeNode(byteSource, {
        onnodestart: function(descriptor) {
          if (descriptor.type !== 'header') {
            console.error('expected header node, got type: ' + descriptor.type);
          }
        },
        onnoderecord: function(record) {
          records.push(record);
        },
        onnodeend: function() {
          if (records.length !== 3) {
            console.error('expected 3 records in header node, got ' + records.length);
            return;
          }
          var headerRecord = records[0], mapRecord = records[2];
          headerRecord.slice(0, 30).read({
            onbytes: function(recordBytes) {
              var recordDV = new DataView(recordBytes.buffer, recordBytes.byteOffset, recordBytes.byteLength);
              var recordInfo = {
                treeDepth: recordDV.getUint16(0, false),
                rootNodeNumber: recordDV.getUint32(2, false),
                leafRecordCount: recordDV.getUint32(6, false),
                firstLeaf: recordDV.getUint32(10, false),
                lastLeaf: recordDV.getUint32(14, false),
                nodeByteLength: recordDV.getUint16(18, false), // always 512?
                maxKeyByteLength: recordDV.getUint16(20, false),
                nodeCount: recordDV.getUint32(22, false),
                freeNodeCount: recordDV.getUint32(26, false),
                // ...76 reserved bytes
              };
              if (typeof reader.onheaderrecord === 'function') {
                reader.onheaderrecord(recordInfo);
              }
            },
          });
        },
      });
    },
    readBTreeNode: function(byteSource, reader) {
      byteSource.slice(0, 12).read({
        onbytes: function(bytes) {
          var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          var descriptor = {
            forwardLink: dv.getInt32(0, false),
            backwardLink: dv.getInt32(4, false),
            type: (function(b) {
              switch(b) {
                case 0: return 'index';
                case 1: return 'header';
                case 2: return 'map';
                case 0xFF: return 'leaf';
                default:
                  console.error('unknown node descriptor type: ' + b);
                  return b;
              }
            })(bytes[8]),
            depth: bytes[9],
            recordCount: dv.getUint16(10, false),
            // reserved: dv.getUint16(12, false),
          };
          if (typeof reader.onnodestart === 'function') {
            reader.onnodestart(descriptor);
          }
          byteSource.slice(-2 * (descriptor.recordCount + 1)).read({
            onbytes: function(offsets) {
              var offsetsDV = new DataView(offsets.buffer, offsets.byteOffset, offsets.byteLength);
              for (var i = 0; i < descriptor.recordCount; i++) {
                var offset = offsetsDV.getUint16(offsets.length - 2*(i+1), false);
                var length = offsetsDV.getUint16(offsets.length - 2*(i+2), false) - offset;
                if (typeof reader.onnoderecord === 'function') {
                  reader.onnoderecord(byteSource.slice(offset, length));
                }
              }
              if (typeof reader.onnodeend === 'function') {
                reader.onnodeend();
              }
            }
          });
        }
      });
    },
  };
  
  return AppleVolume;

});
