define(['mac/hfs/BTreeNodeView'], function(BTreeNodeView) {

  'use strict';
  
  var BLOCK_BYTES = 512;
  
  function BTreeByteSink(byteSource) {
    this.byteSource = byteSource;
  }
  BTreeByteSink.prototype = {
    getRawNode: function(number) {
      return this.byteSource.slice(
        number * BLOCK_BYTES,
        (number + 1) * BLOCK_BYTES).getBytes();
    },
    getNode: function(number) {
      return this.getRawNode(number)
      .then(function(rawNode) {
        return new BTreeNodeView(rawNode.buffer, rawNode.byteOffset, rawNode.byteLength);
      });
    },
    getHeaderNode: function() {
      var promise = this.getNode(0)
      .then(function(node) {
        if (node.nodeType !== 'header') return Promise.reject('node zero is not a header node');
        return node;
      });
      this.getHeaderNode = function(){ return promise; };
      return promise;
    },
    getFirstLeafNode: function() {
      var self = this;
      var promise = this.getHeaderNode()
      .then(function(node) {
        return self.getNode(node.records[0].firstLeaf);
      });
      this.getFirstLeafNode = function(){ return promise; };
      return promise;
    },
    getRootNode: function() {
      var self = this;
      var promise = this.getHeaderNode()
      .then(function(node) {
        return self.getNode(node.records[0].rootNodeNumber);
      });
      this.getRootNode = function(){ return promise; };
      return promise;
    },
    findLeafForParentFolderID: function(parentFolderID) {
      var self = this;
      function onNode(node) {
        if (node.nodeType === 'leaf') return node;
        if (node.nodeType !== 'index') return Promise.reject('node is not a leaf or index');
        for (var i = node.records.length - 1; i >= 0; i--) {
          if (parentFolderID >= node.records[i].parentFolderID) {
            return self.getNode(records[i].nodeNumber).then(onNode);
          }
        }
        return Promise.reject('parent folder ID not found: ' + parentFolderID);
      }
      return this.getRootNode().then(onNode);
    },
  };
  
  return BTreeByteSink;

});
