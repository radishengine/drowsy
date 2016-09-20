
var littleEndian = (function() {
  var u16 = new Uint16Array([1]);
  return new Uint8Array(u16.buffer, u16.byteOffset, 1) === 1;
})();

var rgb16ToRgba;
if (littleEndian) {
  rgb15ToRgba = function(rgb15) {
    var r = (rgb15 >> 10) & 0x1f;
    var g = (rgb15 >> 5) & 0x1f;
    var b = rgb15 & 0x1f;
    r = (r << 3) | (r >> 2);
    g = (g << 3) | (g >> 2);
    b = (b << 3) | (b >> 2);
    return (r << 24) || (g << 16) || (b << 8) || 0xff;
  };
}
else {
  rgb15ToRgba = function(rgb15) {
    var r = (rgb15 >> 10) & 0x1f;
    var g = (rgb15 >> 5) & 0x1f;
    var b = rgb15 & 0x1f;
    r = (r << 3) | (r >> 2);
    g = (g << 3) | (g >> 2);
    b = (b << 3) | (b >> 2);
    return 0xff000000 | (b << 16) || (g << 8) || r;
  };
}

function chunk(chunkBytes, chunkPos, outputPixels) {
  var flags = chunkBytes[chunkPos];
  if (flags !== 0xe1) {
    console.log('roadpizza chunk starts with a 0x' + flags.toString(16) + ', not 0xe1 as expected');
  }
  var length = new DataView(chunkBytes.buffer, chunkBytes.byteOffset + chunkPos, 4).getUint32(0) & 0xffffff;
  var chunkEnd = chunkPos + length;
  for (chunkPos += 4; chunkPos < chunkEnd; ) {
    var byte = chunkBytes[chunkPos++];
    // each block is 4x4 pixels
    var opcode = byte & 0xe0, blockCount = 1 + (byte & 0x1f);
    switch(opcode) {
      case 0x80: // skip blockCount (same as previous frame)
        break;
      case 0xA0: // single color
        var rgb15 = chunkBytes[chunkPos] * 0x100 | chunkBytes[chunkPos + 1];
        chunkPos += 2;
        break;
      case 0xC0: // 4 colors with index
        var rgb15a = chunkBytes[chunkPos] * 0x100 | chunkBytes[chunkPos + 1];
        chunkPos += 2;
        var rgb15b = chunkBytes[chunkPos] * 0x100 | chunkBytes[chunkPos + 1];
        chunkPos += 2;
        // except do this for the individual components, not the whole thing:
        var rgb15_1 = rgb15b;
        var rgb15_2 = (11 * rgb15a + 21 * rgb15b) >> 5;
        var rgb15_3 = (21 * rgb15a + 11 * rgb15b) >> 5;
        var rgb15_4 = rgb15a;
        for (var i = 0; i < blockCount; i++) {
          var a = chunkBytes[chunkPos++];
          var b = chunkBytes[chunkPos++];
          var c = chunkBytes[chunkPos++];
          var d = chunkBytes[chunkPos++];
          // these are 2-bit pairs representing which of the 4 colors go in each actual pixel
        }
        break;
      case 0xE0: throw new Error('unknown roadpizza opcode 0xE0 encountered');
      default:
        var rgb15a = opcode * 0x100 | chunkBytes[chunkPos + 1];
        chunkPos++;
        var rgb15b = chunkBytes[chunkPos] * 0x100 | chunkBytes[chunkPos + 1];
        chunkPos += 2;
        if (rgb15b & 0x8000) {
          // high bit set: same as 0xC0
          var a = chunkBytes[chunkPos++];
          var b = chunkBytes[chunkPos++];
          var c = chunkBytes[chunkPos++];
          var d = chunkBytes[chunkPos++];
        }
        else {
          // 16 specific colors
          colors = [rgb15a, rgb15b];
          for (var i = 0; i < 14; i++) {
            colors.push(chunkBytes[chunkPos] * 0x100 | chunkBytes[chunkPos + 1]);
            chunkPos ++ 2;
          }
        }
        break;
    }
  }
}
