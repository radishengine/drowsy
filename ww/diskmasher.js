// Based on xDMS <http://zakalwe.fi/~shd/foss/xdms/>
// by Andre Rodrigues de la Rocha & Heikki Orsila

function RLEDecruncher() {
}
RLEDecruncher.prototype = {
  process: function(input, outpfuut) {
    var input_pos = 0;
    for (var output_pos = 0, output_end = output.length; output_pos < output_end; ) {
      var a = input[input_pos++];
      if (a !== 0x90) {
        output[output_pos++] = a;
        continue;
      }
      var b = input[input_pos++];
      if (b === 0) {
        output[output_pos++] = a;
        continue;
      }
      a = input[input_pos++];
      var n;
      if (b === 0xff) {
        n = (input[input_pos] << 8) | (input[input_pos + 1]);
        input_pos += 2;
      }
      else n = b;
      if (out_pos + n > output_end) return 1;
      while (n--) {
        output[output_pos++] = a;
      }
    }
  },
};

function QuickDecruncher() {
  this.text = new Uint8Array(0x100);
}
QuickDecruncher.prototype = {
  text_loc: 251,
  bitbuf: 0,
  bitcount: 0,
  process: function(input, output) {
    var bitbuf = this.bitbuf,
      bitcount = this.bitcount,
      text = this.text,
      text_loc = this.text_loc,
      input_pos = 0;
    function GETBITS(n) {
      return bitbuf >>> (bitcount - n);
    }
    function DROPBITS(n) {
      bitcount -= n;
      bitbuf &= (1 << bitcount) - 1;
      while (bitcount < 16) {
        bitbuf = (bitbuf << 8) | input[input_pos++];
        bitcount += 8;
      }
    }
    DROPBITS(0);
    for (var output_pos = 0, output_end = output.length; output_pos < output_end; ) {
      if (GETBITS(1) !== 0) {
        DROPBITS(1);
        output[output_pos] = text[text_loc] = GETBITS(8);
        DROPBITS(8);
        text_loc = (text_loc + 1) % text.length;
      }
      else {
        DROPBITS(1);
        var j = GETBITS(2) + 2;
        DROPBITS(2);
        var i = text_loc - GETBITS(8) - 1;
        DROPBITS(8);
        while (j--) {
          output[output_pos++] = text[text_loc] = text[i];
          i = (i + 1) % text.length;
          text_loc = (text_loc + 1) % text.length;
        }
      }
    }
    this.text_loc = (text_loc + 5) % 256;
    this.bitbuf = bitbuf;
    this.bitcount = bitcount;
  },
};

////// medium mode /////

var d_len = new Uint8Array(256);
var d_pos = 0;
while (d_pos < 0x20) d_len[d_pos++] = 3;
while (d_pos < 0x50) d_len[d_pos++] = 4;
while (d_pos < 0x90) d_len[d_pos++] = 5;
while (d_pos < 0xC0) d_len[d_pos++] = 6;
while (d_pos < 0xF0) d_len[d_pos++] = 7;
while (d_pos < 0x100) d_len[d_pos++] = 8;

var d_code = new Uint8Array(256);
var pos = 0x20, val = 0x01;
while (pos < 0x70) {
  d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val;
  d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val;
  d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val;
  d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val;
  val++;
}
for (; pos < 0x90; val++) {
  d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val;
  d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val; d_code[pos++] = val;
  val++;
}
for (; pos < 0xC0; val++) {
  d_code[pos++] = val; d_code[pos++] = val;
  d_code[pos++] = val; d_code[pos++] = val;
  val++;
}
while (pos < 0xF0) {
  d_code[pos++] = val; d_code[pos++] = val;
  val++;
}
while (pos < 0x100) d_code[pos++] = val;

