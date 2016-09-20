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
      var mode = this.mode;
      if (mode === 'type') mode = 'typedo'; // skip check

      var self = this;

      var put = self.next_out, next = self.next_in, hold = self.hold, bits = self.bits;

      function RESTORE() {
        self.next_out = put;
        self.next_in = next;
        self.hold = hold;
        self.bits = bits;
        self.mode = mode;
      }

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

      var ret = 'more';

      inflation: for (;;) switch (mode) {
        case 'head':
          if (this.wrap === 0) {
            mode = 'typedo';
            continue inflation;
          }
          if (!NEEDBITS(16)) break inflation;
          if ((this.wrap & 2) && hold === 0x8b1f) {  /* gzip header */
            this._crc2(hold);
            hold = bits = 0;
            mode = 'flags';
            continue inflation;
          }
          this.flags = 0; //  expect zlib header
          if (this.head) this.head.done = -1;
          if (!(this.wrap & 1) ||   /* check if zlib header allowed */
              ((BITS(8) << 8) + (hold >> 8)) % 31) {
            throw new Error("incorrect header check");
          }
          if (BITS(4) !== 8 /* Z_DEFLATED */) {
            throw new Error("unknown compression method");
          }
          DROPBITS(4);
          var len = BITS(4) + 8;
          if (this.wbits === 0) this.wbits = len;
          else if (len > this.wbits) {
            throw new Error("invalid window size");
          }
          this.dmax = 1 << len;
          this.check = zutil.adler32();
          mode = hold & 0x200 ? 'dictid' : 'type';
          hold = bits = 0;
          continue inflation;
        case 'flags':
          if (!NEEDBITS(16)) break inflation;
          this.flags = hold;
          if ((this.flags & 0xff) !== 8 /* Z_DEFLATED */) {
            throw new Error("unknown compression method");
          }
          if (this.flags & 0xe000) {
            throw new Error("unknown header flags set");
          }
          if (this.head) this.head.text = ((hold >> 8) & 1);
          if (this.flags & 0x0200) this._crc2(hold);
          hold = bits = 0;
          mode = 'time';
          //continue inflation;
        case 'time':
          if (!NEEDBITS(32)) break inflation;
          if (this.head) this.head.time = hold;
          if (this.flags & 0x0200) this._crc4(hold);
          hold = bits = 0;
          mode = 'os';
          //continue inflation;
        case 'os':
          if (!NEEDBITS(16)) break inflation;
          if (this.head) {
            this.head.xflags = hold & 0xff;
            this.head.os = hold >> 8;
          }
          if (this.flags & 0x0200) this._crc2(hold);
          hold = bits = 0;
          mode = 'exlen';
          //continue inflation;
        case 'exlen':
          if (this.flags & 0x0400) {
            if (!NEEDBITS(16)) break inflation;
            this.length = hold >>> 0;
            if (this.head) this.head.extra_len = hold >>> 0;
            if (this.flags & 0x0200) this._crc2(hold);
            hold = bits = 0;
          }
          else if (this.head) this.head.extra = null;
          mode = 'extra';
          //continue inflation;
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
            if (this.length > 0) break inflation;
          }
          this.length = 0;
          mode = 'name';
          //continue inflation;
        case 'name':
          if (this.flags & 0x0800) {
            if (next.length === 0) break inflation;
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
            if (len > 0) break inflation;
          }
          else if (this.head) this.head.name = null;
          this.length = 0;
          mode = 'comment';
          //continue inflation;
        case 'comment':
          if (this.flags & 0x1000) {
            if (next.length === 0) break inflation;
            var copy = 0, len;
            do {
              len = next[copy++];
              if (this.head && this.head.comment && this.length < this.head.comm_max) {
                this.head.comment[this.length++] = len;
              }
            } while (len > 0 && copy < next.length);
            if (this.flags & 0x0200) this.check = crc32(this.check, next, copy);
            next = next.subarray(copy);
            if (len) break inflation;
          }
          else if (this.head) this.head.comment = null;
          mode = 'hcrc';
          //continue inflation;
        case 'hcrc':
          if (this.flags & 0x0200) {
            if (!NEEDBITS(16)) break inflation;
            if (hold !== (this.check & 0xffff)) {
              throw new Error("header crc mismatch");
            }
            hold = bits = 0;
          }
          if (this.head) {
            this.head.hcrc = (this.flags >> 9) & 1;
            this.head.done = 1;
          }
          this.check = zutil.crc32();
          mode = 'type';
          continue inflation;
        case 'dictid':
          if (!NEEDBITS(32)) break inflation;
          this.check = zutil.swap32(hold);
          hold = bits = 0;
          mode = 'dict';
          //continue inflation;
        case 'dict':
          if (!this.havedict) {
            RESTORE();
            return 'needDictionary';
          }
          this.check = zutil.adler32();
          mode = 'type';
          //continue inflation;
        case 'type':
          if (flush === 'block' || flush === 'trees') break inflation;
          //continue inflation;
        case 'typedo':
          if (this.last) {
            hold >>= bits & 7; bits -= bits & 7;
            mode = 'check';
            continue inflation;
          }
          if (!NEEDBITS(3)) break inflation;
          this.last = BITS(1);
          DROPBITS(1);
          switch (BITS(2)) {
            case 0: // stored block
              mode = 'stored';
              break;
            case 1: // fixed block
              this.lencode = CodeTableView.fixedLengthTable;
              this.distcode = CodeTableView.fixedDistanceTable;
              mode = 'len_'; // decode codes
              if (flush === 'trees') {
                DROPBITS(2);
                break inflation;
              }
              break;
            case 2: // dynamic block
              mode = 'table';
              break;
            case 3:
              throw new Error("invalid block type");
          }
          DROPBITS(2);
          continue inflation;
        case 'stored':
          // go to byte boundary
          hold >>= bits & 7; bits -= bits & 7;
          if (!NEEDBITS(32)) break inflation;
          if ((hold & 0xffff) !== ((hold >> 16) ^ 0xffff)) {
            throw new Error("invalid stored block lengths");
          }
          this.length = hold & 0xffff;
          hold = bits = 0;
          mode = 'copy_';
          if (flush === 'trees') break inflation;
          //continue inflation;
        case 'copy_':
          mode = 'copy';
          //continue inflation;
        case 'copy':
          var copy = this.length;
          if (copy > 0) {
            if (copy = Math.min(copy, next.length, put.length) === 0) {
              break inflation;
            }
            put.set(next.subarray(0, copy));
            next = next.subarray(copy);
            put = put.subarray(copy);
            this.length -= copy;
            continue inflation;
          }
          mode = 'type';
          continue inflation;
        case 'table':
          if (!NEEDBITS(14)) break inflation;
          this.nlen = BITS(5) + 257;
          DROPBITS(5);
          this.ndist = BITS(5) + 1;
          DROPBITS(5);
          this.ncode = BITS(4) + 4;
          DROPBITS(4);
          /*
          #ifndef PKZIP_BUG_WORKAROUND
          if (this.nlen > 286 || this.ndist > 30) {
            throw new Exception("too many length or distance symbols");
          }
          #endif
          */
          this.have = 0;
          mode = 'lenlens';
          //continue inflation;
        case 'lenlens':
          while (this.have < this.ncode) {
            if (!NEEDBITS(3)) break inflation;
            this.lens[order[this.have++]] = BITS(3);
            DROPBITS(3);
          }
          while (this.have < 19) {
            this.lens[order[this.have++]] = 0;
          }
          this.lencode = new CodeTableView('codes', 7, this.lens.subarray(0, 19));
          this.have = 0;
          mode = 'codelens';
          //continue inflation;
        case 'codelens':
          var lcode = this.lencode;
          while (this.have < this.nlen + this.ndist) {
            var here;
            for (;;) {
              here = BITS(lcode.bitWidth);
              if (lcode.bits[here] <= bits) break;
              if (!PULLBYTE()) break inflation;
            }
            var here_val = lcode.val[here], here_bits = lcode.bits[here];
            if (here_val < 16) {
              DROPBITS(here_bits);
              this.lens[this.have++] = here_val;
            }
            else {
              var len, copy;
              if (here_val === 16) {
                if (!NEEDBITS(here_bits + 2)) break inflation;
                DROPBITS(here_bits);
                if (this.have === 0) {
                  throw new Error("invalid bit length repeat");
                }
                len = this.lens[this.have - 1];
                copy = 3 + BITS(2);
                DROPBITS(2);
              }
              else if (here_val === 17) {
                if (!NEEDBITS(here_bits + 3)) break inflation;
                DROPBITS(here_bits);
                len = 0;
                copy = 3 + BITS(3);
                DROPBITS(3);
              }
              else {
                if (!NEEDBITS(here_bits + 7)) break inflation;
                DROPBITS(here_bits);
                len = 0;
                copy = 11 + BITS(7);
                DROPBITS(7);
              }
              if (this.have + copy > this.nlen + this.ndist) {
                throw new Error("invalid bit length repeat");
              }
              while (copy--) {
                this.lens[this.have++] = len & 0xffff;
              }
            }
          }

          /* check for end-of-block code (better have one) */
          if (this.lens[256] === 0) {
            throw new Error("invalid code -- missing end-of-block");
          }

          /* build code tables */
          this.lencode = new CodeTableView('lens', 9, this.lens.subarray(0, this.nlen));
          this.distcode = new CodeTableView('dists', 6, this.lens.subarray(this.nlen, this.nlen + this.ndist));
          mode = 'len_';
          if (flush === 'trees') break inflation;
          //continue inflation;
        case 'len_':
          mode = 'len';
          //continue inflation;
        case 'len':
          if (next.length >= 6 && put.length >= 258) {
            /* copy state to local variables */
            var dmax = this.dmax, /* maximum distance from zlib header */
              wsize = this.wsize, /* window size or zero if not using window */
              whave = this.whave, /* valid bytes in the window */
              wnext = this.wnext, /* window write index */
              window = this.window, /* allocated sliding window, if wsize != 0 */
              lcode = this.lencode,
              dcode = this.distcode;
            var lcode_op = lcode.op,
              lcode_mask = lcode.mask,
              lcode_val = lcode.val,
              dcode_op = dcode.op,
              dcode_bits = dcode.bits,
              dcode_mask = dcode.mask,
              dcode_val = dcode.val,
              lcode_bits = lcode.bits;
            var beg_p = put.length - out; /* inflate()'s initial this.next_out */
            
            var in_p = 0, out_p = 0, in_last = next.length - 5, out_last = put.length - 257;
      
            /* decode literals and length/distances until end-of-block or not enough
               input data or output space */
            fastLoop: do {
              if (bits < 15) {
                hold += next[in_p++] << bits; bits += 8;
                hold += next[in_p++] << bits; bits += 8;
              }
      
              var len_i = hold & lcode_mask;
      
              do {
                // code bits, operation, extra bits, or window position, window bytes to copy
                var op = lcode_bits[len_i];
                hold >>= op; bits -= op;
                op = lcode_op[len_i];
                if (op === 0) { // literal
                  put[out_p++] = lcode_val[len_i] & 0xff;
                  continue fastLoop;
                }
                if (op & 16) { // length base
                  var len = lcode_val[len_i];
                  op &= 15; // number of extra bits
                  if (op !== 0) {
                    if (bits < op) {
                      hold += next[in_p++] << bits; bits += 8;
                    }
                    len += hold & ((1 << op) - 1);
                    hold >>= op; bits -= op;
                  }
                  if (bits < 15) {
                    hold += next[in_p++] << bits; bits += 8;
                    hold += next[in_p++] << bits; bits += 8;
                  }
                  var dist_i = hold & dcode_mask;
                  do {
                    op = dcode_bits[dist_i];
                    hold >>= op; bits -= op;
                    op = dcode_op[dist_i];
                    if (op & 16) {
                      // distance base
                      var dist = dcode_val[dist_i];
                      op &= 15; // number of extra bits
                      if (bits < op) {
                        hold += next[in_p++] << bits; bits += 8;
                        if (bits < op) {
                          hold += next[in_p++] << bits; bits += 8;
                        }
                      }
                      dist += hold & ((1 << op) - 1);
                      //#ifdef INFLATE_STRICT
                      if (dist > dmax) {
                        throw new Error("invalid distance too far back");
                      }
                      //#endif
                      hold >>= op; bits -= op;
                      op = (out_p - beg_p) >>> 0; // max distance in output
                      if (dist > op) { // see if copy from window
                        op = dist - op; // distance back in window
                        if (op > whave) {
                          throw new Error("invalid distance too far back");
                        }
                        var from = window;
                        if (wnext == 0) { // very common case
                          from = from.subarray(wsize - op);
                          if (op < len) {
                            // some from window
                            len -= op;
                            put.set(from.subarray(0, op), out_p);
                            out_p += op;
                            // rest from output
                            from = put.subarray(out_p - dist);
                          }
                        }
                        else if (wnext < op) {
                          // wrap around window
                          from = from.subarray(wsize + wnext - op);
                          op -= wnext;
                          if (op < len) {
                            // some from end of window
                            len -= op;
                            put.set(from.subarray(0, op), out_p);
                            out_p += op;
                            from = window;
                            if (wnext < len) { 
                              // some from start of window
                              op = wnext;
                              len -= op;
                              put.set(from.subarray(0, op), out_p);
                              out_p += op;
                              // rest from output
                              from = put.subarray(out_p - dist, out_p);
                            }
                          }
                        }
                        else {
                          // contiguous in window
                          from = from.subarray(wnext - op);
                          if (op < len) {
                            // some from window
                            len -= op;
                            put.set(from.subarray(0, op), out_p);
                            out_p += op;
                            // rest from output
                            from = put.subarray(out_p - dist, out_p);
                          }
                        }
                        put.set(from.subarray(0, len), out_p);
                        out_p += len;
                      }
                      else {
                        /* copy direct from output */
                        put.set(put.subarray(out_p - dist, (out_p - dist) + len), out_p);
                        out_p += len;
                      }
                      continue fastLoop;
                    }
                    if (op & 64) {
                      throw new Error("invalid distance code");
                    }
                    /* 2nd level distance code */
                    var new_dist_i = dcode_val[dist_i] + (hold & ((1 << op) - 1));
                    //if (new_dist_i >= dcode_val.length) throw new RangeError('internal error: dist_i out of range');
                    dist_i = new_dist_i;
                  } while(true);
                }
                if (op & 64) {
                  if (op & 32) {
                    mode = 'type';
                    break fastLoop;
                  }
                  throw new Error("invalid literal/length code");
                }
                /* 2nd level length code */
                var new_len_i = lcode_val[len_i] + (hold & ((1 << op) - 1));
                if (new_len_i >= lcode_val.length) throw new RangeError('internal error: len_i out of range');
                len_i = new_len_i;
              } while (true);
            } while (in_p < in_last && out_p < out_last);
      
            /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
            var len = bits >> 3;
            next = next.subarray(in_p - len);
            put = put.subarray(out_p);
            bits -= len << 3;
            hold &= (1 << bits) - 1;
            if (mode === 'type') {
              this.back = -1;
            }
            continue inflation;
          }
          this.back = 0;
          var lcode = this.lencode;
          var here;
          for (;;) {
            here = BITS(lcode.bitWidth);
            if (lcode.bits[here] <= bits) break;
            if (!PULLBYTE()) break inflation;
          }
          if (lcode.op[here] && !(lcode.op[here] & 0xf0)) {
            var last_op = lcode.op[here], last_bits = lcode.bits[here], last_val = lcode.val[here];
            for (;;) {
              here = last_val + (BITS(last_bits + last_op) >> last_bits);
              if ((last_bits + lcode.bits[here]) <= bits) break;
              if (!PULLBYTE()) break inflation;
            }
            DROPBITS(last_bits);
            this.back += last_bits;
          }
          var here_bits = lcode.bits[here], here_op = lcode.op[here], here_val = lcode.val[here];
          DROPBITS(here_bits);
          this.back += here_bits;
          this.length = here_val;
          if (here_op === 0) {
            mode = 'lit';
            continue inflation;
          }
          if (here_op & 32) {
            this.back = -1;
            mode = 'type';
            continue inflation;
          }
          if (here_op & 64) {
            throw new Error("invalid literal/length code");
          }
          this.extra = here_op & 15;
          mode = 'lenext';
          //continue inflation;
        case 'lenext':
          if (this.extra > 0) {
            if (!NEEDBITS(this.extra)) break inflation;
            this.length += BITS(this.extra);
            DROPBITS(this.extra);
            this.back += this.extra;
          }
          this.was = this.length;
          mode = 'dist';
          //continue inflation;
        case 'dist':
          var here, dcode = this.distcode;
          for (;;) {
            here = BITS(dcode.bitWidth);
            if (dcode.bits[here] <= bits) break;
            if (!PULLBYTE()) break inflation;
          }
          if ((dcode.op[here] & 0xf0) === 0) {
            var last_val = dcode.val[here], last_bits = dcode.bits[here], last_op = dcode.op[here];
            for (;;) {
              here = last_val + (BITS(last_bits + last_op) >> last_bits);
              if ((last_bits + dcode.bits[here]) <= bits) break;
              if (!PULLBYTE()) break inflation;
            }
            DROPBITS(last_bits);
            this.back += last_bits;
          }
          var here_bits = dcode.bits[here], here_op = dcode.op[here], here_val = dcode.val[here];
          DROPBITS(here_bits);
          this.back += here_bits;
          if (here_op & 64) {
            throw new Error("invalid distance code");
          }
          this.offset = here_val;
          this.extra = here_op & 15;
          mode = 'distext';
          //continue inflation;
        case 'distext':
          if (this.extra) {
            if (!NEEDBITS(this.extra)) break inflation;
            this.offset += BITS(this.extra);
            DROPBITS(this.extra);
            this.back += this.extra;
          }
          // #ifdef INFLATE_STRICT
          if (this.offset > this.dmax) {
            throw new Error("invalid distance too far back");
          }
          // #endif
          mode = 'match';
          //continue inflation;
        case 'match':
          if (put.length === 0) break inflation;
          var copy = out - put.length;
          var from;
          if (this.offset > copy) { // copy from window
            copy = this.offset - copy;
            if (copy > this.whave) {
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
          if (this.length === 0) mode = 'len';
          continue inflation;
        case 'lit':
          if (put.length === 0) break inflation;
          put[0] = this.length & 0xff;
          put = put.subarray(1);
          mode = 'len';
          continue inflation;
        case 'check':
          if (this.wrap) {
            if (!NEEDBITS(32)) break inflation;
            out -= put.length;
            this.total_out += out;
            this.total += out;
            if (out > 0) {
              var checkBytes = new Uint8Array(put.buffer, put.byteOffset - out, out);
              this._update(checkBytes);
            }
            out = put.length;
            if ((this.flags ? hold : zutil.swap32(hold)) !== this.check) {
              throw new Error("incorrect data check");
            }
            hold = bits = 0;
          }
          mode = 'length';
          //continue inflation;
        case 'length':
          if (this.wrap && this.flags) {
            if (!NEEDBITS(32)) break inflation;
            if ((hold >>> 0) !== (this.total >>> 0)) {
              throw new Error("incorrect length check");
            }
            hold = bits = 0;
          }
          mode = 'done';
          //continue inflation;
        case 'done':
          ret = 'done';
          break inflation;
        default: throw new Error('unknown state');
      }
      // end of loop
      RESTORE();
      if (this.wsize > 0 || (out !== this.next_out.length
        && (flush !== 'finish' || !/^(check|length|done)$/.test(mode)))
      ) {
        this._updateWindow(this.next_out, out - this.next_out.length);
      }
      _in -= this.next_in.length;
      out -= this.next_out.length;
      this.total_in += _in;
      this.total_out += out;
      this.total += out;
      if (this.wrap && out > 0) {
        this._update(new Uint8Array(this.next_out.buffer, this.next_out.byteOffset - out, out));
      }
      this.data_type = this.bits
        + (this.last ? 64 : 0)
        + (mode === 'type' ? 128 : 0)
        + (mode === 'len_' || mode === 'copy_' ? 256 : 0);
      if (((!_in && !out) || flush === 'finish') && ret === 'more') {
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
  };
  
  function inflate(compressedBytes, noWrap) {
    var inflater = noWrap ? new InflateState(-15) : new InflateState();
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
    for (var pos = 0; pos < allBytes.length; pos += bufferList.shift().byteLength) {
      allBytes.set(bufferList[0], pos);
    }
    return allBytes;
  }
  
  inflate.State = InflateState;
  
  return inflate;

});
