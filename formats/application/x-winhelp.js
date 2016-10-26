define(['Format'], function(Format) {

  'use strict';
  
  var headerFormat = Format('chunk/winhelp', {which:'header'});
  var directoryHeaderFormat = Format('chunk/winhelp', {which:'directory-header'});
  
  function split(segment, entries) {
    var context = this;
    return segment.getStruct(headerFormat).then(function(header) {
      if (!header.hasValidSignature) {
        return Promise.reject('winhelp file signature not found');
      }
      return segment.getStruct(directoryHeaderFormat, header.internalDirectoryOffset)
      .then(function(internalDirectoryHeader) {
        
      });
    });
  }
  
  return {
    splitTo: Format('chunk/winhelp'),
    split: split,
  };

});