function MediumDecruncher() {
  this.text = new Uint8Array(0x4000);
}
MediumDecruncher.prototype = {
  text_loc: 0x3fbe,
  process: function(input, output) {
    var bitbuf = this.bitbuf,
      bitcount = this.bitcount,
      text = this.text,
      text_loc = this.text_loc,
      input_pos = 0;
    function GETBITS(n) {
      return bitbuf >>> (bitcount - n);
    }
    function DROPBITS(n) {
      bitcount -= n;
      bitbuf &= (1 << bitcount) - 1;
      while (bitcount < 16) {
        bitbuf = (bitbuf << 8) | input[input_pos++];
        bitcount += 8;
      }
    }
    DROPBITS(0);
    for (var output_pos = 0, output_end = output.length; output_pos < output_end; ) {
      if (GETBITS(1) !== 0) {
        DROPBITS(1);
        output[output_pos++] = text[text_loc] = GETBITS(8);
        text_loc = (text_loc + 1) % text.length;
        DROPBITS(8);
      }
      else {
        DROPBITS(1);
        var c = GETBITS(8);
        DROPBITS(8);
        var j = d_code[c] + 3, u = d_len[c];
        c = ((c << u) | GETBITS(u)) & 0xff;
        DROPBITS(u);
        u = d_len[c];
        c = (d_code[c] << 8) | ((c << u) | GETBITS(u)) & 0xff;
        DROPBITS(u);
        var i = text_loc - c - 1;
        while (j--) {
          output[output_pos++] = text[text_loc] = text[i];
          text_loc = (text_loc + 1) % text.length;
          i = (i + 1) % text.length;
        }
      }
    }
    this.text_loc = (text_loc + 66) % text.length;
    this.bitbuf = bitbuf;
    this.bitcount = bitcount;
  },
};

////// deep mode //////

var DBITMASK = 0x3fff; // 16Kb dictionary
var F = 60; // lookahead buffer size
var THRESHOLD = 2;
var T = (N_CHAR * 2 - 1); // size of table
var R = T - 1; // position of root
var MAX_FREQ = 0x8000;

// kinds of characters (character code = 0..N_CHAR-1)
var N_CHAR = 256 - 2 /* threshold */ + 60 /* lookahead buffer */;

function DeepDecruncher() {
  // pointers to child nodes (son[], son[] + 1)
  this.son = new Uint16Array(N_CHAR * 2 - 1);
  
  // frequency table
  this.freq = new Uint16Array(this.son.length + 1);
  
  // pointers to parent nodes, except for the elements [T..T + N_CHAR - 1]
  // which are used to get the positions of leaves corresponding to the codes
  this.prnt = new Uint16Array(this.son.length + N_CHAR);
}
DeepDecruncher.prototype = {
  text_loc: 0x3fc4,
  process: function(input, output) {
    var bitbuf = this.bitbuf,
      bitcount = this.bitcount,
      text = this.text,
      text_loc = this.text_loc,
      self = this,
      son = this.son,
      freq = this.freq,
      prnt = this.prnt,
      input_pos = 0;
    function GETBITS(n) {
      return bitbuf >>> (bitcount - n);
    }
    function DROPBITS(n) {
      bitcount -= n;
      bitbuf &= (1 << bitcount) - 1;
      while (bitcount < 16) {
        bitbuf = (bitbuf << 8) | input[input_pos++];
        bitcount += 8;
      }
    }
    DROPBITS(0);
    
    function decode_char() {
      var c = son[R];
      // travel from root to leaf, choosing the smaller child node (son[])
      // if the read bit is 0, the bigger (son[]+1} if 1
      while (c < T) {
        c = son[c + GETBITS(1)];
        DROPBITS(1);
      }
      c -= T;
      var result = c;
      // increment frequency of given code by one, and update tree
      if (freq[R] === 0x8000 /* MAX_FREQ */) {
        // reconstruction of tree.
        // collect leaf nodes in the first half of the table
        // and replace the freq by (freq + 1) / 2
        var j = 0;
        for (var i = 0; i < son.length; i++) {
          if (son[i] >= son.length) {
            freq[j] = (freq[i] + 1) >>> 1;
            son[j] = son[i];
            j++;
          }
        }
        // begin constructing tree by connecting sons
        for (var i = 0, j = N_CHAR; j < son.length; i += 2, j++) {
          var k = (i + 1) & 0xffff;
          var f = freq[j] = (freq[i] + freq[k]) & 0xffff;
          k = (j - 1) & 0xffff;
          while (f < freq[k]) k--;
          k++; // TODO: check that this is still necessary (previous line refactored)
          var l = ((j - k) << 1) & 0xffff;
          memmove(&freq[k + 1], &freq[k], l);
          freq[k] = f;
          memmove(&son[k + 1], &son[k], l);
          son[k] = i;
        }
        // connect prnt
        for (var i = 0; i < son.length; i++) {
          var k = son[i];
          prnt[k] = i;
          if (k < T) prnt[k+1] = i;
        }
      }
      c = prnt[c + T];
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
      return result;
    }
    
    function decode_position() {
      var i = GETBITS(8);
      DROPBITS(8);
      var c = (d_code[i] << 8) & 0xffff;
      var j = d_len[i];
      i = ((i << j) | GETBITS(j)) & 0xff;
      DROPBITS(j);
      return c | i;
    }
    
    for (var output_pos = 0, output_end = output.length; output_pos < output_end; ) {
      var c = decode_char();
      if (c < 256) {
        output[output_pos++] = text[text_loc] = c;
        text_loc = (text_loc + 1) % text.length;
      }
      else {
        var j = c - 255 + 2 /* THRESHOLD */;
        var i = text_loc - decode_position() - 1;
        while (j--) {
          output[output_pos++] = text[text_loc] = text[i];
          text_loc = (text_loc + 1) % text.length;
          i = (i + 1) % text.length;
        }
      }
    }
    
    this.text_loc = (text_loc + 60) % text.length;
    this.bitbuf = bitbuf;
    this.bitcount = bitcount;
  },
};

