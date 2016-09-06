define(['mac/extendedFloat'], function(extendedFloat) {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      if (String.fromCharCode.apply(null, bytes.subarray(0, 4)) !== 'FORM') {
        return Promise.reject('FORM header not found');
      }
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var length = dv.getUint32(4, false);
      if (bytes.byteLength < 8+length) {
        return Promise.reject('invalid data length');
      }
      if (String.fromCharCode.apply(null, bytes.subarray(8, 12)) !== 'AIFF') {
        return Promise.reject('AIFF header not found');
      }
      var audioInfo = {};
      for (var pos = 12; pos < length; pos += 8 + dv.getUint32(pos + 4, false)) {
        var chunkName = String.fromCharCode.apply(null, bytes.subarray(pos, pos + 4));
        switch (chunkName) {
          case 'COMM':
            var chunkLength = dv.getUint32(pos + 4, false);
            if (chunkLength < 18) {
              return Promise.reject('bad length for COMM chunk (' + chunkLength + ' bytes)');
            }
            var chunkDV = new DataView(
              bytes.buffer,
              bytes.byteOffset + pos + 8,
              bytes.byteOffset + pos + 8 + chunkLength);
            audioInfo.channels = chunkDV.getUint16(0, false);
            audioInfo.numSampleFrames = chunkDV.getUint32(2, false);
            audioInfo.bytesPerSample = chunkDV.getUint16(6, false) / 8;
            audioInfo.sampleRate = extendedFloat(chunkDV, 8);
            break;
          case 'SSND':
            var dataLength = audioInfo.channels * audioInfo.bytesPerSample * audioInfo.numSampleFrames;
            var chunkLength = dv.getUint32(pos + 4, false);
            if (chunkLength < 8 + dataLength) {
              return Promise.reject('bad length for SSND chunk (' + chunkLength + ' bytes)');
            }
            var chunkDV = new DataView(
              bytes.buffer,
              bytes.byteOffset + pos + 8,
              bytes.byteOffset + pos + 8 + 8);
            var offset = chunkDV.getUint16(0, false);
            var blockLength = chunkDV.getUint16(0, false);
            if (offset !== 0 || blockLength !== 0) {
              return Promise.reject('AIFF: offset/blockLength not yet supported');
            }
            audioInfo.samples = bytes.subarray(
              pos + 12,
              pos + 12 + dataLength);
            break;
          default:
            console.log('AIFF chunk: ' + chunkName);
            break;
        }
      }
      item.setRawAudio(audioInfo);
    });
  };
  
  return open;

});
