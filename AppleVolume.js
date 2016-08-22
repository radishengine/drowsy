
define(['ByteSource'], function(ByteSource) {

  'use strict';
  
  var PHYSICAL_BLOCK_BYTES = 512;
  
  var MAC_CHARSET_128_255
    = '\xC4\xC5\xC7\xC9\xD1\xD6\xDC\xE1\xE0\xE2\xE4\xE3\xE5\xE7\xE9\xE8'
    + '\xEA\xEB\xED\xEC\xEE\xEF\xF1\xF3\xF2\xF4\xF6\xF5\xFA\xF9\xFB\xFC'
    + '\u2020\xB0\xA2\xA3\xA7\u2022\xB6\xDF\xAE\xA9\u2122\xB4\xA8\u2260\xC6\xD8'
    + '\u221E\xB1\u2264\u2265\xA5\xB5\u2202\u2211\u220F\u03C0\u222B\xAA\xBA\u03A9\xE6\xF8'
    + '\xBF\xA1\xAC\u221A\u0192\u2248\u2206\xAB\xBB\u2026\xA0\xC0\xC3\xD5\u0152\u0153'
    + '\u2013\u2014\u201C\u201D\u2018\u2019\xF7\u25CA\xFF\u0178\u2044\u20AC\u2039\u203A\uFB01\uFB02'
    + '\u2021\xB7\u201A\u201E\u2030\xC2\xCA\xC1\xCB\xC8\xCD\xCE\xCF\xCC\xD3\xD4'
    + '\uF8FF\xD2\xDA\xDB\xD9\u0131\u02C6\u02DC\xAF\u02D8\u02D9\u02DA\xB8\u02DD\u02DB\u02C7';
  
  function macintoshRoman(u8array, offset, length) {
    switch(arguments.length) {
      case 2: u8array = u8array.subarray(offset); break;
      case 3: u8array = u8array.subarray(offset, offset + length); break;
    }
    return String.fromCharCode.apply(null, u8array)
      .replace(/[\x80-\xFF]/g, function(c) {
        return MAC_CHARSET_128_255[c.charCodeAt(0) - 128];
      });
  }
  
  function nullTerminate(str) {
    return str.replace(/\0.*/, '');
  }
  
  function AppleVolume(byteSource) {
    this.byteSource = byteSource;
  }
  AppleVolume.prototype = {
    read: function(reader) {
      var byteSource = this.byteSource;
      function doPartition(n) {
        byteSource.slice(PHYSICAL_BLOCK_BYTES * n, PHYSICAL_BLOCK_BYTES * (n+1)).read({
          onbytes: function(bytes) {
            if (macintoshRoman(bytes, 0, 4) !== 'PM\0\0') {
              console.error('invalid partition map signature');
              return;
            }
            var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            var partitionInfo = {
              mapBlockCount: dv.getInt32(4, false),
              blockOffset: dv.getInt32(8, false),
              blockCount: dv.getInt32(12, false),
              partitionName: nullTerminate(macintoshRoman(bytes, 16, 32)),
              partitionType: nullTerminate(macintoshRoman(bytes, 48, 32)),
              dataAreaBlockOffset: dv.getInt32(80, false),
              dataAreaBlockCount: dv.getInt32(84, false),
              status: dv.getInt32(88, false),
              bootCodeBlockOffset: dv.getInt32(92, false),
              bootCodeByteLength: dv.getInt32(96, false),
              bootCodeLoadAddress: dv.getInt32(100, false),
              bootCodeEntryPoint: dv.getInt32(108, false),
              bootCodeChecksum: dv.getInt32(116, false),
              processorType: nullTerminate(macintoshRoman(bytes, 124, 16)),
            };
            if (typeof reader.onpartition === 'function') {
              reader.onpartition(partitionInfo);
            }
            if (n < partitionInfo.mapBlockCount) {
              doPartition(n + 1);
            }
          },
        });
        
      }
      doPartition(1);
    },
  };
  
  return AppleVolume;

});
