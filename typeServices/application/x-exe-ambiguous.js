define(function() {

  'use strict';
  
  function split(entries) {
    var segment = this;
    return segment.getBytes(0, 2)
    .then(function(rawSignature) {
      if (String.fromCharCode.apply(null, rawSignature) !== 'MZ') {
        return Promise.reject('not a recognized kind of .exe');
      }
      return segment.getBytes(60, 4);
    })
    .then(function(rawNewHeaderOffset) {
      var newHeaderOffset = new DataView(rawNewHeaderOffset).getUint32(0, true);
      if (newHeaderOffset < 0x40) {
        if (entries.accepts('application/x-exe-msdos')) {
          entries.add('application/x-exe-msdos', segment);
        }
        return;
      }
      if (entries.accepts('application/x-exe-msdos')) {
        entries.add('application/x-exe-msdos', segment.getSegment(0, newHeaderOffset).setMetadata({
          isLikelyStub: true,
        }));
      }
      return segment.getBytes(newHeaderOffset, 6)
      .then(function(rawNewSignature) {
        var newSignature = String.fromCharCode(rawNewSignature[0], rawNewSignature[1]);
        var type;
        switch (newSignature) {
          case 'NE': type = 'application/x-exe-win16'; break;
          case 'PE':
            if (rawNewSignature[2] !== 0 || rawNewSignature[3] !== 0) {
              return Promise.reject('unknown executable type');
            }
            switch (rawNewSignature[4] | (rawNewSignature[5] << 2)) {
              case 0x8664: // AMD64
              case 0x200: // IA64
                type = 'application/x-exe-win32';
                break;
              default:
                type = 'application/x-exe-win64';
            }
            break;
          case 'DL': type = 'application/x-hp-lx-msdos-system-manager'; break; // extension should be .EXM
          case 'MP': case 'P2': case 'P3': type = 'application/x-phar-lap-dos-extender'; break; // extension should be .EXP
          case 'LE': case 'LX': type = 'application/x-exe-linear'; break; // OS/2 2.0+, DOS extenders
          case 'W3': case 'W4': type = 'application/x-exe-linear-collection'; break; // WIN386.EXE, DOS386.EXE, VMM32.VXD
          default: return Promise.reject('unknown executable type');
        }
        if (entries.accepts(type)) {
          entries.add(type, segment.getSegment(newHeaderOffset).setMetadata({
            baseOffset: newHeaderOffset,
          });
        }
      });
    });
  }
  
  return {
    split: split,
  };

});
