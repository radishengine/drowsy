define(function() {

  'use strict';

  function readString(bytes, offset, length) {
    return String.fromCharCode.apply(null, bytes.subarray(offset, offset + length)).replace(/\0.*/, '');
  }

  function readOctalString(bytes, offset, length) {
    return parseInt(readString(bytes, offset, length), 8);
  }

  function TarHeaderChunk(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffsete, byteLength);
  }
  TarHeaderChunk.prototype = {
    get name() {
      return readString(this.bytes, 0, 100);
    },
    get fileMode() {
      return readOctalString(this.bytes, 100, 8);
    },
    get ownerID() {
      return readOctalString(this.bytes, 108, 8);
    },
    get ownerGroupID() {
      return readOctalString(this.bytes, 116, 8);
    },
    get size() {
      return readOctalString(this.bytes, 124, 12);
    },
    get modifiedTime() {
      return new Date(readOctalString(this.bytes, 136, 12) * 1000);
    },
    get checksum() {
      return readOctalString(this.bytes, 148, 8);
    },
    calculateUnsignedChecksum: function() {
      var total = 0x20 * 8;
      for (var i = 0; i < 148; i++) {
        total += this.bytes[0];
      }
      for (var i = 156; i < 512; i++) {
        total += this.bytes[0];
      }
      return total;
    },
    calculateSignedChecksum: function() {
      var total = 0x20 * 8;
      for (var i = 0; i < 148; i++) {
        total += this.bytes[i] << 24 >> 24;
      }
      for (var i = 156; i < 512; i++) {
        total += this.bytes[i] << 24 >> 24;
      }
      return total;
    },
    get isDirectory() {
      return this.type === 'directory' || /\/$/.test(this.name); // ending name with / is the old convention
    },
    get type() {
      var flag = this.bytes[156];
      flag = flag && +String.fromCharCode(flag);
      switch (flag) {
        case 0: return 'file';
        case 1: return 'hardLink';
        case 2: return 'symbolicLink';
        case 3: return 'characterDeviceNode';
        case 4: return 'blockDeviceNode';
        case 5: return 'directory';
        case 6: return 'fifoNode';
        default: return flag;
      }
    },
    get linkName() {
      return readString(this.bytes, 157, 100);
    },
    get magicNumber() {
      return readString(this.bytes, 257, 6);
    },
    get version() {
      return readString(this.bytes, 263, 2); // '00'
    },
    get ownerName() {
      return readString(this.bytes, 265, 32);
    },
    get ownerGroupName() {
      return readString(this.bytes, 297, 32);
    },
    get devMinor() {
      return readOctalString(this.bytes, 329, 8);
    },
    get devMajor() {
      return readOctalString(this.bytes, 337, 8);
    },
    get prefix() {
      return readString(this.bytes, 
    },
  };
  
  function TarChunk() {
  }
  TarChunk.byteLength = 512;

  return {
    getStructView: function(segment) {
      if (segment.format.parameters['which'] === 'header') return TarHeaderChunk;
      return TarChunk;
    },
  };

});
