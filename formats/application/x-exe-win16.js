define(function() {

  'use strict';

  function Win16HeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  Win16HeaderView.prototype = {
    get hasValidSignature() {
      return this.dv.getUint16(0, true) === 0x454E; // NE
    },
    get linkerVersionMajor() {
      return this.dv.getUint8(2);
    },
    get linkerVersionMinor() {
      return this.dv.getUint8(3);
    },
    get entryTableOffset() {
      return this.dv.getUint16(4, true);
    },
    get entryTableByteLength() {
      return this.dv.getUint16(6, true);
    },
    get fileLoadCRC() {
      return this.dv.getUint32(8, true); // 0 in Borland's TPW
    },
    get programFlags() {
      return this.dv.getUint8(0xC, true);
    },
    get dgroupType() {
      switch(this.programFlags & 3) {
        case 0: return 'none';
        case 1: return 'singleShared';
        case 2: return 'multiple';
        case 3: return null;
      }
    },
    get globalInitialization() {
      return !!(this.programFlags & 0x4);
    },
    get protectedModeOnly() {
      return !!(this.programFlags & 0x8);
    },
    get has8086Instructions() {
      return !!(this.programFlags & 0x10);
    },
    get has80286Instructions() {
      return !!(this.programFlags & 0x20);
    },
    get has80386Instructions() {
      return !!(this.programFlags & 0x40);
    },
    get has80x87Instructions() {
      return !!(this.programFlags & 0x80);
    },
    get applicationFlags() {
      return this.getUint8(0xD);
    },
    get windowsAPIRelationship() {
      switch(this.applicationFlags & 7) {
        case 1: return 'unaware'; // full screen
        case 2: return 'compatible';
        case 3: return 'using';
        default: return 'unknown';
      }
    },
    get isO_S2FamilyApplication() {
      return this.applicationFlags & 0x8;
    },
    // application flag 0x10 reserved?
    get hasErrors() {
      return !!(this.applicationFlags & 0x20);
    },
    get nonConformingProgram() {
      return !!(this.applicationFlags & 0x40);
    },
    get isDLLOrDriver() {
      return !!(this.applicationFlags & 0x80);
    },
    get autoDataSegmentIndex() {
      return this.dv.getUint8(0xE);
    },
    get initialLocalHeapSize() {
      return this.dv.getUint16(0x10, true);
    },
    get initialStackSize() {
      return this.dv.getUint16(0x12, true);
    },
    get entryPoint() {
      return this.dv.getUint32(0x14, true);
    },
    get initialStackPointer() {
      return this.dv.getUint32(0x18, true);
    },
    get segmentCount() {
      return this.dv.getUint16(0x1C, true);
    },
    get moduleReferenceCount() {
      return this.dv.getUint16(0x1E, true);
    },
    get nonresidentNamesTableByteLength() {
      return this.dv.getUint16(0x20, true);
    },
    get segmentTableOffset() {
      return this.dv.getUint16(0x22, true);
    },
    get resourceTableOffset() {
      return this.dv.getUint16(0x24, true);
    },
    get residentNamesTableOffset() {
      return this.dv.getUint16(0x26, true);
    },
    get moduleReferenceTableOffset() {
      return this.dv.getUint16(0x28, true);
    },
    get importedNamesTableOffset() {
      return this.dv.getUint16(0x2A, true); // array of counted strings, terminated with a zero-length string
    },
    get nonresidentNamesTableOffset() {
      return this.dv.getUint32(0x2C, true); // is this relative from the start of the whole file?
    },
    get moveableEntryPointCount() {
      return this.dv.getUint16(0x30, true);
    },
    get fileAlignmentShiftSizeCount() {
      return this.dv.getUint16(0x32, true); // 0 equivalent to 9, default 512-byte pages
    },
    get resourceTableEntryCount() {
      return this.dv.getUint16(0x34, true);
    },
    get targetOS() {
      switch(this.dv.getUint8(0x36)) {
        case 1: return 'os/2';
        case 2: return 'windows';
        case 3: return 'european ms-dos 4.x';
        case 4: return 'windows 386';
        case 5: return 'borland operating system services';
      }
    },
    get os2Flags() {
      return this.dv.getUint8(0x37);
    },
    get hasOS2LongFilenameSupport() {
      return !!(this.os2Flags & 0x1);
    },
    get hasOS2ProtectedMode() {
      return !!(this.os2Flags & 0x2);
    },
    get hasOS2ProportionalFonts() {
      return !!(this.os2Flags & 0x4);
    },
    get hasOS2GangloadArea() {
      return !!(this.os2Flags & 0x8);
    },
    get returnThunksOffset() {
      return this.dv.getUint16(0x38, true);
    },
    get gangloadAreaOffset() {
      return this.dv.getUint16(0x38, true); // union with return thunks
    },
    get segmentReferenceThunksOffset() {
      return this.dv.getUint16(0x3A, true);
    },
    get gangloadAreaLength() {
      return this.dv.getUint16(0x3A, true); // union with segment reference thunks offset
    },
    get minimumCodeSwapAreaSize() {
      return this.dv.getUint16(0x3C, true);
    },
    get expectedWindowsVersionMinor() {
      return this.dv.getUint8(0x3E);
    },
    get expectedWindowsVersionMajor() {
      return this.dv.getUint8(0x3F);
    },
  };
  Win16HeaderView.signature = 'NE';
  Win16HeaderView.byteLength = 0x40;
  
  return {
  };

});
