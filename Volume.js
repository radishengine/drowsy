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
    this.pathList = [ALL_PATHS];
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
      var pathList = this.pathList;
      var i_first = 0, i_last = pathList.length;
      while (i_first < i_last) {
        var i = Math.floor((i_first + i_last) / 2);
        var cmp = this.pathCompare(paths.lastPath, pathList[i].firstPath);
        if (cmp < 0 || (cmp === 0 && (paths.excludeLastPath || pathList[i].excludeFirstPath))) {
          i_last = i - 1;
          continue;
        }
        cmp = this.pathCompare(paths.firstPath, pathList[i].lastPath);
        if (cmp > 0 || (cmp === 0 && (paths.excludeFirstPath || pathList[i].excludeLastPath))) {
          i_first = i + 1;
          continue;
        }
      }
    },
    pathCompare: function(p1, p2) {
      for (var i = 0, i_max = Math.max(p1.length, p2.length); i < i_max; i++) {
        var part1 = p1[i] || '', part2 = p2[i] || '';
        if (part1 < part2) return -1;
        if (part1 > part2) return 1;
      }
      return 0;
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
