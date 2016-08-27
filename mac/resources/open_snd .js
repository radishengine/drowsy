define(function() {

  'use strict';
  
  return function(resource) {
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
  	if (dv.getUint16(0, false) !== 2) {
  		console.error('audio data must be format 2');
  		return;
  	}
  	if (dv.getUint16(2, false) !== 0) {
  		// reference count is application specific use anyway
  	}
  	if (dv.getUint16(4, false) !== 1) {
  		console.error('audio data must have 1 sound command');
  		return;
  	}
  	var command = dv.getUint16(6, false);
  	if (command !== 0x8051 && command !== 0x8050) {
  		console.error('audio command must be bufferCmd or soundCmd');
  		return;
  	}
  	if (dv.getUint16(8, false) !== 0) {
  		console.error('bufferCmd parameter must be 0');
  		return;
  	}
  	var soundHeaderOffset = dv.getUint32(10, false);
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
  	var samplingRate = dv.getFixed32(soundHeaderOffset + 8, false);
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
  			throw new Error('Bits per sample: ' + bitsPerSample);
  		}
  		bytesPerSample = bitsPerSample / 8;
  		var totalFrames = dv.getUint32(soundHeaderOffset + 22, false);
  		totalBytes = channels * totalFrames * bytesPerSample;
  		sampleAreaOffset = 64;
  	}
  	resource.soundData = {
  		samples: new DataView(
  			resource.data.buffer,
  			resource.data.byteOffset + soundHeaderOffset + sampleAreaOffset + dataOffset,
  			totalBytes),
  		samplingRate: samplingRate,
  		channels: channels,
  		bytesPerSample: bytesPerSample};
  };

});
