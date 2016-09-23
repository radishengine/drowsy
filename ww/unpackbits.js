
function BitUnpacker() {
}
BitUnpacker.prototype = {
  mode: 'default',
  count: 0,
  context_value: 0,
  process: function(input, output) {
    var input_pos = 0, input_end = input.length,
      output_pos = 0, output_end = output.length,
      mode = this.mode,
      count = this.count,
      context_value = this.context_value;
    unpacking: do switch (mode) {
      case 'default':
        if (input_pos === input_end) break unpacking;
        count = input[input_pos++];
        if (count & 0x80) {
          if (count === 0x80) {
            // TODO: is this the end marker?
            continue unpacking;
          }
          count = 257 - count;
          mode = 'repeat';
          continue unpacking;
        }
        mode = 'literal';
//      continue unpacking;
      case 'literal':
        do {
          if (output_pos === output_end || input_pos === input_end) {
            this.context_value = context_value;
            break;
          }
          output_pos[output_pos++] = input[input_pos++];
        } while (--count);
        mode = 'default';
        continue unpacking;
      case 'repeat':
        if (input_pos === input_end) {
          this.count = count;
          break unpacking;
        }
        context_value = input[input_pos++];
        mode = 'repeat2';
//      continue unpacking;
      case 'repeat2':
        do {
          if (output_pos === output_end) {
            this.context_value = context_value;
            break;
          }
          output[output_pos++] = context_value;
        } while (--count);
        mode = 'default';
        continue unpacking;
    } while (true);
    this.mode = mode;
  },
};

self.init_unpackbits = function() {
  return new BitUnpacker();
};
