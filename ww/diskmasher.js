// Based on xDMS code by Andre Rodrigues de la Rocha

var mask_bits = new Int32Array([
  0x000000, 0x000001, 0x000003, 0x000007,
  0x00000f, 0x00001f, 0x00003f, 0x00007f,
  0x0000ff, 0x0001ff, 0x0003ff, 0x0007ff,
  0x000fff, 0x001fff, 0x003fff, 0x007fff,
  0x00ffff, 0x01ffff, 0x03ffff, 0x07ffff,
  0x0fffff, 0x1fffff, 0x3fffff, 0x7fffff,
  0xffffff,
]);

function TrackDecruncher() {
  this.text = new Uint8Array(0x3fc8);
}
TrackDecruncher.prototype = {
  rle: function(input, output) {
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
  reset: function() {
    delete this.quick_text_loc;
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
}

var quick_text_loc, medium_text_loc, heavy_text_loc, deep_text_loc, init_deep_tabs, text;

function Init_Decrunchers() {
  quick_text_loc = 251;
  medium_text_loc = 0x3fbe;
  heavy_text_loc = 0;
  deep_text_loc = 0x3fc4;
  init_deep_tabs = 1;
  text = new Uint8Array(0x3fc8);
}

Init_Decrunchers();

var HEADLEN = 56;
var THLEN = 20;
var TRACK_BUFFER_LEN = 32000;
var TEMP_BUFFER_LEN = 32000;

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


#define MBITMASK 0x3fff


USHORT medium_text_loc;



USHORT Unpack_MEDIUM(UCHAR *in, UCHAR *out, USHORT origsize){
  USHORT i, j, c;
  UCHAR u, *outend;


  initbitbuf(in);

  outend = out+origsize;
  while (out < outend) {
    if (GETBITS(1)!=0) {
      DROPBITS(1);
      *out++ = text[medium_text_loc++ & MBITMASK] = (UCHAR)GETBITS(8);
      DROPBITS(8);
    } else {
      DROPBITS(1);
      c = GETBITS(8);  DROPBITS(8);
      j = (USHORT) (d_code[c]+3);
      u = d_len[c];
      c = (USHORT) (((c << u) | GETBITS(u)) & 0xff);  DROPBITS(u);
      u = d_len[c];
      c = (USHORT) ((d_code[c] << 8) | (((c << u) | GETBITS(u)) & 0xff));  DROPBITS(u);
      i = (USHORT) (medium_text_loc - c - 1);

      while(j--) *out++ = text[medium_text_loc++ & MBITMASK] = text[i++ & MBITMASK];
      
    }
  }
  medium_text_loc = (USHORT)((medium_text_loc+66) & MBITMASK);

  return 0;
}


// deep

INLINE USHORT DecodeChar(void);
INLINE USHORT DecodePosition(void);
INLINE void update(USHORT c);
static void reconst(void);


USHORT deep_text_loc;
int init_deep_tabs=1;



#define DBITMASK 0x3fff   /*  uses 16Kb dictionary  */

#define F       60  /* lookahead buffer size */
#define THRESHOLD   2
#define N_CHAR      (256 - THRESHOLD + F)   /* kinds of characters (character code = 0..N_CHAR-1) */
#define T       (N_CHAR * 2 - 1)    /* size of table */
#define R       (T - 1)         /* position of root */
#define MAX_FREQ    0x8000      /* updates tree when the */


USHORT freq[T + 1]; /* frequency table */

USHORT prnt[T + N_CHAR]; /* pointers to parent nodes, except for the */
        /* elements [T..T + N_CHAR - 1] which are used to get */
        /* the positions of leaves corresponding to the codes. */

USHORT son[T];   /* pointers to child nodes (son[], son[] + 1) */



void Init_DEEP_Tabs(void){
  USHORT i, j;

  for (i = 0; i < N_CHAR; i++) {
    freq[i] = 1;
    son[i] = (USHORT)(i + T);
    prnt[i + T] = i;
  }
  i = 0; j = N_CHAR;
  while (j <= R) {
    freq[j] = (USHORT) (freq[i] + freq[i + 1]);
    son[j] = i;
    prnt[i] = prnt[i + 1] = j;
    i += 2; j++;
  }
  freq[T] = 0xffff;
  prnt[R] = 0;

  init_deep_tabs = 0;
}



USHORT Unpack_DEEP(UCHAR *in, UCHAR *out, USHORT origsize){
  USHORT i, j, c;
  UCHAR *outend;

  initbitbuf(in);

  if (init_deep_tabs) Init_DEEP_Tabs();

  outend = out+origsize;
  while (out < outend) {
    c = DecodeChar();
    if (c < 256) {
      *out++ = text[deep_text_loc++ & DBITMASK] = (UCHAR)c;
    } else {
      j = (USHORT) (c - 255 + THRESHOLD);
      i = (USHORT) (deep_text_loc - DecodePosition() - 1);
      while (j--) *out++ = text[deep_text_loc++ & DBITMASK] = text[i++ & DBITMASK];
    }
  }

  deep_text_loc = (USHORT)((deep_text_loc+60) & DBITMASK);

  return 0;
}



INLINE USHORT DecodeChar(void){
  USHORT c;

  c = son[R];

  /* travel from root to leaf, */
  /* choosing the smaller child node (son[]) if the read bit is 0, */
  /* the bigger (son[]+1} if 1 */
  while (c < T) {
    c = son[c + GETBITS(1)];
    DROPBITS(1);
  }
  c -= T;
  update(c);
  return c;
}



INLINE USHORT DecodePosition(void){
  USHORT i, j, c;

  i = GETBITS(8);  DROPBITS(8);
  c = (USHORT) (d_code[i] << 8);
  j = d_len[i];
  i = (USHORT) (((i << j) | GETBITS(j)) & 0xff);  DROPBITS(j);

  return (USHORT) (c | i) ;
}



/* reconstruction of tree */

static void reconst(void){
  USHORT i, j, k, f, l;

  /* collect leaf nodes in the first half of the table */
  /* and replace the freq by (freq + 1) / 2. */
  j = 0;
  for (i = 0; i < T; i++) {
    if (son[i] >= T) {
      freq[j] = (USHORT) ((freq[i] + 1) / 2);
      son[j] = son[i];
      j++;
    }
  }
  /* begin constructing tree by connecting sons */
  for (i = 0, j = N_CHAR; j < T; i += 2, j++) {
    k = (USHORT) (i + 1);
    f = freq[j] = (USHORT) (freq[i] + freq[k]);
    for (k = (USHORT)(j - 1); f < freq[k]; k--);
    k++;
    l = (USHORT)((j - k) * 2);
    memmove(&freq[k + 1], &freq[k], (size_t)l);
    freq[k] = f;
    memmove(&son[k + 1], &son[k], (size_t)l);
    son[k] = i;
  }
  /* connect prnt */
  for (i = 0; i < T; i++) {
    if ((k = son[i]) >= T) {
      prnt[k] = i;
    } else {
      prnt[k] = prnt[k + 1] = i;
    }
  }
}



/* increment frequency of given code by one, and update tree */

INLINE void update(USHORT c){
  USHORT i, j, k, l;

  if (freq[R] == MAX_FREQ) {
    reconst();
  }
  c = prnt[c + T];
  do {
    k = ++freq[c];

    /* if the order is disturbed, exchange nodes */
    if (k > freq[l = (USHORT)(c + 1)]) {
      while (k > freq[++l]);
      l--;
      freq[c] = freq[l];
      freq[l] = k;

      i = son[c];
      prnt[i] = l;
      if (i < T) prnt[i + 1] = l;

      j = son[l];
      son[l] = i;

      prnt[j] = c;
      if (j < T) prnt[j + 1] = c;
      son[c] = j;

      c = l;
    }
  } while ((c = prnt[c]) != 0); /* repeat up to root */
}

// heavy

#define NC 510
#define NPT 20
#define N1 510
#define OFFSET 253

USHORT left[2 * NC - 1], right[2 * NC - 1 + 9];
static UCHAR c_len[NC], pt_len[NPT];
static USHORT c_table[4096], pt_table[256];
static USHORT lastlen, np;
USHORT heavy_text_loc;


static USHORT read_tree_c(void);
static USHORT read_tree_p(void);
INLINE USHORT decode_c(void);
INLINE USHORT decode_p(void);



USHORT Unpack_HEAVY(UCHAR *in, UCHAR *out, UCHAR flags, USHORT origsize){
  USHORT j, i, c, bitmask;
  UCHAR *outend;

  /*  Heavy 1 uses a 4Kb dictionary,  Heavy 2 uses 8Kb  */

  if (flags & 8) {
    np = 15;
    bitmask = 0x1fff;
  } else {
    np = 14;
    bitmask = 0x0fff;
  }

  initbitbuf(in);

  if (flags & 2) {
    if (read_tree_c()) return 1;
    if (read_tree_p()) return 2;
  }

  outend = out+origsize;

  while (out<outend) {
    c = decode_c();
    if (c < 256) {
      *out++ = text[heavy_text_loc++ & bitmask] = (UCHAR)c;
    } else {
      j = (USHORT) (c - OFFSET);
      i = (USHORT) (heavy_text_loc - decode_p() - 1);
      while(j--) *out++ = text[heavy_text_loc++ & bitmask] = text[i++ & bitmask];
    }
  }

  return 0;
}



INLINE USHORT decode_c(void){
  USHORT i, j, m;

  j = c_table[GETBITS(12)];
  if (j < N1) {
    DROPBITS(c_len[j]);
  } else {
    DROPBITS(12);
    i = GETBITS(16);
    m = 0x8000;
    do {
      if (i & m) j = right[j];
      else              j = left [j];
      m >>= 1;
    } while (j >= N1);
    DROPBITS(c_len[j] - 12);
  }
  return j;
}



INLINE USHORT decode_p(void){
  USHORT i, j, m;

  j = pt_table[GETBITS(8)];
  if (j < np) {
    DROPBITS(pt_len[j]);
  } else {
    DROPBITS(8);
    i = GETBITS(16);
    m = 0x8000;
    do {
      if (i & m) j = right[j];
      else             j = left [j];
      m >>= 1;
    } while (j >= np);
    DROPBITS(pt_len[j] - 8);
  }

  if (j != np-1) {
    if (j > 0) {
      j = (USHORT)(GETBITS(i=(USHORT)(j-1)) | (1U << (j-1)));
      DROPBITS(i);
    }
    lastlen=j;
  }

  return lastlen;

}



static USHORT read_tree_c(void){
  USHORT i,n;

  n = GETBITS(9);
  DROPBITS(9);
  if (n>0){
    for (i=0; i<n; i++) {
      c_len[i] = (UCHAR)GETBITS(5);
      DROPBITS(5);
    }
    for (i=n; i<510; i++) c_len[i] = 0;
    if (make_table(510,c_len,12,c_table)) return 1;
  } else {
    n = GETBITS(9);
    DROPBITS(9);
    for (i=0; i<510; i++) c_len[i] = 0;
    for (i=0; i<4096; i++) c_table[i] = n;
  }
  return 0;
}



static USHORT read_tree_p(void){
  USHORT i,n;

  n = GETBITS(5);
  DROPBITS(5);
  if (n>0){
    for (i=0; i<n; i++) {
      pt_len[i] = (UCHAR)GETBITS(4);
      DROPBITS(4);
    }
    for (i=n; i<np; i++) pt_len[i] = 0;
    if (make_table(np,pt_len,8,pt_table)) return 1;
  } else {
    n = GETBITS(5);
    DROPBITS(5);
    for (i=0; i<np; i++) pt_len[i] = 0;
    for (i=0; i<256; i++) pt_table[i] = n;
  }
  return 0;
}

