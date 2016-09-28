define(function() {

  'use strict';
  
  function split(entries) {
    var rootSegment = this;
    var headerSegment = rootSegment.getSegment('image/x-gif-header', 0, GIFHeaderView.byteLength + 1);
    return headerSegment.getBytes()
    .then(function(rawHeader) {
      var header = new GIFHeaderView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
      if (!header.hasValidSignature) return Promise.reject('GIF header not found');
      if (entries.accepted('image/x-gif-header')) {
        entries.add(headerSegment);
      }
      var pos = GIFHeaderView.byteLength;
      var knownChunkCode;
      var paletteByteLength = header.globalColorCount * 3;
      if (paletteByteLength > 0) {
        var paletteType = 'image/x-palette; format=r8g8b8; scope=global';
        if (entries.accepted(globalColorTableType)) {
          entries.add(rootSegment.getSegment(paletteType, pos, paletteByteLength));
        }
        pos += paletteByteLength;
        knownChunkCode = rootSegment.getBytes(pos, 1).then(function(b){ return b[0]; });
      }
      else {
        knownChunkCode = Promise.resolve(rawHeader[pos]);
      }
      function onDataBlocks(startPos, rawLengthNext, type) {
        if (rawLengthNext[0] === 0) {
          pos++;
          return nextChunk(rawLengthNext[1]);
        }
        pos += 1 + rawLengthNext[0];
        return rootSegment.getBytes(pos, 2)
        .then(function(rawLengthNext) {
          return onDataBlocks(startPos, rawLengthNext, type);
        });
      }
      function onImageDescriptor() {
        return rootSegment.getBytes(pos, ImageDescriptor.byteLength + 3)
        .then(function(rawDescriptor) {
          var descriptor = new ImageDescriptor(rawDescriptor);
          var descriptorType = 'image/x-gif-image-descriptor';
          if (entries.accepted(descriptorType)) {
            entries.add(rootSegment.getSegment(descriptorType, pos, ImageDescriptor.byteLength));
          }
          pos += ImageDescriptor.byteLength;
          var knownNextBytes;
          var paletteByteLength = imageDescriptor.localColorCount * 3;
          if (paletteByteLength > 0) {
            var paletteType = 'image/x-palette; format=r8g8b8; scope=local';
            if (entries.accepted(paletteType)) {
              entries.add(rootSegment.getSegment(paletteType, pos, paletteByteLength));
            }
            pos += paletteByteLength;
            knownNextBytes = rootSegment.getBytes(pos, 3);
          }
          else {
            knownNextBytes = Promise.resolve(rawDescriptor.subarray(ImageDescriptor.byteLength));
          }
          return knownNextBytes.then(function(nextBytes) {
            var imageDataType = 'image/x-gif-block-stream; data=image; mincodesize=' + nextBytes[0];
            pos++;
            return onDataBlocks(pos, nextBytes.subarray(1), imageDataType);
          });
        });
      }
      function onExtension(rawStart) {
        var extensionType = rawStart[0];
        switch(extensionType) {
          case 0xF9: extensionType = 'graphics-control'; break;
          case 0x01: extensionType = 'plain-text'; break;
          case 0xFF: extensionType = 'application'; break;
          case 0x21: extensionType = 'comment'; break;
          default: extensionType = 'extension-0x' + ('0' + extensionType.toString(16).toUpperCase()).slice(-2); break;
        }
        pos++;
        return onDataBlocks(pos, rawStart.subarray(1), 'image/x-gif-block-stream; data=' + extensionType);
      }
      function nextChunk(chunkCode) {
        pos++;
        switch (chunkCode) {
          case 0x21:
            return rootSegment.getBytes(pos, 2 + 1).then(onExtension);
          case 0x2C:
            return rootSegment.getBytes(pos, ImageDescriptorView.byteLength).then(onImageDescriptor);
          case 0x3F: // trailer byte, terminate
            return;
          default:
            return Promise.reject('unknown GIF chunk code: 0x' + chunkCode.toString(16));
        }
      }
      return knownChunkCode.then(nextChunk);
    });
  }
  
  function GIFHeader(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  GIFHeader.prototype = {
    get signature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 6));
    },
    get hasValidSignature() {
      return /^GIF8[79]a$/.test(this.signature);
    },
    get width() {
      return this.dv.getUint16(6, true);
    },
    get height() {
      return this.dv.getUint16(8, true);
    },
    get flags() {
      return this.bytes[10];
    },
    get globalColorCount() {
      var packed = this.bytes[10];
      return packed & 0x01 ? 2 << ((packed >> 5) & 7) : 0;
    },
    get areGlobalColorsPrioritized() {
      return !!(this.flags & (1 << 4));
    },
    get displayDeviceColorCount() {
      var packed = this.bytes[10];
      return packed & 0x01 ? 2 << ((packed >> 1) & 7) : 0;
    },
    get backgroundColorNumber() {
      return this.bytes[11];
    },
    get displayDevicePixelAspectRatio() {
      return this.bytes[12] ? (this.bytes[12] + 15) / 64 : 1;
    },
  };
  GIFHeaderView.byteLength = 13;
  
  function ImageDescriptorView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  ImageDescriptorView.prototype = {
    get x() {
      return this.dv.getInt16(0, true);
    },
    get y() {
      return this.dv.getInt16(2, true);
    },
    get width() {
      return this.dv.getUint16(4, true);
    },
    get height() {
      return this.dv.getUint16(6, true);
    },
    get flags() {
      return this.dv.getUint8(8, true);
    },
    get localColorCount() {
      var packed = this.flags;
      return packed & 1 ? 2 << (packed >>> 4) : 0;
    },
    get isInterlaced() {
      return !!(this.flags & (1 << 1));
    },
    get areLocalColorsPrioritized() {
      return !!(this.flags & (1 << 2));
    },
  };
  ImageDescriptorView.byteLength = 9;
  
  return {
    split: split,
  };

});
