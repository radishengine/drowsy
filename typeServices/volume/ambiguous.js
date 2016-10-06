define(function() {

  'use strict';
  
  function NO_OP(){}
  
  function split(segment, entries) {
  
    var maybeHFS = segment.getBytes(512 * 2, 2).then(function(sigBytes) {
      var sig = String.fromCharCode(sigBytes[0], sigBytes[1]);
      if (sig === 'BD') {
        entries.add(segment.getSegment('volume/hfs'));
      }
      else if (sig === 'H+') {
        entries.add(segment.getSegment('volume/hfs-plus'));
      }
      else if (sig === 'HX') {
        entries.add(segment.getSegment('volume/hfs-plus; variant=case-sensitive'));
      }
    }, NO_OP);
    
    var maybeFAT = segment.getBytes(0, 36).then(function(raw) {
      if (raw[0] !== 0xEB || raw[1] < 0x34 || raw[2] !== 0x90) {
        return;
      }
      entries.add(segment.getSegment('volume/fat'));
    }, NO_OP);
    
    return Promise.all([
      maybeHFS,
      maybeFAT,
    ]);
    
  }
  
  return {
    split: split,
  };

});
