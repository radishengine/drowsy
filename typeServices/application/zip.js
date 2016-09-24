define(['charset/utf-8', 'charset/x-msdos-latin-us'],
function(        utf_8,                   latin_us) {

  'use strict';
  
  function split() {
    var context;
    return (context = this)
    .getBytes(-TrailerView.byteLength).then(function(rawTrailer) {
      var trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset, rawTrailer.byteLength);
      if (trailer.hasValidSignature && trailer.commentByteLength === 0) return trailer;
      var bufferPos = -TrailerView.byteLength;
      var commentBufferSize = 0x100;
      var maxCommentBufferSize = 0x10000;
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
                  break findTrailer;
                }
                trailer = null;
              }
              continue findTrailer;
            case 0x4B: // 'K'
              if (rawTrailer[pos-1] === 0x50 && rawTrailer[pos+1] === 0x05 && rawTrailer[pos+2] === 0x06) {
                trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos - 1, TrailerView.byteLength);
                if (trailer.commentByteLength === (rawTrailer.length - pos - 1 - TrailerView.byteLength)) {
                  break findTrailer;
                }
                trailer = null;
              }
              continue findTrailer;
            case 0x05: // '\x05'
              if (rawTrailer[pos-2] === 0x50 && rawTrailer[pos-1] === 0x4B && rawTrailer[pos+1] === 0x06) {
                trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos - 2, TrailerView.byteLength);
                if (trailer.commentByteLength === (rawTrailer.length - pos - 2- TrailerView.byteLength)) {
                  break findTrailer;
                }
                trailer = null;
              }
              continue findTrailer;
            case 0x06: // '\x06'
              if (rawTrailer[pos-3] === 0x50 && rawTrailer[pos-2] === 0x4B && rawTrailer[pos-1] === 0x05) {
                trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos - 3, TrailerView.byteLength);
                if (trailer.commentByteLength === (rawTrailer.length - pos - 3 - TrailerView.byteLength)) {
                  break findTrailer;
                }
                trailer = null;
              }
              continue findTrailer;
          }
        }
        if (!trailer) {
          commentBufferSize *= 2;
          bufferPos -= commentBufferSize;
          if (commentBufferSize >= maxCommentBufferSize) {
            return Promise.reject('application/zip: trailer not found');
          }
          return context.getBytes(bufferPos, commentBufferSize).then(onTrackback);
        }
        context.addEntry(context.slice(pos + TrailerView.byteLength), {
          isComment: true,
        });
        rawTrailer = new Uint8Array(rawTrailer.subarray(pos, pos + TrailerView.byteLength));
        return new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos, TrailerView.byteLength);
      }
      bufferPos -= commentBufferSize;
      return context.getBytes(bufferPos, commentBufferSize).then(onTrackback);
    })
    .then(function(trailer) {
      if (trailer.centralDirFirstPart !== trailer.partNumber
       || trailer.partEntryCount !== trailer.totalEntryCount) {
        return Promise.reject('multi-part zip files not yet supported'); // TODO
      }
      return context
      .getBytes(trailer.centralDirFirstOffset, trailer.centralDirByteLength)
      .then(function(rawCDir) {
        return CentralRecordView.getList(
          trailer.partEntryCount,
          rawCDir.buffer, rawCDir.byteOffset, rawCDir.byteLength);
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
        return context.getBytes(centralRecord.localHeaderOffset, LocalFileHeaderFixedView.byteLength)
        .then(function(rawLocalRecord) {
          var localRecord = new LocalRecordView(
            rawLocalRecord.buffer,
            rawLocalRecord.byteOffset,
            rawLocalRecord.byteLength);
          
          context.addEntry(
            context.getBytes(
              record.localHeaderOffset
                + LocalFileHeaderFixedView.byteLength
                + localFixed.pathByteLength
                + localFixed.extraByteLength,
              compressedByteLength),
            {
              path: centralRecord.path,
              date: centralRecord.modifiedAt,
              creationSystem: centralRecord.creationSystem,
            });
        });
      });
      context.getBytes
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
    get localHeaderOffset() {
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
