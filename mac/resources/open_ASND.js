define(function() {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var deltas = new Int8Array(bytes.buffer, bytes.byteOffset + 4, 16);
      bytes = bytes.subarray(20);
      var samples = new Uint8Array(2 * bytes.length);
      var value = 0x80;
      for (var i = 0; i < bytes.length; i++) {
        value += deltas[bytes[i] & 0xf];
        value = value << 24 >> 24;
        samples[i*2] = value & 0xff;
        value += deltas[(bytes[i] >> 4) & 0xf];
        value = value << 24 >> 24;
        samples[i*2 + 1] = value & 0xff;
      }
      item.setRawAudio({
        channels: 1,
        samplingRate: 11000,
        bytesPerSample: 1,
        samples: samples,
      });
    });
  }
  
  return open;

});
