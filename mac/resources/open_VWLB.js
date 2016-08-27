define(['mac/roman'], function(macintoshRoman) {

  'use strict';

  return function(resource) {
      var VWLB = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
      var entries = new Array(VWLB.getUint16(0, false));
      var textBase = 2 + 4 * (entries.length + 1);
      var totalTextLen = VWLB.getUint16(2 + (4 * entries.length) + 2, false);
      entries.text = macintoshRoman(resource.data, textBase, totalTextLen);
      var names = entries.text.match(/^[^\r\n]*/)[0];
      resource.dataObject = {};
      for (var imarker = 0; imarker < entries.length; imarker++) {
        var markerBase = 2 + (4 * imarker);
        resource.dataObject[names.substring(
            VWLB.getUint16(markerBase + 2, false),
            VWLB.getUint16(markerBase + 4 + 2, false)
        )] = VWLB.getUint16(markerBase, false);
      }
  };

});
