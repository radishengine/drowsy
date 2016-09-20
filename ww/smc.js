
var c2 = new Uint8Array(256 * 2), c2n = -1;
var c4 = new Uint8Array(256 * 4), c4n = -1;
var c8 = new Uint8Array(256 * 8), c8n = -1;

function decode(palette, data_buf, data_pos) {
  var chunk_pos = data_pos;
  var flags = data_buf[data_pos]; // usually 0xE1. 0x80 has been observed. meaning unknown
  var chunk_len = data_buf[data_pos + 1] << 16 | data_buf[data_pos + 2] << 8 | data_buf[data_pos + 3];
  data_pos += 3;
  var chunk_end = chunk_pos + chunk_len;
  while (data_pos < chunk_end) {
    var byte = data_buf[data_pos++];
    switch(byte & 0xF0) {
      case 0x00: case 0x10: // skip blocks
        var blockCount = 1 + ((byte & 0x10) ? (byte & 0x0f) : data_buf[data_pos++]);
        break;
      case 0x20: case 0x30: // repeat last block
        var blockCount = 1 + ((byte & 0x10) ? (byte & 0x0f) : data_buf[data_pos++]);
        break;
      case 0x40: case 0x50: // repeat previous 2 blocks
        var blockCount = 1 + ((byte & 0x10) ? (byte & 0x0f) : data_buf[data_pos++]);
        break;
      case 0x60: case 0x70: // 1-color encoding
        var blockCount = 1 + ((byte & 0x10) ? (byte & 0x0f) : data_buf[data_pos++]);
        var color = palette[data_buf[data_pos++]];
        break;
      case 0x80: case 0x90: // 2-color encoding
        var blockCount = 1 + (byte & 0x0f);
        var ci;
        if (byte & 0x10) {
          ci = data_buf[data_pos++] << 1;
        }
        else {
          ci = (c2n = (c2n + 1) % 256) << 1;
          c2[ci] = data_buf[data_pos++];
          c2[ci + 1] = data_buf[data_pos++];
        }
        for (var i = 0; i < blockCount; i++) {
          var bitmask1 = data_buf[data_pos++];
          var bitmask2 = data_buf[data_pos++];
        }
        break;
      case 0xA0: case 0xB0: // 4-color encoding
        var blockCount = 1 + (byte & 0x0f);
        var ci;
        if (byte & 0x10) {
          ci = data_buf[data_pos++];
        }
        else {
          ci = (c4n = (c4n + 1) % 256) << 2;
          c4[ci] = data_buf[data_pos++];
          c4[ci + 1] = data_buf[data_pos++];
          c4[ci + 2] = data_buf[data_pos++];
          c4[ci + 3] = data_buf[data_pos++];
        }
        for (var i = 0; i < blockCount; i++) {
          var bitmask1 = data_buf[data_pos++];
          var bitmask2 = data_buf[data_pos++];
          var bitmask3 = data_buf[data_pos++];
          var bitmask4 = data_buf[data_pos++];
        }
        break;
      case 0xC0: case 0xD0: // 8-color encoding
        var blockCount = 1 + (byte & 0x0f);
        var ci;
        if (byte & 0x10) {
          ci = data_buf[data_pos++];
        }
        else {
          ci = (c8n = (c8n + 1) % 256) << 3;
          c8[ci] = data_buf[data_pos++];
          c8[ci + 1] = data_buf[data_pos++];
          c8[ci + 2] = data_buf[data_pos++];
          c8[ci + 3] = data_buf[data_pos++];
          c8[ci + 4] = data_buf[data_pos++];
          c8[ci + 5] = data_buf[data_pos++];
          c8[ci + 6] = data_buf[data_pos++];
          c8[ci + 7] = data_buf[data_pos++];
        }
        for (var i = 0; i < blockCount; i++) {
          var bitmask1 = data_buf[data_pos++];
          var bitmask2 = data_buf[data_pos++];
          var bitmask3 = data_buf[data_pos++];
          var bitmask4 = data_buf[data_pos++];
          var bitmask5 = data_buf[data_pos++];
          var bitmask6 = data_buf[data_pos++];
        }
        break;
      case 0xE0: // 16-color encoding
        var blockCount = 1 + (byte & 0x0f);
        for (var i = 0; i < blockCount; i++) {
          for (var j = 0; j < 16; j++) {
            var color = data_buf[data_pos++];
          }
        }
        break;
      case 0xF0: throw new Error('unknown opcode: 0xF0');
    }
  }
  return chunk_end;
}
