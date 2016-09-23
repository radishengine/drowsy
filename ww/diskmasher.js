// Based (extremely loosely) on xDMS <http://zakalwe.fi/~shd/foss/xdms/>
// by Andre Rodrigues de la Rocha & Heikki Orsila

// constant arrays used by Medium Mode & Deep Mode, declared and filled later
var LENGTHS, CODES;

// Deep Mode constants
var F = 60;  // lookahead buffer size
var THRESHOLD = 2;
var N_CHAR = 256 - THRESHOLD + F; // kinds of characters (character code = 0..N_CHAR-1)
var T = N_CHAR * 2 - 1; // size of table
var R = T - 1; // position of root
var MAX_FREQ = 0x8000;

function Demasher(mode, flags) {
  this.mode = mode;
  
  // for Quick, Medium, Deep, and Heavy Mode
  this.ring_buffer = new Uint8Array(8192);
  
  // Deep Mode: frequency table
  this.freq = new Uint16Array(T + 1);
  // Deep Mode: pointers to parent nodes
  // ...except for [T..T + N_CHAR - 1] which are used to get
  //    the positions of leaves corresponding to the codes
  this.prnt = new Uint16Array(T + N_CHAR); 
  // Deep Mode: pointers to child nodes (son[], son[] + 1)
  this.son = new Uint16Array(T);
  
  // Heavy Mode
  this.flags = flags;
  this.c_len = new Uint8Array(510);
  this.pt_len = new Uint8Array(20);
  this.left = new Uint16Array(2 * this.c_len.length - 1);
  this.right = new Uint16Array(this.left.length + 9);
  this.c_table = new Uint16Array(4096);
  this.pt_table = new Uint16Array(256);  
}
Demasher.prototype = {
  hold: 0,
  bits: 0,
  context_value: 0,
  repeat_count: 0,
  ring: null,
  ring_pos: 0,
  copy_pos: 0,
  copy_count: 0,
  lastlen: 0,
  process: function(input, output) {
    var mode = this.mode,
      default_mode = this.default_mode,
      hold = this.hold,
      bits = this.bits,
      input_pos = 0,
      input_end = input.length,
      output_pos = 0,
      output_end = output.length,
      context_value = this.context_value,
      repeat_count = this.repeat_count,
      ring = this.ring,
      ring_pos = this.ring_pos,
      copy_pos = this.copy_pos,
      copy_count = this.copy_count,
      son = this.son,
      prnt = this.prnt,
      freq = this.freq;
    function PULLBYTE() {
      if (input_pos === input_end) return false;
      hold |= (input[input_pos++] << 8);
      bits += 8;
      return true;
    }
    function NEEDBITS(n) {
      while (bits < n) {
        if (!PULLBYTE()) return false;
      }
      return true;
    }
    function BITS(n) {
      return hold & ((1 << n) - 1);
    }
    function DROPBITS(n) {
      hold >>= n; bits -= n;
    }
    decrunching: do switch(mode) {
      //// RLE Mode ////
      case 'rle':
        mode = default_mode = this.default_mode = 'rle_';
//      continue decrunching;
      case 'rle_':
        var end_fast = input_end - 5 + 1;
        fastRLE: while (input_pos < end_fast && output_pos < output_end) {
          var value = input[input_pos++];
          if (value !== 0x90) {
            output[output_pos++] = value;
            continue fastRLE;
          }
          repeat_count = input[input_pos++];
          if (repeat_count === 0) {
            output[output_pos++] = 0x90;
            continue fastRLE;
          }
          context_value = input[input_pos++];
          if (repeat_count === 0xff) {
            repeat_count = input[input_pos++];
            repeat_count = (repeat_count << 8) | input[input_pos++];
          }
          do {
            output[output_pos++] = context_value;
            if (output_pos === output_end) {
              this.repeat_count = repeat_count;
              this.context_value = context_value;
              break decrunching;
            }
          } while (--repeat_count);
        }
        do {
          if (input_pos === input_end || output_pos === output_end) break decrunching;
          var value = input[input_pos++];
          if (value === 0x90) break;
          output[output_pos++] = value;
        } while (true);
        mode = 'rle2';
//      continue decrunching;
      case 'rle2':
        if (input_pos === input_end || output_pos === output_end) break decrunching;
        repeat_count = input[input_pos++];
        if (repeat_count === 0x00) {
          output[output_pos++] = 0x90;
          mode = default_mode;
          continue decrunching;
        }
        mode = 'rle3';
        this.repeat_count = repeat_count;
//      continue decrunching;
      case 'rle3':
        if (input_pos === input_end) break decrunching;
        this.context_value = context_value = input[input_pos++];
        mode = 'rle4';
//      continue decrunching;
      case 'rle4':
        if (repeat_count === 0xFF) {
          if (!NEEDBITS(16)) break decrunching;
          repeat_count = BITS(16);
          DROPBITS(16);
        }
        mode = 'output_repeat';
//      continue decrunching;
      case 'output_repeat':
        do {
          if (output_pos === output_end) {
            this.repeat_count = repeat_count;
            break decrunching;
          }
          output[output_pos++] = context_value;
        } while (--repeat_count);
        mode = default_mode;
        continue decrunching;
      //// Quick Mode ////
      case 'quick':
        ring = this.ring = this.ring_buffer.subarray(0, 256);
        ring_pos = this.ring_pos = ring.length - 5;
        mode = default_mode = this.default_mode = 'quick_';
//      continue decrunching;
      case 'quick_':
        var ring_mask = ring.length - 1;
        do {
          if (output_pos === output_end) break decrunching;
          if (!NEEDBITS(9)) break decrunching;
          if (BITS(9) & 0x100) {
            if (!NEEDBITS(2)) break decrunching;
            copy_pos = (ring_pos - (BITS(8) + 1)) & ring_mask;
            DROPBITS(8);
            copy_count = BITS(2) + 2;
            DROPBITS(3);
            break;
          }
          output[output_pos++] = ring[ring_pos] = BITS(8);
          DROPBITS(9);
          ring_pos = (ring_pos + 1) & ring_mask;
        } while (true);
        mode = 'ring_copy';
//      continue decrunching;
      case 'ring_copy':
        var ring_mask = ring.length - 1;
        do {
          if (output_pos === output_length) {
            this.copy_pos = copy_pos;
            this.copy_count = copy_count;
            break decrunching;
          }
          output[output_pos++] = ring[ring_pos] = ring[copy_pos];
          ring_pos = (ring_pos + 1) & ring_mask;
          copy_pos = (copy_pos + 1) & ring_mask;
        } while (--copy_count);
        mode = default_mode;
        continue decrunching;
      //// Medium Mode ////
      case 'medium':
        ring = this.ring = this.ring_buffer.subarray(0, 0x4000);
        ring_pos = ring.length - 66;
        mode = default_mode = default_mode = 'medium_';
//      continue decrunching;
      case 'medium_':
        var ring_mask = ring.length - 1;
        do {
          if (output_pos === output_end) break decrunching;
          if (!NEEDBITS(9)) break decrunching;
          if (BITS(9) & 0x100) {
            context_value = BITS(8);
            DROPBITS(9);
            break;
          }
          output[output_pos++] = ring[ring_pos] = BITS(8);
          DROPBITS(9);
          ring_pos = (ring_pos + 1) & ring_mask;
        } while (true);
        mode = 'medium2';
//      continue decrunching;
      case 'medium2':
        var u = LENGTHS[context_value];
        if (!NEEDBITS(u)) {
          this.context_value = context_value;
          break decrunching;
        }
        copy_count = CODES[context_value] + 3;
        context_value = ((context_value << u) | BITS(u)) & 0xff;
        DROPBITS(u);
        mode = 'medium3';
//      continue decrunching;
      case 'medium3':
        var u = LENGTHS[context_value];
        if (!NEEDBITS(u)) {
          this.context_value = context_value;
          break decrunching;
        }
        context_value = (CODES[context_value] << 8) | (((context_value << u) | BITS(u)) & 0xff);
        DROPBITS(u);
        copy_pos = (ring_pos - context_value - 1) & (ring.length - 1);
        mode = 'ring_copy';
        continue decrunching;
        
      /* Deep Mode */
      case 'deep':
        ring = this.ring = this.ring_buffer.subarray(0, 0x4000);
        ring_pos = ring.length - 60;
        for (var i = 0; i < N_CHAR; i++) {
          freq[i] = 1;
          son[i] = i + T;
          prnt[i + T] = i;
        }
        var i = 0, j = N_CHAR;
        while (j <= R) {
          freq[j] = freq[i] + freq[i + 1];
          son[j] = i;
          prnt[i] = prnt[i + 1] = j;
          i += 2; j++;
        }
        freq[T] = 0xffff;
        prnt[R] = 0;
        mode = default_mode = this.default_mode = 'deep_';
//      continue decrunching;
      case 'deep_':
        context_value = son[R];
        mode = 'deep2';
//      continue decrunching;
      case 'deep2':
        while (context_value < T) {
          if (!NEEDBITS(1)) {
            this.context_value = context_value;
            break decrunching;
          }
          context_value = son[context_value + BITS(1)];
          DROPBITS(1);
        }
        context_value -= T;
        if (freq[R] === MAX_FREQ) {
          /* collect leaf nodes in the first half of the table */
          /* and replace the freq by (freq + 1) / 2. */
          var i = 0, j = 0;
          for (; i < T; i++) {
            if (son[i] >= T) {
              freq[j] = (freq[i] + 1) >> 1;
              son[j] = son[i];
              j++;
            }
          }
          /* begin constructing tree by connecting sons */
          var i = 0;
          for (var j = N_CHAR; j < T; j++) {
            var k = (i + 1) & 0xffff;
            var f = freq[j] = (freq[i] + freq[k]) & 0xffff;
            k = (j - 1) & 0xffff;
            while (f < freq[k]) k--;
            k++;
            var l = ((j - k) * 2) & 0xffff;
            // TODO: something probably more sensible than this literal memmove substitute
            var dst = new Uint8Array(freq.buffer, freq.byteOffset + (k + 1) * 2, l);
            var src = new Uint8Array(new Uint8Array(freq.buffer, freq.byteOffset + k * 2, l));
            dst.set(src);
            freq[k] = f;
            dst = new Uint8Array(son.buffer, son.byteOffset + (k + 1) * 2, l);
            src = new Uint8Array(new Uint8Array(son.buffer, son.byteOffset + k * 2, l));
            dst.set(src);
            son[k] = i;
            i += 2;
          }
          /* connect prnt */
          for (var i = 0; i < T; i++) {
            var k = son[i];
            prnt[k] = i;
            if (k < T) prnt[k + 1] = i;
          }
        }
        var c = prnt[context_value + T];
        do {
          var k = ++freq[c];
          var l = (c + 1) & 0xffff;
          /* if the order is disturbed, exchange nodes */
          if (k > freq[l]) {
            while (k > freq[l]) l++;
            freq[c] = freq[l];
            freq[l] = k;
      
            var i = son[c];
            prnt[i] = l;
            if (i < T) prnt[i + 1] = l;
      
            var j = son[l];
            son[l] = i;
      
            prnt[j] = c;
            if (j < T) prnt[j + 1] = c;
            son[c] = j;
      
            c = l;
          }
          c = prnt[c];
        } while (c !== 0); /* repeat up to root */
        mode = 'deep3';
//      continue decrunching;
      case 'deep3':
        if (context_value < 256) {
          if (output_pos === output_end) break decrunching;
          output_pos[output_pos++] = ring[ring_pos] = context_value;
          ring_pos = (ring_pos + 1) % ring.length;
          mode = default_mode;
          continue decrunching;
        }
        copy_count = context_value - 253;
        mode = 'deep4';
//      continue decrunching;
      case 'deep4':
        if (!NEEDBITS(8)) break decrunching;
        context_value = BITS(8);
        DROPBITS(8);
        mode = 'deep5';
//      continue decrunching;
      case 'deep5':
        var i = context_value;
        var j = LENGTHS[i];
        if (!NEEDBITS(j)) {
          this.context_value = context_value;
          break decrunching;
        }
        context_value = (CODES[i] << 8) | (((i << j) | BITS(j)) & 0xff);
        DROPBITS(j);
        copy_pos = (ring_pos - context_value - 1) & (ring.length - 1);
        mode = 'ring_copy';
        continue decrunching;
      
      /* Heavy Mode */
      case 'heavy':
        ring = this.ring = this.ring_buffer.subarray(0, (this.flags & 8) ? 0x2000 : 0x1000);
        ring_pos = 0;
        this.np = (this.flags & 8) ? 15 : 14;
        default_mode = this.default_mode = 'heavy_';
        if (this.flags & 2) {
          mode = 'heavy_c_tree';
          continue decrunching;
        }
        mode = 'heavy_';
//      continue decrunching;
      case 'heavy_':
        if (!NEEDBITS(12)) break decrunching;
        context_value = this.c_table[BITS(12)];
        if (context_value < 510 /* N1 */) {
          DROPBITS(this.c_len[context_value]);
          mode = 'heavy3';
          continue decrunching;
        }
        DROPBITS(12);
        mode = 'heavy2';
//      continue decrunching;
      case 'heavy2':
        if (!NEEDBITS(16)) {
          this.context_value = context_value;
          break decrunching;
        }
        var i = BITS(16);
        var m = 0x8000;
        do {
          context_value = (i & m) ? this.right[context_value] : this.left[context_value];
          m >>= 1;
        } while (context_value >= 510 /* N1 */);
        DROPBITS(c_len[context_value] - 12);
        mode = 'heavy3';
//      continue decrunching;
      case 'heavy3':
        if (context_value < 256) {
          if (output_pos === output_end) {
            this.context_value = context_value;
            break decrunching;
          }
          output[output_pos++] = ring[ring_pos] = context_value;
          ring_pos = (ring_pos + 1) % ring.length;
          mode = default_mode;
          continue decrunching;
        }
        copy_count = (context_value - 253) & 0xffff;
        mode = 'heavy4';
//      continue decrunching;
      case 'heavy4':
        if (!NEEDBITS(8)) {
          this.copy_count = copy_count;
          break decrunching;
        }
        context_value = this.pt_table[BITS(8)];
        if (context_value < this.np) {
          DROPBITS(this.pt_len[context_value]);
          mode = 'heavy6';
          continue decrunching;
        }
        DROPBITS(8);
        mode = 'heavy5';
//      continue decrunching;
      case 'heavy5':
        if (!NEEDBITS(16)) {
          this.context_value = context_value;
          break decrunching;
        }
        var i = BITS(16);
        var m = 0x8000;
        do {
          context_value = (i & m) ? right[context_value] : left[context_value];
          m >>= 1;
        } while (context_value >= this.np);
        DROPBITS(this.pt_len[context_value] - 8);
        mode = 'heavy6';
        continue decrunching;
      case 'heavy6':
        if (context_value === this.np-1) {
          context_value = this.lastlen;
          copy_pos = (ring_pos - context_value - 1) & (ring.length - 1);
          mode = 'ring_copy';
          continue decrunching;
        }
        if (context_value <= 0) {
          this.lastlen = context_value;
          copy_pos = (ring_pos - context_value - 1) & (ring.length - 1);
          mode = 'ring_copy';
          continue decrunching;
        }
        mode = 'heavy7';
//      continue decrunching;
      case 'heavy7':
        var i = (context_value-1) & 0xffff;
        if (!NEEDBITS(i)) {
          this.context_value = context_value;
          break decrunching;
        }
        this.lastloc = context_value = GETBITS(i) | ((1 << (context_value-1)) & 0xffff);
        DROPBITS(i);
        copy_pos = (ring_pos - context_value - 1) & (ring.length - 1);
        mode = 'ring_copy';
        continue decrunching;
      case 'heavy_c_tree':
        if (!NEEDBITS(9)) break decrunching;
        context_value = BITS(9);
        DROPBITS(9);
        if (context_value === 0) {
          mode = 'heavy_c_tree_zero';
          continue decrunching;
        }
        copy_count = 0;
        mode = 'heavy_c_tree_nonzero';
//      continue decrunching;
      case 'heavy_c_tree_nonzero':
        while (copy_count < context_value) {
          if (!NEEDBITS(5)) {
            this.copy_count = copy_count;
            this.context_value = context_value;
            break decrunching;
          }
          this.c_len[copy_count++] = BITS(5);
          DROPBITS(5);
        }
        while (copy_count < 510) this.c_len[copy_count++] = 0;
        make_table(510, this.c_len, 12, this.c_table);
        mode = 'heavy_p_tree';
        continue decrunching;
      case 'heavy_c_tree_zero':
        if (!NEEDBITS(9)) break decrunching;
        context_value = BITS(9);
        DROPBITS(9);
        var i;
        for (i = 0; i < 510; i++) this.c_len[i] = 0;
        for (i = 0; i < 4096; i++) this.c_table[i] = context_value;
        mode = 'heavy_p_tree';
//      continue decrunching;
      case 'heavy_p_tree':
        if (!NEEDBITS(5)) break decrunching;
        context_value = BITS(5);
        DROPBITS(5);
        if (context_value === 0) {
          mode = 'heavy_p_tree_zero';
          continue decrunching;
        }
        copy_count = 0;
        mode = 'heavy_p_tree_nonzero';
//      continue decrunching;
      case 'heavy_p_tree_nonzero':
        while (copy_count < context_value) {
          if (!NEEDBITS(4)) {
            this.copy_count = copy_count;
            this.context_value = context_value;
            break decrunching;
          }
          this.pt_len[copy_count++] = BITS(4);
          DROPBITS(4);
        }
        while (copy_count < this.np) this.pt_len[copy_count++] = 0;
        make_table(this.np, this.pt_len, 8, this.pt_table);
        mode = 'heavy_';
        continue decrunching;
      case 'heavy_p_tree_zero':
        if (!NEEDBITS(5)) break decrunching;
        context_value = BITS(5);
        DROPBITS(5);
        var i;
        for (i = 0; i < this.np; i++) this.pt_len[i] = 0;
        for (i = 0; i < 256; i++) this.pt_table[i] = context_value;
        mode = 'heavy_';
        continue decrunching;
      default: throw new Error('unknown state');
    } while (true);
    this.mode = mode;
    this.hold = hold;
    this.bits = bits;
    this.ring_pos = ring_pos;
  },
};

