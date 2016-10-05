define(function() {

  'use strict';
  
  function NO_OP(){}
  
  function split(segment, entries) {
  
    var macPartitioned = segment.getBytes(512, 4).then(function(sig) {
      if (String.fromCharCode(sig[0], sig[1], sig[2], sig[3]) !== 'PM\0\0') {
        return;
      }
      return segment.getSegment('volume/mac-partitioned').split();
    }, NO_OP);
    
    var iso9660 = segment.getBytes(2048 * 16 + 1, 5).then(function(sig) {
      if (String.fromCharCode(sig[0], sig[1], sig[2], sig[3], sig[4]) !== 'CD001') {
        return;
      }
      return segment.getSegment('volume/iso-9660').split();
    }, NO_OP);
    
    return Promise.all([
      macPartitioned,
      iso9660,
    ]);
    
  }
  
  return {
    split: split,
  };

});
