define(['../dispatch'], function(dispatch) {

  'use strict';
  
  function split_contents(formatVersion, segment, entries, offset) {
    switch (formatVersion) {
      default: return Promise.reject('unsupported format version: ' + formatVersion);
      case 6:
        return segment.getBytes(offset + 8, 2).then(function(count) {
          count = count[0] | (count[1] << 8);
          var totalSize = 6 /* signature */
            + 1 /* modifier */
            + 1 /* padding? */
            + 2 /* file count */
            + 13 /* password dooberry */
            + count*13 /* file names */
            + count*4 /* file lengths */
            + count*2 /* flags & ratio */;
          var fileListSegment = segment.getSegment(
            'chunk/ags; which=file-list-v6; base=' + (offset + totalSize),
            offset,
            totalSize);
          entries.add(fileListSegment);
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
      case 20:
        return segment.getDataView(0, 5).then(function(dv) {
          if (dv.getUint8(0) !== 0) return Promise.reject('not first datafile in chain');
          var pos = 5;
          function doFileNames(fileCount) {
            if (fileCount === 0) return;
            return segment.getInt16(pos, true)
            .then(function(nameLength) {
              nameLength = (nameLength / 5) | 0;
              pos += 4 + nameLength;
              return doFileNames(fileCount - 1);
            });
          }
          function doFiles(fileCount) {
            return doFileNames(fileCount).then(function() {
              pos += fileCount*4 + fileCount*4 + fileCount;
            });
          }
          function doContainers(containerCount) {
            if (containerCount === 0) {
              return segment.getInt32(pos, true).then(function(fileCount) {
                pos += 4;
                doFiles(fileCount);
              });
            }
            function onByte(b) {
              pos++;
              if (b === 0) return doContainers(containerCount - 1);
              return segment.getUint8(pos).then(onByte);
            }
            return segment.getUint8(pos).then(onByte);
          }
          return doContainers(dv.getUint32(1, true))
          .then(function() {
            entries.add(segment.getSegment('chunk/ags; which=file-list-v' + formatVersion), 0, pos);
          });
        });
    }
  }
  
  function split_prefix(segment, entries, offset) {
    return segment.getBytes(offset, 6).then(function(prefix) {
      if (String.fromCharCode(prefix[0], prefix[1], prefix[2], prefix[3]) !== 'CLIB') {
        return Promise.reject('resource package signature not found');
      }
      return split_contents(
        prefix[5],
        segment.getSegment(segment.typeName + '; body-version=' + prefix[5]),
        entries,
        offset);
    });
  }
  
  function split_suffix(segment, entries) {
    return segment.getBytes('suffix', 16).then(function(suffix) {
      var signature = String.fromCharCode.apply(null, suffix.subarray(4, 16));
      if (signature !== 'CLIB\x01\x02\x03\x04SIGE') {
        return Promise.reject('resource package signature not found');
      }
      var offset = (suffix[0] | (suffix[1] << 8) | (suffix[2] << 16) | (suffix[3] << 24)) >>> 0;
      return split_prefix(segment, entries, offset);
    });
  }
  
  function split(segment, entries) {
    var bodyVersion = segment.getTypeParameter('body-version');
    if (bodyVersion) return split_contents(bodyVersion, segment, entries, 0);
    
    var mode = segment.getTypeParameter('mode');
    if (mode === 'prefix') return split_prefix(segment, entries, 0);
    if (mode === 'suffix') return split_suffix(segment, entries);
    
    return split_prefix(segment, entries, 0).then(null, function() {
      return split_suffix(segment, entries);
    });
  }
  
  function mount(containerSegment, volume) {
    var promiseChain = Promise.resolve();
    return containerSegment.split(function(chunk) {
      if (chunk.typeName === 'chunk/ags' && chunk.getTypeParameter('which') === 'file-list-v6') {
        var base = chunk.getTypeParameter('base');
        if (!base) {
          throw new Error('base must be set');
        }
        base = +base;
        promiseChain = promiseChain.then(
        chunk.getStruct()
        .then(function(fileList) {
          for (var i = 0; i < fileList.fileRecords.length; i++) {
            var file = fileList.fileRecords[i];
            var fileType;
            var ext = file.name.match(/[^\.]*$/)[0].toLowerCase();
            switch (ext) {
              case 'crm':
                fileType = 'application/x-ags-room';
                break;
              case 'mid':
                fileType = 'audio/midi';
                break;
              case 'wav':
                fileType = 'audio/x-wav';
                break;
              case 'dta':
                fileType = 'application/x-ags-game';
                break;
              case 'spr':
                fileType = 'application/x-ags-sprite-pack';
                break;
              case 'wfn':
                fileType = 'application/x-ags-font';
                break;
              case 'dat':
                if (/^aclang.*\.dat$/i.test(file.name)) {
                  fileType = 'application/x-ags-translation';
                  break;
                }
                else {
                  console.log('unknown file: ' + file.name);
                  fileType = 'application/octet-stream';
                }
                break;
              default:
                fileType = dispatch.byExtension[ext] || 'application/octet-stream';
                console.log('unknown file: ' + file.name);
                break;
            }
            volume.addFile(containerSegment.getSegment(fileType, file.byteOffset, file.byteLength));
          }
        }));
      }
      else {
        console.log('unsupported: ' + chunk.type);
      }
    },
    function() {
      return promiseChain;
    });
  }
  
  return {
    split: split,
    mount: mount,
  };

});