LENGTHS = new Uint8Array(0x100);
var d_pos = 0;
while (d_pos < 0x20) LENGTHS[d_pos++] = 3;
while (d_pos < 0x50) LENGTHS[d_pos++] = 4;
while (d_pos < 0x90) LENGTHS[d_pos++] = 5;
while (d_pos < 0xC0) LENGTHS[d_pos++] = 6;
while (d_pos < 0xF0) LENGTHS[d_pos++] = 7;
while (d_pos < 0x100) LENGTHS[d_pos++] = 8;

CODES = new Uint8Array(0x100);
var pos = 0x20, val = 0x01;
while (pos < 0x70) {
  CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val;
  CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val;
  CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val;
  CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val;
  val++;
}
for (; pos < 0x90; val++) {
  CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val;
  CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val; CODES[pos++] = val;
  val++;
}
for (; pos < 0xC0; val++) {
  CODES[pos++] = val; CODES[pos++] = val;
  CODES[pos++] = val; CODES[pos++] = val;
  val++;
}
while (pos < 0xF0) {
  CODES[pos++] = val; CODES[pos++] = val;
  val++;
}
while (pos < 0x100) CODES[pos++] = val++;

function make_table(nchar, bitlen, tablebits, table) {
  var n = nchar,
    avail = nchar,
    tblsiz = 1 << tablebits,
    maxdepth = (tablebits + 1) & 0xffff,
    depth = 1,
    len = 1,
    c = -1,
    codeword = 0;
  var bit = (tblsiz >> 1) & 0xffff;

  function mktbl() {
    var i;
    if (len === depth) {
      while (++c < n) {
        if (bitlen[c] === len) {
          i = codeword;
          codeword += bit;
          if (codeword > tblsiz) throw new Error('codeword > tblsiz');
          while (i < codeword) table[i++] = c & 0xffff;
          return c & 0xffff;
        }
      }
      c = -1;
      len++;
      bit >>= 1;
    }
    if (++depth < maxdepth) {
      mktbl();
      mktbl();
    }
    else {
      if (depth > 32) throw new Error('depth > 32');
      i = avail++;
      if (i >= 2*n - 1) {
        throw new Error('i >= 2*n - 1');
      }
      left[i] = mktbl();
      right[i] = mktbl();
      if (codeword >= tblsiz) {
        throw new Error('codeword >= tblsiz');
      }
      if (depth === self.maxdepth) table[codeword++] = i;
    }
    depth--;
    return i;
  }
  
  mktbl();  /* left subtree */
  mktbl();  /* right subtree */
  if (codeword !== tablesize) throw new Error('codeword != tblsiz');
}

