define(['Format'], function(Format) {

  'use strict';
  
  function NO_OP(){}
  
  function split(segment, entries) {
  
    /*
    var macPartitioned = segment.getBytes(512, 4).then(function(sig) {
      if (String.fromCharCode(sig[0], sig[1], sig[2], sig[3]) !== 'PM\0\0') {
        return;
      }
      entries.add(segment.getSegment('volume/mac-partitioned'));
    }, NO_OP);
    */
    
    var iso9660 = segment.getBytes(2048 * 16 + 1, 5).then(function(sig) {
      if (String.fromCharCode(sig[0], sig[1], sig[2], sig[3], sig[4]) !== 'CD001') {
        return;
      }
      segment.getSegment('iso-9660/partitioned').split(function(entry) {
        entries.add(entry);
      });
    }, NO_OP);
    
    return Promise.all([
      //macPartitioned,
      iso9660,
    ]);
    
  }
  
  function mount(segment, volume) {
    return segment.split().then(function(parts) {
      if (parts.length === 0) return Promise.reject('No disk volume found');
      return parts[0].mount(volume);
    });
  }
  
  return {
    splitTo: Format('volume/mac-partitioned').or('iso-9660/partitioned'),
    split: split,
    mount: mount,
  };

});
