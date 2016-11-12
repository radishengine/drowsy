define(function() {

  'use strict';
  
  function BootSectorDisambiguatorView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  BootSectorDisambiguatorView.prototype = {
    get hasValidSignature() {
      switch (this.bytes[0]) {
        case 0xEB: return this.bytes[2] === 0x90;
        case 0xE9: return true;
        default: return false;
      }
    },
    get sectorByteLength() {
      return this.dv.getUint16(11, true);
    },
    get sectorsPerCluster() {
      return this.bytes[13];
    },
    get reservedSectorCount() {
      return this.dv.getUint16(14, true);
    },
    get fatStructureCount() {
      return this.bytes[16];
    },
    get rootFolderRecordCount() {
      return this.dv.getUint16(17, true);
    },
    get rootFolderSectorCount() {
      return Math.ceil((this.rootFolderRecordCount * 32) / this.sectorByteLength);
    },
    get sectorCount() {
      return this.dv.getUint16(19, true) || this.dv.getUint32(32, true);
    },
    get sectorsPerFatStructure() {
      return this.dv.getUint16(22, true) || this.dv.getUint32(36, true);
    },
    get dataSectorCount() {
      return this.sectorCount
        - this.reservedSectorCount
        - this.fatStructureCount * this.sectorsPerFatStructure
        - this.rootFolderSectorCount;
    },
    get clusterCount() {
      return Math.floor(this.dataSectorCount / this.sectorsPerCluster);
    },
    get fatType() {
      var clusters = this.clusterCount;
      if (clusters < 4085) return 'fat12';
      if (clusters < 65525) return 'fat16';
      return 'fat32';
    },
  };
  BootSectorDisambiguatorView.byteLength = 40;
  
  function BootSectorView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  BootSectorView.prototype = {
    get hasValidSignature() {
      switch (this.bytes[0]) {
        case 0xEB: return this.bytes[2] === 0x90;
        case 0xE9: return true;
        default: return false;
      }
    },
    get formattedBySystemName() {
      return String.fromCharCode.apply(null, this.bytes.subarray(3, 12)).replace(/\s*(?:\0.*)$/, '');
    },
    get sectorByteLength() {
      return this.dv.getUint16(11, true);
    },
    get sectorsPerCluster() {
      return this.bytes[13];
    },
    get reservedSectorCount() {
      return this.dv.getUint16(14, true);
    },
    get fatStructureCount() {
      return this.bytes[16];
    },
    get rootFolderRecordCount() {
      return this.dv.getUint16(17, true);
    },
    get rootFolderSectorCount() {
      return Math.ceil((this.rootFolderRecordCount * 32) / this.sectorByteLength);
    },
    get sectorCount() {
      return this.dv.getUint16(19, true) || this.dv.getUint32(32, true);
    },
    get mediaType() {
      return this.bytes[21];
      // 0xF8: fixed/non-removable
      // 0xF0: removable
      // other valid values: 0xF9-0xFF
      // same as low byte of FAT[0]
    },
    get sectorsPerFatStructure() {
      return this.dv.getUint16(22, true) || this.dv.getUint32(36, true);
    },
    get sectorsPerTrack() {
      return this.dv.getUint16(24, true);
    },
    get headCount() {
      return this.dv.getUint16(26, true);
    },
    get hiddenSectorCount() {
      return this.dv.getUint32(28, true);
    },
    get dataSectorCount() {
      return this.sectorCount
        - this.reservedSectorCount
        - this.fatStructureCount * this.sectorsPerFatStructure
        - this.rootFolderSectorCount;
    },
    get clusterCount() {
      return Math.floor(this.dataSectorCount / this.sectorsPerCluster);
    },
    get fatType() {
      var clusters = this.clusterCount;
      if (clusters < 4085) return 'fat12';
      if (clusters < 65525) return 'fat16';
      return 'fat32';
    },
  };
  
  return {
    getStructView: function getStructView() {
      return BootSectorView;
    },
  };

});