function DMSPasswordDecrypter(password) {
  this.crc = createCRC(password);
}
DMSPasswordDecrypter.prototype = {
  process: function(input, output) {
    var input_pos = 0, input_end = input.length,
      output_pos = 0, output_end = output.length,
      crc = this.crc;
    while (input_pos < input_end && output_pos < output_end) {
      var t = input[input_pos++];
      output[output_pos++] = (t ^ crc) & 0xff;
      crc = ((crc >> 1) + t) & 0xffff;
    }
    this.crc = crc;
  },
};

var CRCTab = new Uint16Array([
  0x0000,0xC0C1,0xC181,0x0140,0xC301,0x03C0,0x0280,0xC241,0xC601,0x06C0,0x0780,0xC741,0x0500,0xC5C1,0xC481,0x0440,
  0xCC01,0x0CC0,0x0D80,0xCD41,0x0F00,0xCFC1,0xCE81,0x0E40,0x0A00,0xCAC1,0xCB81,0x0B40,0xC901,0x09C0,0x0880,0xC841,
  0xD801,0x18C0,0x1980,0xD941,0x1B00,0xDBC1,0xDA81,0x1A40,0x1E00,0xDEC1,0xDF81,0x1F40,0xDD01,0x1DC0,0x1C80,0xDC41,
  0x1400,0xD4C1,0xD581,0x1540,0xD701,0x17C0,0x1680,0xD641,0xD201,0x12C0,0x1380,0xD341,0x1100,0xD1C1,0xD081,0x1040,
  0xF001,0x30C0,0x3180,0xF141,0x3300,0xF3C1,0xF281,0x3240,0x3600,0xF6C1,0xF781,0x3740,0xF501,0x35C0,0x3480,0xF441,
  0x3C00,0xFCC1,0xFD81,0x3D40,0xFF01,0x3FC0,0x3E80,0xFE41,0xFA01,0x3AC0,0x3B80,0xFB41,0x3900,0xF9C1,0xF881,0x3840,
  0x2800,0xE8C1,0xE981,0x2940,0xEB01,0x2BC0,0x2A80,0xEA41,0xEE01,0x2EC0,0x2F80,0xEF41,0x2D00,0xEDC1,0xEC81,0x2C40,
  0xE401,0x24C0,0x2580,0xE541,0x2700,0xE7C1,0xE681,0x2640,0x2200,0xE2C1,0xE381,0x2340,0xE101,0x21C0,0x2080,0xE041,
  0xA001,0x60C0,0x6180,0xA141,0x6300,0xA3C1,0xA281,0x6240,0x6600,0xA6C1,0xA781,0x6740,0xA501,0x65C0,0x6480,0xA441,
  0x6C00,0xACC1,0xAD81,0x6D40,0xAF01,0x6FC0,0x6E80,0xAE41,0xAA01,0x6AC0,0x6B80,0xAB41,0x6900,0xA9C1,0xA881,0x6840,
  0x7800,0xB8C1,0xB981,0x7940,0xBB01,0x7BC0,0x7A80,0xBA41,0xBE01,0x7EC0,0x7F80,0xBF41,0x7D00,0xBDC1,0xBC81,0x7C40,
  0xB401,0x74C0,0x7580,0xB541,0x7700,0xB7C1,0xB681,0x7640,0x7200,0xB2C1,0xB381,0x7340,0xB101,0x71C0,0x7080,0xB041,
  0x5000,0x90C1,0x9181,0x5140,0x9301,0x53C0,0x5280,0x9241,0x9601,0x56C0,0x5780,0x9741,0x5500,0x95C1,0x9481,0x5440,
  0x9C01,0x5CC0,0x5D80,0x9D41,0x5F00,0x9FC1,0x9E81,0x5E40,0x5A00,0x9AC1,0x9B81,0x5B40,0x9901,0x59C0,0x5880,0x9841,
  0x8801,0x48C0,0x4980,0x8941,0x4B00,0x8BC1,0x8A81,0x4A40,0x4E00,0x8EC1,0x8F81,0x4F40,0x8D01,0x4DC0,0x4C80,0x8C41,
  0x4400,0x84C1,0x8581,0x4540,0x8701,0x47C0,0x4680,0x8641,0x8201,0x42C0,0x4380,0x8341,0x4100,0x81C1,0x8081,0x4040,
]);

