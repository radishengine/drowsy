define(function() {

  'use strict';
  
  var utf8 = {};
  
  if ('TextDecoder' in window) {
    var decoder = new TextDecoder('utf-8');
    utf8.decode = function(bytes, offset, length) {
      if (arguments.length === 3) {
        bytes = bytes.subarray(offset, offset + length);
      }
      else if (arguments.length === 2) {
        bytes = bytes.subarray(offset);
      }
      return decoder.decode(bytes);
    };
  }
  else {
    // TODO: implement a fallback
    throw new Error('TextDecoder required for UTF-8 decoding');
  }
  
  return utf8;

});
