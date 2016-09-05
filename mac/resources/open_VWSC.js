define(function() {
  
	'use strict';
  
  var transitionNames = [
    null,
		'wipeRight', 'wipeLeft', 'wipeDown', 'wipeUp',
		'centerOutHorizontal', 'edgesInHorizontal',
      'centerOutVertical', 'edgesInVertical',
      'centerOutSquare', 'edgesInSquare',
    'pushLeft', 'pushRight', 'pushDown', 'pushUp',
    'revealUp', 'revealUpRight', 'revealRight', 'revealDownRight',
      'revealDown', 'revealDownLeft', 'revealLeft', 'revealUpLeft',
    'dissolvePixelsFast', 'dissolveBoxyRectangles',
      'dissolveBoxySquares', 'dissolvePatterns',
    'randomRows', 'randomColumns',
    'coverDown', 'coverDownLeft', 'coverDownRight', 'coverLeft',
      'coverRight', 'coverUp', 'coverUpLeft', 'coverUpRight',
    'venetianBlinds', 'checkerboard',
    'stripsBottomBuildLeft', 'stripsBottomBuildRight',
      'stripsLeftBuildDown', 'stripsLeftBuildUp',
      'stripsRightBuildDown', 'stripsRightBuildUp',
      'stripsTopBuildLeft', 'stripsTopBuildRight',
    'zoomOpen', 'zoomClose',
    'verticalBlinds',
    'dissolveBitsFast', 'dissolvePixels', 'dissolveBits',
  ];
  
	var SPRITE_BYTES = 16; // 20
	var SPRITE_COUNT = 49;
  
  function FrameView(buffer, byteOffset, byteLength) {
    Object.defineProperty(this, 'dv', {value:new DataView(buffer, byteOffset, byteLength)});
  }
  Object.defineProperties(FrameView.prototype, {
    duration: {
      get: function() {
        var v = this.dv.getInt8(4);
        return (v === 0) ? 'default'
          : (v >= 1 && v <= 60) ? (1000 / v)
          : (v <= -1 && v >= -30) ? (250 * -v)
          : (v === -128) ? 'untilUserAction'
          : (v >= -122 && v <= -121) ? ('untilAfterSound' + (-120 - v))
          : 'untilAfterVideo' + (v + 121);
      },
      enumerable: true,
    },
    transition: {
      get: function() {
        var v = this.dv.getUint8(5);
        return (v >= transitionNames.length) ? v : transitionNames[v];
      },
      enumerable: true,
    },
    audio1: {
      get: function() {
        return this.dv.getUint16(6, false);
      },
      enumerable: true,
    },
    audio2: {
      get: function() {
        return this.dv.getUint16(8, false);
      },
      enumerable: true,
    },
    script: {
      get: function() {
        return this.dv.getUint16(16, false);
      },
      enumerable: true,
    },
    palette: {
      get: function() {
      	var v = this.dv.getInt16(0x14, false);
      	return (v === 0) ? 'default'
      	  : (v < 0) ? ('system' + (-v))
      	  : v;
      },
      enumerable: true,
    },
    sprites: {
      get: function() {
        var sprites = {};
        var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset + SPRITE_BYTES * 2;
        for (var i = 1; i <= SPRITE_COUNT; i++) {
          var spriteView = new FrameSpriteView(buffer, byteOffset, SPRITE_BYTES);
          if (spriteView.cast) {
            sprites[i] = spriteView;
          }
          byteOffset += SPRITE_BYTES;
        }
        Object.defineProperty(this, 'sprites', {value:sprites});
        return sprites;
      },
      enumerable: true,
    },
  });
  
  function FrameSpriteView(buffer, byteOffset, byteLength) {
    Object.defineProperty(this, 'dv', {value:new DataView(buffer, byteOffset, byteLength)});
  }
  Object.defineProperties(FrameSpriteView.prototype, {
    cast: {
      get: function() {
        return this.dv.getUint16(6, false);
      },
      enumerable: true,
    },
    top: {
      get: function() {
        return this.dv.getInt16(8, false);
      },
      enumerable: true,
    },
    left: {
      get: function() {
        return this.dv.getInt16(10, false);
      },
      enumerable: true,
    },
    bottom: {
      get: function() {
        return this.dv.getInt16(12, false);
      },
      enumerable: true,
    },
    right: {
      get: function() {
        return this.dv.getInt16(14, false);
      },
      enumerable: true,
    },
    script: {
      get: function() {
        return this.dv.getUint16(16, false);
      },
      enumerable: true,
    },
    ink: {
      get: function() {
        var v = this.dv.getUint8(5) & 0xf;
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
      enumerable: true,
    },
  });
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (dv.getUint32(0, false) !== bytes.length) {
        return Promise.reject('length does not match data');
      }
      var previousData = new Uint8Array(1024);
      var dataObject = [];
      var pos = 4;
      while (pos < bytes.length) {
        var frameData = new Uint8Array(previousData);
        var endPos = pos + dv.getUint16(pos);
        if (endPos === pos) break;
        pos += 2;
        while (pos < endPos) {
          var patchLength = bytes[pos] * 2, patchOffset = bytes[pos + 1] * 2;
          pos += 2;
          var patch = bytes.subarray(pos, pos + patchLength);
          pos += patchLength;
          frameData.set(patch, patchOffset);
        }
        dataObject.push(new FrameView(frameData.buffer, frameData.byteOffset, frameData.byteLength));
      }
      item.setDataObject(dataObject);
      previousData = frameData;
    });
  };
  
});
