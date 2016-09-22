
function PCMUint8Mono() {
}
PCMUint8Mono.prototype = {
  process: function(input, output) {
    var output_pos;
    if ('leftover' in this) {
      var leftover = this.leftover;
      delete this.leftover;
      output_pos = this.process(leftover, output);
    }
    else {
      output_pos = 0;
    }
    if (input.length > output.length) {
      this.leftover = input.subarray(output.length);
      input = input.subarray(0, output.length);
    }
    for (var pos = 0, pos_max = input.length; pos < pos_max; pos++) {
      output[pos] = (input[pos] - 128) / 128;
    }
    return pos;
  },
};

function PCMInt8Mono() {
}
PCMInt8Mono.prototype = {
  process: function(input, output) {
    var output_pos;
    if ('leftover' in this) {
      var leftover = this.leftover;
      delete this.leftover;
      output_pos = this.process(leftover, output);
    }
    else {
      output_pos = 0;
    }
    if (input.length > output.length) {
      this.leftover = input.subarray(output.length);
      input = input.subarray(0, output.length);
    }
    for (var pos = 0, pos_max = input.length; pos < pos_max; pos++) {
      output[pos] = (input[pos] << 24 >> 24) / 128;
    }
    return pos;
  },
};

self.init_pcm_uint8mono = function() {
  return new PCMUint8Mono();
};

self.init_pcm_int8mono = function() {
  return new PCMInt8Mono();
};
