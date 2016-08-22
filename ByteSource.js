define([], function() {

  'use strict';
  
  function ByteSource() {
  }
  
  function ByteSourceFromBlob(blob) {
    this.blob = blob;
  }
  (function(proto) {
    proto.slice = function() {
      return new BlobByteSource(this.blob.slice.apply(this.blob, arguments));
    };
    proto.read = function(reader) {
      var fr = new FileReader();
      fr.addEventListener('load', function() {
        if (typeof reader.onbytes === 'function') {
          reader.onbytes(new Uint8Array(fr.result));
        }
        if (typeof reader.oncomplete === 'function') {
          reader.oncomplete();
        }
      });
      fr.readAsArrayBuffer(this.blob);
    };
  })(ByteSourceFromBlob.prototype = new ByteSource);
  
  ByteSource.FromBlob = ByteSourceFromBlob;
  
  ByteSource.from = function(src) {
    if (src instanceof ByteSource) return src;
    if (src instanceof Blob) return new ByteSourceFromBlob(src);
    if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) return new ByteSourceFromBlob(new Blob([src]));
    throw new TypeError('value not supported for creating ByteSource: ' + (typeof src === 'object' ? src : typeof src));
  };
  
  return ByteSource;
  
});
