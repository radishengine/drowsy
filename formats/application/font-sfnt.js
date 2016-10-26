define(['Format'], function(Format) {

  'use strict';
  
  var offsetTableFormat = Format('chunk/sfnt; which=offset-table');
  
  function split(segment, entries) {
    var offsetTableSegment = segment.getSegment(offsetTableFormat, 0, 12);
    return offsetTableSegment.getStruct().then(function(offsetTable) {
      entries.add(offsetTableSegment);
      return segment.getBytes(12, offsetTable.tableCount * 16)
      .then(function(rawTable) {
        var dv = new DataView(rawTable.buffer, rawTable.byteOffset, rawTable.byteLength);
        for (var i = 0; i < offsetTable.tableCount; i++) {
          var tag = String.fromCharCode.apply(null, rawTable.subarray(i*16, i*16 + 4));
          var checksum = dv.getUint32(i*16 + 4, false);
          var byteOffset = dv.getUint32(i*16 + 8, false);
          var byteLength = dv.getUint32(i*16 + 12, false);
          entries.add(segment.getSegment(
            Format('chunk/sfnt', {which:tag, checksum:checksum.toString(16)}),
            byteOffset,
            byteLength));
        }
      });
    });
  }
  
  return {
    splitTo: Format.filter('chunk/sfnt'),
    split: split,
  };

});
