define(function() {

  'use strict';
  
  function CodeTableView(mode, bitWidth, lens) {
    switch(mode) {
      case 'lens':
        this.bits = new Uint8Array(CodeTableView.ENOUGH_LENS);
        this.op = new Uint8Array(CodeTableView.ENOUGH_LENS);
        this.val = new Uint16Array(CodeTableView.ENOUGH_LENS);
        break;
      case 'dists':
        this.bits = new Uint8Array(CodeTableView.ENOUGH_DISTS);
        this.op = new Uint8Array(CodeTableView.ENOUGH_DISTS);
        this.val = new Uint16Array(CodeTableView.ENOUGH_DISTS);
        break;
      case 'codes':
        this.bits = new Uint8Array(1 << bitWidth);
        this.op = new Uint8Array(1 << bitWidth);
        this.val = new Uint16Array(1 << bitWidth);
        break;
      default: throw new Error('unknown mode');
    }

    var count = new Uint16Array(16 /*MAXBITS+1*/); // number of codes of each length
    for (var sym = 0; sym < lens.length; sym++) {
      count[lens[sym]]++;
    }
    
    // bound code lengths, force root to be within code lengths
    var root = bitWidth;
    var max;
    for (max = 15 /* MAXBITS */; max >= 1; max--) {
      if (count[max] > 0) break;
    }
    if (root > max) root = max;
    if (max === 0) {
      /* no symbols to code at all */
      this.op[0] = this.op[1] = 64; // invalid code number
      this.bits[0] = this.bits[1] = 1;
      this.val[0] = this.val[1] = 0;
      this.bitWidth = 1;
      return; // no symbols, but wait for decoding to report error
    }
    var min;
    for (min = 1; min < max; min++) {
      if (count[min] !== 0) break;
    }
    if (root < min) root = min;
    
    this.bitWidth = root;
    
    /* check for an over-subscribed or incomplete set of lengths */
    var left = 1;
    for (var len = 1; len <= 15 /* MAXBITS */; len++) {
      left <<= 1;
      left -= count[len];
      if (left < 0) throw new Error('over-subscribed');
    }
    if (left > 0 && (mode == 'codes' || max !== 1)) {
      throw new Error('incomplete set');
    }
    
    // generate offsets into symbol table for each length for sorting
    var offs = new Uint16Array(16 /*MAXBITS+1*/);
    for (var len = 1; len < 15 /*MAXBITS*/; len++) {
      offs[len+1] = offs[len] + count[len];
    }

    // sort symbols by length, by symbol order within each length
    var work = new Uint16Array(288);
    for (var sym = 0; sym < lens.length; sym++) {
      if (lens[sym] > 0) {
        work[offs[lens[sym]]++] = sym & 0xffff;
      }
    }
    
    var base, extra, end;

    /* set up for code type */
    switch (mode) {
      case 'codes':
        base = extra = work;    /* dummy value--not used */
        end = 19;
        break;
      case 'lens':
        base = new Uint16Array(285 + 3);
        base.set([ /* Length codes 257..285 base */
          3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
          35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], 257);
        extra = new Uint16Array(285 + 3);
        extra.set([ /* Length codes 257..285 extra */
          16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
          19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], 257);
        end = 256;
        break;
      case 'dists':
        base = new Uint16Array([ /* Distance codes 0..29 base */
          1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
          257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
          8193, 12289, 16385, 24577, 0, 0]);
        extra = new Uint16Array([ /* Distance codes 0..29 extra */
          16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
          23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
          28, 28, 29, 29, 64, 64]);
        end = -1;
        break;
      default: throw new Error('unknown mode: ' + mode);
    }
    
    /* initialize state for loop */
    var huff = 0,       //  starting code
      sym = 0,          // starting code symbol
      len = min,        // starting code length
      next = 0,         // current table to fill in
      curr = root,      // current table index bits
      drop = 0,         // current bits to drop from code for index
      low = -1 >>> 0,   // trigger new sub-table when len > root
      used = 1 << root; // use root table entries
    var mask = used - 1;  // mask for comparing low

    /* check available table space */
    if ((mode === 'lens' && used > CodeTableView.ENOUGH_LENS)
    ||  (mode === 'dists' && used > CodeTableView.ENOUGH_DISTS)) {
      throw new Error('not enough table space');
    }

    /* process all codes and make table entries */
    for (;;) {
      /* create table entry */
      var here_op, here_val, here_bits = (len - drop) & 0xff;
      if (work[sym] < end) {
        here_op = 0;
        here_val = work[sym];
      }
      else if (work[sym] > end) {
        here_op = extra[work[sym]] & 0xff;
        here_val = base[work[sym]];
      }
      else {
        here_op = 32 + 64; // end of block
        here_val = 0;
      }

      /* replicate for those indices with low len bits equal to huff */
      var incr = 1 << (len - drop);
      var fill = 1 << curr;
      min = fill; // save offset to next table
      do {
        fill -= incr;
        var n = next + (huff >> drop) + fill;
        this.op[n] = here_op; this.bits[n] = here_bits; this.val[n] = here_val;
      } while (fill !== 0);

      /* backwards increment the len-bit code huff */
      incr = 1 << (len - 1);
      while (huff & incr) incr >>= 1;
      if (incr !== 0) {
        huff &= incr - 1;
        huff += incr;
      }
      else huff = 0;

      /* go to next symbol, update count, len */
      sym++;
      if (--count[len] == 0) {
        if (len === max) break;
        len = lens[work[sym]];
      }

      /* create new sub-table if needed */
      if (len > root && (huff & mask) !== low) {
        /* if first time, transition to sub-tables */
        if (drop === 0) drop = root;

        /* increment past last table */
        next += min; // here min is 1 << curr

        /* determine length of next table */
        curr = len - drop;
        left = 1 << curr;
        while (curr + drop < max) {
          left -= count[curr + drop];
          if (left <= 0) break;
          curr++;
          left <<= 1;
        }

        /* check for enough space */
        used += 1 << curr;
        if ((mode === 'lens' && used > CodeTableView.ENOUGH_LENS)
        ||  (mode === 'dists' && used > CodeTableView.ENOUGH_DISTS)) {
          throw new Error('not enough space');
        }

        /* point entry in root table to sub-table */
        low = huff & mask;
        this.op[low] = curr & 0xff;
        this.bits[low] = root & 0xff;
        this.val[low] = next & 0xffff;
      }
    }

    /*
    fill in remaining table entry if code is incomplete (guaranteed to have
    at most one remaining entry, since if the code is incomplete, the
    maximum code length that was allowed to get this far is one bit)
    */
    if (huff !== 0) {
      this.op[next + huff] = 64; // invalid code marker
      this.bits[next + huff] = (len - drop) & 0xff;
      this.val[next + huff] = 0;
    }
  }
  CodeTableView.prototype = {
    get length() {
      return 1 << this.bitWidth;
    },
    get mask() {
      return (1 << this.bitWidth) - 1;
    },
  };

  CodeTableView.ENOUGH_LENS = 852;
  CodeTableView.ENOUGH_DISTS = 592;

  // initialize fixed tables
  var lens, sym;
  
  lens = new Uint16Array(288);
  sym = 0;
  while (sym < 144) lens[sym++] = 8;
  while (sym < 256) lens[sym++] = 9;
  while (sym < 280) lens[sym++] = 7;
  while (sym < lens.length) lens[sym++] = 8;
  CodeTableView.fixedLengthTable = new CodeTableView('lens', 9, lens);

  lens = new Uint16Array(32);
  sym = 0;
  while (sym < lens.length) lens[sym++] = 5;
  CodeTableView.fixedDistanceTable = new CodeTableView('dists', 5, lens);

  return CodeTableView;

});
