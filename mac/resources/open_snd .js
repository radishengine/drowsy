define(['mac/fixedPoint'], function(fixedPoint) {

  'use strict';
  
  return function(resource) {
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    var formatNumber = dv.getUint16(0, false);
    var offset;
    switch (formatNumber) {
      case 1:
        var numOfDataFormats = dv.getUint16(2, false);
        if (numOfDataFormats !== 1) {
          console.error('expecting 1 snd data format, got ' + numOfDataFormats);
          return;
        }
        var firstDataFormatID = dv.getUint16(4, false);
        if (firstDataFormatID !== 5) {
          console.error('expected snd data format 5, got ' + firstDataFormatID);
          return;
        }
        var initOption = dv.getUint32(6, false);
        console.log('audio init option: ' + initOption.toString(16));
        offset = 10;
        break;
      case 2:
        offset = 4;
        break;
      default:
        console.error('unknown "snd " format version: ' + formatNumber);
        return;
    }
    if (dv.getUint16(offset, false) !== 1) {
      console.error('audio data must have 1 sound command');
      return;
    }
    var command = dv.getUint16(offset + 2, false);
    if (command !== 0x8051 && command !== 0x8050) {
      console.error('audio command must be bufferCmd or soundCmd');
      return;
    }
    if (dv.getUint16(offset + 4, false) !== 0) {
      console.error('bufferCmd parameter must be 0');
      return;
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
      console.error('unknown encoding: ' + encoding);
      return;
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
    resource.soundData = {
      samples: resource.data.subarray(sampleDataOffset, sampleDataOffset + totalBytes),
      samplingRate: samplingRate,
      channels: channels,
      bytesPerSample: bytesPerSample};
  };

});
