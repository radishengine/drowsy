
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
        offset: dv.getInt16(offset + i*4, false),
        length: dv.getInt16(offset + i*4 + 2, false),
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
            attributes: dv.getInt16(10, false),
            rootFileCount: dv.getInt16(12, false),
            bitmapBlockOffset: dv.getInt16(14, false),
            nextAllocationSearch: dv.getInt16(16, false),
            allocationBlockCount: dv.getInt16(18, false),
            allocationBlocksByteLength: dv.getInt32(20, false),
            defaultClumpSize: dv.getInt32(24, false),
            allocationBlocksOffset: dv.getInt16(28, false),
            nextUnusedCatalogNodeId: dv.getInt32(30, false),
            unusedAllocationBlockCount: dv.getInt16(34, false),
            name: nullTerminate(macintoshRoman(bytes, 36 + 1, bytes[36])),
            lastBackupAt: macintoshDate(dv, 64),
            backupSequenceNumber: dv.getInt16(68, false),
            writeCount: dv.getInt32(70, false),
            extentsOverflowFileClumpSize: dv.getInt32(74, false),
            catalogFileClumpSize: dv.getInt32(78, false),
            rootFolderCount: dv.getInt16(82, false),
            fileCount: dv.getInt32(84, false),
            folderCount: dv.getInt32(88, false),
            finderInfo: [
              dv.getInt32(92, false),
              dv.getInt32(100, false),
              dv.getInt32(108, false),
              dv.getInt32(116, false),
              dv.getInt32(124, false),
              dv.getInt32(132, false),
              dv.getInt32(140, false),
              dv.getInt32(148, false),
            ],
            cacheBlockCount: dv.getInt16(156, false),
            bitmapCacheBlockCount: dv.getInt16(158, false),
            commonCacheBlockCount: dv.getInt16(160, false),
            extentsOverflowFileByteLength: dv.getInt32(162, false),
            extentsOverflowFileExtentRecord: extentDataRecord(dv, 166),
            catalogFileByteLength: dv.getInt32(178, false),
            catalogFileExtentRecord: extentDataRecord(dv, 182),
          };
          if (typeof reader.onvolumestart === 'function') {
            reader.onvolumestart(volumeInfo);
          }
        }
      });
    },
  };
  
  return AppleVolume;

});
