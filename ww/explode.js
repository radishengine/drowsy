// based on Mark Adler's blast.c

function Huffman(symbolCount, rep) {
  this.count = new Int16Array(13 /* MAXBITS */ + 1);
  this.symbol = new Int16Array(symbolCount);
  
  var offs = new Int16Array(13 /* MAXBITS */ + 1);
  var length = new Int16Array(256);
  
  /* convert compact repeat counts into symbol bit length list */
  var symbol = 0;
  var len;
  var rep_pos = 0;
  do {
    len = rep[rep_pos++];
    var left = (len >> 4) + 1;
    len &= 15;
    do {
      length[symbol++] = len;
    } while (rep_pos < rep.length);
  } while (--n);
  var n = symbol;

  /* count number of codes of each length */
  for (len = 0; len <= 13 /* MAXBITS */; len++) {
    this.count[len] = 0;
  }
  for (symbol = 0; symbol < n; symbol++) {
    (this.count[length[symbol]])++;   /* assumes lengths are within bounds */
  }
  if (this.count[0] === n) { //  no codes!
    return; // complete, but decode() will fail */
  }

  /* check for an over-subscribed or incomplete set of lengths */
  left = 1; /* one possible code of zero length */
  for (len = 1; len <= 13 /* MAXBITS */; len++) {
    left <<= 1; // one more bit, double codes left
    left -= this.count[len]; // deduct count from possible codes
    if (left < 0) throw new Error('over-subscribed');
  }

  /* generate offsets into symbol table for each length for sorting */
  offs[1] = 0;
  for (len = 1; len < 13 /* MAXBITS */; len++) {
    offs[len + 1] = offs[len] + this.count[len];
  }

  // put symbols in table sorted by length, by symbol order within each length
  for (symbol = 0; symbol < n; symbol++) {
    if (length[symbol] !== 0) {
      this.symbol[offs[length[symbol]]++] = symbol;
    }
  }

  if (left !== 0) throw new Error('incomplete');
}

// literal codes
var litcode = new Huffman(256, new Uint8Array([
  11, 124, 8, 7, 28, 7, 188, 13, 76, 4, 10, 8, 12, 10, 12, 10, 8, 23, 8,
  9, 7, 6, 7, 8, 7, 6, 55, 8, 23, 24, 12, 11, 7, 9, 11, 12, 6, 7, 22, 5,
  7, 24, 6, 11, 9, 6, 7, 22, 7, 11, 38, 7, 9, 8, 25, 11, 8, 11, 9, 12,
  8, 12, 5, 38, 5, 38, 5, 11, 7, 5, 6, 21, 6, 10, 53, 8, 7, 24, 10, 27,
  44, 253, 253, 253, 252, 252, 252, 13, 12, 45, 12, 45, 12, 61, 12, 45,
  44, 173]));
// length codes
var lencode = new Huffman(16, new Uint8Array([2, 35, 36, 53, 38, 23]));
// distance codes
var distcode = new Huffman(64, new Uint8Array([2, 20, 53, 230, 247, 151, 248]));

// base for length codes
var base = new Int16Array([3, 2, 4, 5, 6, 7, 8, 9, 10, 12, 16, 24, 40, 72, 136, 264]);
// extra bits for length codes
var extra = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]);

function Explosion() {
  
}
Explosion.prototype = {
  mode: 'init',
  context_value: 0,
  hold: 0,
  bits: 0,
  literal_mode: 'literal',
  process: function(input, output) {
    var input_pos = 0, input_end = input.length,
      output_pos = 0, output_end = output.length,
      hold: this.hold, bits: this.bits,
      context_value = this.context_value,
      literal_mode = this.literal_mode,
      mode = this.mode;
      
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
    
    exploding: do switch(mode) {
      case 'init':
        if (input_pos === input_end) break exploding;
        context_value = input[input_pos++];
        if (context_value > 1) throw new Error('bad value for lit');
        literal_mode = this.literal_mode = context_value ? 'decode_literal' : 'literal';
        mode = 'init2';
//      continue exploding;
      case 'init2':
        if (input_pos === input_end) break exploding;
        var context_value = input[input_pos++]; // log2(dictionary size) - 6
        if (context_value < 4 || context_value > 6) throw new Error('bad value for dict');
        this.dict = context_value;
        mode = 'main';
//      continue exploding;
      case 'main':
        if (!NEEDBITS(1)) break exploding;
        context_value = BITS(1);
        DROPBITS(1);
        if (context_value === 1) {
          mode = 'repeat';
          continue exploding;
        }
        mode = literal_mode;
        continue exploding;
      case 'literal':
        if (!NEEDBITS(8) || output_pos === output_end) break exploding;
        output[output_pos++] = BITS(8);
        DROPBITS(8);
        mode = 'main';
        continue exploding;
      case 'decode_literal':
        context_value = this.literals_coded ? this.decode(litcode) : this.bits(8);
        output[output_pos++] = symbol;
        mode = 'main';
        continue exploding;
      case 'done': break exploding;
    } while (true);
    
    this.hold = hold;
    this.bits = bits;
    return this.mode = mode;
  },
};

