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
    load: function(segment) {
      switch (segment.typeName) {
        case 'application/zip': return this.loadZip(segment);
        default: return Promise.reject('Cannot load volume from ' + segment.typeName);
      }
    },
    loadZip: function(zip) {
      var promises = [];
      var self = this;
      return zip.split(
        function(entry) {
          if (entry.getTypeParameter('type') !== 'local') return;
          promises.push(entry.getStruct().then(function(record) {
            var ext = record.path.match(/[^\.]*$/)[0].toLowerCase();
            var type = dispatch.byExtension[ext] || 'application/octet-stream';
            if (record.compressionMethod !== 'none') {
              var innerType = type;
              switch (record.compressionMethod) {
                case 'shrunk': type = 'application/x-lzw; variant=shrink'; break;
                case 'factor1': type = 'application/x-reduced; factor=1'; break;
                case 'factor2': type = 'application/x-reduced; factor=2'; break;
                case 'factor3': type = 'application/x-reduced; factor=3'; break;
                case 'factor4': type = 'application/x-reduced; factor=4'; break;
                case 'imploded': type = 'application/x-ibm-terse; variant=old'; break;
                case 'deflated': type = 'application/x-deflated'; break;
                case 'enhancedDeflated': type = 'application/x-deflated; variant=deflate64'; break;
                case 'dclImploded': type = 'application/x-imploded; variant=dcl'; break;
                case 'bzip2': type = 'application/x-bzip2'; break;
                case 'lzma': type = 'application/x-lzma'; break;
                case 'terse': type = 'application/x-ibm-terse; variant=new'; break;
                case 'lz77': type = 'application/x-lz77'; break;
                case 'jpeg': type = 'image/jpeg'; break;
                case 'wavpack': type = 'audio/x-wavpack'; break;
                case 'ppmd': type = 'application/x-ppmd; version=i; rev=1'; break;
                case 'aes': type = 'application/x-aes'; break;
                default: return Promise.reject('unknown compression: ' + record.compressionMethod);
              }
              type += '; type='+innerType;
              var full = record.uncompressedByteLength32; // TODO: zip64
              type += '; full='+full;
            }
            self.addFile(entry.path, entry.getSegment(type, entry.byteLength));
          }));
        },
        function() {
          return Promise.all(promises);
        });
    },
    addFile: function(path, segment) {
      this.files[path] = segment;
      this.onfile(path, segment);
    },
    onfile: function(){},
  };
  
  return Volume;

});
