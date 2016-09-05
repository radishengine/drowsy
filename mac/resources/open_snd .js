define(['mac/fixedPoint'], function(fixedPoint) {

  'use strict';
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var formatNumber = dv.getUint16(0, false);
      var offset;
      switch (formatNumber) {
        case 1:
          var numOfDataFormats = dv.getUint16(2, false);
          if (numOfDataFormats !== 1) {
            return Promise.reject('expecting 1 snd data format, got ' + numOfDataFormats);
          }
          var firstDataFormatID = dv.getUint16(4, false);
          if (firstDataFormatID !== 5) {
            return Promise.reject('expected snd data format 5, got ' + firstDataFormatID);
          }
          var initOption = dv.getUint32(6, false);
          offset = 10;
          break;
        case 2:
          offset = 4;
          break;
        default:
          return Promise.reject('unknown "snd " format version: ' + formatNumber);
      }
      if (dv.getUint16(offset, false) !== 1) {
        return Promise.reject('audio data must have 1 sound command');
      }
      var command = dv.getUint16(offset + 2, false);
      if (command !== 0x8051 && command !== 0x8050) {
        return Promise.reject('audio command must be bufferCmd or soundCmd');
      }
      if (dv.getUint16(offset + 4, false) !== 0) {
        return Promise.reject('bufferCmd parameter must be 0');
      }
      var soundHeaderOffset = dv.getUint32(offset + 6, false);
      var headerType;
      var encoding = dv.getUint8(soundHeaderOffset + 20);
      if (encoding === 0) {
        headerType = 'standard';
      }
      else if (encoding === 0xff) {
        headerType = 'extended';
      }
      else if (encoding === 0xfe) {
        headerType = 'compressed';
      }
      else {
        return Promise.reject('unknown encoding: 0x' + encoding.toString(16));
      }
      var dataOffset = dv.getUint32(soundHeaderOffset, false);
      var samplingRate = fixedPoint.fromInt32(dv.getInt32(soundHeaderOffset + 8, false));
      var loopStartPoint = dv.getUint32(soundHeaderOffset + 12, false);
      var loopEndPoint = dv.getUint32(soundHeaderOffset + 16, false);
      var baseFrequency = dv.getUint8(soundHeaderOffset + 21);
      var totalBytes, channels, sampleAreaOffset, bytesPerSample;
      if (headerType === 'standard') {
        totalBytes = dv.getUint32(soundHeaderOffset + 4, false);
        channels = 1;
        sampleAreaOffset = 22;
        bytesPerSample = 1;
      }
      else {
        channels = dv.getUint32(soundHeaderOffset + 4, false);
        var bitsPerSample = dv.getUint16(soundHeaderOffset + 48, false);
        if (bitsPerSample % 8 !== 0) {
          console.error('unsupported bits per sample: ' + bitsPerSample);
          return;
        }
        bytesPerSample = bitsPerSample / 8;
        var totalFrames = dv.getUint32(soundHeaderOffset + 22, false);
        totalBytes = channels * totalFrames * bytesPerSample;
        sampleAreaOffset = 64;
      }
      var sampleDataOffset = soundHeaderOffset + sampleAreaOffset + dataOffset;
      item.setRawAudio({
        samples: bytes.subarray(sampleDataOffset, sampleDataOffset + totalBytes),
        samplingRate: samplingRate,
        channels: channels,
        bytesPerSample: bytesPerSample});
    });
  };

});
