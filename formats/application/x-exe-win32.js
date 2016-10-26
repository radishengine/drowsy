define(function() {

  'use strict';
  
  function Win32HeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  Win32HeaderView.prototype = {
    get hasValidSignature() {
      return this.dv.getUint32(0, true) === 0x00004550; // PE\0\0
    },
    get targetArchitecture() {
      switch(this.dv.getUint16(4, true)) {
        case 0x014c: return 'x86';
        case 0x0200: return 'intel_itanium';
        case 0x8664: return 'x64';
        default: return 'unknown';
      }
    },
    get sectionCount() {
      return this.dv.getUint16(6, true);
    },
    get timeStamp() {
      return new Date(this.dv.getUint32(8, true) * 1000);
    },
    get pointerToSymbolTable() {
      return this.dv.getUint32(12, true);
    },
    get symbolCount() {
      return this.dv.getUint32(16, true);
    },
    get optionalHeaderByteLength() {
      return this.dv.getUint16(20, true);
    },
    get characteristics() {
      return this.dv.getUint16(22, true);
    },
    get isStrippedOfRelocationInfo() {
      return !!(this.characteristics & 0x0001); // must be loaded at preferred base address
    },
    get hasUnresolvedExternalReferences() {
      return !(this.characteristics & 0x0002);
    },
    get isStrippedOfLineNumbers() {
      return !!(this.characteristics & 0x0004);
    },
    get isStrippedOfSymbols() {
      return !!(this.characteristics & 0x0008);
    },
    get aggressivelyTrimWorkingSet() {
      return !!(this.characteristics & 0x0010); // obsolete
    },
    get canHandleAddressesOver2GB() {
      return !!(this.characteristics & 0x0020);
    },
    get bytesReversedLo() {
      return !!(this.characteristics & 0x0080); // obsolete
    },
    get supports32BitWords() {
      return !!(this.characteristics & 0x0100);
    },
    get strippedOfDebugInfo() {
      return !!(this.characteristics & 0x0200);
    },
    get runFromSwapFileIfOnRemovableMedia() {
      return !!(this.characteristics & 0x0400);
    },
    get runFromSwapFileIfOnNetwork() {
      return !!(this.characteristics & 0x0800);
    },
    get isSystemFile() {
      return !!(this.characteristics & 0x1000);
    },
    get isDLL() {
      return !!(this.characteristics & 0x2000);
    },
    get requiresUniprocessor() {
      return !!(this.characteristics & 0x4000);
    },
    get bytesReversedHi() {
      return !!(this.characteristics & 0x8000); // obsolete
    },
  };
  Win32HeaderView.signature = 'PE\0\0';
  Win32HeaderView.byteLength = 24;
  
  function Win32OptionalHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  Win32OptionalHeaderView.prototype = {
    get signature() {
      return this.dv.getUint16(0, true);
    },
    get hasValidSignature() {
      return this.signature === 0x010B || this.signature === 0x020B;
    },
    get is64Bit() {
      return this.signature === 0x020B;
    },
    get linkerVersionMajor() {
      return this.dv.getUint8(2);
    },
    get linkerVersionMinor() {
      return this.dv.getUint8(3);
    },
    get codeByteLength() {
      return this.dv.getUint32(4, true);
    },
    get initializedByteLength() {
      return this.dv.getUint32(8, true);
    },
    get uninitializedByteLength() {
      return this.dv.getUint32(12, true);
    },
    get entryPoint() {
      return this.dv.getUint32(16, true);
    },
    get codeBase() {
      return this.dv.getUint32(20, true);
    },
    get dataBase() {
      return this.dv.getUint32(24, true);
    },
    get imageBase() {
      return this.dv.getUint32(28, true);
    },
    get sectionAlignment() {
      return this.dv.getUint32(32, true);
    },
    get fileAlignment() {
      return this.dv.getUint32(36, true);
    },
    get osVersionMajor() {
      return this.dv.getUint16(40, true);
    },
    get osVersionMinor() {
      return this.dv.getUint16(42, true);
    },
    get imageVersionMajor() {
      return this.dv.getUint16(44, true);
    },
    get imageVersionMinor() {
      return this.dv.getUint16(46, true);
    },
    get subsystemVersionMajor() {
      return this.dv.getUint16(48, true);
    },
    get subsytemVersionMinor() {
      return this.dv.getUint16(50, true);
    },
    get win32VersionValue() {
      return this.dv.getUint32(52, true);
    },
    get imageSize() {
      return this.dv.getUint32(56, true);
    },
    get headersSize() {
      return this.dv.getUint32(60, true);
    },
    get checksum() {
      return this.dv.getUint32(64, true);
    },
    get subsystem() {
      return this.dv.getUint16(68, true);
    },
    get dllCharacteristics() {
      return this.dv.getUint16(70, true);
    },
    get stackReserveSize() {
      return this.dv.getUint32(72, true);
    },
    get stackCommitSize() {
      return this.dv.getUint32(76, true);
    },
    get heapReserveSize() {
      return this.dv.getUint32(80, true);
    },
    get heapCommitSize() {
      return this.dv.getUint32(84, true);
    },
    get loaderFlags() {
      return this.dv.getUint32(88, true);
    },
    get rvaRecords() {
      var records = new Array(this.dv.getUint32(92, true));
      for (var i = 0; i < records.length; i++) {
        records[i] = {
          relativeVirtualAddress: this.dv.getUint32(96 + i * 8, true),
          byteLength: this.dv.getUint32(96 + i * 8 + 4, true),
        };
      }
      Object.defineProperty(this, 'rvaRecords', {value:records});
      return records;
    },
    getRecord: function(n) {
      if (n >= this.records.length || this.records[n].byteLength === 0) return null;
      return this.records[n];
    },
    get exportRecord() {
      return this.getRecord(0);
    },
    get importRecord() {
      return this.getRecord(1);
    },
    get resourceRecord() {
      return this.getRecord(2);
    },
    get exceptionRecord() {
      return this.getRecord(2);
    },
    get securityRecord() {
      return this.getRecord(2);
    },
    get baseRelocationRecord() {
      return this.getRecord(2);
    },
    get debugRecord() {
      return this.getRecord(2);
    },
    get copyrightRecord() {
      return this.getRecord(2);
    },
    get architectureRecord() {
      return this.getRecord(2);
    },
    get globalPointer() {
      return this.records.length < 9 ? NaN : this.records[8].rva;
    },
    get tlsRecord() {
      return this.getRecord(9);
    },
    get loadConfigurationRecord() {
      return this.getRecord(10);
    },
    get boundImportRecord() {
      return this.getRecord(11);
    },
    get importAddressTableRecord() {
      return this.getRecord(12);
    },
    get delayLoadImportDescriptorsRecord() {
      return this.getRecord(13);
    },
    get clrRuntimeHeaderRecord() {
      return this.getRecord(14);
    },
  };
  Win32OptionalHeaderView.byteLength = 96;
  
  return {
  };

});