// xDMS credits this CRC func to Bjorn Stenberg
function createCRC(str) {
  var crc = 0;
  for (var i = 0; i < str.length; i++) {
    crc = (CRCTab[(crc ^ str.charCodeAt(i)) & 255] ^ ((CRC >> 8) & 255)) & 0xffff;
  }
  return crc;
}



function Process_Track(fi, fo, b1, b2, cmd, opt, pwd) {
  var l = (USHORT)fread(b1,1,THLEN,fi);

  if (l !== THLEN) {
    if (l === 0) return 'FILE_END';
    else throw new Error('ERR_SREAD');
  }

  /*  "TR" identifies a Track Header  */
  if (String.fromCharCode.apply(null, b1.subarray(0, 2)) !== 'TR') throw new Error('ERR_NOTTRACK');

  /*  Track Header CRC  */
  var hcrc = (b1[THLEN-2] << 8) | b1[THLEN-1];

  if (CreateCRC(b1, THLEN-2) != hcrc) throw new Error('ERR_THCRC');

  var number = (b1[2] << 8) | b1[3];  /*  Number of track  */
  var pklen1 = (b1[6] << 8) | b1[7];  /*  Length of packed track data as in archive  */
  var pklen2 = (b1[8] << 8) | b1[9];  /*  Length of data after first unpacking  */
  var unpklen = (b1[10] << 8) | b1[11];  /*  Length of data after subsequent rle unpacking */
  var flags = b1[12];    /*  control flags  */
  var cmode = b1[13];    /*  compression mode used  */
  var usum = (b1[14] << 8) | b1[15];  /*  Track Data CheckSum AFTER unpacking  */
  var dcrc = (b1[16] << 8) | b1[17];  /*  Track Data CRC BEFORE unpacking  */

  if (pklen1 > TRACK_BUFFER_LEN || pklen2 > TRACK_BUFFER_LEN || unpklen > TRACK_BUFFER_LEN) {
    throw new Error('ERR_BIGTRACK');
  }

  if (fread(b1, 1, pklen1, fi) !== pklen1) throw new Error('ERR_SREAD');

  if (CreateCRC(b1, pklen1) !== dcrc) throw new Error('ERR_TDCRC');

  /*  track 80 is FILEID.DIZ, track 0xffff (-1) is Banner  */
  /*  and track 0 with 1024 bytes only is a fake boot block with more advertising */
  /*  FILE_ID.DIZ is never encrypted  */

  if (pwd && number !== 80) dms_decrypt(b1, pklen1);

  if (number < 80 && unpklen > 2048) {
    r = Unpack_Track(b1, b2, pklen2, unpklen, cmode, flags);
    if (r !== 'NO_PROBLEM') {
      if (pwd) throw new Error('ERR_BADPASSWD');
      return r;
    }
    if (usum !== Calc_CheckSum(b2, unpklen)) {
      throw new Error(pwd ? 'ERR_BADPASSWD' : 'ERR_CSUM');
    }
    if (fwrite(b2, 1, unpklen, fo) !== unpklen) throw new Error('ERR_CANTWRITE');
  }

  return 'NO_PROBLEM';
}

