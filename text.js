define(function() {

  'use strict';
  
  var text = {};
  
  if ('TextDecoder' in window) {
    var utf8 = new TextDecoder('utf-8');
    text.decodeUTF8 = function(bytes, offset, length) {
      if (arguments.length === 3) {
        bytes = bytes.subarray(offset, offset + length);
      }
      else if (arguments.length === 2) {
        bytes = bytes.subarray(offset);
      }
      return utf8.decode(bytes);
    };
    var iso8859_1 = new TextDecoder('iso-8859-1');
    text.decodeByteString = function(bytes, offset, length) {
      if (arguments.length === 3) {
        bytes = bytes.subarray(offset, offset + length);
      }
      else if (arguments.length === 2) {
        bytes = bytes.subarray(offset);
      }
      return iso8859_1.decode(bytes);
    };
  }
  else {
    text.decodeByteString = function(bytes, offset, length) {
      if (arguments.length === 3) {
        bytes = bytes.subarray(offset, offset + length);
      }
      else if (arguments.length === 2) {
        bytes = bytes.subarray(offset);
      }
      return String.fromCharCode.apply(null, bytes);
    };
    // TODO: implement a fallback
    throw new Error('TextDecoder required for UTF-8 decoding');
  }
  
  return text;

});