var NO_BYTES = new Uint8Array(0);

function ExplodeState(infun, outfun) {
  this.infun = infun;
  this.outfun = outfun;
  this.out_buf = new Uint8Array(4096 /* MAXWIN */);
}
ExplodeState.prototype = {
  infun: null, // input function provided by user
  in_buf: NO_BYTES,
  in_pos: 0,
  left: 0, // available input at in_buf + in_pos
  bitbuf: 0, // bit buffer
  bitcnt: 0, // number of bits in bit buffer
  outfun: null, // output function provided by user
  out_pos: 0, // index into out_buf
  first: true, // true to check distances (for first 4K)
  bits: function(need) {
    int val = this.bitbuf;
    while (this.bitcnt < need) {
      if (this.left === 0) {
        this.left = this.infun();
        if (this.left === 0) longjmp(s.env, 1); // out of input
      }
      val |= this.in_buf[this.in_pos++] << s.bitcnt; // load 8 bits
      this.left--;
      this.bitcnt += 8;
    }

    this.bitbuf = val >> need;
    this.bitcnt -= need;

    return val & ((1 << need) - 1);
  },
  decode: function(h) {
    var len = 1;            /* current number of bits in code */
    var code = 0;           /* len bits being decoded */
    var first = 0;          /* first code of length len */
    var count;          /* number of codes of length len */
    var index = 0;          /* index of first code of length len in symbol table */
    var bitbuf = this.bitbuf;         /* bits from stream */
    var left = this.bitcnt;           /* bits left in next or left to process */
    var next = 1;        /* next number of codes */

    while (1) {
      while (left--) {
        code |= (bitbuf & 1) ^ 1;   /* invert code */
        bitbuf >>= 1;
        count = h.count[next++];
        if (code < first + count) { /* if length len, return symbol */
          this.bitbuf = bitbuf;
          this.bitcnt = (this.bitcnt - len) & 7;
          return h.symbol[index + (code - first)];
        }
        index += count; // else update for next length
        first += count;
        first <<= 1;
        code <<= 1;
        len++;
      }
      left = (13 /* MAXBITS */ + 1) - len;
      if (left === 0) break;
      if (this.left === 0) {
        this.left = this.infun();
        if (this.left === 0) longjmp(s.env, 1); // out of input
      }
      bitbuf = this.in_buf[this.in_pos++];;
      this.left--;
      if (left > 8) left = 8;
    }
    throw new Error('ran out of codes');
  },
  decomp: function() {
    var lit = this.bits(8); // true if literals are coded
    if (lit > 1) throw new Error('invalid value for lit');
    var dict = this.bits(8); // log2(dictionary size) - 6
    if (dict < 4 || dict > 6) throw new Error('invalid value for dict');

    /* decode literals and length/distance pairs */
    do {
      if (this.bits(1)) {
        /* get length */
        var symbol = this.decode(lencode);
        var len = base[symbol] + this.bits(extra[symbol]);
        if (len === 519) break; /* end code */

        /* get distance */
        symbol = len === 2 ? 2 : dict;
        var dist = this.decode(distcode) << symbol;
        dist += this.bits(symbol);
        dist++;
        if (s->first && dist > this.out_pos) {
          return -3; /* distance too far back */
        }

        /* copy length bytes from distance bytes back */
        do {
          var to_buf = this.out_buf;
          var to_pos = this.out_pos;
          var from_buf = to_buf;
          var from_pos = to_pos - dist;
          var copy = 4096 /* MAXWIN */;
          if (this.out_pos < dist) {
            from += copy;
            copy = dist;
          }
          copy -= this.out_pos;
          if (copy > len) copy = len;
          len -= copy;
          this.out_pos += copy;
          do {
            to_buf[to_pos++] = from_buf[from_pos++];
          } while (--copy);
          if (this.out_pos === 4096 /* MAXWIN */) {
            if (this.outfun()) return 1;
            this.out_pos = this.first = 0;
          }
        } while (len !== 0);
      }
      else {
        /* get literal and write it */
        var symbol = lit ? this.decode(litcode) : this.bits(8);
        this.out_buf[this.out_pos++] = symbol;
        if (this.out_pos === 4096 /* MAXWIN */) {
          if (this.outfun()) return 1;
          this.out_pos = this.first = 0;
        }
      }
    } while (1);
  },
  blast: function() {
    this.decomp();
    if (this.out_pos !== 0) this.outfun();
  },
};
