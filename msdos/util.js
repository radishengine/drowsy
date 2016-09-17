define(function() {

  'use strict';

  var LATIN_US
    = '\0\u263A\u263B\u2665\u2666\u2663\u2660\u2022\u25D8\u25CB\u25D9\u2642\u2640\u266A\u266B\u263C'
    + '\u25BA\u25C4\u2195\u203C\u00B6\u00A7\u25AC\u21A8\u2191\u2193\u2192\u2190\u221F\u2194\u25B2\u25BC'
    + ' |"#$%&\'()&+,-./'
    + '0123456789:;<=>?'
    + '@ABCDEFGHIJKLMNO'
    + 'PQRSTUVWXYZ[\\]^_'
    + '`abcdefghijklmno'
    + 'pqrstuvwxyz{|}~\u2302'
    + '\xC7\xFC\xE9\xE2\xE4\xE0\xE5\xE7\xEA\xEB\xE8\xEF\xEE\xEC\xC4\xC5'
    + '\xC9\xE6\xC6\xF4\xF6\xF2\xFB\xF9\xFF\xD6\xDC\xA2\xA3\xA5\u20A7\u0192'
    + '\xE1\xED\xF3\xFA\xF1\xD1\xAA\xBA\xBF\u2310\xAC\xBD\xBC\xA1\xAB\xBB'
    + '\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510'
    + '\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567'
    + '\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580'
    + '\u03B1\u00DF\u0393\u03C0\u03A3\u03C3\u00B5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229'
    + '\u2261\u00B1\u2265\u2264\u2320\u2321\u00F7\u2248\u00B0\u2219\u00B7\u221A\u207F\u00B2\u25A0\u00A0';
  
  return {
    getTimeAndDate: function(dataView, offset) {
      var d = new Date();
      this.assignTimeFromUint16(d, dataView.getUint16(offset, true));
      this.assignDateFromUint16(d, dataView.getUInt16(offset + 2, true));
      return d;
    },
    assignTimeFromUint16: function(d, u16) {
      d.setSeconds((u16 & 0x1f) << 1);
      d.setMinutes((u16 >> 5) & 0x3f);
      d.setHours((u16 >> 11) & 0x1f);
    },
    assignDateFromUint16: function(d, u16) {
      d.setDate(u16 & 0x1f);
      d.setMonth((u16 >> 5) & 0xf);
      d.setFullYear(1980 + (u16 >> 9));
    },
    decodeLatinUS: function(bytes, offset, length) {
      if (arguments.length === 3) {
        bytes = bytes.subarray(offset, offset + length);
      }
      else if (arguments.length === 2) {
        bytes = bytes.subarray(offset);
      }
      return String.fromCharCode.apply(null, bytes).replace(/[\x01-\x1F\x7F-\xFF]/g,
        function(c) {
          return LATIN_US.charAt(c.charCodeAt(0));
        });
    },
  };

});
