define(function() {

  'use strict';
  
  const ROOT_PATH = Object.freeze([]);
  const LAST_PATH = Object.freeze([-1]);  
  const ALL_PATHS = Object.freeze({
    firstPath: ROOT_PATH,
    excludeFirstPath: false,
    lastPath: LAST_PATH,
    excludeLastPath: false,
    minDepthLevel: 0,
    maxDepthLevel: Infinity,
    length: 0,
  });
  const NO_PATHS = Object.freeze({
    firstPath: ROOT_PATH,
    excludeFirstPath: true,
    lastPath: ROOT_PATH,
    excludeLastPath: true,
    minDepthLevel: -1,
    maxDepthLevel: -1,
  });
  
  function Volume() {
    this.paths = [ALL_PATHS];
  }
  Volume.prototype = {
    getPaths: function(paths) {
      if (typeof paths === 'string') {
        paths = this.decodePathRange(paths);
      }
      if (typeof paths.firstPath === 'undefined') {
        if (typeof paths.length !== 'number' || typeof paths !== 'object' || paths === null) {
          throw new Error('invalid path range');
        }
        paths = Object.freeze({
          firstPath: paths,
          excludeFirstPath: false,
          lastPath: paths,
          excludeLastPath: false,
          minDepthLevel: paths.length,
          maxDepthLevel: paths.length,
        });
      }
    },
    decodePathRange: function(encoded) {
      var path = this.decodePath(encoded);
      return Object.freeze({
        firstPath: path,
        excludeFirstPath: false,
        lastPath: path,
        excludeLastPath: false,
        minDepthLevel: path.length,
        maxDepthLevel: path.length,
      });
    },
    decodePath: function(encoded) {
      return encoded.split(/\//g);
    },
    encodePathPart: function(nameOrOrdinal) {
      if (typeof nameOrOrdinal === 'number') {
        return '[' + nameOrOrdinal + ']';
      }
      return encodeURIComponent(nameOrOrdinal);
    },
    setMetadata: function(paths, name, value) {
      
    },
  };
  
  return Volume;

});
