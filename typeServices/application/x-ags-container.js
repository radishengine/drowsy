define(['../dispatch'], function(dispatch) {

  'use strict';
  
  function split_contents(formatVersion, segment, entries) {
    switch (formatVersion) {
      default: return Promise.reject('unsupported format version: ' + formatVersion);
      case 6:
        return segment.getBytes(2, 2).then(function(count) {
          count = count[0] | (count[1] << 8);
          var totalSize = 1 /* modifier */
            + 1 /* padding? */
            + 2 /* file count */
            + 13 /* password dooberry */
            + count*13 /* file names */
            + count*4 /* file lengths */
            + count*2 /* flags & ratio */;
          var fileListSegment = segment.getSegment('chunk/ags; which=file-list-v6', 0, totalSize);
          entries.add(fileListSegment);
          return fileListSegment.getStruct().then(function(fileList) {
            var offset = totalSize;
            for (var i = 0; i < fileList.files.length; i++) {
              var file = fileList.files[i];
              var ext = file.name.match(/[^\.]*$/)[1].toLowerCase();
              var type = dispatch.byExtension[ext] || 'application/octet-stream';
              entries.add(segment.getSegment(type, offset, file.byteLength);
              offset += file.byteLength;
            }
          });
        });
      case 10:
      case 11:
      case 15:
        return segment.getBytes(0, 5).then(function(bytes) {
          if (bytes[0] !== 0) return Promise.reject('not first datafile in chain');
          var containerCount = (bytes[1] | (bytes[2] << 8) | (bytes[3] << 16) | (bytes[4] << 24)) >>> 0;
          return segment.getBytes(1 + 4 + 20*containerCount, 4).then(function(bytes) {
            var fileCount = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
            var totalSize = 1 + 4 + 20*containerCount + 4 + 25*fileCount + 4*fileCount + 4*fileCount + fileCount;
            entries.add(segment.getSegment('chunk/ags; which=file-list-v' + formatVersion, 0, totalSize));
          });
        });
    }
  }
  
  function split_prefix(segment, entries) {
    return segment.getBytes(0, 6).then(function(prefix) {
      if (String.fromCharCode(prefix[0], prefix[1], prefix[2], prefix[3]) !== 'CLIB') {
        return Promise.reject('resource package signature not found');
      }
      return split_contents(
        prefix[5],
        segment.getSegment(segment.typeName + '; body-version=' + prefix[5]),
        entries);
    });
  }
  
  function split_suffix(segment, entries) {
    return segment.getBytes('suffix', 16).then(function(suffix) {
      var signature = String.fromCharCode.apply(null, suffix.subarray(0, 12));
      if (signature !== 'CLIB\x01\x02\x03\x04SIGE') {
        return Promise.reject('resource package signature not found');
      }
      var offset = (suffix[12] | (suffix[13] << 8) | (suffix[14] << 16) | (suffix[15] << 16)) >>> 0;
      return split_prefix(segment.getSegment(segment.typeName + '; mode=prefix', offset), entries);
    });
  }
  
  function split(segment, entries) {
    var bodyVersion = +segment.getTypeParameter('body-version');
    if (!isNaN(bodyVersion)) return split_contents(bodyVersion, segment, entries);
    
    var mode = segment.getTypeParameter('mode');
    if (mode === 'prefix') return split_prefix(segment, entries);
    if (mode === 'suffix') return split_suffix(segment, entries);
    
    return split_prefix(segment, entries).then(null, function() {
      return split_suffix(segment, entries);
    });
  }
  
  return {
    split: split,
  };

});
