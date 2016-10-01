define(function() {

  'use strict';
  
  var typeNames;
  
  function split(rootSegment, entries) {
    return rootSegment.getBytes(0, 9)
    .then(function(rawPartialHeader) {
      var headerSize = 8 + Math.max(1, Math.ceil(((5 + (rawPartialHeader[8] >>> 3)) * 4) / 8)) + 4;
      if (entries.accepted('chunk/swf; which=header')) {
        entries.add(rootSegment.getSegment('chunk/swf; which=header', 0, headerSize));
      }
      return rootSegment.getBytes(0, headerSize);
    })
    .then(function(rawHeader) {
      var header = new SWFHeaderView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
      var chunkStream;
      var end = header.fileLength - rawHeader.byteLength;
      if (end === 0) return;
      switch (header.compression) {
        case 'none':
          chunkStream = rootSegment.getSegment('', rawHeader.byteLength, end);
          break;
        case 'zlib':
          chunkStream = rootSegment.getSegment('application/zlib', rawHeader.byteLength)
          .getTransformedSegment('', 0, end);
          break;
        case 'lzma':
          chunkStream = rootSegment.getSegment('application/x-raw-lzma', rawHeader.byteLength)
          .getTransformedSegment('', 0, end);
          break;
        default: throw new Error('unknown compression method');
      }
      function onChunk(rawHeader) {
        var tagCodeAndLength = rawHeader[0] | rawHeader[1] << 8;
        var tagCode = tagCodeAndLength >>> 6;
        var shortLength = tagCodeAndLength & ((1 << 6) - 1);
        var chunkType = 'chunk/swf; which=' + (typeNames[tagCode] || tagCode);
        var chunkHeaderLength, bodyLengthKnown;
        if (shortLength < 0x3f) {
          chunkHeaderLength = 2;
          bodyLengthKnown = Promise.resolve(shortLength);
        }
        else {
          chunkHeaderLength = 6;
          bodyLengthKnown = chunkStream.getBytes(2, 4)
          .then(function(rawLongLength) {
            return rawLongLength[0] | rawLongLength[1] << 8 | rawLongLength[2] << 16 | rawLongLength[3] << 24;
          });
        }
        return bodyLengthKnown.then(function(chunkBodyLength) {
          if (entries.accepted(chunkType)) {
            entries.add(chunkStream.getSegment(chunkType, chunkHeaderLength, chunkBodyLength));
          }
          end -= chunkHeaderLength + chunkBodyLength;
          if (end > 3) {
            chunkStream = chunkStream.getSegment('', chunkHeaderLength + chunkBodyLength);
            return chunkStream.getBytes(0, 2).then(onChunk);
          }
        });
      }
      return chunkStream.getBytes(0, 2).then(onChunk);
    });
  }
  
  typeNames = {
    '0':'control/end',
    '9':'control/background-rgb',
    '43':'control/frame-label',
    '24':'control/protect',
    '56':'control/export',
    '57':'control/import-swf7',
    '71':'control/import-swf8',
    '58':'control/enable-debugger-swf5',
    '64':'control/enable-debugger-swf6',
    '65':'control/script-limits',
    '66':'control/set-tab-index',
    '69':'control/file-attributes',
    '76':'control/symbol-class',
    '77':'control/metadata',
    '78':'control/scaling-grid',
    '86':'control/scene-and-frame-label-data',
    '1':'show-frame',
    '2':'shape/define-swf1',
    '22':'shape/define-swf2',
    '32':'shape/define-swf3',
    '83':'shape/define-swf8',
    '4':'display-list/place-swf1',
    '5':'display-list/remove-swf1',
    '26':'display-list/place-swf3',
    '28':'display-list/remove-swf3',
    '70':'display-list/place-swf8',
    '6':'bitmap/jpeg-swf1',
    '21':'bitmap/jpeg-swf2', // swf8: png/gif support
    '35':'bitmap/jpeg-swf3', // swf8: png/gif support
    '90':'bitmap/jpeg-swf10', // deblocking parameter
    '8':'bitmap/jpeg-tables',
    '20':'bitmap/lossless-swf2',
    '36':'bitmap/lossless-swf3',
    '46':'morph/shape-swf3',
    '84':'morph/shape-swf8',    
    '7':'button/define-swf1',
    '34':'button/define-swf2',
    '23':'button/define-color-transform',
    '17':'button/define-sound',
    '10':'font/define-swf1',
    '48':'font/define-swf3',
    '75':'font/define-swf8',
    '91':'font/define-swf10',
    '13':'font/info-swf1',
    '62':'font/info-swf6',
    '73':'font/align-zones',
    '88':'font/name',
    '11':'text/static-swf1',
    '33':'text/static-swf3',
    '37':'text/editable-swf4', 
    '74':'text/csm-settings',
    '12':'action/do',
    '59':'action/do-init',
    '82':'action/do-abc', // actionscript container swf9+
    '14':'sound/define',
    '15':'sound/start-or-stop-swf1',
    '89':'sound/start-or-stop-swf9',
    '18':'sound/stream-head-swf1',
    '45':'sound/stream-head-swf3',
    '19':'sound/stream-block',
    '39':'sprite/define',
    '60':'video/stream',
    '61':'video/frame',
    '87':'metadata/binary-data',
    '93':'metadata/enable-telemetry',
    
    //'3':'free-character',
    //'25':'paths-are-postscript',
    //'29':'sync-frame',
    //'31':'free-all',
    //'38':'define-video',
    //'40':'name-character',
    //'41':'product-info',
    //'42':'define-text-format',
    //'47':'generate-frame',
    //'49''generator-command',
    //'50':'define-command-object',
    //'51':'character-set',
    //'52':'external-font',
    //'63':'debug-id',
    //'72':'do-abc-define',
  };
  
  function SWFHeaderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  SWFHeaderView.prototype = {
    get signature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 3));
    },
    get hasValidSignature() {
      return /^[FCZ]WS$/.test(this.signature);
    },
    get compression() {
      switch (this.signature) {
        case 'FWS': return 'none';
        case 'CWS': return 'zlib';
        case 'ZWS': return 'lzma';
        default: return 'unknown';
      }
    },
    get version() {
      return this.bytes[3];
    },
    get fileLength() {
      return this.dv.getUint32(4, true);
    },
    get offsetof_frameRect() {
      return 8;
    },
    // note: x & y of frameRect are always zero, so it is really just width and height
    get sizeof_frameRect() {
      return Math.min(1, Math.ceil((this.bytes[8] >>> 3) / 2));
    },
    get framesPerSecond() {
      return this.dv.getUint16(this.offsetof_frameRect + this.sizeof_frameRect, true);
    },
    get frameCount() {
      return this.dv.getUint16(this.offsetof_frameRect + this.sizeof_frameRect + 2, true);
    },
  };
  
  function RGBView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  RGBView.prototype = {
    get red()   { return this.bytes[0]; },
    get green() { return this.bytes[1]; },
    get blue()  { return this.bytes[2]; },
  };
  
  function StringView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  StringView.prototype = {
    // null terminated
    // SWF1-5: encoding is ANSI or Shift-JIS, depending on the locale of the player client (!)
    // SWF6+: UTF-8
  };
  
  function EmptyView() {
  }
  
  function readNullTerminatedSubarray(bytes, pos) {
    var end = pos;
    while (bytes[end]) end++;
    return bytes.subarray(pos, end);
  }
  
  function ExportView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  ExportView.prototype = {
    get values() {
      var values = new Array(this.getUint16(0, false));
      var pos = 2;
      for (var i = 0; i < values.length; i++) {
        values[i] = {
          id: this.dv.getUint16(pos, false),
          identifier: readNullTerminatedSubarray(this.bytes, pos),
        };
        pos += 2 + values[i].length + 1;
      }
      Object.defineProperty(this, 'values', {value:values});
      return values;
    },
  };
  
  function readTagNameArray(bytes, dv, pos) {
    var imports = new Array(dv.getUint16(pos, true));
    pos += 2;
    for (var i = 0; i < imports.length; i++) {
      var rawName = readNullTerminatedSubarray(bytes, pos + 2); // TODO: encode
      imports[i] = {
        tag: dv.getUint16(pos, true),
        name: rawName, // TODO: encode
      };
      pos += 2 + imports[i].name.length + 1;
    }
    return imports;
  }
  
  function SWF7ImportView(buffer, byteOffset, byteLength) {
    var bytes = new Uint8Array(buffer, byteOffset, byteLength);
    var dv = new DataView(buffer, byteOffset + rawURL.length + 1, byteLength - rawURL.length - 1);
    var rawURL = readNullTerminatedSubarray(bytes, 0);
    this.url = rawURL; // TODO: encode
    this.imports = readTagNameArray(bytes, dv, this.url.length + 1);
  }
  
  function SWF8ImportView(buffer, byteOffset, byteLength) {
    var bytes = new Uint8Array(buffer, byteOffset, byteLength);
    var dv = new DataView(buffer, byteOffset + rawURL.length + 1, byteLength - rawURL.length - 1);
    var rawURL = readNullTerminatedSubarray(bytes, 0);
    this.url = rawURL; // TODO: encode
    // two reserved bytes (must be 1, 0)
    this.imports = readTagNameArray(bytes, dv, this.url.length + 1 + 2);
  }
  
  function OptionalMD5View(buffer, byteOffset, byteLength) {
    if (byteLength === 0) {
      this.md5 = 0;
      return;
    }
    var bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.md5 = parseInt(String.fromCharCode(null, readNullTerminatedSubarray(bytes, 0)), 16) >> 0;
  }
  
  function SWF6EnableDebugger(buffer, byteOffset, byteLength) {
    if (byteLength === 2) {
      this.md5 = 0;
      return;
    }
    var bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.md5 = parseInt(String.fromCharCode(null, readNullTerminatedSubarray(bytes, 2)), 16) >> 0;
  }
  
  function ScriptLimitsView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  ScriptLimitsView.prototype = {
    get maxRecursionDepth()    { return this.dv.getUint16(0, true); },
    get scriptTimeoutSeconds() { return this.dv.getUint16(2, true); },
  };
  
  function SetTabIndexView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  SetTabIndexView.prototype = {
    get depth()    { return this.dv.getUint16(0, true); },
    get tabIndex() { return this.dv.getUint16(2, true); },
  };
  
  function readRect(bytes, pos) {
    var bitCount = bytes[pos] >>> 3;
    if (bitCount === 0) return {top:0, left:0, bottom:0, right:0};
    var bits = 3;
    var hold = bytes[pos] & ((1 << bits) - 1);
    function BITS(n) {
      while (bits < n) {
        hold = (hold << 8) | bytes[pos++];
      }
      var value = hold & ((1 << n) - 1);
      bits -= n; hold >>>= n;
      return value;
    }
    var rect = {};
    rect.top = BITS(bitCount);
    rect.left = BITS(bitCount);
    rect.bottom = BITS(bitCount);
    rect.right = BITS(bitCount);
    return {rect:rect, next:pos};
  }
  
  function FileAttributesView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  FileAttributesView.prototype = {
    // 1 reserved byte
    get useDirectBlit() {
      return !!this.bytes[1]; // SWF10
    },
    get useGPU() {
      return !!this.bytes[2]; // SWF10
    },
    get hasMetadata() {
      return !!this.bytes[3];
    },
    get usesActionScript3() {
      return !!this.bytes[4]; // SWF9
    },
    // 2 reserved bytes
    get isGivenNetworkFileAccessWhenLoadedLocally() {
      return !!this.bytes[7]; // otherwise, local file access
    },
    // 24 reserved bytes
  };
  
  function SymbolClassView(buffer, byteOffset, byteLength) {
    var bytes = new Uint8Array(buffer, byteOffset, byteLength);
    var dv = new DataView(buffer, byteOffset, byteLength);
    this.symbols = readTagNameArray(bytes, dv, 0);
  }
  
  function ScalingGridView(buffer, byteOffset, byteLength) {
    var dv = new DataView(buffer, byteOffset, byteLength);
    var bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.forID = dv.getUint16(0, true);
    this.center9Slice = readRect(bytes, 2).rect;
  }
  
  function readUnsigned(bytes, pos) {
    var result = bytes[pos++];
    if (!(result & 0x80)) return {value:result, next:pos};
    result = (result & 0x7F) | (bytes[pos++] << 7);
    if (!(result & 0x4000)) return {value:result, next:pos};
    result = (result & 0x3FFF) | (bytes[pos++] << 14);
    if (!(result & 0x200000)) return {value:result, next:pos};
    result = (result & 0x1fffff) | (bytes[pos++] << 21);
    if (!(result & 0x10000000)) return {value:result, next:pos};
    result = (result & 0xfffffff) | (bytes[pos++] << 28);
    return {value:result, next:pos};
  }
  
  function SceneFrameLabelView(buffer, byteOffset, byteLength) {
    var bytes = new Uint8Array(buffer, byteOffset, byteLength);
    var pos = 0;
    var _tmp = readUnsigned(bytes, pos);
    var scenes = new Array(_tmp.value);
    pos = _tmp.next;
    for (var i = 0; i < scenes.length; i++) {
      _tmp = readUnsigned(bytes, pos);
      var firstFrameNumber = _tmp.value;
      pos = _tmp.next;
      var rawSceneName = readNullTerminatedSubarray(bytes, pos);
      pos += rawSceneName.length + 1;
      scenes[i] = {
        firstFrameNumber: firstFrameNumber,
        name: rawSceneName, // TODO: encode
      };
    }
    var _tmp = readUnsigned(bytes, pos);
    var frameLabels = new Array(_tmp.value);
    pos = _tmp.next;
    for (var i = 0; i < frameLabels.length; i++) {
      _tmp = readUnsigned(bytes, pos);
      var frameNumber = _tmp.value;
      pos = _tmp.next;
      var rawLabel = readNullTerminatedSubarray(bytes, pos);
      pos += rawLabel.length + 1;
      frameLabels[i] = {
        frameNumber: frameNumber,
        label: rawLabel, // TODO: encode
      };
    }
    this.scenes = scenes;
    this.frameLabels = frameLabels;
  }
  
  var chunkViews = {
    'control/end': EmptyView,
    'control/background-rgb': RGBView,
    'control/frame-label': StringView,
    'control/protect': OptionalMD5View,
    'control/export': ExportView,
    'control/import-swf7': SWF7ImportView,
    'control/import-swf8': SWF8ImportView,
    'control/enable-debugger-swf5': OptionalMD5View,
    'control/enable-debugger-swf6': SWF6EnableDebugger,
    'control/script-limits': ScriptLimitsView,
    'control/set-tab-index': SetTabIndexView,
    'control/file-attributes': FileAttributesView,
    'control/symbol-class': SymbolClassView,
    // 'control/metadata': RDFXMLView,
    'control/scaling-grid': ScalingGridView,
    'control/scene-and-frame-label-data': SceneFrameLabelView,
  };
  
  return {
    split: split,
    bytePattern: /^[FCZ]WS.{10}/,
  };

});
