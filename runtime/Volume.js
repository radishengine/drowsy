define(['typeServices/dispatch'], function(dispatch) {

  'use strict';
  
  function Volume() {
    this.files = {};
  }
  Volume.prototype = {
    charset: 'utf-8',
    pathSeparator: '/',
    joinPath: function(parts) {
      return parts.join(this.pathSeparator);
    },
    splitPath: function(path) {
      return path.split(this.pathSeparator);
    },
    addFile: function(path, segment) {
      this.files[path] = segment;
      this.onfile(path, segment);
    },
    onfile: function(){},
    guessTypeForFilename: function(filename) {
      var ext = filename.match(/[^\.\/\\\:]*$/)[0].toLowerCase();
      return dispatch.byExtension[ext] || 'application/octet-stream';
    },
  };
  
  return Volume;

});
