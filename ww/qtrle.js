
function decode(bpp, height, data_buf, data_pos) {
  var chunk_pos = data_pos;
  var chunk_size = data_buf[data_pos] << 24 | data_buf[data_pos + 1] << 16 | data_buf[data_pos + 2] << 8 | data_buf[data_pos + 3];
  data_pos += 4;
  var chunk_end = chunk_pos + chunk_size;
  if (chunk_size < 8) {
    return chunk_end; // no-op - same as previous frame
  }
  var header = data_buf[data_pos] << 8 | data_buf[data_pos + 1];
  data_pos += 2;
  var starting_line, lines_to_update;
  if (header & 8) {
    starting_line = data_buf[data_pos] << 8 | data_buf[data_pos + 1];
    data_pos += 2;
    // unknown
    data_pos += 2;
    lines_to_update = data_buf[data_pos] << 8 | data_buf[data_pos + 1];
    data_pos += 2;
    // unknown
    data_pos += 2;
  }
  else {
    starting_line = 0;
    lines_to_update = height;
    data_pos += 8;
  }
  for (var line_i = starting_line, line_max = starting_line + lines_to_update; line_i < line_max; line_i++) {
    var x = data_buf[data_pos++] - 1;
    if (x === -1) break;
    switch(bpp) {
      case 1: throw new Error('NYI: 1bpp');
      case 2: throw new Error('NYI: 2bpp');
      case 4: throw new Error('NYI: 4bpp');
      case 8: throw new Error('NYI: 8bpp');
      case 16: throw new Error('NYI: 16bpp');
      case 24: throw new Error('NYI: 24bpp');
      case 32: throw new Error('NYI: 32bpp');
      default: throw new Error('Unknown bpp: ' + bpp);
    }
  }
  return chunk_end;
}
