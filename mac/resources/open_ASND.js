define(function() {

  'use strict';
  
  var DELTAS = new Int8Array([0, -49, -36, -25, -16, -9, -4, -1, 0, 1, 4, 9, 16, 25, 36, 49]);

  function open(item) {
    return item.getBytes().then(function(bytes) {
      var samples = new Uint8Array(2 * (bytes.length - 20));
      var value = 128;
      for (var i = 0; i < samples.length; i++) {
        var index = 20 + i >> 1;
        value += (i % 2) ? DELTAS[bytes[index] >> 4] : DELTAS[bytes[index] & 0xf];
        value |= 0;
        samples[i] = (value << 24 >> 24) + 128;
      }
      item.setRawAudio({
        channels: 1,
        samplingRate: 11050,
        bytesPerSample: 1,
        samples: samples,
      });
    });
  }
  
  return open;

});
