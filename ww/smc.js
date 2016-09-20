
var c2_0 = new Uint8Array(256), c2_1 = new Uint8Array(256);
var c4_0 = new Uint8Array(256), c4_1 = new Uint8Array(256), c4_2 = new Uint8Array(256), c4_3 = new Uint8Array(256);
var c8_0 = new Uint8Array(256), c8_1 = new Uint8Array(256), c8_2 = new Uint8Array(256), c8_3 = new Uint8Array(256),
    c8_4 = new Uint8Array(256), c8_5 = new Uint8Array(256), c8_6 = new Uint8Array(256), c8_7 = new Uint8Array(256);

var c2n = -1, c4n = -1, c8n = -1;

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
        var color1, color2;
        if (byte & 0x10) {
          var ci = data_buf[data_pos++];
          color1 = c2_0[ci];
          color2 = c2_1[ci];
        }
        else {
          c2n = (c2n + 1) % 256;
          color1 = c2_0[c2n] = data_buf[data_pos++];
          color2 = c2_0[c2n] = data_buf[data_pos++];
        }
        for (var i = 0; i < blockCount; i++) {
          var bitmask1 = data_buf[data_pos++];
          var bitmask2 = data_buf[data_pos++];
        }
        break;
      case 0xA0: case 0xB0: // 4-color encoding
        var blockCount = 1 + (byte & 0x0f);
        var color1, color2, color3, color4;
        if (byte & 0x10) {
          var ci = data_buf[data_pos++];
          color1 = c4_0[ci];
          color2 = c4_1[ci];
          color3 = c4_2[ci];
          color4 = c4_3[ci];
        }
        else {
          c4n = (c4n + 1) % 256;
          color1 = c4_0[c4n] = data_buf[data_pos++];
          color2 = c4_1[c4n] = data_buf[data_pos++];
          color3 = c4_2[c4n] = data_buf[data_pos++];
          color4 = c4_3[c4n] = data_buf[data_pos++];
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
        var color1, color2, color3, color4, color5, color6, color7, color8;
        if (byte & 0x10) {
          var ci = data_buf[data_pos++];
          color1 = c8_0[ci];
          color2 = c8_1[ci];
          color3 = c8_2[ci];
          color4 = c8_3[ci];
          color5 = c8_4[ci];
          color6 = c8_5[ci];
          color7 = c8_6[ci];
          color8 = c8_7[ci];
        }
        else {
          c8n = (c8n + 1) % 256;
          color1 = c8_0[c8n] = data_buf[data_pos++];
          color2 = c8_1[c8n] = data_buf[data_pos++];
          color3 = c8_2[c8n] = data_buf[data_pos++];
          color4 = c8_3[c8n] = data_buf[data_pos++];
          color5 = c8_4[c8n] = data_buf[data_pos++];
          color6 = c8_5[c8n] = data_buf[data_pos++];
          color7 = c8_6[c8n] = data_buf[data_pos++];
          color8 = c8_7[c8n] = data_buf[data_pos++];
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
