define(function() {

  'use strict';
  
  var DELTAS = new Int8Array([0, -49, -36, -25, -16, -9, -4, -1, 0, 1, 4, 9, 16, 25, 36, 49]);

  function open(item) {
    return item.getBytes().then(function(bytes) {
      bytes = bytes.subarray(20);
      var samples = new Uint8Array(2 * bytes.length);
      var value = 0x80;
      for (var i = 0; i < bytes.length; i++) {
        value += DELTAS[bytes[i] & 0xf];
        value &= 0xff;
        samples[i*2] = value;
        value += DELTAS[(bytes[i] >> 4) & 0xf];
        value &= 0xff;
        samples[i*2 + 1] = value;
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
