define(function() {

  'use strict';
  
  function RFALSE(){ return false; }
  
  function split(segment, entries, noRecurse) {
  
    var maybeHFS = segment.getBytes(512 * 2, 2).then(function(sigBytes) {
      var sig = String.fromCharCode(sigBytes[0], sigBytes[1]);
      if (sig === 'BD') {
        entries.add(segment.getSegment('volume/mac-hfs'));
        return true;
      }
      if (sig === 'H+') {
        entries.add(segment.getSegment('volume/mac-hfs-plus'));
        return true;
      }
      else if (sig === 'HX') {
        entries.add(segment.getSegment('volume/mac-hfs-plus; variant=case-sensitive'));
        return false;
      }
      return false;
    }, RFALSE);
    
    var maybeFAT = segment.getBytes(0, 36).then(function(raw) {
      if (raw[0] === 0xEB) {
        if (raw[1] < 0x34 || raw[2] !== 0x90) {
          return false;
        }
      }
      else if (raw[0] === 0xE9) {
      }
      else {
        return false;
      }
      entries.add(segment.getSegment('fat/volume'));
      return true;
    }, RFALSE);
    
    var tries = Promise.all([maybeHFS, maybeFAT]);
    
    if (!noRecurse) {
      tries = tries.then(function(results) {
        for (var i = 0; i < results.length; i++) { if (results[i]) return; }
        // if all else fails, try shifting 0x54 bytes (DiskCopy 4.2 header size) and trying again
        split(segment.getSegment(segment.type, 0x54), entries, true);
      });
    }
    
    return tries;
    
  }
  
  return {
    split: split,
  };

});
