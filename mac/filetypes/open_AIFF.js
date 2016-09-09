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
      var instrument;
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
            if (chunkLength !== InstrumentView.byteLength) {
              return Promise.reject('bad length for INST chunk (' + chunkLength + ' bytes)');
            }
            instrument = new InstrumentView(
              bytes.buffer,
              bytes.byteOffset + pos + 8,
              InstrumentView.byteLength);
            break;
          default:
            console.log('AIFF chunk: ' + chunkName);
            break;
        }
      }
      if (instrument) {
        console.log(instrument);
      }
      item.setRawAudio(audioInfo);
    });
  };
  
  function InstrumentView(buffer, byteOffset, byteLength) {
    Object.defineProperties({
      bytes: {value:new Uint8Array(buffer, byteOffset, byteLength)},
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  InstrumentView.prototype = {
    get baseNote() {
      return this.bytes[0]; // MIDI note 0..127, 60 = middle C
    },
    get detune() {
      return this.bytes[1]; // pitch shift -50..+50 cents (-0.5..+0.5 semitone)
    },
    get lowNote() {
      return this.bytes[2]; // MIDI note 0..127
    },
    get highNote() {
      return this.bytes[3]; // MIDI note 0..127
    },
    get lowVelocity() {
      return this.bytes[4]; // MIDI velocity 1..127
    },
    get highVelocity() {
      return this.bytes[5]; // MIDI velocity 1..127
    },
    get gain() {
      return this.dataView.getInt16(6, false); // decibels, e.g. +6=double each sample point, -6=halve each
    },
    get sustainPlayMode() {
      var v;
      switch(v = this.dataView.getUint16(8, false)) {
        case 0: return 'normal';
        case 1: return 'loop';
        case 2: return 'pingpong';
        default: return v;
      }
    },
    get sustainMarker1() {
      return this.dataView.getUint16(10, false);
    },
    get sustainMarker2() {
      return this.dataView.getUint16(12, false);
    },
    get releasePlayMode() {
      var v;
      switch(v = this.dataView.getUint16(14, false)) {
        case 0: return 'normal';
        case 1: return 'loop';
        case 2: return 'pingpong';
        default: return v;
      }
    },
    get releaseMarker1() {
      return this.dataView.getUint16(16, false);
    },
    get releaseMarker2() {
      return this.dataView.getUint16(17, false);
    },
  };
  InstrumentView.byteLength = 20;
  
  return open;

});
