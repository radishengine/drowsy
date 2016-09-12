define(['mac/roman', 'mac/date'], function(macRoman, macDate) {

  'use strict';

  function VolumeHeaderView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  VolumeHeaderView.prototype = {
    toJSON: function() {
      return {
        version: this.version,
        attributes: this.attributes,
        lastMountedVersion: this.lastMountedVersion,
        journalInfoBlock: this.journalInfoBlock,
        createdAt: this.createdAt,
        lastModifiedAt: this.lastModifiedAt,
        backupAt: this.backupAt,
        fileCount: this.fileCount,
        folderCount: this.folderCount,
        blockSize: this.blockSize,
        totalBlocks: this.totalBlocks,
        freeBlocks: this.freeBlocks,
        nextAllocation: this.nextAllocation,
        resourceClumpSize: this.resourceClumpSize,
        dataClumpSize: this.dataClumpSize,
        nextCatalogID: this.nextCatalogID,
        writeCount: this.writeCount,
        encodingsBitmap1: this.encodingsBitmap1,
        encodingsBitmap2: this.ecnodingsBitmap2,
        finderInfo: this.finderInfo,
        allocationFile: this.allocationFile,
        extentsFile: this.extentsFile,
        catalogFile: this.catalogFile,
        attributesFile: this.attributesFile,
        startupFile: this.startupFile,
      };
    },
    get version() {
      return this.dataView.getUint16(2, false);
    },
    get attributes() {
      return this.dataView.getUint32(4, false);
    },
    get lastMountedVersion() {
      return macRoman(this.bytes, 8, 4);
    },
    get journalInfoBlock() {
      return this.dataView.getUint32(12, false);
    },
    get createdAt() {
      return macDate(this.dataView, 16);
    },
    get lastModifiedAt() {
      return macDate(this.dataView, 20);
    },
    get backupAt() {
      return macDate(this.dataView, 24);
    },
    get fileCount() {
      return this.dataView.getUint32(28, false);
    },
    get folderCount() {
      return this.dataView.getUint32(32, false);
    },
    get blockSize() {
      return this.dataView.getUint32(36, false);
    },
    get totalBlocks() {
      return this.dataView.getUint32(40, false);
    },
    get freeBlocks() {
      return this.dataView.getUint32(44, false);
    },
    get nextAllocation() {
      return this.dataView.getUint32(48, false);
    },
    get resourceClumpSize() {
      return this.dataView.getUint32(52, false);
    },
    get dataClumpSize() {
      return this.dataView.getUint32(56, false);
    },
    get nextCatalogID() {
      return this.dataView.getUint32(60, false);
    },
    get writeCount() {
      return this.dataView.getUint32(64, false);
    },
    get encodingsBitmap1() {
      return this.dataView.getUint32(68, false);
    },
    get encodingsBitmap2() {
      return this.dataView.getUint32(72, false);
    },
    get finderInfo() {
      return [
        this.dataView.getInt32(76, false),
        this.dataView.getInt32(80, false),
        this.dataView.getInt32(84, false),
        this.dataView.getInt32(88, false),
        this.dataView.getInt32(92, false),
        this.dataView.getInt32(96, false),
        this.dataView.getInt32(100, false),
        this.dataView.getInt32(104, false),
      ];
    },
    get files() {
      var files = new Array(5);
      var buffer = this.dataView.buffer, byteOffset = this.dataView.byteOffset + 108;
      for (var i = 0; i < files.length; i++) {
        files[i] = new ForkDataView(buffer, byteOffset, ForkDataView.byteLength);
        byteOffset += ForkDataView.byteLength;
      }
      Object.defineProperty(this, 'files', {value:files});
      return files;
    },
    get allocationFile() {
      return this.files[0];
    },
    get extentsFile() {
      return this.files[1];
    },
    get catalogFile() {
      return this.files[2];
    },
    get attributesFile() {
      return this.files[3];
    },
    get startupFile() {
      return this.files[4];
    },
  };
  
  function ForkDataView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  ForkDataView.prototype = {
    get logicalSize1() {
      return this.dataView.getUint32(0, false);
    },
    get logicalSize2() {
      return this.dataView.getUint32(4, false);
    },
    get clumpSize() {
      return this.dataView.getUint32(8, false);
    },
    get totalBlocks() {
      return this.dataView.getUint32(12, false);
    },
    get extents() {
      var extents = new Array(8);
      for (var i = 0; i < extents.length; i++) {
        extents[i] = {
          startBlock: this.dataView.getUint32(16 + (i * 8), false),
          blockCount: this.dataView.getUint32(16 + (i * 8) + 4, false),
        };
      }
      Object.defineProperty(this, 'extents', {value:extents});
      return extents;
    },
  };
  ForkDataView.byteLength = 8 + 4 + 4 + (8 * (4 + 4));
  
  return VolumeHeaderView;

});
