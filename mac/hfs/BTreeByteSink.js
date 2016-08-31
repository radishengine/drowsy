define(['mac/hfs/BTreeNodeView'], function(BTreeNodeView) {

  'use strict';
  
  var BLOCK_BYTES = 512;
  
  function BTreeByteSink(byteSource) {
    this.byteSource = byteSource;
  }
  BTreeByteSink.prototype = {
    getRawNode: function(number) {
      var offset = number * BLOCK_BYTES;
      var length = BLOCK_BYTES;
      return this.byteSource.slice(offset, offset+length).getBytes();
    },
    getRootNode: function() {
      return this.getRawNode()
        .then(function(rootBytes) {
          return new BTreeNodeView(rootBytes.buffer, rootBytes.byteOffset);
        });
    },
  };
  
  return BTreeByteSink;

});
