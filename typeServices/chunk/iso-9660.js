define(function() {

  'use strict';

  function VolumeDescriptorView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  VolumeDescriptorView.prototype = {
    get typeCode() {
      return this.bytes[0];
    },
    get descriptorType() {
      switch (this.typeCode) {
        case 0: return 'boot';
        case 1: return 'volume'; // primary
        case 2: return 'volume'; // supplementary
        case 3: return 'partition';
        case 255: return 'terminator';
        default: return this.typeCode;
      }
    },
    get isPrimaryVolume() {
      return this.typeCode === 1;
    },
    get signature() {
      return String.fromCharCode(this.bytes[1], this.bytes[2], this.bytes[3], this.bytes[4], this.bytes[5]);
    },
    get hasValidSignature() {
      return this.signature === 'CD001';
    },
    get version() {
      return this.bytes[6];
    },
    get body() {
      var body, buffer = this.dv.buffer, byteOffset = this.dv.byteOffset, byteLength = this.dv.byteLength;
      switch(this.descriptorType) {
        case 'boot': body = new BootRecordView(buffer, byteOffset, byteLength); break;
        case 'volume': body = new VolumeRecordView(buffer, byteOffset, byteLength); break;
        default: body = null; break;
      }
      Object.defineProperty(this, 'body', {value:body});
      return body;
    },
  };
  
  function readSpacePadded(bytes) {
    return String.fromCharCode.apply(null, bytes).replace(/\s*$/, '');
  }
  
  function decodeTimeZoneSuffix(tz) {
    tz = (tz - 48) * 15;
    var sign = (tz < 0) ? ('-') : ('+');
    tz = Math.abs(tz);
    return sign + ('0' + Math.floor(tz / 60)).slice(-2) + ':' + ('0' + tz%60).slice(-2);
  }
  
  function readStringDateTime(bytes, offset) {
    var year = String.fromCharCode(bytes[offset + 0], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (!/^0*[1-9][0-9]*$/.test(year)) return null;
    var month = String.fromCharCode(bytes[offset + 4], bytes[offset + 5]);
    var day = String.fromCharCode(bytes[offset + 6], bytes[offset + 7]);
    var hour = String.fromCharCode(bytes[offset + 8], bytes[offset + 9]);
    var minute = String.fromCharCode(bytes[offset + 10], bytes[offset + 11]);
    var second = String.fromCharCode(bytes[offset + 12], bytes[offset + 13]);
    var hundredths = String.fromCharCode(bytes[offset + 14], bytes[offset + 15]);
    var timeZone = decodeTimeZoneSuffix(bytes[offset + 16]);
    var dateString = year+'-'+month+'-'+day+'T'+hour+':'+minute+':'+second+'.'+hundredths+timeZone;
    console.log(dateString);
    return new Date(dateString);
  }
  
  function readBinaryDateTime(bytes, offset) {
    if (bytes[offset + 1] === 0) return null; // month, must be 1-12
    var year = '' + (1900 + bytes[offset]);
    var month = ('0' + bytes[offset + 1]).slice(-2);
    var day = ('0' + bytes[offset + 2]).slice(-2);
    var hour = ('0' + bytes[offset + 3]).slice(-2);
    var minute = ('0' + bytes[offset + 4]).slice(-2);
    var second = ('0' + bytes[offset + 5]).slice(-2);
    var timeZone = decodeTimeZoneSuffix(bytes[offset + 6]);
    var dateString = year + '-' + month + '-' + day + 'T' + hour + ':' + minute + ':' + second + timeZone;
    console.log(dateString);
    return new Date(dateString);
  }
  
  function BootRecordView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.bootData = this.bytes.subarray(71);
  }
  BootRecordView.prototype = {
    get systemIdentifier() {
      return readSpacePadded(this.bytes.subarray(7, 32));
    },
    get identifier() {
      return readSpacePadded(this.bytes.subarray(39, 64));
    },
  };
  
  function VolumeRecordView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  VolumeRecordView.prototype = {
    get systemIdentifier() {
      return readSpacePadded(this.bytes.subarray(8, 32));
    },
    get identifier() {
      return readSpacePadded(this.bytes.subarray(40, 64));
    },
    get blockCount() {
      return this.dv.getUint32(80, true);
    },
    get diskCount() {
      return this.dv.getUint16(120, true);
    },
    get diskNumber() {
      return this.dv.getUint16(124, true);
    },
    get blockByteLength() {
      return this.dv.getUint16(128, true);
    },
    get pathTableByteLength() {
      return this.dv.getUint32(132, true);
    },
    get pathTableBlockAddressLE() {
      return this.dv.getUint32(140, true);
    },
    get optionalPathTableBlockAddressLE() {
      return this.dv.getUint32(144, true);
    },
    get pathTableBlockAddressLE() {
      return this.dv.getUint32(148, false);
    },
    get optionalPathTableBlockAddressLE() {
      return this.dv.getUint32(152, false);
    },
    get rootDirectory() {
      var root = new DirectoryRecordView(this.dv.buffer, this.dv.byteOffset + 156, 34);
      Object.defineProperty(this, 'rootDirectory', {value:root});
      return root;
    },
    get setIdentifier() {
      return readStringPadded(this.bytes.subarray(190, 190 + 128));
    },
    get publisher() {
      return readStringPadded(this.bytes.subarray(318, 318 + 128));
    },
    get dataPreparer() {
      return readStringPadded(this.bytes.subarray(446, 446 + 128));
    },
    get application() {
      return readStringPadded(this.bytes.subarray(574, 574 + 128));
    },
    get copyrightFilename() {
      return readStringPadded(this.bytes.subarray(702, 702 + 38));
    },
    get abstractFilename() {
      return readStringPadded(this.bytes.subarray(740, 740 + 36));
    },
    get bibliographyFilename() {
      return readStringPadded(this.bytes.subarray(776, 776 + 37));
    },
    get createdAt() {
      return readStringDateTime(this.bytes, 813);
    },
    get modifiedAt() {
      return readStringDateTime(this.bytes, 830);
    },
    get becomesObsoleteAt() {
      return readStringDateTime(this.bytes, 847);
    },
    get becomesEffectiveAt() {
      return readStringDateTime(this.bytes, 864);
    },
    get fileStructureVersion() {
      return this.bytes[881];
    },
    get applicationData() {
      var section = this.bytes.subarray(883, 883 + 512);
      Object.defineProperty(this, 'applicationData', {value:section});
      return section;
    },
  };
  
  function DirectoryRecordView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  DirectoryRecordView.prototype = {
    get length() {
      return this.bytes[0];
    },
    get extendedAttributeRecordLength() {
      return this.bytes[1];
    },
    get dataBlockAddress() {
      return this.dv.getUint32(2, true);
    },
    get dataByteLength() {
      return this.dv.getUint32(10, true);
    },
    get recordedAt() {
      return readBinaryDateTime(this.bytes, 18);
    },
    get flags() {
      return this.bytes[25];
    },
    get isHidden() {
      return !!(this.flags & (1 << 0));
    },
    get isDirectory() {
      return !!(this.flags & (1 << 1));
    },
    get isAssociatedFile() {
      return !!(this.flags & (1 << 2));
    },
    get hasExtendedAttributeInfo() {
      return !!(this.flags & (1 << 3));
    },
    get hasPermissionsInExtendedAttributeInfo() {
      return !!(this.flags & (1 << 4));
    },
    get isPartial() {
      return !!(this.flags & (1 << 7));
    },
    get interleavedUnitSize() {
      return this.bytes[26];
    },
    get interleavedGapSize() {
      return this.bytes[27];
    },
    get volumeNumber() {
      return this.dv.getUint16(28, true);
    },
    get nameAndIdentifier() {
      return String.fromCharCode.apply(null, this.bytes.subarray(33, 33 + this.bytes[32]));
    },
    get name() {
      return this.nameAndIdentifier.replace(/;\d+$/, '');
    },
    get identifier() {
      return +(this.nameAndIdentifier.match(/;(\d+)$/) || '')[1];
    },
    get after_identifier() {
      var identifierLength = this.bytes[32];
      return 33 + identifierLength + ((identifierLength + 1) % 2);
    },
    get byteLength() {
      var extendedLength = this.extendedAttributeRecordLength;
      return this.after_identifier + extendedLength + extendedLength % 2;
    },
  };
  
  function PathTableEntryView(littleEndian, buffer, byteOffset, byteLength) {
    this.littleEndian = littleEndian;
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  PathTableEntryView.prototype = {
    get extendedAttributeLength() {
      return this.bytes[1];
    },
    get extentBlockAddress() {
      return this.dv.getUint32(2, this.littleEndian);
    },
    get parentDirectoryIndex() {
      return this.dv.getUint16(6, this.littleEndian);
    },
    get identifier() {
      return String.fromCharCode.apply(null, this.bytes.subarray(8, 8 + this.bytes[0]));
    },
    get byteLength() {
      var idLength = this.bytes[0];
      return 8 + idLength + idLength % 2;
    },
  };

  return {
    getStructView: function(segment) {
      switch (segment.getTypeParameter('which')) {
        case 'volume-descriptor': return VolumeDescriptorView;
        case 'path-table-entry': return PathTableEntryView;
        case 'boot-record': return BootRecordView;
        case 'volume-record': return VolumeRecordView;
        case 'folder': return DirectoryRecordView;
        case 'file': return DirectoryRecordView;
        default: return null;
      }
    },
    PathTableEntryView: PathTableEntryView,
    VolumeDescriptorView: VolumeDescriptorView,
    BootRecordView: BootRecordView,
    VolumeRecordView: VolumeRecordView,
    DirectoryRecordView: DirectoryRecordView,
  };

});
