define(['../../msdos/util'], function(dosUtil) {

  'use strict';
  
  function split(rootSegment, entries) {
    var headerSegment = rootSegment.getSegment('chunk/flic; type=file', 0, HeaderView.byteLength);
    return headerSegment.getBytes().then(function(rawHeader) {
      var header = new HeaderView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
      if (entries.accepted('chunk/flic; type=file')) {
        entries.add(headerSegment);
      }
      var pos = HeaderView.byteLength;
      var end = header.totalByteLength;
      function onContainerChunk(typeName, headerLength, totalLength) {
        // TODO: use totalLength to skip if every possible subchunk type is not permissable
        typeName = 'chunk/flic; type=' + typeName;
        if (entries.accepted(typeName)) {
          entries.add(rootSegment.getSegment(typeName, pos, headerLength));
        }
        pos += headerLength;
        if (pos < end) return rootSegment.getBytes(pos, 6).then(onChunk);
      }
      function onChunk(rawHeader) {
        var chunkLength = rawHeader[0] | (rawHeader[1] << 8) | (rawHeader[2] << 16) | (rawHeader[3] << 24);
        var chunkType = rawHeader[4] | (rawHeader[5] << 8);
        pos += 6;
        switch (chunkType) {
          case 0xF100: return onContainerChunk('prefix', 4, chunkLength);
          case 0xF1FA: return onContainerChunk('frame', 10, chunkLength);
          case 0xF1FB: return onContainerChunk('segment-table', 2, chunkLength);
          
          case 0x0003: chunkType = 'cel-data'; break;
          case 0x0004: chunkType = 'palette; bits=8'; break;
          case 0x0007: chunkType = 'delta-rle; unit=word'; break;
          case 0x000B: chunkType = 'palette; bits=6'; break;
          case 0x000C: chunkType = 'delta-rle; unit=byte'; break;
          case 0x000D: chunkType = 'full-black'; break;
          case 0x000F: chunkType = 'full-rle-8bit'; break;
          case 0x0010: chunkType = 'full-uncompressed'; break; // rare
          case 0x0012: chunkType = 'postage-stamp'; break; // icon of the first frame
          case 0x0019: chunkType = 'full-rle; unit=pixel'; break;
          case 0x001A: chunkType = 'uncompressed-image'; break;
          case 0x001B: chunkType = 'delta-rle; unit=pixel'; break;
          case 0x001F: chunkType = 'frame-label'; break;
          case 0x0020: chunkType = 'bitmap-mask'; break;
          case 0x0021: chunkType = 'multilevel-mask'; break;
          case 0x0022: chunkType = 'segment-information'; break;
          case 0x0023: chunkType = 'key-image'; break;
          case 0x0024: chunkType = 'key-palette'; break;
          case 0x0025: chunkType = 'region-of-frame-differences'; break;
          case 0x0026: chunkType = 'digitized-audio'; break;
          case 0x0027: chunkType = 'user-data'; break;
          case 0x0028: chunkType = 'region-mask'; break;
          case 0x0029: chunkType = 'extended-frame-label'; break;
          case 0x002A: chunkType = 'scanline-delta-shifts'; break;
          case 0x002B: chunkType = 'path-map'; break;
          default: chunkType = '0x' + chunkType.toString(16).toUpperCase();
        }
        chunkType = 'chunk/flic; type=' + chunkType;
        if (entries.accepted(chunkType)) {
          entries.add(rootSegment.getSegment(chunkType, pos, chunkLength));
        }
        pos += chunkLength + chunkLength % 2;
        if (pos < end) return rootSegment.getBytes(pos, 6).then(onChunk);
      }
      if (pos < end) return rootSegment.getBytes(pos, 6).then(onChunk);
    });
  }
  
  function HeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  HeaderView.prototype = {
    get totalByteLength() {
      return this.dv.getUint32(0, true);
    },
    get fileType() {
      var value = this.dv.getUint16(4, true);
      switch (value) {
        case 0xAF11: return 'fli';
        case 0xAF12: return 'flic8BitDepth';
        case 0xAF44: return 'flicNon8BitDepth';
        case 0xAF30: return 'flicHuffmanOrBWTCompression';
        case 0xAF31: return 'flicFrameShiftCompression';
        default: return value;
      }
    },
    get frameCountInFirstSegment() {
      return this.dv.getUint16(6, true);
    },
    get width() {
      return this.dv.getUint16(8, true);
    },
    get height() {
      return this.dv.getUint16(10, true);
    },
    get bitsPerPixel() {
      return this.dv.getUint16(12, true);
    },
    get flags() {
      return this.dv.getUint16(14, true);
    },
    get frameDuration() {
      var value = this.dv.getUint32(16, true);
      return this.fileType === 'fli' ? (value * 1000)/70 : value; // millisecond conversion
    },
    // 2 reserved bytes
    get createdAt() {
      return dosUtil.getTimeAndDate(this.dv, 22); // FLC only
    },
    get creatorID() {
      return this.dv.getUint32(26, true); // FLC only
    },
    get updatedAt() {
      return dosUtil.getTimeAndDate(this.dv, 30); // FLC only
    },
    get updaterID() {
      return this.dv.getUint32(34, true); // FLC only
    },
    get aspectWidth() {
      return this.dv.getUint16(38, true); // FLC only
    },
    get aspectHeight() {
      return this.dv.getUint16(40, true); // FLC only
    },
    get egiExtensionFlags() {
      return this.dv.getUint16(42, true); // EGI only
    },
    get keyFrameFrequency() {
      return this.dv.getUint16(44, true); // EGI only
    },
    get frameCount() {
      return this.dv.getUint16(46, true); // EGI only
    },
    get maxUncompressedChunkSize() {
      return this.dv.getUint32(48, true); // EGI only
    },
    get maxRegionsInCHK_REGION() {
      return this.dv.getUint16(52, true); // EGI only
    },
    get transparentLevelCount() {
      return this.dv.getUint16(54, true);
    },
    get frameOffset1() {
      return this.dv.getUint32(80, true); // FLC only
    },
    get frameOffset2() {
      return this.dv.getUint32(84, true); // FLC only
    },
    // reserved: 40 bytes
  };
  HeaderView.byteLength = 128;
  
  return {
    split: split,
    bytePattern: /^.{4}[\x11\x12\x44\x30\x31]\xAF/,
  };

});
