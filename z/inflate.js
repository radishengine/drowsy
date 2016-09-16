// Adapted from Mark Adler's zlib inflate.c decompression
define(['./util', './CodeTableView'], function(zutil, CodeTableView) {

  'use strict';
  
  var NO_BYTES = new Uint8Array(0);
  
  /* permutation of code lengths */
  var order = new Uint16Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);

  function InflateState(windowBits) {
    this.lens = new Uint16Array(320); /* temporary storage for code lengths */

    if (arguments.length === 0) windowBits = 15 + 32; // +32 to enable gzip decoding

    /* extract wrap request from windowBits parameter */
    if (windowBits < 0) {
      this.wrap = 0;
      windowBits = -windowBits;
    }
    else {
      this.wrap = (windowBits >> 4) + 1;
      if (windowBits < 48) windowBits &= 15;
    }

    if (windowBits && (windowBits < 8 || windowBits > 15)) {
      throw new Error('invalid number of windowBits');
    }

    this.wbits = windowBits;
  }
  InflateState.prototype = {
    next_in: NO_BYTES,
    total_in: 0,
    next_out: NO_BYTES,
    total_out: 0,
    data_type: 0,

    mode: 'head',
    last: 0,
    wrap: 0,
    havedict: false,
    flags: 0,
    dmax: 32768,
    check: 0,
    total: 0,
    head: null,
    wbits: 0,
    wsize: 0,
    whave: 0,
    wnext: 0,
    window: null,
    hold: 0,
    bits: 0,
    length: 0,
    offset: 0,
    extra: 0,
    lencode: null,
    distcode: null,
    ncode: 0,
    nlen: 0,
    ndist: 0,
    have: 0,
    back: -1,
    was: 0,
    inflate: function(flush) {
      if (this.mode === 'type') this.mode = 'typedo'; // skip check

      var self = this;

      var put, next, hold, bits;

      function LOAD() {
        put = self.next_out;
        next = self.next_in;
        hold = self.hold;
        bits = self.bits;
      }

      function RESTORE() {
        self.next_out = put;
        self.next_in = next;
        self.hold = hold;
        self.bits = bits;
      }

      LOAD();

      function PULLBYTE() {
        if (next.length === 0) return false;
        hold += next[0] << bits;
        next = next.subarray(1);
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
        // n < 16
        return hold & ((1 << n) - 1);
      }

      function DROPBITS(n) {
        hold >>= n;
        bits -= n;
      }

      var _in = next.length, out = put.length;

      var ret = 'ok';

      inflateLoop: for (;;) switch (this.mode) {
        case 'head':
          if (this.wrap === 0) {
            this.mode = 'typedo';
            continue inflateLoop;
          }
          if (!NEEDBITS(16)) break inflateLoop;
          if ((this.wrap & 2) && hold === 0x8b1f) {  /* gzip header */
            this._crc2(hold);
            hold = bits = 0;
            this.mode = 'flags';
            continue inflateLoop;
          }
          this.flags = 0; //  expect zlib header
          if (this.head) this.head.done = -1;
          if (!(this.wrap & 1) ||   /* check if zlib header allowed */
              ((BITS(8) << 8) + (hold >> 8)) % 31) {
            this.mode = 'bad';
            throw new Error("incorrect header check");
          }
          if (BITS(4) !== 8 /* Z_DEFLATED */) {
            this.mode = 'bad';
            throw new Error("unknown compression method");
          }
          DROPBITS(4);
          var len = BITS(4) + 8;
          if (this.wbits === 0) this.wbits = len;
          else if (len > this.wbits) {
            this.mode = 'bad';
            throw new Error("invalid window size");
          }
          this.dmax = 1 << len;
          this.check = zutil.adler32();
          this.mode = hold & 0x200 ? 'dictid' : 'type';
          hold = bits = 0;
          continue inflateLoop;
        case 'flags':
          if (!NEEDBITS(16)) break inflateLoop;
          this.flags = hold;
          if ((this.flags & 0xff) !== 8 /* Z_DEFLATED */) {
            this.mode = 'bad';
            throw new Error("unknown compression method");
          }
          if (this.flags & 0xe000) {
            this.mode = 'bad';
            throw new Error("unknown header flags set");
          }
          if (this.head) this.head.text = ((hold >> 8) & 1);
          if (this.flags & 0x0200) this._crc2(hold);
          hold = bits = 0;
          this.mode = 'time';
          //continue inflateLoop;
        case 'time':
          if (!NEEDBITS(32)) break inflateLoop;
          if (this.head) this.head.time = hold;
          if (this.flags & 0x0200) this._crc4(hold);
          hold = bits = 0;
          this.mode = 'os';
          //continue inflateLoop;
        case 'os':
          if (!NEEDBITS(16)) break inflateLoop;
          if (this.head) {
            this.head.xflags = hold & 0xff;
            this.head.os = hold >> 8;
          }
          if (this.flags & 0x0200) this._crc2(hold);
          hold = bits = 0;
          this.mode = 'exlen';
          //continue inflateLoop;
        case 'exlen':
          if (this.flags & 0x0400) {
            if (!NEEDBITS(16)) break inflateLoop;
            this.length = hold >>> 0;
            if (this.head) this.head.extra_len = hold >>> 0;
            if (this.flags & 0x0200) this._crc2(hold);
            hold = bits = 0;
          }
          else if (this.head) this.head.extra = null;
          this.mode = 'extra';
          //continue inflateLoop;
        case 'extra':
          if (this.flags & 0x0400) {
            var copy = Math.min(this.length, next.length);
            if (copy > 0) {
              if (this.head && this.head.extra) {
                var len = this.head.extra_len - this.length;
                if (len + copy > this.head.extra_max) {
                  this.head.extra.set(next.subarray(0, this.head.extra_max - len), len);
                }
                else {
                  this.head.extra.set(next.subarray(0, copy), len);
                }
              }
              if (this.flags & 0x0200) this._crc(next, copy);
              next = next.subarray(copy);
              this.length -= copy;
            }
            if (this.length > 0) break inflateLoop;
          }
          this.length = 0;
          this.mode = 'name';
          //continue inflateLoop;
        case 'name':
          if (this.flags & 0x0800) {
            if (next.length === 0) break inflateLoop;
            var len, copy = 0;
            do {
              len = next[copy++];
              if (this.head && this.head.name && this.length < this.head.name_max) {
                this.head.name[this.length++] = len;
              }
            } while (len > 0 && copy < next.length);
            if (this.flags & 0x0200) {
              this._crc(next, copy);
            }
            next = next.subarray(copy);
            if (len > 0) break inflateLoop;
          }
          else if (this.head) this.head.name = null;
          this.length = 0;
          this.mode = 'comment';
          //continue inflateLoop;
        case 'comment':
          if (this.flags & 0x1000) {
            if (next.length === 0) break inflateLoop;
            var copy = 0, len;
            do {
              len = next[copy++];
              if (this.head && this.head.comment && this.length < this.head.comm_max) {
                this.head.comment[this.length++] = len;
              }
            } while (len > 0 && copy < next.length);
            if (this.flags & 0x0200) this.check = crc32(this.check, next, copy);
            next = next.subarray(copy);
            if (len) break inflateLoop;
          }
          else if (this.head) this.head.comment = null;
          this.mode = 'hcrc';
          //continue inflateLoop;
        case 'hcrc':
          if (this.flags & 0x0200) {
            if (!NEEDBITS(16)) break inflateLoop;
            if (hold !== (this.check & 0xffff)) {
              this.mode = 'bad';
              throw new Error("header crc mismatch");
            }
            hold = bits = 0;
          }
          if (this.head) {
            this.head.hcrc = (this.flags >> 9) & 1;
            this.head.done = 1;
          }
          this.check = zutil.crc32();
          this.mode = 'type';
          continue inflateLoop;
        case 'dictid':
          if (!NEEDBITS(32)) break inflateLoop;
          this.check = zutil.swap32(hold);
          hold = bits = 0;
          this.mode = 'dict';
          //continue inflateLoop;
        case 'dict':
          if (!this.havedict) {
            RESTORE();
            return 'needDictionary';
          }
          this.check = zutil.adler32();
          this.mode = 'type';
          //continue inflateLoop;
        case 'type':
          if (flush === 'block' || flush === 'trees') break inflateLoop;
          //continue inflateLoop;
        case 'typedo':
          if (this.last) {
            hold >>= bits & 7; bits -= bits & 7;
            this.mode = 'check';
            continue inflateLoop;
          }
          if (!NEEDBITS(3)) break inflateLoop;
          this.last = BITS(1);
          DROPBITS(1);
          switch (BITS(2)) {
            case 0: // stored block
              this.mode = 'stored';
              break;
            case 1: // fixed block
              this.lencode = CodeTableView.fixedLengthTable;
              this.distcode = CodeTableView.fixedDistanceTable;
              this.mode = 'len_'; // decode codes
              if (flush === 'trees') {
                DROPBITS(2);
                break inflateLoop;
              }
              break;
            case 2: // dynamic block
              this.mode = 'table';
              break;
            case 3:
              this.mode = 'bad';
              throw new Error("invalid block type");
          }
          DROPBITS(2);
          continue inflateLoop;
        case 'stored':
          // go to byte boundary
          hold >>= bits & 7; bits -= bits & 7;
          if (!NEEDBITS(32)) break inflateLoop;
          if ((hold & 0xffff) !== ((hold >> 16) ^ 0xffff)) {
            this.mode = 'bad';
            throw new Error("invalid stored block lengths");
          }
          this.length = hold & 0xffff;
          hold = bits = 0;
          this.mode = 'copy_';
          if (flush === 'trees') break inflateLoop;
          //continue inflateLoop;
        case 'copy_':
          this.mode = 'copy';
          //continue inflateLoop;
        case 'copy':
          var copy = this.length;
          if (copy > 0) {
            if (copy = Math.min(copy, next.length, put.length) === 0) {
              break inflateLoop;
            }
            put.set(next.subarray(0, copy));
            next = next.subarray(copy);
            put = put.subarray(copy);
            this.length -= copy;
            continue inflateLoop;
          }
          this.mode = 'type';
          continue inflateLoop;
        case 'table':
          if (!NEEDBITS(14)) break inflateLoop;
          this.nlen = BITS(5) + 257;
          DROPBITS(5);
          this.ndist = BITS(5) + 1;
          DROPBITS(5);
          this.ncode = BITS(4) + 4;
          DROPBITS(4);
          /*
          #ifndef PKZIP_BUG_WORKAROUND
          if (this.nlen > 286 || this.ndist > 30) {
            this.mode = 'bad';
            throw new Exception("too many length or distance symbols");
          }
          #endif
          */
          this.have = 0;
          this.mode = 'lenlens';
          //continue inflateLoop;
        case 'lenlens':
          while (this.have < this.ncode) {
            if (!NEEDBITS(3)) break inflateLoop;
            this.lens[order[this.have++]] = BITS(3);
            DROPBITS(3);
          }
          while (this.have < 19) {
            this.lens[order[this.have++]] = 0;
          }
          this.lencode = new CodeTableView('codes', 7, this.lens.subarray(0, 19));
          this.have = 0;
          this.mode = 'codelens';
          //continue inflateLoop;
        case 'codelens':
          while (this.have < this.nlen + this.ndist) {
            var here;
            for (;;) {
              here = BITS(this.lencode.bits);
              if (this.lencode.getBits(here) <= bits) break;
              if (!PULLBYTE()) break inflateLoop;
            }
            if (this.lencode.getVal(here) < 16) {
              DROPBITS(this.lencode.getBits(here));
              this.lens[this.have++] = this.lencode.getVal(here);
            }
            else {
              var len, copy;
              if (this.lencode.getVal(here) === 16) {
                if (!NEEDBITS(this.lencode.getBits(here) + 2)) break inflateLoop;
                DROPBITS(this.lencode.getBits(here));
                if (this.have === 0) {
                  this.mode = 'bad';
                  throw new Error("invalid bit length repeat");
                }
                len = this.lens[this.have - 1];
                copy = 3 + BITS(2);
                DROPBITS(2);
              }
              else if (this.lencode.getVal(here) === 17) {
                if (!NEEDBITS(this.lencode.getBits(here) + 3)) break inflateLoop;
                DROPBITS(this.lencode.getBits(here));
                len = 0;
                copy = 3 + BITS(3);
                DROPBITS(3);
              }
              else {
                if (!NEEDBITS(this.lencode.getBits(here) + 7)) break inflateLoop;
                DROPBITS(this.lencode.getBits(here));
                len = 0;
                copy = 11 + BITS(7);
                DROPBITS(7);
              }
              if (this.have + copy > this.nlen + this.ndist) {
                this.mode = 'bad';
                throw new Error("invalid bit length repeat");
              }
              while (copy--) {
                this.lens[this.have++] = len & 0xffff;
              }
            }
          }

          /* handle error breaks in while */
          if (this.mode === 'bad') continue inflateLoop;

          /* check for end-of-block code (better have one) */
          if (this.lens[256] === 0) {
            this.mode = 'bad';
            throw new Error("invalid code -- missing end-of-block");
          }

          /* build code tables */
          this.lencode = new CodeTableView('lens', 9, this.lens.subarray(0, this.nlen));
          this.distcode = new CodeTableView('dists', 6, this.lens.subarray(this.nlen, this.nlen + this.ndist));
          this.mode = 'len_';
          if (flush === 'trees') break inflateLoop;
          //continue inflateLoop;
        case 'len_':
          this.mode = 'len';
          //continue inflateLoop;
        case 'len':
          if (next.length >= 6 && put.length >= 258) {
            RESTORE();
            this._fast(out);
            LOAD();
            if (this.mode === 'type') {
              this.back = -1;
            }
            continue inflateLoop;
          }
          this.back = 0;
          var here;
          for (;;) {
            here = BITS(this.lencode.bits);
            if (this.lencode.getBits(here) <= bits) break;
            if (!PULLBYTE()) break inflateLoop;
          }
          if (this.lencode.getOp(here) && !(this.lencode.getOp(here) & 0xf0)) {
            var last = here;
            for (;;) {
              here = this.lencode.getVal(last) + (
                BITS(this.lencode.getBits(last) + this.lencode.getOp(last)) >> this.lencode.getBits(last));
              if ((this.lencode.getBits(last) + this.lencode.getBits(here)) <= bits) break;
              if (!PULLBYTE()) break inflateLoop;
            }
            DROPBITS(this.lencode.getBits(last));
            this.back += this.lencode.getBits(last);
          }
          DROPBITS(this.lencode.getBits(here));
          this.back += this.lencode.getBits(here);
          this.length = this.lencode.getVal(here);
          if (this.lencode.getOp(here) === 0) {
            this.mode = 'lit';
            continue inflateLoop;
          }
          if (this.lencode.getOp(here) & 32) {
            this.back = -1;
            this.mode = 'type';
            continue inflateLoop;
          }
          if (this.lencode.getOp(here) & 64) {
            this.mode = 'bad';
            throw new Error("invalid literal/length code");
          }
          this.extra = this.lencode.getOp(here) & 15;
          this.mode = 'lenext';
          //continue inflateLoop;
        case 'lenext':
          if (this.extra > 0) {
            if (!NEEDBITS(this.extra)) break inflateLoop;
            this.length += BITS(this.extra);
            DROPBITS(this.extra);
            this.back += this.extra;
          }
          this.was = this.length;
          this.mode = 'dist';
          //continue inflateLoop;
        case 'dist':
          for (;;) {
            if (this.distcode.getBits(BITS(this.distcode.bits)) <= bits) break;
            if (!PULLBYTE()) break inflateLoop;
          }
          var here;
          if (!(this.distcode.getOp(BITS(this.distcode.bits)) & 0xf0)) {
            var last = BITS(this.distcode.bits);
            for (;;) {
              here = this.distcode.getVal(last) + (
                BITS(this.distcode.getBits(last) + this.distcode.getOp(last)) >> this.distcode.getBits(last));
              if ((this.distcode.getBits(last) + this.distcode.getBits(here)) <= bits) break;
              if (!PULLBYTE()) break inflateLoop;
            }
            DROPBITS(this.distcode.getBits(last));
            this.back += this.distcode.getBits(last);
          }
          DROPBITS(this.distcode.getBits(here));
          this.back += this.distcode.getBits(here);
          if (this.distcode.getOp(here) & 64) {
            this.mode = 'bad';
            throw new Error("invalid distance code");
          }
          this.offset = this.distcode.getVal(here);
          this.extra = this.distcode.getOp(here) & 15;
          this.mode = 'distext';
          //continue inflateLoop;
        case 'distext':
          if (this.extra) {
            if (!NEEDBITS(this.extra)) break inflateLoop;
            this.offset += BITS(this.extra);
            DROPBITS(this.extra);
            this.back += this.extra;
          }
          // #ifdef INFLATE_STRICT
          if (this.offset > this.dmax) {
            this.mode = 'bad';
            throw new Error("invalid distance too far back");
          }
          // #endif
          this.mode = 'match';
          //continue inflateLoop;
        case 'match':
          if (put.length === 0) break inflateLoop;
          var copy = out - put.length;
          var from;
          if (this.offset > copy) { // copy from window
            copy = this.offset - copy;
            if (copy > this.whave) {
              this.mode = 'bad';
              throw new Error("invalid distance too far back");
            }
            if (copy > this.wnext) {
              copy -= this.wnext;
              from = this.window.subarray(this.wsize - copy);
            }
            else {
              from = this.window.subarray(this.wnext - copy);
            }
            if (copy > this.length) copy = this.length;
          }
          else {
            // copy from output
            from = new Uint8Array(put.buffer, put.byteOffset - this.offset, put.length + this.offset);
            copy = this.length;
          }
          if (copy > put.length) copy = put.length;
          this.length -= copy;
          put.set(from.subarray(0, copy));
          put = put.subarray(copy);
          if (this.length === 0) this.mode = 'len';
          continue inflateLoop;
        case 'lit':
          if (put.length === 0) break inflateLoop;
          put[0] = this.length & 0xff;
          put = put.subarray(1);
          this.mode = 'len';
          continue inflateLoop;
        case 'check':
          if (this.wrap) {
            if (!NEEDBITS(32)) break inflateLoop;
            out -= put.length;
            this.total_out += out;
            this.total += out;
            if (out > 0) {
              var checkBytes = new Uint8Array(put.buffer, put.byteOffset - out, out);
              this._update(checkBytes);
            }
            out = put.length;
            if ((this.flags ? hold : zutil.swap32(hold)) !== this.check) {
              this.mode = 'bad';
              throw new Error("incorrect data check");
            }
            hold = bits = 0;
          }
          this.mode = 'length';
          //continue inflateLoop;
        case 'length':
          if (this.wrap && this.flags) {
            if (!NEEDBITS(32)) break inflateLoop;
            if ((hold >>> 0) !== (this.total >>> 0)) {
              this.mode = 'bad';
              throw new Error("incorrect length check");
            }
            hold = bits = 0;
          }
          this.mode = 'done';
          //continue inflateLoop;
        case 'done':
          ret = 'done';
          break inflateLoop;
        case 'bad': throw new Error('previous error');
        default: throw new Error('unknown state');
      }
      // end of loop
      RESTORE();
      if (this.wsize > 0 || (out !== this.next_out.length
        && !/^(bad|mem|sync)$/.test(this.mode)
        && (flush !== 'finish' || !/^(check|length|done)$/.test(this.mode)))
      ) {
        this._updateWindow(this.next_out, out - this.next_out.length);
      }
      _in -= this.next_in.length;
      out -= this.next_out.length;
      this.total_in += _in;
      this.total_out += out;
      this.total += out;
      if (this.wrap && out > 0) {
        this._update(this.next_out - out, out);
      }
      this.data_type = this.bits
        + (this.last ? 64 : 0)
        + (this.mode === 'type' ? 128 : 0)
        + (this.mode === 'len_' || this.mode === 'copy_' ? 256 : 0);
      if (((!_in && !out) || flush === 'finish') && ret === 'ok') {
        throw new Error('buffer error');
      }
      return ret;
    },
    _crc: function(bytes, length) {
      this.check = crc32(this.check, bytes, length);
    },
    _crc2: function(v) {
      this.check = zutil.crc32(this.check, new Uint8Array([
        v & 0xff,
        (v >> 8) & 0xff]));
    },
    _crc4: function(v) {
      this.check = zutil.crc32(this.check, new Uint8Array([
        v & 0xff,
        (v >> 8) & 0xff,
        (v >> 16) & 0xff,
        (v >> 24) & 0xff]));
    },
    _update: function(bytes) {
      this.check = (this.flags ? zutil.crc32 : zutil.adler32)(this.check, bytes);
    },
    _updateWindow: function(end, copy) {
      /* if it hasn't been done already, allocate space for the window */
      if (!this.window) {
        this.window = new Uint8Array(1 << this.wbits);
      }

      /* if window not in use yet, initialize */
      if (this.wsize == 0) {
        this.wsize = 1 << this.wbits;
        this.wnext = 0;
        this.whave = 0;
      }

      /* copy this.wsize or less output bytes into the circular window */
      if (copy >= this.wsize) {
        this.window.set(new Uint8Array(end.buffer, end.byteOffset - this.wsize, this.wsize));
        this.wnext = 0;
        this.whave = this.wsize;
      }
      else {
        var dist = Math.min(this.wsize - this.wnext, copy);
        this.window.set(new Uint8Array(end.buffer, end.byteOffset - copy, dist), this.wnext);
        copy -= dist;
        if (copy > 0) {
          this.window.set(new Uint8Array(end.buffer, end.byteOffset - copy, copy));
          this.wnext = copy;
          this.whave = this.wsize;
        }
        else {
          this.wnext += dist;
          if (this.wnext == this.wsize) this.wnext = 0;
          if (this.whave < this.wsize) this.whave += dist;
        }
      }
    },
    _fast: function(start) {
      /* copy state to local variables */
      var _in = this.next_in,
        out = this.next_out,
        //#ifdef INFLATE_STRICT
        dmax = this.dmax, /* maximum distance from zlib header */
        //#endif
        wsize = this.wsize, /* window size or zero if not using window */
        whave = this.whave, /* valid bytes in the window */
        wnext = this.wnext, /* window write index */
        window = this.window, /* allocated sliding window, if wsize != 0 */
        hold = this.hold,
        bits = this.bits,
        lcode = this.lencode,
        dcode = this.distcode;
      var lmask = (1 << lcode.bits) - 1, /* mask for first level of length codes */
        dmask = (1 << dcode.bits) - 1, /* mask for first level of distance codes */
        begOffset = out.byteOffset + out.byteLength - start; /* inflate()'s initial this.next_out */

      /* decode literals and length/distances until end-of-block or not enough
         input data or output space */
      mainloop: do {
        if (bits < 15) {
          hold += _in[0] << bits; bits += 8;
          hold += _in[1] << bits; bits += 8;
          _in = _in.subarray(2);
        }

        var here_n = hold & lmask;

        dolen: for (;;) {
          // code bits, operation, extra bits, or window position, window bytes to copy
          var op = lcode.getBits(here_n);
          hold >>= op; bits -= op;
          op = lcode.getOp(here_n);
          if (op === 0) { // literal
            out[0] = lcode.getVal(here_n) & 0xff;
            out = out.subarray(1);
          }
          else if (op & 16) { // length base
            var len = lcode.getVal(here_n);
            op &= 15; // number of extra bits
            if (op !== 0) {
              if (bits < op) {
                hold += _in[0] << bits; bits += 8;
                _in = _in.subarray(1);
              }
              len += hold & ((1 << op) - 1);
              hold >>= op; bits -= op;
            }
            if (bits < 15) {
              hold += _in[0] << bits; bits += 8;
              hold += _in[1] << bits; bits += 8;
              _in = _in.subarray(2);
            }
            here_n = hold & dmask;
            dodist: for (;;) {
              op = dcode.getBits(here_n);
              hold >>= op; bits -= op;
              op = dcode.getOp(here_n);
              if (op & 16) {
                // distance base
                var dist = dcode.getVal(here_n);
                op &= 15; // number of extra bits
                if (bits < op) {
                  hold += _in[0] << bits; bits += 8;
                  if (bits < op) {
                    hold += _in[1] << bits; bits += 8;
                    _in = _in.subarray(2);
                  }
                  else {
                    _in = _in.subarray(1);
                  }
                }
                dist += hold & ((1 << op) - 1);
                //#ifdef INFLATE_STRICT
                if (dist > dmax) {
                  this.mode = 'bad';
                  throw new Error("invalid distance too far back");
                }
                //#endif
                hold >>= op; bits -= op;
                op = (out.byteOffset - begOffset) >>> 0; // max distance in output
                if (dist > op) { // see if copy from window
                  op = dist - op; // distance back in window
                  if (op > whave) {
                    this.mode = 'bad';
                    throw new Error("invalid distance too far back");
                  }
                  var from = window;
                  if (wnext == 0) { // very common case
                    from = from.subarray(wsize - op);
                    if (op < len) {
                      // some from window
                      len -= op;
                      out.set(from.subarray(0, op));
                      out = out.subarray(op);
                      // rest from output
                      from = new Uint8Array(out.buffer, out.byteOffset - dist, out.byteLength + dist);
                    }
                  }
                  else if (wnext < op) {
                    // wrap around window
                    from = from.subarray(wsize + wnext - op);
                    op -= wnext;
                    if (op < len) {
                      // some from end of window
                      len -= op;
                      out.set(from.subarray(0, op));
                      out = out.subarray(op);
                      from = window;
                      if (wnext < len) { 
                        // some from start of window
                        op = wnext;
                        len -= op;
                        out.set(from.subarray(0, op));
                        out = out.subarray(op);
                        // rest from output
                        from = new Uint8Array(out.buffer, out.byteOffset - dist, len);
                      }
                    }
                  }
                  else {
                    // contiguous in window
                    from = from.subarray(wnext - op);
                    if (op < len) {
                      // some from window
                      len -= op;
                      out.set(from.subarray(0, op));
                      out = out.subarray(op);
                      // rest from output
                      from = new Uint8Array(out.buffer, out.byteOffset - dist, len);
                    }
                  }
                  out.set(from.subarray(0, len));
                  out = out.subarray(len);
                }
                else {
                  /* copy direct from output */
                  out.set(new Uint8Array(out.buffer, out.byteOffset - dist, len));
                  out = out.subarray(len);
                }
              }
              else if (!(op & 64)) {
                /* 2nd level distance code */
                here_n = dcode.getVal(here_n) + (hold & ((1 << op) - 1));
                continue dodist;
              }
              else {
                this.mode = 'bad';
                throw new Error("invalid distance code");
              }
              break dodist;
            }
          }
          else if (!(op & 64)) {
            /* 2nd level length code */
            here_n = lcode.getVal(here_n) + (hold & ((1 << op) - 1));
            continue dolen;
          }
          else if (op & 32) {
            this.mode = 'type';
            break mainloop;
          }
          else {
            this.mode = 'bad';
            throw new Error("invalid literal/length code");
          }
          break dolen;
        }
      } while (_in.length > 5 && out.length > 257);

      /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
      var len = bits >> 3;
      if (len > 0) {
        _in = new Uint8Array(_in.buffer, _in.byteOffset - len, _in.byteLength + len);
      }
      bits -= len << 3;
      hold &= (1 << bits) - 1;

      /* update state and return */
      this.next_in = _in;
      this.next_out = out;
      this.hold = hold;
      this.bits = bits;
    },
  };
  
  function inflate(compressedBytes) {
    var inflater = new InflateState();
    inflater.next_in = compressedBytes;
    var bufferList = [];
    var status;
    var allBytes = 0;
    do {
      var buffer = inflater.next_out = new Uint8Array(32 * 1024);
      status = inflater.inflate();
      if (inflater.next_out.byteLength !== 0) {
        buffer = buffer.subarray(0, inflater.next_out.byteOffset - buffer.byteOffset);
      }
      allBytes += buffer.byteLength;
      bufferList.push(buffer);
    } while (status !== 'done');
    allBytes = new Uint8Array(allBytes);
    for (var pos = 0; pos < allBytes.length; pos += bufferList.unshift().byteLength) {
      allBytes.set(bufferList[0], pos);
    }
    return allBytes;
  }
  
  inflate.State = InflateState;
  
  return inflate;

});
