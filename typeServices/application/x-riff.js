define(function() {

  function split(entries) {
    var context = this;
    context.getBytes(0, 12)
    .then(function(rawFileHeader) {
      var littleEndian;
      var formID = String.fromCharCode.apply(null, rawFileHeader.subarray(0, 4));
      switch (formID) {
        case 'RIFF': case 'RIFX':
          littleEndian = true;
          break;
        case 'FFIR': case 'XFIR':
          littleEndian = false;
          break;
        default:
          return Promise.reject('unknown RIFF form: ' + formID);
      }
      var getFourCC;
      if (littleEndian) {
        getFourCC = function(bytes, offset) {
          return String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
        };
      }
      else {
        getFourCC = function(bytes, offset) {
          return String.fromCharCode(bytes[offset+3], bytes[offset+2], bytes[offset+1], bytes[offset]);
        };
      }
      context.setMetadata('riffType', getFourCC(rawFileHeader, 4));
      var maxPos = new DataView(rawFileHeader.buffer, rawFileHeader.byteOffset + 8, 4).getUint32(0, littleEndian);
      var pos = 12;
      if (pos >= maxPos) return;
      function onChunkHeader(headerBytes) {
        var chunkType = getFourCC(headerBytes, 0);
        var length = new DataView(headerBytes.buffer, headerBytes.byteOffset + 4, 4).getUint32(0, littleEndian);
        pos += 8;
        entries.add(context.getSegment(pos, length));
        pos += length + length % 2;
        if (pos < maxPos) return context.getBytes(pos, 8).then(onChunkHeader);
      }
      return context.getBytes(pos, 8).then(onChunkHeader);
    });
  }
  
  return {
    split: split,
    bytePattern: /^(RIFF|RIFX|XFIR|FFIR).{4}(.{8}(..)+)+$/,
  };

});
