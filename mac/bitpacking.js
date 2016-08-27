define(function() {

  'use strict';

  return {
    unpackBits: function(buffer, byteOffset, byteLength) {
      var packed = new Int8Array(buffer, byteOffset, byteLength);
      var pos = 0;
      var buf = [];
      while (pos < packed.length) {
        if (packed[pos] >= 0) {
          var length = packed[pos++] + 1;
          for (var i = 0; i < length; i++) {
            buf.push(packed[pos++]);
          }
        }
        else {
          if (packed[pos] > -128) {
            var count = 1 - packed[pos++];
            for (var i = 0; i < count; i++) {
              buf.push(packed[pos]);
            }
          }
          pos++;
      	}
      }
      return new Uint8Array(new Int8Array(buf).buffer, 0, buf.length);
    },
  };

});
