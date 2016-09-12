define(function() {
  
  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var len = dv.getUint32(0, false);
      if (len > bytes.length) {
        return Promise.reject('length does not match data');
      }
      item.playHeadFactory = {
        createPlayHead: function() {
          return new FramePlayHead(bytes.buffer, bytes.byteOffset + 4, len - 4);
        },
      };
    });
  }
  
  var BUFFER_BYTES = 1024;
  var SPRITE_BYTES = 16; // 20
  var SPRITE_OFFSET = 32;

  function FramePlayHead(sourceBuffer, sourceByteOffset, sourceByteLength) {
    this.sourceDataView = new DataView(sourceBuffer, sourceByteOffset, sourceByteLength);
    this.sourceBytes = new Uint8Array(sourceBuffer, sourceByteOffset, sourceByteLength);
    this.sourceNextPos = 0;
    this.currentBytes = new Uint8Array(BUFFER_BYTES);
    this.dataView = new DataView(this.currentBytes.buffer, this.currentBytes.byteOffset, SPRITE_OFFSET);
    var sprites = new Array();
    for (var i = SPRITE_OFFSET; i < BUFFER_BYTES; i += SPRITE_BYTES) {
      sprites.push(new SpriteView(this.currentBytes.buffer, this.currentBytes.byteOffset + i, SPRITE_BYTES));
    }
  }
  FramePlayHead.prototype = {
    next: function() {
      var pos = this.sourceNextPos;
      var endPos = pos + this.sourceDataView.getUint16(pos);
      this.sourceNextPos = endPos % this.sourceDataView.byteLength;
      pos += 2;
      var bytes = this.sourceBytes;
      var currentBytes = this.currentBytes;
      var firstByteChanged = Infinity, lastByteChanged = -Infinity;
      while (pos < endPos) {
        var patchLength = bytes[pos] * 2, patchOffset = bytes[pos + 1] * 2;
        pos += 2;
        var patch = bytes.subarray(pos, pos + patchLength);
        pos += patchLength;
        currentBytes.set(patch, patchOffset);
        firstByteChanged = Math.min(firstByteChanged, patchOffset);
        lastByteChanged = Math.max(lastByteChanged, patchOffset + patchLength - 1);
      }
      this.firstByteChanged = firstByteChanged;
      this.lastByteChanged = lastByteChanged;
    },
    get lastSpriteChanged() {
      return Math.floor((this.lastByteChanged - SPRITE_OFFSET) / SPRITE_BYTES);
    },
    get duration() {
      var v = this.dataView.getInt8(4);
      return (v === 0) ? 'default'
        : (v >= 1 && v <= 60) ? (1000 / v)
        : (v <= -1 && v >= -30) ? (250 * -v)
        : (v === -128) ? 'untilUserAction'
        : (v >= -122 && v <= -121) ? ('untilAfterSound' + (-120 - v))
        : 'untilAfterVideo' + (v + 121);
    },
    get transition() {
      switch(this.dataView.getUint8(5)) {
        case 0: return null;
        case 1: return 'wipeRight';
        case 2: return 'wipeLeft';
        case 3: return 'wipeDown';
        case 4: return 'wipeUp';
        case 5: return 'centerOutHorizontal';
        case 6: return 'edgesInHorizontal';
        case 7: return 'centerOutVertical';
        case 8: return 'edgesInVertical';
        case 9: return 'centerOutSquare';
        case 10: return 'edgesInSquare';
        case 11: return 'pushLeft';
        case 12: return 'pushRight';
        case 13: return 'pushDown';
        case 14: return 'pushUp';
        case 15: return 'revealUp';
        case 16: return 'revealUpRight';
        case 17: return 'revealRight';
        case 18: return 'revealDownRight';
        case 19: return 'revealDown';
        case 20: return 'revealDownLeft';
        case 21: return 'revealLeft';
        case 22: return 'revealUpLeft';
        case 22: return 'dissolvePixelsFast';
        case 23: return 'dissolveBoxyRectangles';
        case 24: return 'dissolveBoxySquares';
        case 25: return 'dissolvePatterns';
        case 26: return 'randomRows';
        case 27: return 'randomColumns';
        case 28: return 'coverDown';
        case 29: return 'coverDownLeft';
        case 30: return 'coverDownRight';
        case 31: return 'coverLeft';
        case 32: return 'coverRight';
        case 33: return 'coverUp';
        case 34: return 'coverUpLeft';
        case 35: return 'coverUpRight';
        case 36: return 'venetianBlinds';
        case 37: return 'checkerboard';
        case 38: return 'stripsBottomBuildLeft';
        case 39: return 'stripsBottomBuildRight';
        case 40: return 'stripsLeftBuildDown';
        case 41: return 'stripsLeftBuildUp';
        case 42: return 'stripsRightBuildDown';
        case 43: return 'stripsRightBuildUp';
        case 44: return 'stripsTopBuildLeft';
        case 45: return 'stripsTopBuildRight';
        case 46: return 'zoomOpen';
        case 47: return 'zoomClose';
        case 48: return 'verticalBlinds';
        case 49: return 'dissolveBitsFast';
        case 50: return 'dissolvePixels';
        case 51: return 'dissolveBits';
        default: return this.dataView.getUint8(5);
      }
    },
    get audio1() {
      return this.dataView.getUint16(6, false);
    },
    get audio2() {
      return this.dataView.getUint16(8, false);
    },
    get script() {
      return this.dataView.getUint16(16, false);
    },
    get palette() {
      return this.dataView.getInt16(0x14, false);
    },
  };
  
  function SpriteView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  SpriteView.prototype = {
    toJSON: function() {
      if (!this.cast) return null;
      return {
        cast: this.cast,
        top: this.top,
        left: this.left,
        bottom: this.bottom,
        right: this.right,
        ink: this.ink,
      };
    },
    get ink() {
      var v = this.dataView.getUint8(5) & 0xf;
      switch (v) {
        case 0x00: return 'copy';
        case 0x01: return 'transparent';
        case 0x02: return 'reverse';
        case 0x03: return 'ghost';
        case 0x04: return 'notCopy';
        case 0x05: return 'notTransparent';
        case 0x06: return 'notReverse';
        case 0x07: return 'notGhost';
        case 0x08: return 'matte';
        case 0x09: return 'mask';
        case 0x20: return 'blend';
        case 0x21: return 'addPin';
        case 0x22: return 'add';
        case 0x23: return 'subtractPin';
        case 0x25: return 'lightest';
        case 0x26: return 'subtract';
        case 0x27: return 'darkest';
        default: return v;
      }
    },
    get cast() {
      return this.dataView.getUint16(6, false);
    },
    get top() {
      return this.dataView.getInt16(8, false);
    },
    get left() {
      return this.dataView.getInt16(10, false);
    },
    get bottom() {
      return this.dataView.getInt16(12, false);
    },
    get right() {
      return this.dataView.getInt16(14, false);
    },
  };

  return open;
  
});
