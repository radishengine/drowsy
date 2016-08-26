
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
  
  function hfsPlusForkData(dv, offset) {
    var forkData = {
      logicalSize1: dv.getUint32(offset, false),
      logicalSize2: dv.getUint32(offset + 4, false),
      clumpSize: dv.getUint32(offset + 8, false),
      totalBlocks: dv.getUint32(offset + 12, false),
      extents: [],
    };
    for (var i = 0; i < 8; i++) {
      forkData.extents.push({
        startBlock: dv.getUint32(offset + 16 + (i * 8), false),
        blockCount: dv.getUint32(offset + 16 + (i * 8) + 4, false),
      });
    }
    return forkData;
  }
  hfsPlusForkData.byteLength = 8 + 4 + 4 + (8 * (4 + 4));
  
  var PIXEL0 = new Uint8Array([255,255,255,255]);
  var PIXEL1 = new Uint8Array([0,0,0,255]);
  
  var mac4BitSystemPalette = [
    [255,255,255, 255], [255,255,  0, 255], [255,102,  0, 255], [221,  0,  0, 255],
    [255,  0,153, 255], [ 51,  0,153, 255], [  0,  0,204, 255], [  0,153,255, 255],
    [  0,170,  0, 255], [  0,102,  0, 255], [102, 51,  0, 255], [153,102, 51, 255],
    [187,187,187, 255], [136,136,136, 255], [ 68, 68, 68, 255], [  0,  0,  0, 255],
  ];
  
  var mac8BitSystemPalette = [
    [255,255,255, 255], [255,255,204, 255], [255,255,153, 255], [255,255,102, 255], [255,255, 51, 255], [255,255,  0, 255],
    [255,204,255, 255], [255,204,204, 255], [255,204,153, 255], [255,204,102, 255], [255,204, 51, 255], [255,204,  0, 255],
    [255,153,255, 255], [255,153,204, 255], [255,153,153, 255], [255,153,102, 255], [255,153, 51, 255], [255,153,  0, 255],
    [255,102,255, 255], [255,102,204, 255], [255,102,153, 255], [255,102,102, 255], [255,102, 51, 255], [255,102,  0, 255],
    [255, 51,255, 255], [255, 51,204, 255], [255, 51,153, 255], [255, 51,102, 255], [255, 51, 51, 255], [255, 51,  0, 255],
    [255,  0,255, 255], [255,  0,204, 255], [255,  0,153, 255], [255,  0,102, 255], [255,  0, 51, 255], [255,  0,  0, 255],
    [204,255,255, 255], [204,255,204, 255], [204,255,153, 255], [204,255,102, 255], [204,255, 51, 255], [204,255,  0, 255],
    [204,204,255, 255], [204,204,204, 255], [204,204,153, 255], [204,204,102, 255], [204,204, 51, 255], [204,204,  0, 255],
    [204,153,255, 255], [204,153,204, 255], [204,153,153, 255], [204,153,102, 255], [204,153, 51, 255], [204,153,  0, 255],
    [204,102,255, 255], [204,102,204, 255], [204,102,153, 255], [204,102,102, 255], [204,102, 51, 255], [204,102,  0, 255],
    [204, 51,255, 255], [204, 51,204, 255], [204, 51,153, 255], [204, 51,102, 255], [204, 51, 51, 255], [204, 51,  0, 255],
    [204,  0,255, 255], [204,  0,204, 255], [204,  0,153, 255], [204,  0,102, 255], [204,  0, 51, 255], [204,  0,  0, 255],
    [153,255,255, 255], [153,255,204, 255], [153,255,153, 255], [153,255,102, 255], [153,255, 51, 255], [153,255,  0, 255],
    [153,204,255, 255], [153,204,204, 255], [153,204,153, 255], [153,204,102, 255], [153,204, 51, 255], [153,204,  0, 255],
    [153,153,255, 255], [153,153,204, 255], [153,153,153, 255], [153,153,102, 255], [153,153, 51, 255], [153,153,  0, 255],
    [153,102,255, 255], [153,102,204, 255], [153,102,153, 255], [153,102,102, 255], [153,102, 51, 255], [153,102,  0, 255],
    [153, 51,255, 255], [153, 51,204, 255], [153, 51,153, 255], [153, 51,102, 255], [153, 51, 51, 255], [153, 51,  0, 255],
    [153,  0,255, 255], [153,  0,204, 255], [153,  0,153, 255], [153,  0,102, 255], [153,  0, 51, 255], [153,  0,  0, 255],
    [102,255,255, 255], [102,255,204, 255], [102,255,153, 255], [102,255,102, 255], [102,255, 51, 255], [102,255,  0, 255],
    [102,204,255, 255], [102,204,204, 255], [102,204,153, 255], [102,204,102, 255], [102,204, 51, 255], [102,204,  0, 255],
    [102,153,255, 255], [102,153,204, 255], [102,153,153, 255], [102,153,102, 255], [102,153, 51, 255], [102,153,  0, 255],
    [102,102,255, 255], [102,102,204, 255], [102,102,153, 255], [102,102,102, 255], [102,102, 51, 255], [102,102,  0, 255],
    [102, 51,255, 255], [102, 51,204, 255], [102, 51,153, 255], [102, 51,102, 255], [102, 51, 51, 255], [102, 51,  0, 255],
    [102,  0,255, 255], [102,  0,204, 255], [102,  0,153, 255], [102,  0,102, 255], [102,  0, 51, 255], [102,  0,  0, 255],
    [ 51,255,255, 255], [ 51,255,204, 255], [ 51,255,153, 255], [ 51,255,102, 255], [ 51,255, 51, 255], [ 51,255,  0, 255],
    [ 51,204,255, 255], [ 51,204,204, 255], [ 51,204,153, 255], [ 51,204,102, 255], [ 51,204, 51, 255], [ 51,204,  0, 255],
    [ 51,153,255, 255], [ 51,153,204, 255], [ 51,153,153, 255], [ 51,153,102, 255], [ 51,153, 51, 255], [ 51,153,  0, 255],
    [ 51,102,255, 255], [ 51,102,204, 255], [ 51,102,153, 255], [ 51,102,102, 255], [ 51,102, 51, 255], [ 51,102,  0, 255],
    [ 51, 51,255, 255], [ 51, 51,204, 255], [ 51, 51,153, 255], [ 51, 51,102, 255], [ 51, 51, 51, 255], [ 51, 51,  0, 255],
    [ 51,  0,255, 255], [ 51,  0,204, 255], [ 51,  0,153, 255], [ 51,  0,102, 255], [ 51,  0, 51, 255], [ 51,  0,  0, 255],
    [  0,255,255, 255], [  0,255,204, 255], [  0,255,153, 255], [  0,255,102, 255], [  0,255, 51, 255], [  0,255,  0, 255],
    [  0,204,255, 255], [  0,204,204, 255], [  0,204,153, 255], [  0,204,102, 255], [  0,204, 51, 255], [  0,204,  0, 255],
    [  0,153,255, 255], [  0,153,204, 255], [  0,153,153, 255], [  0,153,102, 255], [  0,153, 51, 255], [  0,153,  0, 255],
    [  0,102,255, 255], [  0,102,204, 255], [  0,102,153, 255], [  0,102,102, 255], [  0,102, 51, 255], [  0,102,  0, 255],
    [  0, 51,255, 255], [  0, 51,204, 255], [  0, 51,153, 255], [  0, 51,102, 255], [  0, 51, 51, 255], [  0, 51,  0, 255],
    [  0,  0,255, 255], [  0,  0,204, 255], [  0,  0,153, 255], [  0,  0,102, 255], [  0,  0, 51, 255],
    [238,0,0, 255], [221,0,0, 255], [187,0,0, 255], [170,0,0, 255], [136,0,0, 255],
     [119,0,0, 255], [ 85,0,0, 255], [ 68,0,0, 255], [ 34,0,0, 255], [ 17,0,0, 255],
    [0,238,0, 255], [0,221,0, 255], [0,187,0, 255], [0,170,0, 255], [0,136,0, 255],
     [0,119,0, 255], [0, 85,0, 255], [0, 68,0, 255], [0, 34,0, 255], [0, 17,0, 255],
    [0,0,238, 255], [0,0,221, 255], [0,0,187, 255], [0,0,170, 255], [0,0,136, 255],
     [0,0,119, 255], [0,0, 85, 255], [0,0, 68, 255], [0,0, 34, 255], [0,0, 17, 255],
    [238,238,238, 255], [221,221,221, 255], [187,187,187, 255], [170,170,170, 255], [136,136,136, 255],
     [119,119,119, 255], [ 85, 85, 85, 255], [ 68, 68, 68, 255], [ 34, 34, 34, 255], [ 17, 17, 17, 255],
    [0,0,0,255],
  ];
  
  function unpackBits(buffer, byteOffset, byteLength) {
    var packed = new Int8Array(buffer, byteOffset, byteLength);
    var pos = 0;
    var buf = [];
    while (pos < packed.length) {
      if (packed[pos] >= 0) {
        var length = packed[pos++] + 1;
        for (var i = 0; i < length; i++) {
          buf.push(packed[pos++]);
        }
      }
      else {
        if (packed[pos] > -128) {
          var count = 1 - packed[pos++];
          for (var i = 0; i < count; i++) {
            buf.push(packed[pos]);
          }
        }
        pos++;
    	}
    }
    return new Uint8Array(new Int8Array(buf).buffer, 0, buf.length);
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
              default:
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
          var tag;
          switch(tag = macintoshRoman(bytes, 0, 2)) {
            case 'BD':
              this.onhfs(bytes);
              break;
            case 'H+':
              this.onhfsplus(bytes);
              break;
            default:
              console.error('Unknown master directory block signature: ' + tag);
              break;
          }
        },
        onhfs: function(bytes) {
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
            allocationBlocks.blockSize * catalogExtents.offset + volumeInfo.catalogFileByteLength);
          catalogExtents.allocationBlocks = allocationBlocks;
          self.readCatalog(catalogExtents, {
            
          });
        },
        onhfsplus: function(bytes) {
          var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          var volumeInfo = {
            version: dv.getUint16(2, false),
            attributes: dv.getUint32(4, false),
            lastMountedVersion: macintoshRoman(bytes, 8, 4),
            journalInfoBlock: dv.getUint32(12, false),
            createdAt: macintoshDate(dv, 16),
            lastModifiedAt: macintoshDate(dv, 20),
            backupAt: macintoshDate(dv, 24),
            fileCount: dv.getUint32(28, false),
            folderCount: dv.getUint32(32, false),
            blockSize: dv.getUint32(36, false),
            totalBlocks: dv.getUint32(40, false),
            freeBlocks: dv.getUint32(44, false),
            nextAllocation: dv.getUint32(48, false),
            resourceClumpSize: dv.getUint32(52, false),
            dataClumpSize: dv.getUint32(56, false),
            nextCatalogId: dv.getUint32(60, false),
            writeCount: dv.getUint32(64, false),
            encodingsBitmap1: dv.getUint32(68, false),
            encodingsBitmap2: dv.getUint32(72, false),
            finderInfo: [
              dv.getInt32(76, false),
              dv.getInt32(80, false),
              dv.getInt32(84, false),
              dv.getInt32(88, false),
              dv.getInt32(92, false),
              dv.getInt32(96, false),
              dv.getInt32(100, false),
              dv.getInt32(104, false),
            ],
            allocationFile: hfsPlusForkData(dv, 108),
            extentsFile: hfsPlusForkData(dv, 108 + hfsPlusForkData.byteLength),
            catalogFile: hfsPlusForkData(dv, 108 + hfsPlusForkData.byteLength * 2),
            attributesFile: hfsPlusForkData(dv, 108 + hfsPlusForkData.byteLength * 3),
            startupFile: hfsPlusForkData(dv, 108 + hfsPlusForkData.byteLength * 4),
          };
        },
      });
    },
    readCatalog: function(byteSource, reader) {
      var self = this;
      var folders = {};
      var allocation = byteSource.allocationBlocks;
      this.readBTreeNode(byteSource.slice(0, BTREE_NODE_BYTES), {
        onheadernode: function(headerNode) {
          var rootNode = byteSource.slice(
            headerNode.rootNodeNumber * BTREE_NODE_BYTES,
            (headerNode.rootNodeNumber + 1) * BTREE_NODE_BYTES);
          self.readBTreeNode(rootNode, this);
        },
        onindexnode: function(indexNode) {
          for (var i = 0; i < indexNode.pointers.length; i++) {
            var pointer = indexNode.pointers[i];
            var pointedBytes = byteSource.slice(
              pointer.nodeNumber * BTREE_NODE_BYTES,
              (pointer.nodeNumber + 1) * BTREE_NODE_BYTES);
            self.readBTreeNode(pointedBytes, this);
          }
        },
        onfolderthread: function(threadInfo) {
        },
        onfolder: function(folderInfo) {
          var container = document.createElement('SECTION');
          if (folderInfo.isInvisible) {
            container.classList.add('invisible');
          }
          container.classList.add('folder');
          container.dataset.name = folderInfo.name;
          var title = document.createElement('HEADER');
          title.innerHTML = folderInfo.name;
          container.appendChild(title);
          var timestamp = folderInfo.modifiedAt || folderInfo.createdAt;
          if (timestamp) {
            container.dataset.lastModified = timestamp.toISOString();
          }
          if (folderInfo.id in folders) {
            container.appendChild(folders[folderInfo.id]);
          }
          else {
            var children = document.createElement('SECTION');
            children.classList.add('folder-children');
            container.appendChild(children);
            folders[folderInfo.id] = children;
          }
          if (folderInfo.parentDirectoryId === 1) {
            container.setAttribute('open', 'open');
            document.body.appendChild(container);
          }
          else if (folderInfo.parentDirectoryId in folders) {
            folders[folderInfo.parentDirectoryId].appendChild(container);
          }
          else {
            var siblings = document.createElement('SECTION');
            siblings.classList.add('folder-children');
            siblings.appendChild(container);
            folders[folderInfo.parentDirectoryId] = siblings;
          }
        },
        onfile: function(fileInfo) {
          var container = document.createElement('SECTION');
          if (fileInfo.isInvisible) {
            container.classList.add('invisible');
          }
          container.classList.add('file');
          container.dataset.name = fileInfo.name;
          if (fileInfo.type !== null) {
            container.dataset.macType = fileInfo.type;
          }
          if (fileInfo.creator !== null) {
            container.dataset.macCreator = fileInfo.creator;
          }
          var timestamp = fileInfo.modifiedAt || fileInfo.createdAt;
          if (timestamp) {
            container.dataset.lastModified = timestamp.toISOString();
          }
          var title = document.createElement('HEADER');
          if (fileInfo.dataFork.logicalEOF) {
            container.dataset.size = fileInfo.dataFork.logicalEOF;
            var dataFork = document.createElement('A');
            dataFork.setAttribute('href', '#');
            dataFork.classList.add('data-fork');
            dataFork.innerText = fileInfo.name;
            var extent = fileInfo.dataFork.firstExtentRecord[0];
            allocation.slice(
              allocation.blockSize * extent.offset,
              allocation.blockSize * extent.offset + fileInfo.dataFork.logicalEOF
            ).getURL().then(function(url) {
              dataFork.setAttribute('href', url);
              dataFork.setAttribute('download', fileInfo.name);
            });
            title.appendChild(dataFork);
          }
          else {
            title.appendChild(document.createTextNode(fileInfo.name));
          }
          container.appendChild(title);
          if (fileInfo.resourceFork.logicalEOF) {
            var extent = fileInfo.resourceFork.firstExtentRecord[0];
            self.readResourceFork(allocation.slice(
              allocation.blockSize * extent.offset,
              allocation.blockSize * extent.offset + fileInfo.resourceFork.logicalEOF
            ), {
              onresource: function(resource) {
                var resourceEl;
                if ('image' in resource) {
                  resourceEl = document.createElement('IMG');
                  resourceEl.width = resource.image.width;
                  resourceEl.height = resource.image.height;
                  if ('offsetX' in resource.image) {
                    resourceEl.dataset.offsetX = resource.image.offsetX;
                  }
                  if ('offsetY' in resource.image) {
                    resourceEl.dataset.offsetY = resource.image.offsetY;
                  }
                  resourceEl.src = resource.image.url;
                  if ('hotspot' in resource) {
                    resourceEl.style.cursor = 'url(' + resource.image.url + ') '
                      + resource.hotspot.x + ' ' + resource.hotspot.y + ', url(' + resource.image.url + '), auto';
                  }
                }
                else if ('text' in resource) {
                  resourceEl = document.createElement('SCRIPT');
                  resourceEl.setAttribute('type', 'text/plain');
                  resourceEl.appendChild(document.createTextNode(resource.text.replace(/\r/g, '\n')));
                }
                else if ('dataObject' in resource) {
                  resourceEl = document.createElement('SCRIPT');
                  resourceEl.setAttribute('type', 'application/json');
                  resourceEl.appendChild(document.createTextNode(JSON.stringify(resource.dataObject)));
                }
                else {
                  resourceEl = document.createElement('DIV');
                  resourceEl.dataset.size = resource.data.length;
                }
                resourceEl.classList.add('resource');
                if (resource.name !== null) {
                  resourceEl.dataset.name = resource.name;
                }
                resourceEl.dataset.type = resource.type;
                resourceEl.dataset.id = resource.id;
                container.appendChild(resourceEl);
              }
            });
          }
          if (fileInfo.parentDirectoryId === 1) {
            document.body.appendChild(container);
          }
          else if (fileInfo.parentDirectoryId in folders) {
            folders[fileInfo.parentDirectoryId].appendChild(container);
          }
          else {
            var siblings = document.createElement('SECTION');
            siblings.classList.add('folder-children');
            siblings.appendChild(container);
            folders[fileInfo.parentDirectoryId] = siblings;
          }
        },
      });
    },
    readResourceFork: function(byteSource, reader) {
      byteSource.read({
        onbytes: function(bytes) {
          var dv = new DataView(bytes.buffer, bytes.byteOffet, bytes.byteLength);
          var dataOffset = dv.getUint32(0, false);
          var mapDV = new DataView(bytes.buffer, bytes.byteOffset + dv.getUint32(4, false), dv.getUint32(12, false));
          var attributes = mapDV.getUint16(22, false);
          var isReadOnly = !!(attributes & 0x80);
          var typeListOffset = mapDV.getUint16(24, false);
          var nameListOffset = mapDV.getUint16(26, false);
          var typeCount = mapDV.getInt16(typeListOffset, false) + 1;
          var resources = [];
          for (var i = 0; i < typeCount; i++) {
            var resourceTypeName = macintoshRoman(
              new Uint8Array(mapDV.buffer, mapDV.byteOffset + typeListOffset + 2 + (i * 8), 4),
              0, 4);
            var resourceCount = mapDV.getInt16(typeListOffset + 2 + (i * 8) + 4, false) + 1;
            var referenceListOffset = mapDV.getUint16(typeListOffset + 2 + (i * 8) + 4 + 2, false);
            var referenceListDV = new DataView(
              mapDV.buffer,
              mapDV.byteOffset + typeListOffset + referenceListOffset,
              resourceCount * 12);
            for (var j = 0; j < resourceCount; j++) {
              var resourceID = referenceListDV.getUint16(j * 12, false);
              var resourceNameOffset = referenceListDV.getInt16(j * 12 + 2, false);
              var resourceAttributes = referenceListDV.getUint8(j * 12 + 4, false);
              var resourceDataOffset = referenceListDV.getUint32(j * 12 + 4, false) & 0xffffff;
              var resourceName;
              if (resourceNameOffset === -1) {
                resourceName = null;
              }
              else {
                resourceNameOffset += nameListOffset;
                resourceName = new Uint8Array(
                  mapDV.buffer,
                  mapDV.byteOffset + resourceNameOffset + 1,
                  mapDV.getUint8(resourceNameOffset));
                resourceName = macintoshRoman(resourceName, 0, resourceName.length);
              }
              resourceDataOffset += dataOffset;
              var data = bytes.subarray(
                resourceDataOffset + 4,
                resourceDataOffset + 4 + dv.getUint32(resourceDataOffset, false));
              var resource = {
                name: resourceName,
                type: resourceTypeName,
                id: resourceID,
                data: data,
              };
              if (resourceAttributes & 0x40) resource.loadInSystemHeap = true; // instead of application heap
              if (resourceAttributes & 0x20) resource.mayBePagedOutOfMemory = true;
              if (resourceAttributes & 0x10) resource.doNotMoveInMemory = true;
              if (resourceAttributes & 0x08) resource.isReadOnly = true;
              if (resourceAttributes & 0x04) resource.preload = true;
              if (resourceAttributes & 0x01) resource.compressed = true;
              switch (resource.type) {
                case 'STR ':
                  resource.text = macintoshRoman(resource.data, 0, resource.data.length);
                  break;
                case 'STR#':
                  var strcount = new DataView(resource.data.buffer, resource.data.byteOffset, 2).getInt16(0, false);
                  if (strcount < 0) {
                    console.log(strcount, resource.data);
                    break;
                  }
                  var list = [];
                  var pos = 2;
                  for (var istr = 0; istr < strcount; istr++) {
                    var len = resource.data[pos++];
                    list.push(macintoshRoman(resource.data, pos, len));
                    pos += len;
                  }
                  resource.dataObject = list;
                  break;
                case 'CURS':
                  if (resource.data.length !== 68) {
                    console.error('CURS resource expected to be 68 bytes, got ' + resource.data.length);
                    break;
                  }
                  var img = document.createElement('CANVAS');
                  img.width = 16;
                  img.height = 16;
                  var ctx = img.getContext('2d');
                  var pix = ctx.createImageData(16, 16);
                  for (var ibyte = 0; ibyte < 32; ibyte++) {
                    var databyte = resource.data[ibyte], maskbyte = resource.data[32 + ibyte];
                    for (var ibit = 0; ibit < 8; ibit++) {
                      var imask = 0x80 >> ibit;
                      if (maskbyte & imask) {
                        pix.data.set(databyte & imask ? PIXEL1 : PIXEL0, (ibyte*8 + ibit) * 4);
                      }
                    }
                  }
                  ctx.putImageData(pix, 0, 0);
                  resource.image = {url: img.toDataURL(), width:16, height:16};
                  var hotspotDV = new DataView(resource.data.buffer, resource.data.byteOffset + 64, 8);
                  resource.hotspot = {y:hotspotDV.getInt16(0), x:hotspotDV.getInt16(2)};
                  break;
                case 'ICON':
                  if (resource.data.length !== 128) {
                    console.error('ICON resource expected to be 128 bytes, got ' + resource.data.length);
                    break;
                  }
                  var img = document.createElement('CANVAS');
                  img.width = 32;
                  img.height = 32;
                  var ctx = img.getContext('2d');
                  var pix = ctx.createImageData(32, 32);
                  for (var ibyte = 0; ibyte < 128; ibyte++) {
                    var databyte = resource.data[ibyte];
                    for (var ibit = 0; ibit < 8; ibit++) {
                      var imask = 0x80 >> ibit;
                      pix.data.set(databyte & imask ? PIXEL1 : PIXEL0, (ibyte*8 + ibit) * 4);
                    }
                  }
                  ctx.putImageData(pix, 0, 0);
                  resource.image = {url: img.toDataURL(), width:32, height:32};
                  break;
                case 'ICN#':
                  if (resource.data.length !== 256) {
                    console.error('ICN# resource expected to be 256 bytes, got ' + resource.data.length);
                    break;
                  }
                  var img = document.createElement('CANVAS');
                  img.width = 32;
                  img.height = 32;
                  var ctx = img.getContext('2d');
                  var pix = ctx.createImageData(32, 32);
                  for (var ibyte = 0; ibyte < 128; ibyte++) {
                    var databyte = resource.data[ibyte], maskbyte = resource.data[128 + ibyte];
                    for (var ibit = 0; ibit < 8; ibit++) {
                      var imask = 0x80 >> ibit;
                      if (maskbyte & imask) {
                        pix.data.set(databyte & imask ? PIXEL1 : PIXEL0, (ibyte*8 + ibit) * 4);
                      }
                    }
                  }
                  ctx.putImageData(pix, 0, 0);
                  resource.image = {url: img.toDataURL(), width:32, height:32};
                  break;
                case 'ics#':
                  if (resource.data.length !== 64) {
                    console.error('ics# resource expected to be 64 bytes, got ' + resource.data.length);
                    break;
                  }
                  var img = document.createElement('CANVAS');
                  img.width = 16;
                  img.height = 16;
                  var ctx = img.getContext('2d');
                  var pix = ctx.createImageData(16, 16);
                  for (var ibyte = 0; ibyte < 32; ibyte++) {
                    var databyte = resource.data[ibyte], maskbyte = resource.data[32 + ibyte];
                    for (var ibit = 0; ibit < 8; ibit++) {
                      var imask = 0x80 >> ibit;
                      if (maskbyte & imask) {
                        pix.data.set(databyte & imask ? PIXEL1 : PIXEL0, (ibyte*8 + ibit) * 4);
                      }
                    }
                  }
                  ctx.putImageData(pix, 0, 0);
                  resource.image = {url: img.toDataURL(), width:16, height:16};
                  break;
                case 'icl8':
                  if (resource.data.length !== 1024) {
                    console.error('icl8 resource expected to be 1024 bytes, got ' + resource.data.length);
                    break;
                  }
                  var img = document.createElement('CANVAS');
                  img.width = 32;
                  img.height = 32;
                  var ctx = img.getContext('2d');
                  var pix = ctx.createImageData(32, 32);
                  for (var ibyte = 0; ibyte < 1024; ibyte++) {
                    pix.data.set(mac8BitSystemPalette[resource.data[ibyte]], ibyte*4);
                  }
                  ctx.putImageData(pix, 0, 0);
                  resource.image = {url: img.toDataURL(), width:32, height:32};
                  break;
                case 'ics8':
                  if (resource.data.length !== 256) {
                    console.error('ics8 resource expected to be 256 bytes, got ' + resource.data.length);
                    break;
                  }
                  var img = document.createElement('CANVAS');
                  img.width = 16;
                  img.height = 16;
                  var ctx = img.getContext('2d');
                  var pix = ctx.createImageData(16, 16);
                  for (var ibyte = 0; ibyte < 256; ibyte++) {
                    pix.data.set(mac8BitSystemPalette[resource.data[ibyte]], ibyte*4);
                  }
                  ctx.putImageData(pix, 0, 0);
                  resource.image = {url: img.toDataURL(), width:16, height:16};
                  break;
                case 'icl4':
                  if (resource.data.length !== 512) {
                    console.error('icl4 resource expected to be 512 bytes, got ' + resource.data.length);
                    break;
                  }
                  var img = document.createElement('CANVAS');
                  img.width = 32;
                  img.height = 32;
                  var ctx = img.getContext('2d');
                  var pix = ctx.createImageData(32, 32);
                  for (var ibyte = 0; ibyte < 512; ibyte++) {
                    pix.data.set(mac4BitSystemPalette[resource.data[ibyte] >> 4], ibyte*8);
                    pix.data.set(mac4BitSystemPalette[resource.data[ibyte] & 15], ibyte*8 + 4);
                  }
                  ctx.putImageData(pix, 0, 0);
                  resource.image = {url: img.toDataURL(), width:32, height:32};
                  break;
                case 'ics4':
                  if (resource.data.length !== 128) {
                    console.error('ics4 resource expected to be 128 bytes, got ' + resource.data.length);
                    break;
                  }
                  var img = document.createElement('CANVAS');
                  img.width = 16;
                  img.height = 16;
                  var ctx = img.getContext('2d');
                  var pix = ctx.createImageData(16, 16);
                  for (var ibyte = 0; ibyte < 128; ibyte++) {
                    pix.data.set(mac4BitSystemPalette[resource.data[ibyte] >> 4], ibyte*8);
                    pix.data.set(mac4BitSystemPalette[resource.data[ibyte] & 15], ibyte*8 + 4);
                  }
                  ctx.putImageData(pix, 0, 0);
                  resource.image = {url: img.toDataURL(), width:16, height:16};
                  break;
                case 'BITD':
                  resource.getUnpackedData = function() {
                    return unpackBits(this.data.buffer, this.data.byteOffset, this.data.byteLength);
                  };
                  break;
                case 'FREF':
                  if (resource.data.length !== 7) {
                    console.error('FREF resource expected to be 7 bytes, got ' + resource.data.length);
                    break;
                  }
                  resource.dataObject = {
                    fileType: macintoshRoman(resource.data, 0, 4),
                    iconListID: (resource.data[4] << 8) | resource.data[5],
                  };
                  break;
                case 'WIND':
                  var dataDV = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
                  resource.dataObject = {
                    initialRectangle: {
                      top: dataDV.getInt16(0, false),
                      left: dataDV.getInt16(2, false),
                      bottom: dataDV.getInt16(4, false),
                      right: dataDV.getInt16(6, false),
                    },
                    definitionID: dataDV.getInt16(8, false),
                    visible: dataDV.getInt16(10, false),
                    closeBox: dataDV.getInt16(12, false),
                    referenceConstant: dataDV.getInt32(14, false),
                  };
                  resource.dataObject.title = macintoshRoman(resource.data, 19, resource.data[18]);
                  var pos = 19 + resource.data[18];
                  if (pos+2 <= resource.data.length) {
                    resource.dataObject.positioning = dataDV.getInt16(pos);
                  }
                  break;
                case 'vers':
                  resource.dataObject = {
                    major: resource.data[0],
                    minor: resource.data[1],
                    developmentStage: (function(v) {
                      switch(v) {
                        case 0x20: return 'development';
                        case 0x40: return 'alpha';
                        case 0x60: return 'beta';
                        case 0x80: return 'release';
                        default: return v;
                      }
                    })(resource.data[2]),
                    prereleaseRevisionLevel: resource.data[3],
                    regionCode: (resource.data[4] << 8) | resource.data[5],
                  };
                  resource.dataObject.versionNumber = macintoshRoman(resource.data, 7, resource.data[6]);
                  var pos = 7 + resource.data[6];
                  resource.dataObject.versionMessage = macintoshRoman(resource.data, pos + 1, resource.data[pos]);
                  break;
                case 'STXT':
                  var dataDV = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
            			var textPos = dataDV.getUint32(0, false);
            			var textLen = dataDV.getUint32(4, false);
            			var num3 = dataDV.getUint32(8, false); // TODO: what is this
            			resource.text = macintoshRoman(resource.data, textPos, textLen);
                  break;
                case 'PICT':
                  var pictDV = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
                  var fileSizeBytes = pictDV.getUint16(0, false);
                  var top = pictDV.getInt16(2, false);
                  var left = pictDV.getInt16(4, false);
                  var bottom = pictDV.getInt16(6, false);
                  var right = pictDV.getInt16(8, false);
                  var canvas = document.createElement('CANVAS');
                  canvas.width = right - left;
                  canvas.height = bottom - top;
                  var ctx = canvas.getContext('2d');
                  var fontFamily = 'sans-serif';
                  if (resource.data[10] === 0x11 && resource.data[11] === 0x01) {
                    // version 1
                    console.log('PICTv1', left, top, right, bottom);
                    function region() {
                      var len = pictDV.getUint16(pictPos);
                      var region = {
                        left: pictDV.getInt16(pictPos + 2),
                        top: pictDV.getInt16(pictPos + 4),
                        right: pictDV.getInt16(pictPos + 6),
                        bottom: pictDV.getInt16(pictPos + 8),
                      };
                      if (len > 10) {
                        region.extra = resource.data.subarray(pictPos + 10, pictPos + len);
                      }
                      pictPos += len;
                      return region;
                    }
                    var currentX = 0, currentY = 0;
                    pictV1loop:
                    for (var pictPos = 12; resource.data[pictPos] !== 0xff; ) {
                      switch(resource.data[pictPos++]) {
                        case 0x00: break; // no-op
                        case 0x01: // clipping region
                          var clipRegion = region();
                          console.log('clip', clipRegion);
                          break;
                        case 0x02: // background pattern
                          pictPos += 8;
                          break;
                        case 0x03: // font number for text
                          pictPos += 2;
                          break;
                        case 0x04: // text font style
                          pictPos += 1;
                          break;
                        case 0x05: // source mode
                          pictPos += 2;
                          break;
                        case 0x06: // extra space
                          pictPos += 4;
                          break;
                        case 0x07: // pen size
                          pictPos += 4;
                          break;
                        case 0x08: // pen mode
                          pictPos += 2;
                          break;
                        case 0x09: // pen pattern
                          pictPos += 8;
                          break;
                        case 0x0A: // fill pattern
                          pictPos += 8;
                          break;
                        case 0x0B: // oval size
                          pictPos += 4;
                          break;
                        case 0x0C: // origin
                          currentY = pictDV.getInt16(pictPos);
                          currentX = pictDV.getInt16(pictPos + 2);
                          pictPos += 4;
                          break;
                        case 0x0D: // text size
                          ctx.font = fontFamily + ' ' + pictDV.getUint16(pictPos) + 'px';
                          pictPos += 2;
                          break;
                        case 0x0E: // foreground color
                          pictPos += 4;
                          break;
                        case 0x0F: // background color
                          pictPos += 4;
                          break;
                        case 0x10: // txratio
                          pictPos += 8;
                          break;
                        case 0x11: // version
                          pictPos += 1;
                          break;
                        case 0x20: // line
                          pictPos += 8;
                          break;
                        case 0x21: // line from
                          pictPos += 4;
                          break;
                        case 0x22: // short line
                          pictPos += 6;
                          break;
                        case 0x23: // short line from
                          pictPos += 2;
                          break;
                        case 0x28: // long text
                          var y = pictDV.getInt16(pictPos, false);
                          var x = pictDV.getInt16(pictPos + 2, false);
                          pictPos += 4;
                          var text = macintoshRoman(resource.data, pictPos+1, resource.data[pictPos]);
                          pictPos += 1 + text.length;
                          currentX = x;
                          currentY = y;
                          ctx.fillText(text, currentX, currentY);
                          break;
                        case 0x29: // DHtext
                          var x = resource.data[pictPos++];
                          var text = macintoshRoman(resource.data, pictPos+1, resource.data[pictPos]);
                          pictPos += 1 + text.length;
                          currentX += x;
                          ctx.fillText(text, currentX, currentY);
                          break;
                        case 0x2A: // DVtext
                          var y = resource.data[pictPos++];
                          var text = macintoshRoman(resource.data, pictPos+1, resource.data[pictPos]);
                          pictPos += 1 + text.length;
                          currentY += y;
                          ctx.fillText(text, currentX, currentY);
                          break;
                        case 0x2B: // DHDVtext
                          var x = resource.data[pictPos++];
                          var y = resource.data[pictPos++];
                          var text = macintoshRoman(resource.data, pictPos+1, resource.data[pictPos]);
                          pictPos += 1 + text.length;
                          currentX += x;
                          currentY += y;
                          ctx.fillText(text, currentX, currentY);
                          break;
                        case 0x30: // frame rect
                          pictPos += 8;
                          break;
                        case 0x31: // paint rect
                          pictPos += 8;
                          break;
                        case 0x32: // erase rect
                          pictPos += 8;
                          break;
                        case 0x33: // invert rect
                          pictPos += 8;
                          break;
                        case 0x34: // fill rect
                          pictPos += 8;
                          break;
                        case 0x38: // frame same rect
                          break;
                        case 0x39: // paint same rect
                          break;
                        case 0x3A: // erase same rect
                          break;
                        case 0x3B: // invert same rect
                          break;
                        case 0x3C: // fill same rect
                          break;
                          
                        case 0x40: // frame rrect
                          pictPos += 8;
                          break;
                        case 0x41: // paint rrect
                          pictPos += 8;
                          break;
                        case 0x42: // erase rrect
                          pictPos += 8;
                          break;
                        case 0x43: // invert rrect
                          pictPos += 8;
                          break;
                        case 0x44: // fill rrect
                          pictPos += 8;
                          break;
                        case 0x48: // frame same rrect
                          break;
                        case 0x49: // paint same rrect
                          break;
                        case 0x4A: // erase same rrect
                          break;
                        case 0x4B: // invert same rrect
                          break;
                        case 0x4C: // fill same rrect
                          break;
                          
                        case 0x50: // frame oval
                          pictPos += 8;
                          break;
                        case 0x51: // paint oval
                          pictPos += 8;
                          break;
                        case 0x52: // erase oval
                          pictPos += 8;
                          break;
                        case 0x53: // invert oval
                          pictPos += 8;
                          break;
                        case 0x54: // fill oval
                          pictPos += 8;
                          break;
                        case 0x58: // frame same oval
                          break;
                        case 0x59: // paint same oval
                          break;
                        case 0x5A: // erase same oval
                          break;
                        case 0x5B: // invert same oval
                          break;
                        case 0x5C: // fill same oval
                          break;
                          
                        case 0x60: // frame arc
                          pictPos += 12;
                          break;
                        case 0x61: // paint arc
                          pictPos += 12;
                          break;
                        case 0x62: // erase arc
                          pictPos += 12;
                          break;
                        case 0x63: // invert arc
                          pictPos += 12;
                          break;
                        case 0x64: // fill arc
                          pictPos += 12;
                          break;
                        case 0x68: // frame same arc
                          pictPos += 4;
                          break;
                        case 0x69: // paint same arc
                          pictPos += 4;
                          break;
                        case 0x6A: // erase same arc
                          pictPos += 4;
                          break;
                        case 0x6B: // invert same arc
                          pictPos += 4;
                          break;
                        case 0x6C: // fill same arc
                          pictPos += 4;
                          break;
                          
                        // case 0x70: // frame poly
                        // case 0x71: // paint poly
                        // case 0x72: // erase poly
                        // case 0x73: // invert poly
                        // case 0x74: // fill poly
                        case 0x78: // frame same poly
                          break;
                        case 0x79: // paint same poly
                          break;
                        case 0x7A: // erase same poly
                          break;
                        case 0x7B: // invert same poly
                          break;
                        case 0x7C: // fill same poly
                          break;
                        
                        case 0x80: // frame region
                          var frameRegion = region();
                          console.log('frame', frameRegion);
                          break;
                        case 0x81: // paint region
                          var paintRegion = region();
                          console.log('paint', paintRegion);
                          break;
                        case 0x82: // erase region
                          var eraseRegion = region();
                          console.log('erase', eraseRegion);
                          break;
                        case 0x83: // invert region
                          var invertRegion = region();
                          console.log('invert', invertRegion);
                          break;
                        case 0x84: // fill region
                          var fillRegion = region();
                          console.log('fill', fillRegion);
                          break;
                        case 0x88: // frame same region
                          break;
                        case 0x89: // paint same region
                          break;
                        case 0x8A: // erase same region
                          break;
                        case 0x8B: // invert same region
                          break;
                        case 0x8C: // fill same region
                          break;
                        
                        //case 0x90: // copy bits to clipped rect
                        //case 0x91: // copy bits to clipped region
                        //case 0x98: // copy packed bits to clipped rect
                        //case 0x99: // copy packed bits to clipped region
                        
                        case 0xA0: // short comment
                          var kind = pictDV.getUint16(pictPos, false);
                          console.log('comment', kind);
                          pictPos += 2;
                          break;
                        case 0xA1: // long comment
                          var kind = pictDV.getUint16(pictPos, false);
                          var len = pictDV.getUint16(pictPos + 2, false);
                          var commentData = resource.data.subarray(pictPos + 4, pictPos + 4 + len);
                          console.log('comment', kind, commentData);
                          pictPos += 4 + len;
                          break;
                        
                        //case 0xFF: // end of picture (checked by outer loop)
                        
                        default:
                          console.error('unhandled PICTv1 opcode: 0x' + resource.data[pictPos - 1].toString(16));
                          break pictV1loop;
                      }
                    }
                  }
                  else if (resource.data[10] === 0x00 && resource.data[11] === 0x11
                      && resource.data[12] === 0x02 && resource.data[13] === 0xff) {
                    // version 2
                    console.log('PICTv2', left, top, right, bottom);
                  }
                  else {
                    console.error('unknown PICT format version');
                    break;
                  }
                  resource.image = {width:right - left, height:bottom-top, url:canvas.toDataURL()};
                  if (left) resource.image.offsetX = left;
                  if (top) resource.image.offsetY = top;
                  break;
              }
              if (typeof reader.onresource === 'function') {
                reader.onresource(resource);
              }
            }
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
                var parentDirectoryId = dv.getUint32(2, false);
                var name = macintoshRoman(record, 7, record[6]);
                var offset = 1 + keyLength;
                offset = offset + (offset % 2);
                record = record.subarray(offset);
                dv = new DataView(record.buffer, record.byteOffset, record.byteLength);
                switch(record[0]) {
                  case 1: // folder
                    var folderInfo = {
                      name: name,
                      id: dv.getUint32(6, false),
                      modifiedAt: macintoshDate(dv, 14),
                      location: {
                        v: dv.getInt16(32, false),
                        h: dv.getInt16(34, false),
                      },
                      window: {
                        top: dv.getInt16(22, false),
                        left: dv.getInt16(24, false),
                        bottom: dv.getInt16(26, false),
                        right: dv.getInt16(28, false),
                        scroll: {
                          v: dv.getInt16(38, false),
                          h: dv.getInt16(40, false),
                        },
                      },
                      parentDirectoryId: parentDirectoryId,
                      // dinfoReserved: dv.getInt16(36, false),
                      // dxinfoReserved: dv.getInt32(42, false),
                      dxinfoFlags: dv.getUint16(46, false),
                      dxinfoComment: dv.getUint16(48, false),
                      fileCount: dv.getUint16(4, false),
                      createdAt: macintoshDate(dv, 10),
                      backupAt: macintoshDate(dv, 18),
                      putAwayFolderID: dv.getInt32(50, false),
                      flags: dv.getUint16(2, false),
                    };
                    if (!folderInfo.flags) delete folderInfo.flags;
                    var dinfoFlags = dv.getUint16(30, false);
                    if (dinfoFlags & 0x0001) folderInfo.isOnDesk = true;
                    if (dinfoFlags & 0x000E) folderInfo.color = true;
                    if (dinfoFlags & 0x0020) folderInfo.requireSwitchLaunch = true;
                    if (dinfoFlags & 0x0400) folderInfo.hasCustomIcon = true;
                    if (dinfoFlags & 0x1000) folderInfo.nameLocked = true;
                    if (dinfoFlags & 0x2000) folderInfo.hasBundle = true;
                    if (dinfoFlags & 0x4000) folderInfo.isInvisible = true;
                    if (typeof reader.onfolder === 'function') {
                      reader.onfolder(folderInfo);
                    }
                    break;
                  case 2: // file
                    var fileInfo = {
                      name: name,
                      creator: macintoshRoman(record, 8, 4),
                      type: macintoshRoman(record, 4, 4),
                      id: dv.getUint32(20, false),
                      parentDirectoryId: parentDirectoryId,
                      // type: record[3], /* always zero */
                      position: {v:dv.getInt16(14, false), h:dv.getInt16(16, false)},
                      // finfoReserved: dv.getInt16(18, false),
                      dataFork: {
                        firstAllocationBlock: dv.getUint16(24, false),
                        logicalEOF: dv.getUint32(26, false),
                        physicalEOF: dv.getUint32(30, false),
                        firstExtentRecord: extentDataRecord(dv, 74),
                      },
                      resourceFork: {
                        firstAllocationBlock: dv.getUint16(34, false),
                        logicalEOF: dv.getUint32(36, false),
                        physicalEOF: dv.getUint32(40, false),
                        firstExtentRecord: extentDataRecord(dv, 86),
                      },
                      createdAt: macintoshDate(dv, 44),
                      modifiedAt: macintoshDate(dv, 48),
                      backupAt: macintoshDate(dv, 52),
                      // fxinfoReserved: (8 bytes)
                      fxinfoFlags: dv.getUint16(64, false),
                      putAwayFolderID: dv.getUint32(68, false),
                      clumpSize: dv.getUint16(72),
                    };
                    if (fileInfo.creator === '\0\0\0\0') fileInfo.creator = null;
                    if (fileInfo.type === '\0\0\0\0') fileInfo.type = null;
                    if (!(fileInfo.position.v || fileInfo.position.h)) fileInfo.position = 'default';
                    if (record[2] & 0x01) fileInfo.locked = true;
                    if (record[2] & 0x02) fileInfo.hasThreadRecord = true;
                    if (record[2] & 0x80) fileInfo.recordUsed = true;
                    var finfoFlags = dv.getUint16(12, false);
                    if (finfoFlags & 0x0001) fileInfo.isOnDesk = true;
                    if (finfoFlags & 0x000E) fileInfo.color = true;
                    if (finfoFlags & 0x0020) fileInfo.requireSwitchLaunch = true;
                    if (finfoFlags & 0x0040) fileInfo.isShared = true;
                    if (finfoFlags & 0x0080) fileInfo.hasNoINITs = true;
                    if (finfoFlags & 0x0100) fileInfo.hasBeenInited = true;
                    if (finfoFlags & 0x0400) fileInfo.hasCustomIcon = true;
                    if (finfoFlags & 0x0800) fileInfo.isStationery = true;
                    if (finfoFlags & 0x1000) fileInfo.nameLocked = true;
                    if (finfoFlags & 0x2000) fileInfo.hasBundle = true;
                    if (finfoFlags & 0x4000) fileInfo.isInvisible = true;
                    if (finfoFlags & 0x8000) fileInfo.isAlias = true;
                    if (typeof reader.onfile === 'function') {
                      reader.onfile(fileInfo);
                    }
                    break;
                  case 3: // folder thread
                  case 4: // file thread
                    var threadInfo = {
                      parentDirectoryId: parentDirectoryId,
                      parentFolderID: dv.getUint32(10, false),
                      parentFolderName: macintoshRoman(record, 15, record[14]),
                    };
                    if (record[0] === 3) {
                      if (typeof reader.onfolderthread === 'function') {
                        reader.onfolderthread(threadInfo);
                      }
                    }
                    else {
                      if (typeof reader.onfilethread === 'function') {
                        reader.onfilethread(threadInfo);
                      }
                    }
                    break;
                  default:
                    console.error('unknown folder record type: ' + dv.getUint8(0));
                    break;
                }
              }
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
