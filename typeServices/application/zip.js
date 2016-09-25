define(function() {

  'use strict';
  
  function split(entries) {
    var segment = this;
    var trailerSegment = segment.getSegment(-TrailerView.byteLength);
    return trailerSegment.then(function(rawTrailer) {
      var trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset, rawTrailer.byteLength);
      if (trailer.hasValidSignature && trailer.commentByteLength === 0) {
        if (entries.accepts('application/x-zip-trailer')) {
          entries.add('application/x-zip-trailer', trailerSegment);
        }
        return trailer;
      }
      var bufferPos = -TrailerView.byteLength;
      var commentBufferSize = 0x20;
      var earliestPos = bufferPos - 0x10000;
      function onTrackback(moreBytes) {
        var expanded = new Uint8Array(moreBytes.length + rawTrailer.length);
        expanded.set(moreBytes);
        expanded.set(rawTrailer, moreBytes.length);
        rawTrailer = expanded;
        trailer = null;
        findTrailer: for (var pos = moreBytes.length-1; pos >= 3; pos -= 4) {
          switch(rawTrailer[pos]) {
            case 0x50: // 'P'
              if (rawTrailer[pos+1] === 0x4B && rawTrailer[pos+2] === 0x05 && rawTrailer[pos+3] === 0x06) {
                trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos, TrailerView.byteLength);
                if (trailer.commentByteLength === (rawTrailer.length - pos - TrailerView.byteLength)) {
                  trailerSegment = segment.getSegment(bufferPos + pos);
                  break findTrailer;
                }
                trailer = null;
              }
              continue findTrailer;
            case 0x4B: // 'K'
              if (rawTrailer[pos-1] === 0x50 && rawTrailer[pos+1] === 0x05 && rawTrailer[pos+2] === 0x06) {
                trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos - 1, TrailerView.byteLength);
                if (trailer.commentByteLength === (rawTrailer.length - pos - 1 - TrailerView.byteLength)) {
                  trailerSegment = segment.getSegment(bufferPos + pos - 1);
                  break findTrailer;
                }
                trailer = null;
              }
              continue findTrailer;
            case 0x05: // '\x05'
              if (rawTrailer[pos-2] === 0x50 && rawTrailer[pos-1] === 0x4B && rawTrailer[pos+1] === 0x06) {
                trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos - 2, TrailerView.byteLength);
                if (trailer.commentByteLength === (rawTrailer.length - pos - 2- TrailerView.byteLength)) {
                  trailerSegment = segment.getSegment(bufferPos + pos - 2);
                  break findTrailer;
                }
                trailer = null;
              }
              continue findTrailer;
            case 0x06: // '\x06'
              if (rawTrailer[pos-3] === 0x50 && rawTrailer[pos-2] === 0x4B && rawTrailer[pos-1] === 0x05) {
                trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos - 3, TrailerView.byteLength);
                if (trailer.commentByteLength === (rawTrailer.length - pos - 3 - TrailerView.byteLength)) {
                  trailerSegment = segment.getSegment(bufferPos + pos - 3);
                  break findTrailer;
                }
                trailer = null;
              }
              continue findTrailer;
          }
        }
        if (!trailer) {
          bufferPos -= commentBufferSize;
          if (bufferPos < earliestPos) {
            return Promise.reject('application/zip: trailer not found');
          }
          commentBufferSize *= 2;
          return segment.getBytes(bufferPos, commentBufferSize).then(onTrackback);
        }
        if (entries.accepts('application/x-zip-trailer')) {
          entries.add('application/x-zip-trailer', trailerSegment);
        }
        rawTrailer = new Uint8Array(rawTrailer.subarray(pos, pos + TrailerView.byteLength));
        return new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos, TrailerView.byteLength);
      }
      bufferPos -= commentBufferSize;
      return segment.getBytes(bufferPos, commentBufferSize).then(onTrackback);
    })
    .then(function(trailer) {
      if (!entries.accepts('application/x-zip-central-record')
       && !entries.accepts('application/x-zip-local-record')) {
        return;
      }
      var centralDirSegment = segment.getSegment(trailer.centralDirFirstOffset, trailer.centralDirByteLength);
      return centralDirSegment.getBytes()
      .then(function(rawCDir) {
        var pos = 0;
        for (; count > 0; count--) {
          var record = new CentralRecordView(rawCDir.buffer, rawCDir.byteOffset + pos, rawCDir.byteLength - pos);
          if (entries.accepts('application/x-zip-central-record')){
            if (record.isZip64) {
              return Promise.reject('zip64 not yet supported');
            }
            entries.add('application/x-zip-central-record', centralDirSegment.getSegment(pos, record.byteLength));
          }
          if (trailer.partNumber === record.firstPartNumber && entries.accepts('application/x-zip-local-record')) {
            segment.getBytes(record.localRecordOffset, LocalRecordView.byteLength)
            .then(function(rawLocalHeader) {
              var localHeader = new LocalRecordView(rawLocalHeader.buffer, rawLocalHeader.byteOffset, rawLocalHeader.byteLength);
              if (localHeader.isZip64) {
                return Promise.reject('zip64 not yet supported');
              }
              var compressedLength = localHeader.compressedByteLength32;
            });
            entries.add('application/x-zip-local-record', 
          }
          pos += record.byteLength;
        }
        return list;
      });
    })
    .then(function(centralDirRecords) {
      return Promise.all(centralDirRecords.map(function(centralRecord) {
        if (centralRecord.isZip64) {
          return Promise.reject('zip64 not yet supported'); // TODO
        }
        if (centralRecord.isEncrypted) {
          return Promise.reject('encryption not yet supported'); // TODO
        }
        var compressedByteLength = centralRecord.compressedByteLength32;
        var uncompressedByteLength = centralRecord.uncompressedByteLength32;
        return context.getBytes(centralRecord.localRecordOffset, LocalRecordView.byteLength)
        .then(function(rawLocalRecord) {
          var localRecord = new LocalRecordView(
            rawLocalRecord.buffer,
            rawLocalRecord.byteOffset,
            rawLocalRecord.byteLength);
          
          entries.add(
            context.getSegment(
              record.localRecordOffset
                + LocalRecordView.byteLength
                + localRecord.pathByteLength
                + localRecord.extraByteLength,
              compressedByteLength)
            .setMetadata({
              path: centralRecord.path,
              date: centralRecord.modifiedAt,
              creationSystem: centralRecord.creationSystem,
            }));
        });
      });
    });
  }
  
  function TrailerView(buffer, byteSource, byteLength) {
    this.dv = new DataView(buffer, byteSource, byteLength);
    this.bytes = new Uint8Array(buffer, byteSource, byteLength);
  }
  TrailerView.prototype = {
    get hasValidSignature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === TrailerView.signature;
    },
    get partNumber() {
      return this.dv.getUint16(4, true);
    },
    get centralDirFirstPart() {
      return this.dv.getUint16(6, true);
    },
    get partEntryCount() {
      return this.dv.getUint16(8, true);
    },
    get totalEntryCount() {
      return this.dv.getUint16(10, true);
    },
    get centralDirByteLength() {
      return this.dv.getUint32(12, true);
    },
    get centralDirFirstOffset() {
      return this.dv.getUint32(16, true);
    },
    get commentByteLength() {
      return this.dv.getUint16(20, true);
    },
  };
  TrailerView.signature = 'PK\x05\x06';
  TrailerView.byteLength = 22;
  
  function CentralRecordView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  CentralRecordView.prototype = {
    get hasValidSignature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === CentralRecordView.signature;
    },
    get creationSystem() {
      var systemCode = this.dv.getUint8(5);
      switch(systemCode) {
        case 0: return 'fat'; // FAT / VFAT / FAT32: MS-DOS and OS/2
        case 1: return 'amiga';
        case 2: return 'openVMS';
        case 3: return 'unix';
        case 4: return 'vm/cms';
        case 5: return 'atariST';
        case 6: return 'hpfs'; // OS/2
        case 7: return 'mac';
        case 8: return 'z';
        case 9: return 'cp/m';
        case 10: return 'ntfs';
        case 11: return 'mvs';
        case 12: return 'vse';
        case 13: return 'acorn';
        case 14: return 'vfat';
        case 15: return 'mvsAlternate';
        case 16: return 'beOS';
        case 17: return 'tandem';
        case 18: return 'os/400';
        case 19: return 'osx'; // darwin
        default: return systemCode;
      }
    },
    get zipSpecificationVersion() {
      return this.dv.getUint8(4);
    },
    get requiredPKZipVersion() {
      return this.dv.getUint16(6, true) / 10;
    },
    get flags() {
      return this.dv.getUint16(8, true);
    },
    get isEncrypted() {
      return !!(this.flags & (1 << 0));
    },
    get usesCompressionOption1() {
      return !!(this.flags & (1 << 1));
    },
    get usesCompressionOption2() {
      return !!(this.flags & (1 << 2));
    },
    get hasDataDescriptor() {
      return !!(this.flags & (1 << 3));
    },
    get hasEnhancedDeflation() {
      return !!(this.flags & (1 << 4));
    },
    get hasCompressedPatchedData() {
      return !!(this.flags & (1 << 5));
    },
    get hasStrongEncryption() {
      return !!(this.flags & (1 << 6));
    },
    get hasUTF8Encoding() {
      return !!(this.flags & (1 << 11));
    },
    get hasMaskHeaderValues() {
      return !!(this.flags & (1 << 13));
    },
    get compressionMethod() {
      var methodCode = this.dv.getUint16(10, true);
      switch(methodCode) {
        case 0: return 'none';
        case 1: return 'shrunk';
        case 2: return 'factor1';
        case 3: return 'factor2';
        case 4: return 'factor3';
        case 5: return 'factor4';
        case 6: return 'imploded';
        case 8: return 'deflated';
        case 9: return 'enhancedDeflated';
        case 10: return 'dclImploded';
        case 12: return 'bzip2';
        case 14: return 'lzma';
        case 18: return 'terse';
        case 19: return 'lz77';
        case 98: return 'ppmd';
        default: return methodCode;
      }
    },
    get modifiedAt() {
      return getTimeAndDate(this.dv, 12);
    },
    get crc32() {
      return ('0000000' + this.dv.getUint32(16, true).toString(16).toUpperCase()).slice(-8);
    },
    get compressedByteLength32() {
      return this.dv.getUint32(20, true);
    },
    get uncompressedByteLength32() {
      return this.dv.getUint32(24, true);
    },
    get isZip64() {
      return this.compressedSize32 === 0xffffffff && this.uncompressedSize32 === 0xffffffff;
    },
    get pathByteLength() {
      return this.dv.getUint16(28, true);
    },
    get extraByteLength() {
      return this.dv.getUint16(30, true);
    },
    get commentByteLength() {
      return this.dv.getUint16(32, true);
    },
    get firstDiskNumber() {
      return this.dv.getUint16(34, true);
    },
    get internalAttributes() {
      return this.dv.getUint16(36, true);
    },
    get isApparentlyTextFile() {
      return !!(this.internalAttributes && (1 << 0));
    },
    get hasControlFieldRecordsBeforeLogicalRecords() {
      return !!(this.internalAttributes && (1 << 2));
    },
    get externalAttributes() {
      return this.dv.getUint32(38, true);
    },
    get localRecordOffset() {
      return this.dv.getUint32(42, true);
    },
    get pathPos() {
      return CentralRecordView.fixedByteLength;
    },
    get decode() {
      return this.hasUTF8Encoding ? utf_8.decode : latin_us.decode;
    },
    get path() {
      return this.decode(this.bytes, this.pathPos, this.pathByteLength);
    },
    get extraPos() {
      return this.pathPos + this.pathByteLength;
    },
    get commentPos() {
      return this.extraPos + this.extraByteLength;
    },
    get comment() {
      return this.decode(this.bytes, this.commentPos, this.commentByteLength);
    },
    get byteLength() {
      return this.pathPos + this.pathByteLength + this.extraByteLength + this.commentByteLength;
    },
  };
  CentralRecordView.signature = 'PK\x01\x02';
  CentralRecordView.fixedByteLength = 46;
  CentralRecordView.getList = function(count, buffer, byteOffset, byteLength) {
    var list = [];
    var pos = 0;
    for (; count > 0; count--) {
      var record = new CentralRecordView(buffer, byteOffset + pos, byteLength - pos);
      pos += record.byteLength;
      list.push(record);
    }
    return list;
  };
  
  function LocalRecordView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  LocalRecordView.prototype = {
    get hasValidSignature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === LocalRecordView.signature;
    },
    get version() {
      return this.dv.getUint16(4, true) / 10;
    },
    get flags() {
      return this.dv.getUint16(6, true) / 10;
    },
    get isEncrypted() {
      return !!(this.flags & (1 << 0));
    },
    get usesCompressionOption1() {
      return !!(this.flags & (1 << 1));
    },
    get usesCompressionOption2() {
      return !!(this.flags & (1 << 2));
    },
    get hasDataDescriptor() {
      return !!(this.flags & (1 << 3));
    },
    get hasEnhancedDeflation() {
      return !!(this.flags & (1 << 4));
    },
    get hasCompressedPatchedData() {
      return !!(this.flags & (1 << 5));
    },
    get hasStrongEncryption() {
      return !!(this.flags & (1 << 6));
    },
    get hasUTF8Encoding() {
      return !!(this.flags & (1 << 11));
    },
    get hasMaskHeaderValues() {
      return !!(this.flags & (1 << 13));
    },
    get compressionMethod() {
      var methodCode = this.dv.getUint16(8, true);
      switch(methodCode) {
        case 0: return 'none';
        case 1: return 'shrunk';
        case 2: return 'factor1';
        case 3: return 'factor2';
        case 4: return 'factor3';
        case 5: return 'factor4';
        case 6: return 'imploded';
        case 8: return 'deflated';
        case 9: return 'enhancedDeflated';
        case 10: return 'dclImploded';
        case 12: return 'bzip2';
        case 14: return 'lzma';
        case 18: return 'terse';
        case 19: return 'lz77';
        case 98: return 'ppmd';
        default: return methodCode;
      }
    },
    get modifiedAt() {
      return getTimeAndDate(this.dv, 0xA);
    },
    get crc32() {
      return ('0000000' + this.dv.getUint32(0xE, true).toString(16).toUpperCase()).slice(-8);
    },
    get compressedSize32() {
      return this.dv.getUint32(0x12, true);
    },
    get uncompressedSize32() {
      return this.dv.getUint32(0x16, true);
    },
    get isZip64() {
      return this.compressedSize32 === 0xffffffff && this.uncompressedSize32 === 0xffffffff;
    },
    get pathByteLength() {
      return this.dv.getInt16(0x1a, true);
    },
    get extraByteLength() {
      return this.dv.getInt16(0x1c, true);
    },
  };
  LocalRecordView.byteLength = 0x1e;
  LocalRecordView.signature = 'PK\x03\x04';
  
  function getTimeAndDate(dataView, offset) {
    var time = dataView.getUint16(offset, true);
    var date = dataView.getUint16(offset + 2, true);
    
    var d = new Date();
    d.setFullYear(1980 + (date >> 9));
    d.setMonth((date >> 5) & 0xf);
    d.setDate(date & 0x1f);
    d.setHours((time >> 11) & 0x1f);
    d.setMinutes((time >> 5) & 0x3f);
    d.setSeconds((time & 0x1f) << 1);
    return d;
  }
  
  return {
    split: split,
  };

});