///// heavy mode /////

function HeavyDecruncher(flags) {
  this.flags = flags;
  if (flags & 8) {
    this.np = 15;
    this.text = new Uint8Array(0x2000);
  }
  else {
    this.np = 14;
    this.text = new Uint8Array(0x1000);
  }
  
  this.c_len = new Uint8Array(510);
  this.pt_len = new Uint8Array(20);
  this.left = new Uint16Array(2 * this.c_len.length - 1);
  this.right = new Uint16Array(this.left.length + 9);
  this.c_table = new Uint16Array(4096);
  this.pt_table = new Uint16Array(256);
}
HeavyDecruncher.prototype = {
  text_loc: 0,
  lastlen: 0,
  np: 0,
  process: function(input, output) {
    //  Heavy 1 uses a 4Kb dictionary, Heavy 2 uses 8Kb
    var bitbuf = this.bitbuf,
      bitcount = this.bitcount,
      text = this.text,
      text_loc = this.text_loc,
      input_pos = 0,
      c_table = this.c_table,
      c_len = this.c_len,
      pt_table = this.pt_table,
      pt_len = this.pt_len,
      left = this.left,
      right = this.right,
      lastlen = this.lastlen,
      np = this.np;
      
    function GETBITS(n) {
      return bitbuf >>> (bitcount - n);
    }
    function DROPBITS(n) {
      bitcount -= n;
      bitbuf &= (1 << bitcount) - 1;
      while (bitcount < 16) {
        bitbuf = (bitbuf << 8) | input[input_pos++];
        bitcount += 8;
      }
    }
    DROPBITS(0);
    
    function decode_c() {
      var j = c_table[GETBITS(12)];
      if (j < 510 /* N1 */) {
        DROPBITS(c_len[j]);
      }
      else {
        DROPBITS(12);
        var i = GETBITS(16);
        var m = 0x8000;
        do {
          j = (i & m) ? right[j] : left[j];
          m >>= 1;
        } while (j >= 510 /* N1 */);
        DROPBITS(c_len[j] - 12);
      }
      return j;
    }
    
    function decode_p() {
      var j = pt_table[GETBITS(8)];
      if (j < np) {
        DROPBITS(pt_len[j]);
      }
      else {
        DROPBITS(8);
        var i = GETBITS(16);
        var m = 0x8000;
        do {
          j = (i & m) ? right[j] : left[j];
          m >>= 1;
        } while (j >= np);
        DROPBITS(pt_len[j] - 8);
      }
      if (j !== np-1) {
        if (j > 0) {
          i = (j-1) & 0xffff;
          j = GETBITS(i) | ((1 << (j-1)) & 0xffff);
          DROPBITS(i);
        }
        lastlen = j;
      }
      return lastlen;
    }
    
    function read_tree_c() {
      var n = GETBITS(9);
      DROPBITS(9);
      if (n > 0) {
        for (var i = 0; i < n; i++) {
          c_len[i] = GETBITS(5);
          DROPBITS(5);
        }
        while (n < 510) c_len[n++] = 0;
        make_table(510, c_len, 12, c_table);
      }
      else {
        n = GETBITS(9);
        DROPBITS(9);
        var i;
        for (i = 0; i < 510; i++) c_len[i] = 0;
        for (i = 0; i < 4096; i++) c_table[i] = n;
      }
    }
    
    function read_tree_p() {
      var n = GETBITS(5);
      DROPBITS(5);
      if (n > 0) {
        for (var i = 0; i < n; i++) {
          pt_len[i] = GETBITS(4);
          DROPBITS(4);
        }
        while (n < np) pt_len[n++] = 0;
        make_table(np, pt_len, 8, pt_table);
      }
      else {
        n = GETBITS(5);
        DROPBITS(5);
        var i;
        for (i = 0; i < np; i++) pt_len[i] = 0;
        for (i = 0; i < 256; i++) pt_table[i] = n;
      }
    }
    
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
    
    if (this.flags & 2) {
      read_tree_c();
      read_tree_p();
    }
    for (var output_pos = 0, output_end = output.length; output_pos < output_end; ) {
      var c = decode_c();
      if (c < 256) {
        output[output_pos++] = text[text_loc] = c;
        text_loc = (text_loc + 1) % text.length;
      }
      else {
        var j = (c - 253 /* OFFSET */) & 0xffff;
        var i = (text_loc - decode_p() - 1) & 0xffff;
        while (j--) {
          output[output_pos++] = text[text_loc] = text[i];
          text_loc = (text_loc + 1) % text.length;
          i = (i + 1) % text.length;
        }
      }
    }
    this.text_loc = text_loc;
    this.lastlen = lastlen;
    this.np = np;
  },
};

