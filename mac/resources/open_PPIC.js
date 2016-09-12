define(function() {

  'use strict';
  
  var mode1HuffmanTable = {
    masks: [
      0x0000,
      0x2000, 0x4000, 0x5000, 0x6000, 0x7000, 0x8000, 0x9000, 0xa000,
      0xb000, 0xc000, 0xd000, 0xd800, 0xe000, 0xe800, 0xf000, 0xf800],
    lengths: [3,3,4,4,4,4,4,4,4,4,4,5,5,5,5,5,5],
    values: [
      0x00,
      0x0f, 0x03, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a,
      0x0c, 0xff, 0x01, 0x02, 0x04, 0x0b, 0x0d, 0x0e],
  };
  
  var mode2HuffmanTable = {
    masks: [
      0x0000,
      0x4000, 0x8000, 0xc000, 0xc800, 0xd000, 0xd800, 0xe000, 0xe800,
      0xf000, 0xf400, 0xf600, 0xf800, 0xfa00, 0xfc00, 0xfe00, 0xff00],
    lengths: [2,2,2,5,5,5,5,5,5,6,7,7,7,7,7,8,8],
    values: [
      0xff,
      0x00, 0x0f, 0x01, 0x03, 0x07, 0x0e, 0x0c, 0x08,
      0x06, 0x02, 0x04, 0x09, 0x0d, 0x0b, 0x0a, 0x05],
  };
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
    
      var ibyte = 0, ibit = 0;
      function unsigned(bits) {
        var available = 8 - ibit;
        if (available < bits) {
          var topBits = bytes[ibyte] << (32 - available) >>> (32 - available);
          ibyte++; ibit = 0;
          bits -= available;
          return (topBits << bits) | unsigned(bits);
        }
        var value = bytes[ibyte] << (24 + ibit) >>> (32 - bits);
        ibit += bits;
        if (ibit === 8) { ibyte++; ibit = 0; }
        return value;
      }
      
      var mode = unsigned(3);
      
      var height = unsigned(1) ? unsigned(10) : unsigned(6);
      var width = unsigned(1) ? unsigned(10) : unsigned(6);
      var stride = (width % 16) ? width + 16 - (width % 16) : width;
      
      function readMode3HuffmanTable() {
        var huffman = {
          masks: new Array(17),
          lengths: new Array(17),
          values: new Array(17),
        };
        var v = unsigned(8);
        huffman.values[0] = v/15; huffman.values[2] = v%15;
        v = unsigned(4);
        huffman.values[1] = v;
        v = unsigned(7);
        huffman.values[3] = v/9; huffman.values[8] = v%9;
        v = unsigned(4);
        huffman.values[4] = v;
        v = unsigned(10);
        huffman.values[5] = v/77; huffman.values[6] = (v/7)%11; huffman.values[10] = v%7;
        v = unsigned(6);
        huffman.values[7] = v/6; huffman.values[11] = v%6;
        v = unsigned(3);
        huffman.values[9] = v;
        v = unsigned(4);
        huffman.values[12] = v/3; huffman.values[14] = v%3;
        v = unsigned(2);
        huffman.values[13] = v;
        v = unsigned(1);
        huffman.values[15] = v;
        huffman.values[16] = 0;
        for (var i = 16; i >= 1; i--) {
          for (var j = i; j <= 16; j++) {
            if (huffman.values[j] >= huffman.values[i-1]) {
              huffman.values[j]++;
            }
          }
        }
        for (var i = 16; i >= 0; i--) {
          if (huffman.values[i] == 0x10) {
            huffman.values[i] = 0xff;
            break;
          }
        }
        var bits = unsigned(2) + 1;
        var mask = 0;
        for (var i = 0; i <= 15; i++) {
          if (i !== 0) {
            while (!unsigned(1)) bits++;
          }
          huffman.lengths[i] = bits;
          huffman.masks[i] = mask;
          mask += 1 << (16 - bits);
        }
        huffman.masks[15] = mask;
        while (mask & (1 << (16 - bits))) bits++;
        huffman.masks[16] = mask | (1 << (16 - bits));
        huffman.lengths[15] = huffman.lengths[16] = bits;
        return huffman;
      }

      var huffmanTable;

      switch (mode) {
        default: return Promise.reject('unsupported PPIC mode: ' + mode);
        case 1: huffmanTable = mode1HuffmanTable; break;
        case 2: huffmanTable = mode2HuffmanTable; break;
        case 3: huffmanTable = readMode3HuffmanTable(); break;
      }
      
      console.log(huffmanTable);
      
      item.withPixels(width, height, function(pixelData) {
      });

    });
  }
  
  return open;

});
