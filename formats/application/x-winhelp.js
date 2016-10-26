define(['Format'], function(Format) {

  'use strict';
  
  var headerFormat = Format('chunk/winhelp', {which:'header'});
  
  function split(segment, entries) {
    var context = this;
    return segment.getStruct(headerFormat).then(function(header) {
      if (!header.hasValidSignature) {
        return Promise.reject('winhelp file signature not found');
      }
    });
  }
  
  return {
    splitTo: Format('chunk/winhelp'),
    split: split,
  };

});
