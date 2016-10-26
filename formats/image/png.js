define(function() {

  'use strict';
  
  function split(entries) {
    var rootSegment = this;
    return rootSegment.getBytes(0, 8 + 8)
    .then(function(rawHeader) {
      if (String.fromCharCode.apply(null, rawHeader) !== '\x89PNG\r\n\x1A\n') {
        return Promise.reject('PNG file signature not found');
      }
      var pos = 8;
      var lastChunk;
      function onChunk(bytes) {
        if (lastChunk) {
          var crc = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
          lastChunk.setMetadata({crc: crc.toString(16)});
          entries.add(lastChunk);
        }
        var chunkType = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        if (chunkType === 'IEND') return;
        var dataLength = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
        pos += 8;
        lastChunk = rootSegment.getSegment('image/x-png-chunk; type=' + chunkType, pos, dataLength);
        pos += dataLength;
        return rootSegment.getBytes(pos, 12).then(onChunk);
      }
      return onChunk(rawHeader.subarray(4));
    });
  }
  
  return {
    split: split,
    bytePattern: /^\x89PNG\r\n\x1A\n\x00\x00\x00\x0DIHDR.{13}.{4}.*.{4}IDAT.*.{4}.*\x00\x00\x00\x00IEND....$/,
  };

});
