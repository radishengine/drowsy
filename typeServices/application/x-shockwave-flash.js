define(function() {

  'use strict';
  
  var typeNames;
  
  function split(entries) {
    var rootSegment = this;
    return rootSegment.getBytes(0, 9)
    .then(function(rawPartialHeader) {
      var headerSize = 8 + Math.min(1, Math.ceil((rawPartialHeader[8] >>> 3) / 2)) + 4;
      if (entries.accepts('application/x-swf-header')) {
        entries.add(rootSegment.getSegment('application/x-swf-header', 0, headerSize));
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
        var chunkType = 'application/x-swf-chunk; type=' + (typeNames[tagCode] || tagCode);
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
          if (entries.accepts(chunkType)) {
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
    '9':'control/set-background-color',
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
  
  return {
    split: split,
  };

});