self.init_diskmasher_rle = function() {
  return new RLEDecruncher();
};

self.init_diskmasher_quick = function() {
  return new QuickDecruncher();
};

self.init_diskmasher_medium = function() {
  return new MediumDecruncher();
};

self.init_diskmasher_deep = function() {
  return new DeepDecruncher();
};

self.init_diskmasher_heavy = function() {
  return new HeavyDecruncher();
};

// TODO: this could be (1 << n) - 1
var mask_bits = new Int32Array([
  0x000000, 0x000001, 0x000003, 0x000007,
  0x00000f, 0x00001f, 0x00003f, 0x00007f,
  0x0000ff, 0x0001ff, 0x0003ff, 0x0007ff,
  0x000fff, 0x001fff, 0x003fff, 0x007fff,
  0x00ffff, 0x01ffff, 0x03ffff, 0x07ffff,
  0x0fffff, 0x1fffff, 0x3fffff, 0x7fffff,
  0xffffff,
]);

// init for deep mode

var DBITMASK = 0x3fff; // 16Kb dictionary
var F = 60; // lookahead buffer size
var THRESHOLD = 2;
var N_CHAR = (256 - THRESHOLD + F); // kinds of characters (character code = 0..N_CHAR-1)
var T = (N_CHAR * 2 - 1); // size of table
var R = T - 1; // position of root
var MAX_FREQ = 0x8000;

// init for heavy mode
var NC = 510;
var NPT = 20;
var N1 = 510;
var OFFSET = 253;
var left = new Uint16Array(2 * NC - 1), right = new Uint16Array(2 * NC - 1 + 9);
var c_len = new Uint8Array(NC), pt_len = new Uint8Array(NPT);
var c_table = new Uint16Array(4096), pt_table = new Uint16Array(256);

