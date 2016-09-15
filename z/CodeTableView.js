define(function() {

  'use strict';
  
  function CodeTableView(mode, bits, lens) {
    this.bits = bits;
    this.bytes = new Uint8Array(Math.pow(2, bits-1) * 4);
    this.dataView = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset,
      this.bytes.byteLength);
      
    var count = new Uint16Array(16 /*MAXBITS+1*/); // number of codes of each length
    for (var sym = 0; sym < lens.length; sym++) {
      count[lens[sym]]++;
    }
    
    // bound code lengths, force root to be within code lengths
    var root = bits;
    var max;
    for (max = 15 /* MAXBITS */; max >= 1; max--) {
      if (count[max] > 0) break;
    }
    if (root > max) root = max;
    if (max === 0) {
      /* no symbols to code at all */
      this.setOpBitsVal(0, 64,1,0); // invalid code number
      this.setOpBitsVal(1, 64,1,0);
      this.bits = 1;
      return; // no symbols, but wait for decoding to report error
    }
    var min;
    for (min = 1; min < max; min++) {
      if (count[min] !== 0) break;
    }
    if (root < min) root = min;
    
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
        base = new Uint16Array(285 + 2);
        base.set([ /* Length codes 257..285 base */
          3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
          35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], 257)
        extra = new Uint16Array(285 + 2);
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
  }
  CodeTableView.prototype = {
    get length() {
      return this.bytes.length / 4;
    },
    getEntries: function(n, count) {
      if (arguments.length === 0) return this.bytes;
      if (arguments.length === 1) return this.bytes.subarray(n * 4);
      return this.bytes.subarray(n * 4, (n + count) * 4);
    },
    setEntries: function(n, entries) {
      this.bytes.set(entries, n * 4);
    },
    getEntry: function(n) {
      return this.getEntries(1);
    },
    setEntry: function(n, entry) {
      this.setEntries(n, entry);
    },
    setOpBitsVal: function(n, op, bits, val) {
      this.bytes.set([op, bits, val & 0xff, (val >> 8) & 0xff], n * 4);
    },
    getOp: function(n) {
      return this.bytes[n * 4];
    },
    setOp: function(n, v) {
      this.bytes[n * 4] = v;
    },
    getBits: function(n) {
      return this.bytes[n*4 + 1];
    },
    setBits: function(n, v) {
      this.bytes[n*4 + 1] = v;
    },
    getVal: function(n) {
      return this.dataView.getUint16(n*4 + 2, true);
    },
    setVal: function(n, v) {
      this.dataView.setUint16(n*4 + 2, v);
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
  CodeTableView.fixedDistanceTable = new CodeTableView('dists', 5, lenx);

  return CodeTableView;

});
