define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  return function(resource) {
    var pictDV = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    var fileSizeBytes = pictDV.getUint16(0, false);
    var top = pictDV.getInt16(2, false);
    var left = pictDV.getInt16(4, false);
    var bottom = pictDV.getInt16(6, false);
    var right = pictDV.getInt16(8, false);
    var canvas = document.createElement('CANVAS');
    canvas.width = right - left;
    canvas.height = bottom - top;
    var ctx = canvas.getContext('2d');
    var fontFamily = 'sans-serif';
    if (resource.data[10] === 0x11 && resource.data[11] === 0x01) {
      // version 1
      console.log('PICTv1', left, top, right, bottom);
      function region() {
        var len = pictDV.getUint16(pictPos);
        var region = {
          left: pictDV.getInt16(pictPos + 2),
          top: pictDV.getInt16(pictPos + 4),
          right: pictDV.getInt16(pictPos + 6),
          bottom: pictDV.getInt16(pictPos + 8),
        };
        if (len > 10) {
          region.extra = resource.data.subarray(pictPos + 10, pictPos + len);
        }
        pictPos += len;
        return region;
      }
      var currentX = 0, currentY = 0;
      pictV1loop:
      for (var pictPos = 12; resource.data[pictPos] !== 0xff; ) {
        switch(resource.data[pictPos++]) {
          case 0x00: break; // no-op
          case 0x01: // clipping region
            var clipRegion = region();
            console.log('clip', clipRegion);
            break;
          case 0x02: // background pattern
            pictPos += 8;
            break;
          case 0x03: // font number for text
            pictPos += 2;
            break;
          case 0x04: // text font style
            pictPos += 1;
            break;
          case 0x05: // source mode
            pictPos += 2;
            break;
          case 0x06: // extra space
            pictPos += 4;
            break;
          case 0x07: // pen size
            pictPos += 4;
            break;
          case 0x08: // pen mode
            pictPos += 2;
            break;
          case 0x09: // pen pattern
            pictPos += 8;
            break;
          case 0x0A: // fill pattern
            pictPos += 8;
            break;
          case 0x0B: // oval size
            pictPos += 4;
            break;
          case 0x0C: // origin
            currentY = pictDV.getInt16(pictPos);
            currentX = pictDV.getInt16(pictPos + 2);
            pictPos += 4;
            break;
          case 0x0D: // text size
            ctx.font = fontFamily + ' ' + pictDV.getUint16(pictPos) + 'px';
            pictPos += 2;
            break;
          case 0x0E: // foreground color
            pictPos += 4;
            break;
          case 0x0F: // background color
            pictPos += 4;
            break;
          case 0x10: // txratio
            pictPos += 8;
            break;
          case 0x11: // version
            pictPos += 1;
            break;
          case 0x20: // line
            pictPos += 8;
            break;
          case 0x21: // line from
            pictPos += 4;
            break;
          case 0x22: // short line
            pictPos += 6;
            break;
          case 0x23: // short line from
            pictPos += 2;
            break;
          case 0x28: // long text
            var y = pictDV.getInt16(pictPos, false);
            var x = pictDV.getInt16(pictPos + 2, false);
            pictPos += 4;
            var text = macintoshRoman(resource.data, pictPos+1, resource.data[pictPos]);
            pictPos += 1 + text.length;
            currentX = x;
            currentY = y;
            ctx.fillText(text, currentX, currentY);
            break;
          case 0x29: // DHtext
            var x = resource.data[pictPos++];
            var text = macintoshRoman(resource.data, pictPos+1, resource.data[pictPos]);
            pictPos += 1 + text.length;
            currentX += x;
            ctx.fillText(text, currentX, currentY);
            break;
          case 0x2A: // DVtext
            var y = resource.data[pictPos++];
            var text = macintoshRoman(resource.data, pictPos+1, resource.data[pictPos]);
            pictPos += 1 + text.length;
            currentY += y;
            ctx.fillText(text, currentX, currentY);
            break;
          case 0x2B: // DHDVtext
            var x = resource.data[pictPos++];
            var y = resource.data[pictPos++];
            var text = macintoshRoman(resource.data, pictPos+1, resource.data[pictPos]);
            pictPos += 1 + text.length;
            currentX += x;
            currentY += y;
            ctx.fillText(text, currentX, currentY);
            break;
          case 0x30: // frame rect
            pictPos += 8;
            break;
          case 0x31: // paint rect
            pictPos += 8;
            break;
          case 0x32: // erase rect
            pictPos += 8;
            break;
          case 0x33: // invert rect
            pictPos += 8;
            break;
          case 0x34: // fill rect
            pictPos += 8;
            break;
          case 0x38: // frame same rect
            break;
          case 0x39: // paint same rect
            break;
          case 0x3A: // erase same rect
            break;
          case 0x3B: // invert same rect
            break;
          case 0x3C: // fill same rect
            break;
            
          case 0x40: // frame rrect
            pictPos += 8;
            break;
          case 0x41: // paint rrect
            pictPos += 8;
            break;
          case 0x42: // erase rrect
            pictPos += 8;
            break;
          case 0x43: // invert rrect
            pictPos += 8;
            break;
          case 0x44: // fill rrect
            pictPos += 8;
            break;
          case 0x48: // frame same rrect
            break;
          case 0x49: // paint same rrect
            break;
          case 0x4A: // erase same rrect
            break;
          case 0x4B: // invert same rrect
            break;
          case 0x4C: // fill same rrect
            break;
            
          case 0x50: // frame oval
            pictPos += 8;
            break;
          case 0x51: // paint oval
            pictPos += 8;
            break;
          case 0x52: // erase oval
            pictPos += 8;
            break;
          case 0x53: // invert oval
            pictPos += 8;
            break;
          case 0x54: // fill oval
            pictPos += 8;
            break;
          case 0x58: // frame same oval
            break;
          case 0x59: // paint same oval
            break;
          case 0x5A: // erase same oval
            break;
          case 0x5B: // invert same oval
            break;
          case 0x5C: // fill same oval
            break;
            
          case 0x60: // frame arc
            pictPos += 12;
            break;
          case 0x61: // paint arc
            pictPos += 12;
            break;
          case 0x62: // erase arc
            pictPos += 12;
            break;
          case 0x63: // invert arc
            pictPos += 12;
            break;
          case 0x64: // fill arc
            pictPos += 12;
            break;
          case 0x68: // frame same arc
            pictPos += 4;
            break;
          case 0x69: // paint same arc
            pictPos += 4;
            break;
          case 0x6A: // erase same arc
            pictPos += 4;
            break;
          case 0x6B: // invert same arc
            pictPos += 4;
            break;
          case 0x6C: // fill same arc
            pictPos += 4;
            break;
            
          // case 0x70: // frame poly
          // case 0x71: // paint poly
          // case 0x72: // erase poly
          // case 0x73: // invert poly
          // case 0x74: // fill poly
          case 0x78: // frame same poly
            break;
          case 0x79: // paint same poly
            break;
          case 0x7A: // erase same poly
            break;
          case 0x7B: // invert same poly
            break;
          case 0x7C: // fill same poly
            break;
          
          case 0x80: // frame region
            var frameRegion = region();
            console.log('frame', frameRegion);
            break;
          case 0x81: // paint region
            var paintRegion = region();
            console.log('paint', paintRegion);
            break;
          case 0x82: // erase region
            var eraseRegion = region();
            console.log('erase', eraseRegion);
            break;
          case 0x83: // invert region
            var invertRegion = region();
            console.log('invert', invertRegion);
            break;
          case 0x84: // fill region
            var fillRegion = region();
            console.log('fill', fillRegion);
            break;
          case 0x88: // frame same region
            break;
          case 0x89: // paint same region
            break;
          case 0x8A: // erase same region
            break;
          case 0x8B: // invert same region
            break;
          case 0x8C: // fill same region
            break;
          
          //case 0x90: // copy bits to clipped rect
          //case 0x91: // copy bits to clipped region
          
          case 0x98: // copy packed bits to clipped rect
            var pixmap = {
              baseAddr: pictDV.getUint16(pictPos, false),
              rowBytes: pictDV.getUint16(pictPos + 2, false),
              bounds: {
                top: pictDV.getInt16(pictPos + 2 + 2, false),
                left: pictDV.getInt16(pictPos + 2 + 4, false),
                bottom: pictDV.getInt16(pictPos + 2 + 6, false),
                right: pictDV.getInt16(pictPos + 2 + 8, false),
              },
              recordVersionNumber: pictDV.getInt16(pictPos + 2 + 10, false),
              packType: pictDV.getInt16(pictPos + 2 + 12, false),
              packSize: pictDV.getInt32(pictPos + 2 + 14, false),
              hRes: fixed(pictDV.getInt32(pictPos + 2 + 18, false)),
              vRes: fixed(pictDV.getInt32(pictPos + 2 + 22, false)),
              pixelType: pictDV.getInt16(pictPos + 2 + 26, false),
              pixelSize: pictDV.getInt16(pictPos + 2 + 28, false),
              componentsPerPixel: pictDV.getInt16(pictPos + 2 + 30, false),
              bitsPerComponent: pictDV.getInt16(pictPos + 2 + 32, false),
              planeBytes: pictDV.getInt32(pictPos + 2 + 34, false),
              colorTableHandle: pictDV.getInt16(pictPos + 2 + 38, false),
              reserved: pictDV.getInt32(pictPos + 2 + 40, false),
            };
            console.log(resource.data.subarray(pictPos, pictPos + 2 + 44));
            pictPos += 2 + 44;
            console.log(pixmap);
            break pictV1loop;
          
          //case 0x99: // copy packed bits to clipped region
          
          case 0xA0: // short comment
            var kind = pictDV.getUint16(pictPos, false);
            console.log('comment', kind);
            pictPos += 2;
            break;
          case 0xA1: // long comment
            var kind = pictDV.getUint16(pictPos, false);
            var len = pictDV.getUint16(pictPos + 2, false);
            var commentData = resource.data.subarray(pictPos + 4, pictPos + 4 + len);
            console.log('comment', kind, commentData);
            pictPos += 4 + len;
            break;
          
          //case 0xFF: // end of picture (checked by outer loop)
          
          default:
            console.error('unhandled PICTv1 opcode: 0x' + resource.data[pictPos - 1].toString(16));
            break pictV1loop;
        }
      }
    }
    else if (resource.data[10] === 0x00 && resource.data[11] === 0x11
        && resource.data[12] === 0x02 && resource.data[13] === 0xff) {
      // version 2
      console.log('PICTv2', left, top, right, bottom);
    }
    else {
      console.error('unknown PICT format version');
      return;
    }
    resource.image = {width:right - left, height:bottom-top, url:canvas.toDataURL()};
    if (left) resource.image.offsetX = left;
    if (top) resource.image.offsetY = top;
  };

});