function Unpack_Track(UCHAR *b1, UCHAR *b2, USHORT pklen2, USHORT unpklen, UCHAR cmode, UCHAR flags){
  switch (cmode) {
    case 0: // No Compression
      b2.set(b1.subarray(0, unpklen));
      break;
    case 1: // Simple Compression
      if (Unpack_RLE(b1, b2, unpklen)) throw new Error('ERR_BADDECR');
      break;
    case 2: // Quick Compression
      if (Unpack_QUICK(b1, b2, pklen2)) throw new Error('ERR_BADDECR');
      if (Unpack_RLE(b2, b1, unpklen)) throw new Error('ERR_BADDECR');
      memcpy(b2, b1, (size_t)unpklen);
      break;
    case 3: // Medium Compression
      if (Unpack_MEDIUM(b1,b2,pklen2)) throw new Error('ERR_BADDECR');
      if (Unpack_RLE(b2,b1,unpklen)) throw new Error('ERR_BADDECR');
      memcpy(b2, b1, unpklen);
      break;
    case 4: // Deep Compression
      if (Unpack_DEEP(b1, b2, pklen2)) throw new Error('ERR_BADDECR');
      if (Unpack_RLE(b2, b1, unpklen)) throw new Error('ERR_BADDECR');
      memcpy(b2, b1, unpklen);
      break;
    case 5: case 6: // Heavy Compression
      if (cmode === 5) { // Heavy 1
        if (Unpack_HEAVY(b1, b2, flags & 7, pklen2)) throw new Error('ERR_BADDECR');
      }
      else { // Heavy 2
        if (Unpack_HEAVY(b1, b2, flags | 8, pklen2)) throw new Error('ERR_BADDECR');
      }
      if (flags & 4) {
        /*  Unpack with RLE only if this flag is set  */
        if (Unpack_RLE(b2,b1,unpklen)) throw new Error('ERR_BADDECR');
        memcpy(b2,b1,(size_t)unpklen);
      }
      break;
    default: throw new Error('ERR_UNKNMODE');
  }
  if (!(flags & 1)) Init_Decrunchers();
  return 'NO_PROBLEM';
}


