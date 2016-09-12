define(['mac/palette2'], function(palette) {

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
      
      function skip(bits) {
        ibit += bits;
        var byteOffset = Math.floor(ibit / 8);
        ibyte += byteOffset;
        ibit -= (byteOffset * 8);
      }
      
      var mode = unsigned(3);
      
      var height = unsigned(1) ? unsigned(10) : unsigned(6);
      var width = unsigned(1) ? unsigned(10) : unsigned(6);
      var stride = Math.floor((width + 15) / 16) * 8;
      
      function readMode3HuffmanTable() {
        var huffman = {
          masks: new Array(17),
          lengths: new Array(17),
          values: new Array(17),
        };
        var v = unsigned(8);
        huffman.values[0] = (v/15)|0; huffman.values[2] = v%15;
        v = unsigned(4);
        huffman.values[1] = v;
        v = unsigned(7);
        huffman.values[3] = (v/9)|0; huffman.values[8] = v%9;
        v = unsigned(4);
        huffman.values[4] = v;
        v = unsigned(10);
        huffman.values[5] = (v/77)|0; huffman.values[6] = ((v/7)|0)%11; huffman.values[10] = v%7;
        v = unsigned(6);
        huffman.values[7] = (v/6)|0; huffman.values[11] = v%6;
        v = unsigned(3);
        huffman.values[9] = v;
        v = unsigned(4);
        huffman.values[12] = (v/3)|0; huffman.values[14] = v%3;
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

      var huffman;

      switch (mode) {
        default: return Promise.reject('unsupported PPIC mode: ' + mode);
        //case 0: huffman = null; break;
        case 1: huffman = mode1HuffmanTable; break;
        case 2: huffman = mode2HuffmanTable; break;
        case 3: huffman = readMode3HuffmanTable(); break;
      }
      
      if (!huffman) {
        // TODO
        return Promise.reject('uncompressed mode not yet supported');
      }
      
      function swap16(v) {
        return ((v >> 8) & 0xff) | ((v & 0xff) << 8);
      }
      var walkHuffRepeat = 0, walkHuffLast = 0x0000;
      function walkHuff() {
        if (walkHuffRepeat > 0) {
          walkHuffRepeat--;
          walkHuffLast = swap16(walkHuffLast);
          return walkHuffLast & 0xff;
        }
        var dw = unsigned(16); skip(-16);
        var i;
        for (i = 0; i < 16; i++) {
          if (huffman.masks[i+1] > dw) break;
        }
        skip(huffman.lengths[i]);
        var v = huffman.values[i];
        if (v === 0xff) {
          if (!unsigned(1)) {
            walkHuffLast &= 0xff;
            walkHuffLast |= walkHuffLast << 8;
          }
          walkHuffRepeat = unsigned(3);
          if (walkHuffRepeat < 3) {
            walkHuffRepeat = (walkHuffRepeat << 4) | unsigned(4);
            if (walkHuffRepeat < 8) {
              walkHuffRepeat = (walkHuffRepeat << 8) | unsigned(8);
            }
          }
          walkHuffRepeat -= 2;
          walkHuffLast = swap16(walkHuffLast);
          return walkHuffLast & 0xff;
        }
        else {
          walkHuffLast = (walkHuffLast << 8) | v;
        }
        return v;
      }
      
      var edge = width % 4;
      var flags = edge ? unsigned(5) : unsigned(4) << 1;
      var odd = 0;
      var blank = width % 16;
      if (blank) {
        blank = (blank / 4) | 0;
        odd = blank % 2;
        blank = 2 - ((blank/2) | 0);
      }
      
      var image = new Uint8Array(stride * height);
      
      var p = 0;
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < (width/8); x++) {
          var hi = walkHuff();
          image[p++] = walkHuff() | (hi << 4);
        }
        if (odd) {
          image[p] = walkHuff() << 4;
        }
        p += blank;
      }
      
      if (edge) {
        var p = stride - blank;
        var bits = 0, val = 0;
        for (var y = 0; y < height; y++) {
          if (flags & 1) {
            if (bits < edge) {
              v = walkHuff() << 4;
              val |= v >> bits;
              bits += 4;
            }
            bits -= edge;
            v = val;
            val <<= edge;
            val &= 0xff;
          }
          else {
            v = unsigned(edge);
            v <<= 8 - edge;
          }
          if (odd) v >>= 4;
          image[p] |= v & 0xff;
          p += stride;
        }
      }
      if (flags & 8) {
        var p = 0;
        for (var y = 0; y < height; y++) {
          var v = 0;
          if (flags & 2) {
            for (var x = 0; x < stride; x++) {
              image[p] ^= v;
              v = image[p++];
            }
          }
          else {
            for (var x = 0; x < stride; x++) {
              val = image[p] ^ v;
              val ^= (val >> 4) & 0xf;
              image[p++] = val;
              v = val << 4;
            }
          }
        }
      }
      if (flags & 4) {
        var delta = stride * 4;
        if (flags & 2) {
          delta *= 2;
        }
        var p = 0;
        var q = delta;
        for (var i = 0; i <= height * stride - delta; i++) {
          image[q++] ^= image[p++];
        }
      }

      item.withPixels(width, height, function(pixelData) {
        for (var y = 0; y < height; y++) {
          for (var x = 0; x < width; x++) {
            var pixelValue = image[(y * stride) + (x >> 3)];
            pixelValue = (pixelValue >> (7 - (x & 7))) & 1;
            //pixelValue = (x & 1) ? pixelValue & 0xf : pixelValue >> 4;
            pixelData.set(palette[pixelValue], 4 * (y*width + x));
          }
        }
      });

    });
  }
  
  return open;

});
