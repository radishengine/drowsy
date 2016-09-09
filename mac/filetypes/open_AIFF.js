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
      var loop;
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
            if (audioInfo.bytesPerSample === 1) {
              var signed = new Int8Array(
                audioInfo.samples.buffer,
                audioInfo.samples.byteOffset,
                audioInfo.samples.byteLength);
              for (var i = 0; i < signed.length; i++) {
                audioInfo.samples[i] = signed[i] + 128;
              }
            }
            break;
          case 'INST':
            var chunkLength = dv.getUint32(pos + 4, false);
            if (chunkLength !== 6) {
              return Promise.reject('bad length for INST chunk (' + chunkLength + ' bytes)');
            }
            var chunkDV = new DataView(
              bytes.buffer,
              bytes.byteOffset + pos + 8,
              bytes.byteOffset + pos + 8 + chunkLength);
            switch(chunkDV.getUint16(0)) {
              case 0: loop = null; break;
              case 1: loop = {}; break;
              case 2: loop = {pingpong: true}; break;
              default: return Promise.reject('unknown AIFF INST play mode: ' + chunkDV.getUint16(0));
            }
            if (loop) {
              loop.startMarker = dv.getUint16(2, false);
              loop.endMarker = dv.getUint16(4, false);
            }
            console.log(loop);
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
