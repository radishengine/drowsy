define(['Format', 'DataSegment'], function(Format, DataSegment) {

  'use strict';
  
  var compressedFormats = {
    shrunk: Format('application/x-lzw; variant=shrink'),
    factor1: Format('application/x-reduced; factor=1'),
    factor2: Format('application/x-reduced; factor=2'),
    factor3: Format('application/x-reduced; factor=3'),
    factor4: Format('application/x-reduced; factor=4'),
    imploded: Format('application/x-ibm-terse; variant=old'),
    deflated: Format('application/x-deflated'),
    enhancedDeflated: Format('application/x-deflated; variant=deflate64'),
    dclImploded: Format('application/x-imploded; variant=dcl'),
    bzip2: Format('application/x-bzip2'),
    lzma: Format('application/x-lzma'),
    terse: Format('application/x-ibm-terse; variant=new'),
    lz77: Format('application/x-lz77'),
    jpeg: Format('image/jpeg'),
    wavpack: Format('audio/x-wavpack'),
    ppmd: Format('application/x-ppmd; version=i; rev=1'),
    aes: Format('application/x-aes'),
  };
  
  function mount(zip, volume) {
    var promises = [];
    return zip.split(
      function(entry) {
        if (entry.getTypeParameter('type') !== 'local') return;
        var offset = +entry.getTypeParameter('offset');
        var headerSegment = entry.getSegment(entry.type, 0, offset);
        promises.push(headerSegment.getStruct().then(function(record) {
          var format = volume.guessTypeForFilename(record.path);
          if (record.compressionMethod !== 'none') {
            var encodedFormat = format;
            if (record.compressionMethod in compressedFormats) {
              format = compressedFormats[record.compressedMethod];
            }
            else {
              throw new Error('unknown compression method: ' + record.compressedMethod);
            }
            var full = record.uncompressedByteLength32; // TODO: zip64
            encodedFormat = encodedFormat.toString();
            if (encodedFormat !== 'application/octet-stream') {
              format = new Format(format, {encoded:encodedFormat, full:full});
            }
            else {
              format = new Format(format, {full:full});
            }
          }
          var normalizedPath = record.path.split('/').map(encodeURIComponent).join('/');
          volume.addFile(normalizedPath, entry.getSegment(format, offset));
        }));
      },
      function() {
        return Promise.all(promises);
      });
  }
  
  var TRAILER_TYPE = Format('chunk/zip; type=trailer');
  var CENTRAL_RECORD_TYPE = Format('chunk/zip; type=central');
  var LOCAL_RECORD_TYPE = Format('chunk/zip; type=local');
  
  function join(parts) {
    var knownLengths = parts.map(function(part){ return part.getLength(); });
    return Promise.all(knownLengths).then(function(lengths) {
      var cumulativeOffsets = new Array(lengths.length);
      cumulativeOffsets[0] = 0;
      for (var i = 0; i < lengths.length - 1; i++) {
        cumulativeOffsets[i+1] = cumulativeOffsets[i] + lengths[i];
      }
      return DataSegment.from(parts, 'application/zip; parts=' + cumulativeOffsets.join(','));
    });
  }
  
  function split(segment, entries) {
    var partOffsets = segment.getTypeParameter('parts');
    partOffsets = partOffsets ? partOffsets.split(',').map(parseInt) : [0];
    var trailerSegment = segment.getSegment(TRAILER_TYPE, 'suffix', TrailerView.byteLength);
    return trailerSegment.getBytes().then(function(rawTrailer) {
      var trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset, rawTrailer.byteLength);
      if (trailer.hasValidSignature && trailer.commentByteLength === 0) {
        if (entries.accepted(TRAILER_TYPE)) {
          entries.add(trailerSegment);
        }
        return trailer;
      }
      // do the dance
      var minSize = TrailerView.byteLength + 1;
      var maxSize = TrailerView.byteLength + 0xffff;
      var nextOffset = -minSize;
      trailerSegment = segment.getSegment(segment.type, 'suffix', minSize, maxSize);
      function onTrackback(rawTrailer) {
        trailer = null;
        var pos;
        findTrailer: for (pos = rawTrailer.length + nextOffset; pos >= 3; pos -= 4) {
          switch (rawTrailer[pos]) {
            case 0x50: // 'P'
              if (rawTrailer[pos+1] === 0x4B && rawTrailer[pos+2] === 0x05 && rawTrailer[pos+3] === 0x06) {
                trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos, TrailerView.byteLength);
                if (trailer.commentByteLength === (rawTrailer.length - pos - 1 - TrailerView.byteLength)) {
                  trailerSegment = trailerSegment.getSegment(TRAILER_TYPE, 'suffix', pos - rawTrailer.length);
                  break findTrailer;
                }
                trailer = null;
              }
              continue findTrailer;
            case 0x4B: // 'K'
              if (rawTrailer[pos-1] === 0x50 && rawTrailer[pos+1] === 0x05 && rawTrailer[pos+2] === 0x06) {
                trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos - 1, TrailerView.byteLength);
                if (trailer.commentByteLength === (rawTrailer.length - pos - 1 - TrailerView.byteLength)) {
                  trailerSegment = segment.getSegment(TRAILER_TYPE, bufferPos + pos - 1);
                  break findTrailer;
                }
                trailer = null;
              }
              continue findTrailer;
            case 0x05: // '\x05'
              if (rawTrailer[pos-2] === 0x50 && rawTrailer[pos-1] === 0x4B && rawTrailer[pos+1] === 0x06) {
                trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos - 2, TrailerView.byteLength);
                if (trailer.commentByteLength === (rawTrailer.length - pos - 2- TrailerView.byteLength)) {
                  trailerSegment = segment.getSegment(TRAILER_TYPE, bufferPos + pos - 2);
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
        if (!trailerSegment) {
          if (rawTrailer.length >= maxSize) {
            return Promise.reject('zip trailer not found (part of a multi-part archive?)');
          }
          nextOffset = pos - rawTrailer.length;
          minSize = rawTrailer.length + 1;
          trailerSegment = segment.getSegment(segment.type, 'suffix', minSize, maxSize);
          return trailerSegment.getBytes().then(onTrackback);
        }
        if (entries.accepted(TRAILER_TYPE)) {
          entries.add(trailerSegment);
        }
        rawTrailer = new Uint8Array(rawTrailer.subarray(pos, pos + TrailerView.byteLength));
        return new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset + pos, TrailerView.byteLength);
      }
      return trailerSegment.getBytes().then(onTrackback);
    })
    .then(function(trailer) {
      if (trailer.totalEntryCount === 0 || (
          !entries.accepted(CENTRAL_RECORD_TYPE)
          && !entries.accepted(LOCAL_RECORD_TYPE))) {
        return;
      }
      if (trailer.trailerPartNumber !== partOffsets.length - 1) {
        if (partOffsets.length === 1) {
          return Promise.reject('multipart zip archives must be joined before reading');
        }
        else {
          return Promise.reject('joined-up multipart zip archive has incorrect number of parts');
        }
      }
      var pos = partOffsets[trailer.centralDirPartNumber] + trailer.centralDirOffset;
      var count = trailer.totalEntryCount;
      var pending = [];
      function onPart(rawCentral) {
        var central = new CentralRecordView(rawCentral.buffer, rawCentral.byteOffset, rawCentral.byteLength);
        var localOffset = partOffsets[central.partNumber] + central.localRecordOffset;
        if (entries.accepted(CENTRAL_RECORD_TYPE)) {
          entries.add(segment.getSegment(CENTRAL_RECORD_TYPE, pos, central.byteLength));
        }
        if (entries.accepted(LOCAL_RECORD_TYPE)) {
          pending.push(segment.getBytes(localOffset, LocalRecordView.byteLength)
          .then(function(rawLocal) {
            var local = new LocalRecordView(rawLocal.buffer, rawLocal.byteOffset, rawLocal.byteLength);
            var localType = LOCAL_RECORD_TYPE + '; offset=' + local.contentOffset;
            entries.add(segment.getSegment(localType, localOffset, local.byteLength));
          }));
        }
        if (--count > 0) {
          pos += central.byteLength;
          return segment.getBytes(pos, CentralRecordView.fixedByteLength).then(onPart);
        }
        else {
          return Promise.all(pending);
        }
      }
      return segment.getBytes(pos, CentralRecordView.fixedByteLength).then(onPart);
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
    get trailerPartNumber() {
      return this.dv.getUint16(4, true);
    },
    get centralDirPartNumber() {
      return this.dv.getUint16(6, true);
    },
    get trailerPartEntryCount() {
      return this.dv.getUint16(8, true);
    },
    get totalEntryCount() {
      return this.dv.getUint16(10, true);
    },
    get centralDirByteLength() {
      return this.dv.getUint32(12, true);
    },
    get centralDirOffset() {
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
      return this.compressedByteLength32 === 0xffffffff && this.uncompressedByteLength32 === 0xffffffff;
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
    get partNumber() {
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
    get compressedByteLength32() {
      return this.dv.getUint32(0x12, true);
    },
    get uncompressedByteLength32() {
      return this.dv.getUint32(0x16, true);
    },
    get isZip64() {
      return this.compressedByteLength32 === 0xffffffff && this.uncompressedByteLength32 === 0xffffffff;
    },
    get pathByteLength() {
      return this.dv.getInt16(0x1a, true);
    },
    get extraByteLength() {
      return this.dv.getInt16(0x1c, true);
    },
    get contentOffset() {
      return LocalRecordView.byteLength + this.pathByteLength + this.extraByteLength;
    },
    get byteLength() {
      return this.contentOffset + this.compressedByteLength32;
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
    splitTo: Format('chunk/zip'),
    split: split,
    join: join,
    mount: mount,
    bytePattern: /PK\x05\x06.{18}.{0,65535}$/,
  };

});
