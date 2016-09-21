define(['msdos/util', 'text', 'Item', 'services'], function(dosUtil, text, Item, services) {

  'use strict';
  
  services.decompression = services.decompression || services.create();
  
  function open() {
    var byteSource = this.byteSource;
    this.addExplorer(function(expedition) {
      byteSource.slice(-TrailerView.fixedByteLength).getBytes()
      .then(function(rawTrailer) {
        var trailer = new TrailerView(rawTrailer.buffer, rawTrailer.byteOffset, rawTrailer.byteLength);
        if (!trailer.hasValidSignature) {
          // TODO: support comments
          throw new Exception('ZIP files with comments not supported');
        }
        if (trailer.currentDiskEntryCount !== trailer.totalEntryCount) {
          // TODO: support multi-part ZIP files
          throw new Exception('multi-part ZIP files not supported');
        }
        var pos = trailer.centralDirectoryFirstDiskOffset, len = trailer.centralDirectoryByteLength;
        return byteSource.slice(pos, pos + len).getBytes()
        .then(function(rawCentralDirectory) {
          var fileRecords = CentralFileRecordView.getList(
            trailer.totalEntryCount,
            rawCentralDirectory.buffer,
            rawCentralDirectory.byteOffset,
            rawCentralDirectory.byteLength);
          Promise.all(
            fileRecords.slice(0,1).map(function(record) {
              var compressedLength = record.compressedSize32; // TODO: support Zip64
              var uncompressedLength = record.uncompressedSize32;
              return byteSource.slice(
                record.localHeaderOffset,
                record.localHeaderOffset + LocalFileHeaderFixedView.byteLength)
              .getBytes()
              .then(function(rawLocalFixed) {
                var localFixed = new LocalFileHeaderFixedView(
                  rawLocalFixed.buffer,
                  rawLocalFixed.byteOffset,
                  rawLocalFixed.byteLength);
                var offset = record.localHeaderOffset
                  + LocalFileHeaderFixedView.byteLength
                  + localFixed.pathByteLength
                  + localFixed.extraByteLength;
                return byteSource.slice(offset, offset + compressedLength).getBytes();
              })
              .then(function(compressed) {
                var uncompressed = new Uint8Array(uncompressedLength);
                var pre = performance.now();
                return services.decompression.load('inflate')
                .then(function(inflate) {
                  return inflate.init({nowrap:true});
                })
                .then(function(inflater) {
                  return inflater.process(
                    [compressed, uncompressed],
                    [compressed.buffer, uncompressed.buffer]);
                })
                .then(function(values) {
                  console.log(values);
                });
              });
            })
          )
          .then(function(allUncompressed) {
            console.log(allUncompressed);
          });
        });
      });
      /*
      function onLocalFileHeader(bytes) {
        var signature = String.fromCharCode.apply(null, bytes.subarray(0, 4));
        switch (signature) {
          case LocalFileHeaderFixedView.signature: break;
          default: return expedition.conclude();
        }
        var fixedPart = new LocalFileHeaderFixedView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (fixedPart.hasDataDescriptor) {
          // TODO: support this (requires skipping past the compressed data manually)
          throw new Exception('data descriptor not yet supported');
        }
        byteSource = byteSource.slice(LocalFileHeaderFixedView.byteLength);
        return byteSource.slice(0, fixedPart.pathByteLength + fixedPart.extraByteLength).getBytes()
        .then(function(bytes) {
          var pathBytes = bytes.subarray(0, fixedPart.pathByteLength);
          var extraBytes = bytes.subarray(fixedPart.pathByteLength);
          var path;
          if (fixedPart.hasUTF8Encoding) {
            path = text.decodeUTF8(pathBytes);
          }
          else {
            path = dosUtil.decodeLatinUS(pathBytes);
          }
          var extra = ExtraFieldView.getMap(extraBytes.buffer, extraBytes.byteOffset, extraBytes.byteLength);
          var compressedLength;
          if (fixedPart.isZip64) {
            if (!('zip64' in extra)) throw new Exception('missing zip64 info');
            compressedLength = extra.zip64.compressedFloat64;
            if (isNaN(compressedLength)) throw new Exception('compressed file size too big to handle');
          }
          else {
            compressedLength = fixedPart.compressedSize32;
          }
          console.log(path, compressedLength, fixedPart, extra);
          var compressedByteSource = byteSource.slice(0, compressedLength);
          var entryItem = new Item(compressedByteSource);
          entryItem.path = path;
          expedition.foundItem(entryItem);
          byteSource = byteSource.slice(compressedLength);
          return byteSource.slice(0, LocalFileHeaderFixedView.byteLength).getBytes().then(onLocalFileHeader);
        });
      }
      byteSource.slice(0, LocalFileHeaderFixedView.byteLength).getBytes().then(onLocalFileHeader);
      */
    });
  }
  
  function TrailerView(buffer, byteSource, byteLength) {
    this.dataView = new DataView(buffer, byteSource, byteLength);
    this.bytes = new Uint8Array(buffer, byteSource, byteLength);
  }
  TrailerView.prototype = {
    get hasValidSignature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === TrailerView.signature;
    },
    get diskNumber() {
      return this.dataView.getUint16(4, true);
    },
    get centralDirectoryFirstDiskNumber() {
      return this.dataView.getUint16(6, true);
    },
    get currentDiskEntryCount() {
      return this.dataView.getUint16(8, true);
    },
    get totalEntryCount() {
      return this.dataView.getUint16(10, true);
    },
    get centralDirectoryByteLength() {
      return this.dataView.getUint32(12, true);
    },
    get centralDirectoryFirstDiskOffset() {
      return this.dataView.getUint32(16, true);
    },
    get commentByteLength() {
      return this.dataView.getUint16(20, true);
    },
  };
  TrailerView.signature = 'PK\x05\x06';
  TrailerView.fixedByteLength = 22;
  
  function CentralFileRecordView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  CentralFileRecordView.prototype = {
    get hasValidSignature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === CentralFileRecordView.signature;
    },
    get creationSystem() {
      var systemCode = this.dataView.getUint8(5);
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
      return this.dataView.getUint8(4);
    },
    get requiredPKZipVersion() {
      return this.dataView.getUint16(6, true) / 10;
    },
    get flags() {
      return this.dataView.getUint16(8, true);
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
      var methodCode = this.dataView.getUint16(10, true);
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
      return dosUtil.getTimeAndDate(this.dataView, 12);
    },
    get crc32() {
      return ('0000000' + this.dataView.getUint32(16, true).toString(16).toUpperCase()).slice(-8);
    },
    get compressedSize32() {
      return this.dataView.getUint32(20, true);
    },
    get uncompressedSize32() {
      return this.dataView.getUint32(24, true);
    },
    get isZip64() {
      return this.compressedSize32 === 0xffffffff && this.uncompressedSize32 === 0xffffffff;
    },
    get pathByteLength() {
      return this.dataView.getUint16(28, true);
    },
    get extraByteLength() {
      return this.dataView.getUint16(30, true);
    },
    get commentByteLength() {
      return this.dataView.getUint16(32, true);
    },
    get firstDiskNumber() {
      return this.dataView.getUint16(34, true);
    },
    get internalAttributes() {
      return this.dataView.getUint16(36, true);
    },
    get isApparentlyTextFile() {
      return !!(this.internalAttributes && (1 << 0));
    },
    get hasControlFieldRecordsBeforeLogicalRecords() {
      return !!(this.internalAttributes && (1 << 2));
    },
    get externalAttributes() {
      return this.dataView.getUint32(38, true);
    },
    get localHeaderOffset() {
      return this.dataView.getUint32(42, true);
    },
    get pathPos() {
      return CentralFileRecordView.fixedByteLength;
    },
    get decode() {
      return this.hasUTF8Encoding ? text.decodeUTF8 : dosUtil.decodeLatinUS;
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
  CentralFileRecordView.signature = 'PK\x01\x02';
  CentralFileRecordView.fixedByteLength = 46;
  CentralFileRecordView.getList = function(count, buffer, byteOffset, byteLength) {
    var list = [];
    var pos = 0;
    for (; count > 0; count--) {
      var record = new CentralFileRecordView(buffer, byteOffset + pos, byteLength - pos);
      pos += record.byteLength;
      list.push(record);
    }
    return list;
  };
  
  function LocalFileHeaderFixedView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  LocalFileHeaderFixedView.prototype = {
    get hasValidSignature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === LocalFileHeaderFixedView.signature;
    },
    get version() {
      return this.dataView.getUint16(4, true) / 10;
    },
    get flags() {
      return this.dataView.getUint16(6, true) / 10;
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
      var methodCode = this.dataView.getUint16(8, true);
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
      return dosUtil.getTimeAndDate(this.dataView, 0xA);
    },
    get crc32() {
      return ('0000000' + this.dataView.getUint32(0xE, true).toString(16).toUpperCase()).slice(-8);
    },
    get compressedSize32() {
      return this.dataView.getUint32(0x12, true);
    },
    get uncompressedSize32() {
      return this.dataView.getUint32(0x16, true);
    },
    get isZip64() {
      return this.compressedSize32 === 0xffffffff && this.uncompressedSize32 === 0xffffffff;
    },
    get pathByteLength() {
      return this.dataView.getInt16(0x1a, true);
    },
    get extraByteLength() {
      return this.dataView.getInt16(0x1c, true);
    },
  };
  LocalFileHeaderFixedView.byteLength = 0x1e;
  LocalFileHeaderFixedView.signature = 'PK\x03\x04';
  
  function ExtraFieldView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  ExtraFieldView.prototype = {
    get type() {
      var typeCode = this.dataView.getUint16(0, true);
      switch(typeCode) {
        default: return typeCode;
        case 0x0001: return 'zip64';
        case 0x0007: return 'avInfo';
        case 0x0009: return 'os2';
        case 0x000A: return 'win95';
        case 0x000C: return 'openVMS';
        case 0x000D: return 'unix';
        case 0x000F: return 'patch';
        case 0x0014: return 'x509_PKCS7Store';
        case 0x0015: return 'x509_fileCertAndSig';
        case 0x0016: return 'x509_centralFolderCert';
        case 0x0017: return 'strongEncryption';
        case 0x0018: return 'recordManagementControls';
        case 0x0019: return 'pkcs7EncryptionRecipientCertificateList';
        case 0x0065: return 'z390_i400';
        case 0x0066: return 'z390_i400_compressed';
        case 0x07c8: return 'mac_infoZipOld';
        case 0x2605: return 'mac_zipIt';
        case 0x2705: return 'mac_zipIt1_3_5';
        case 0x2805: return 'mac_zipIt1_3_5+';
        case 0x334d: return 'mac_infoZipNew';
        case 0x4154: return 'tandemNSK';
        case 0x4341: return 'acorn/SparkFS';
        case 0x4453: return 'winNTSecurityDescriptor';
        case 0x4704: return 'VM/CMS';
        case 0x470f: return 'MVS';
        case 0x4854: return 'Theos';
        case 0x4b46: return 'FWKCS_MD5';
        case 0x4c41: return 'OS/2 access control list';
        case 0x4d49: return 'Info-ZIP OpenVMS (obsolete)';
        case 0x4d63: return 'mac_smartZIP';
        case 0x4f4c: return 'Xceed original location extra field';
        case 0x5356: return 'AOS/VS';
        case 0x5455: return 'extended timestamp';
        case 0x554e: return 'Xceed unicode extra field';
        case 0x5855: return 'Info-ZIP Unix (original; also OS/2, NT, etc.)';
        case 0x6542: return 'BeOS (BeBox, PowerMac, etc.)';
        case 0x6854: return 'Theos';
        case 0x7441: return 'AtheOS (AtheOS/Syllable attributes)';
        case 0x756e: return 'ASi Unix';
        case 0x7855: return 'Info-ZIP Unix (new)';
        case 0xfb4a: return 'SMS/QDOS';
      }
    },
    get dataByteLength() {
      return this.dataView.getUint16(2, true);
    },
    get dataBuffer() {
      return this.dataView.buffer;
    },
    get dataByteOffset() {
      return this.dataView.byteOffset + 4;
    },
    get rawData() {
      return new Uint8Array(this.dataBuffer, this.dataByteOffset, this.dataByteLength);
    },
    get dataObject() {
      switch(this.type) {
        case 'zip64': return new Zip64View(this.dataBuffer, this.dataByteOffset, this.dataByteLength);
        default: return this.rawData;
      }
    },
  };
  ExtraFieldView.getList = function(buffer, byteOffset, byteLength) {
    var dataView = new DataView(buffer, byteOffset, byteLength);
    var list = [];
    var pos = 0;
    while (pos < byteLength) {
      var extraField = new ExtraFieldView(buffer, byteOffset + pos, byteLength - pos);
      list.push(extraField);
      pos += 4 + extraField.dataByteLength;
    }
    return list;
  };
  ExtraFieldView.getMap = function(buffer, byteOffset, byteLength) {
    var map = {};
    var list = ExtraFieldView.getList(buffer, byteOffset, byteLength);
    for (var i = 0; i < list.length; i++) {
      map[list[i].type] = list[i].dataObject;
    }
    return map;
  };
  
  function safeFloat64Int(lo, hi) {
    return (hi > 0x200000) ? NaN : hi * Math.pow(2, 32) + lo;
  }
  
  function Zip64View(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  Zip64View.prototype = {
    get uncompressedLow32() {
      return this.getUint32(0, true);
    },
    get uncompressedHigh32() {
      return this.getUint32(4, true);
    },
    get uncompressedFloat64() {
      return safeFloat64Int(this.uncompressedLow32, this.uncompressedHigh32);
    },
    get compressedLow32() {
      return this.getUint32(8, true);
    },
    get uncompressedHigh32() {
      return this.getUint32(12, true);
    },
    get compressedFloat64() {
      return safeFloat64Int(this.compressedLow32, this.compressedHigh32);
    },
    get offsetLow32() {
      return this.getUint32(16, true);
    },
    get offsetHigh32() {
      return this.getUint32(20, true);
    },
    get firstDisk() {
      return this.getUint32(24, true);
    },
  };
  
  return open;

});
