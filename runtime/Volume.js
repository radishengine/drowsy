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
    getSubVolume: function(path) {
      return new SubVolume(this, path);
    },
  };
  
  function SubVolume(volume, path) {
    this.volume = volume;
    this.path = path;
  };
  SubVolume.prototype = {
    get charset() {
      return this.volume.charset;
    },
    get pathSeparator() {
      return this.volume.pathSeparator();
    },
    joinPath: function(parts) {
      return this.volume.joinPath(parts);
    },
    splitPath: function(path) {
      return this.volume.splitPath(parts);
    },
    addFile: function(path, segment) {
      this.volume.addFile(this.path + path, segment);
    },
    guessTypeForFilename: function(filename) {
      return this.volume.guessTypeForFilename(filename);
    },
    getSubVolume: function(path) {
      return this.volume.getSubVolume(this.path + path);
    },
  };
  
  Volume.normalizedPathSeparator = '/';
  Volume.normalizedPathPartPattern = /^(?:[^\-_\.!~\*'\(\)]+|%[0-9a-fA-F]{2})+$/;
  Volume.normalizedPathPattern = /^(?:[^\-_\.!~\*'\(\)]+|%[0-9a-fA-F]{2})+(?:\/(?:[^\-_\.!~\*'\(\)]+|%[0-9a-fA-F]{2})+)*$/;
  
  Volume.SubVolume = SubVolume;
  
  return Volume;

});