function TrackDecruncher() {
  this.text = new Uint8Array(32000);
  this.init_deep_tabs();
  this.freq = new Uint16Array(T + 1); // frequency table
  this.prnt = new Uint16Array(T + T_CHAR); // pointers to parent nodes, except for the
          /* elements [T..T + N_CHAR - 1] which are used to get */
          /* the positions of leaves corresponding to the codes. */
  this.son = new Uint16Array(T);   /* pointers to child nodes (son[], son[] + 1) */
  this.init_deep_tabs();
}
TrackDecruncher.prototype = {
  reset: function() {
    delete this.quick_text_loc;
    delete this.medium_text_loc;
    delete this.deep_text_loc;
    delete this.heavy_text_loc;
    this.init_deep_tabs();
  },
  quick_text_loc: 251,
  bitbuf: 0,
  bitcount: 0,
  indata_buf: null,
  indata_pos: 0,
  initbitbuf: function(indata) {
    this.bitbuf = 0;
    this.bitcount = 0;
    this.indata_buf = indata;
    this.indata_pos = 0;
    this.DROPBITS(0);
  },
  GETBITS: function(n) {
    return this.bitbuf >>> (this.bitcount - n);
  },
  DROPBITS: function(n) {
    this.bitbuf &= mask_bits[this.bitcount -= n];
    while (this.bitcount < 16) {
      this.bitbuf = (this.bitbuf << 8) | this.indata_buf[this.indata_pos++];
      this.bitcount += 8;
    }
  },
  quick: function(input, output) {
    this.initbitbuf(input);
    for (var output_pos = 0, output_end = output.length; output_pos < output_end; ) {
      if (this.GETBITS(1) !== 0) {
        this.DROPBITS(1);
        output[output_pos] = this.text[this.quick_text_loc] = this.GETBITS(8);
        this.DROPBITS(8);
        this.quick_text_loc = (this.quick_text_loc + 1) % 256;
      }
      else {
        this.DROPBITS(1);
        var j = GETBITS(2) + 2;
        this.DROPBITS(2);
        var i = this.quick_text_loc - this.GETBITS(8) - 1;
        this.DROPBITS(8);
        while (j--) {
          output[output_pos++] = this.text[this.quick_text_loc] = this.text[i];
          i = (i + 1) % 256;
          this.quick_text_loc = (this.quick_text_loc + 1) % 256;
        }
      }
    }
    this.quick_text_loc = (this.quick_text_loc + 5) % 256;
    return 0;
  },
  medium_text_loc: 0x3fbe,
  medium: function(input, output) {
    this.initbitbuf(input);
    for (var output_pos = 0, output_end = output.length; output_pos < output_end; ) {
      if (this.GETBITS(1) !== 0) {
        this.DROPBITS(1);
        output[output_pos++] = this.text[this.medium_text_loc] = this.GETBITS(8);
        this.medium_text_loc = (this.medium_text_loc + 1) % 0x4000;
        this.DROPBITS(8);
      }
      else {
        this.DROPBITS(1);
        var c = this.GETBITS(8);
        this.DROPBITS(8);
        var j = d_code[c] + 3, u = d_len[c];
        c = ((c << u) | this.GETBITS(u)) & 0xff;
        this.DROPBITS(u);
        u = d_len[c];
        c = (d_code[c] << 8) | ((c << u) | this.GETBITS(u)) & 0xff;
        this.DROPBITS(u);
        var i = this.medium_text_loc - c - 1;
        while (j--) {
          output[output_pos++] = this.text[medium_text_loc] = this.text[i];
          this.medium_text_loc = (this.medium_text_loc + 1) % 0x40000;
          i = (i + 1) % 0x40000;
        }
      }
    }
    this.medium_text_loc = (this.medium_text_loc + 66) % 0x4000;
  },
  deep_text_loc: 0x3fc4,
  init_deep_tabs: function() {
    var freq = this.freq, son = this.son, prnt = this.print;
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
  },
  deep: function(input, output) {
    this.initbitbuf(input);
    for (var output_pos = 0, output_end = output.length; output_pos < output_end; ) {
      var c = this.decode_char();
      if (c < 256) {
        output[output_pos++] = this.text[deep_text_loc] = c;
        this.deep_text_loc = (this.deep_text_loc + 1) & DBITMASK;
      }
      else {
        var j = (c - 255 + THRESHOLD);
        var i = (this.deep_text_loc - this.decode_position() - 1);
        while (j--) {
          output[output_pos++] = this.text[deep_text_loc] = this.text[i];
          this.deep_text_loc = (this.deep_text_loc + 1) & DBITMASK;
          i = (i + 1) & DBITMASK;
        }
      }
    }
    this.deep_text_loc = ((this.deep_text_loc + 60) & DBITMASK);
  },
  decode_char: function() {
    var c = this.son[R];
    /* travel from root to leaf, */
    /* choosing the smaller child node (son[]) if the read bit is 0, */
    /* the bigger (son[]+1} if 1 */
    while (c < T) {
      c = son[c + this.GETBITS(1)];
      this.DROPBITS(1);
    }
    c -= T;
    this.update(c);
    return c;
  },
  update: function(c) {
    /* increment frequency of given code by one, and update tree */
    if (this.freq[R] == MAX_FREQ) this.reconst();
    c = this.prnt[c + T];
    do {
      var k = ++this.freq[c];
  
      var l = (c + 1) & 0xffff;
      /* if the order is disturbed, exchange nodes */
      if (k > this.freq[l]) {
        while (k > this.freq[l]) l++;
        this.freq[c] = this.freq[l];
        this.freq[l] = k;
  
        var i = this.son[c];
        this.prnt[i] = l;
        if (i < T) this.prnt[i + 1] = l;
  
        var j = this.son[l];
        this.son[l] = i;
  
        this.prnt[j] = c;
        if (j < T) this.prnt[j + 1] = c;
        this.son[c] = j;
  
        c = l;
      }
      c = prnt[c];
    } while (c !== 0); /* repeat up to root */
  },
  /* reconstruction of tree */
  reconst: function(){
    /* collect leaf nodes in the first half of the table */
    /* and replace the freq by (freq + 1) / 2. */
    var j = 0;
    for (var i = 0; i < T; i++) {
      if (this.son[i] >= T) {
        this.freq[j] = ((freq[i] + 1) >> 1) & 0xffff;
        this.son[j] = this.son[i];
        j++;
      }
    }
    /* begin constructing tree by connecting sons */
    for (var i = 0, j = N_CHAR; j < T; i += 2, j++) {
      var k = (i + 1) & 0xffff;
      var f = this.freq[j] = (this.freq[i] + this.freq[k]) & 0xffff;
      k = (j - 1) & 0xffff;
      while (f < this.freq[k]) k--;
      k++; // TODO: check that this is still necessary (previous line refactored)
      var l = ((j - k) << 1) & 0xffff;
      memmove(&freq[k + 1], &freq[k], (size_t)l);
      this.freq[k] = f;
      memmove(&son[k + 1], &son[k], (size_t)l);
      this.son[k] = i;
    }
    /* connect prnt */
    for (var i = 0; i < T; i++) {
      var k = this.son[i];
      this.prnt[k] = i;
      if (k < T) this.prnt[k + 1] = i;
    }
  },
  decode_position: function() {
    var i = this.GETBITS(8);
    this.DROPBITS(8);
    var c = (d_code[i] << 8) & 0xffff;
    var j = d_len[i];
    i = ((i << j) | this.GETBITS(j)) & 0xff;
    this.DROPBITS(j);
    return c | i;
  },
  heavy_text_loc: 0,
  lastlen: 0,
  np: 0,
  heavy: function(input, output, flags){
    /*  Heavy 1 uses a 4Kb dictionary,  Heavy 2 uses 8Kb  */
    if (flags & 8) {
      this.np = 15;
      this.bitmask = 0x1fff;
    }
    else {
      this.np = 14;
      this.bitmask = 0x0fff;
    }
    this.initbitbuf(input);
    if (flags & 2) {
      if (this.read_tree_c()) return 1;
      if (this.read_tree_p()) return 2;
    }
    for (var output_pos = 0, output_end = output.length; output_pos < output_end; ) {
      var c = this.decode_c();
      if (c < 256) {
        output[output_pos++] = text[heavy_text_loc] = c;
        this.heavy_text_loc = (this.heavy_text_loc + 1) & this.bitmask;
      }
      else {
        var j = (c - OFFSET) & 0xffff;
        var i = (heavy_text_loc - decode_p() - 1) & 0xffff;
        while (j--) {
          output[output_pos++] = text[heavy_text_loc] = text[i];
          this.heavy_text_loc = (this.heavy_text_loc + 1) & bitmask;
          i = (i + 1) & bitmask;
        }
      }
    }
  },
  decode_c: function() {
    var j = c_table[this.GETBITS(12)];
    if (j < N1) {
      this.DROPBITS(c_len[j]);
    }
    else {
      this.DROPBITS(12);
      var i = this.GETBITS(16);
      var m = 0x8000;
      do {
        j = (i & m) ? right[j] : left[j];
        m >>= 1;
      } while (j >= N1);
      this.DROPBITS(c_len[j] - 12);
    }
    return j;
  },
  decode_p: function() {
    var j = pt_table[GETBITS(8)];
    if (j < np) {
      this.DROPBITS(pt_len[j]);
    }
    else {
      this.DROPBITS(8);
      var i = this.GETBITS(16);
      var m = 0x8000;
      do {
        j = (i & m) ? right[j] : left[j];
        m >>= 1;
      } while (j >= np);
      this.DROPBITS(pt_len[j] - 8);
    }
    if (j !== np-1) {
      if (j > 0) {
        j = (USHORT)(this.GETBITS(i=(USHORT)(j-1)) | (1U << (j-1)));
        this.DROPBITS(i);
      }
      lastlen = j;
    }
    return lastlen;
  },
  read_tree_c: function() {
    var n = this.GETBITS(9);
    this.DROPBITS(9);
    if (n > 0){
      for (var i = 0; i < n; i++) {
        c_len[i] = this.GETBITS(5);
        this.DROPBITS(5);
      }
      for (var i=n; i<510; i++) c_len[i] = 0;
      if (this.make_table(510, c_len, 12, c_table)) return 1;
    }
    else {
      n = this.GETBITS(9);
      this.DROPBITS(9);
      for (var i = 0; i < 510; i++) c_len[i] = 0;
      for (var i = 0; i < 4096; i++) c_table[i] = n;
    }
    return 0;
  },
  read_tree_p: function() {
    var n = GETBITS(5);
    this.DROPBITS(5);
    if (n > 0){
      for (var i = 0; i < n; i++) {
        pt_len[i] = this.GETBITS(4);
        this.DROPBITS(4);
      }
      for (var i = n; i < np; i++) pt_len[i] = 0;
      if (this.make_table(np, pt_len, 8, pt_table)) return 1;
    }
    else {
      n = this.GETBITS(5);
      this.DROPBITS(5);
      for (var i = 0; i < np; i++) pt_len[i] = 0;
      for (var i = 0; i < 256; i++) pt_table[i] = n;
    }
    return 0;
  },
  make_table: function(nchar, bitlen, tablebits, table) {
    this.n = this.avail = nchar;
    this.blen = bitlen;
    this.tbl = table;
    this.tblsiz = 1 << tablebits;
    this.bit = (tblsiz >> 1) & 0xffff;
    this.maxdepth = (tablebits + 1) & 0xffff;
    this.depth = this.len = 1;
    this.c = -1;
    this.codeword = 0;
    this.TabErr = 0;
    this.mktbl();  /* left subtree */
    if (this.TabErr) return this.TabErr;
    this.mktbl();  /* right subtree */
    if (this.TabErr) return this.TabErr;
    if (this.codeword !== this.tblsiz) return 5;
    return 0;
  },
  mktbl: function() {
    if (this.TabErr) return 0;
    var i;
    if (this.len === this.depth) {
      while (++this.c < this.n) {
        if (this.blen[this.c] === this.len) {
          i = this.codeword;
          this.codeword += this.bit;
          if (this.codeword > this.tblsiz) {
            this.TabErr = 1;
            return 0;
          }
          while (i < this.codeword) this.tbl[i++] = this.c & 0xffff;
          return this.c & 0xffff;
        }
      }
      this.c = -1;
      this.len++;
      this.bit >>= 1;
    }
    this.depth++;
    if (this.depth < this.maxdepth) {
      this.mktbl();
      this.mktbl();
    }
    else if (this.depth > 32) {
      this.TabErr = 2;
      return 0;
    }
    else {
      i = this.avail++;
      if (i >= 2*this.n - 1) {
        this.TabErr = 3;
        return 0;
      }
      this.left[i] = this.mktbl();
      this.right[i] = this.mktbl();
      if (this.codeword >= this.tblsiz) {
        this.TabErr = 4;
        return 0;
      }
      if (this.depth === this.maxdepth) this.tbl[this.codeword++] = i;
    }
    this.depth--;
    return i;
  },
}

var HEADLEN = 56;
var THLEN = 20;
var TRACK_BUFFER_LEN = 32000;

var PWDCRC;
function dms_decrypt(crypt_buf, crypt_pos, crypt_len) {
  while (crypt_len--) {
    var t = crypt_buf[crypt_pos];
    crypt_buf[crypt_pos++] = (t ^ PWDCRC) & 0xff;
    PWDCRC = ((PWDCRC >> 1) + t) & 0xffff;
  }
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


