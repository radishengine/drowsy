define(['../chunk/iso-9660'], function(chunkTypes) {

  'use strict';
  
  function split_descriptors(segment, entries) {
    function doVolumeDescriptor(n) {
      var descriptorOffset = 2048 * (0x10 + n);
      var descriptorSegment = segment.getSegment('chunk/iso-9660; which=volume-descriptor', descriptorOffset, 2048);
      return descriptorSegment.getStruct().then(function(descriptor) {
        if (!descriptor.hasValidSignature) {
          return Promise.reject('ISO 9660 volume descriptor signature not found');
        }
        entries.add(descriptorSegment);
        switch (descriptor.descriptorType) {
          case 'terminator':
            // i.e. don't call doVolumeDescriptor for the next n
            return;
          case 'volume':
            var type = 'volume/iso-9660';
            type += '; volume=' + (descriptor.isPrimaryVolume ? 'primary' : 'supplementary');
            if (descriptor.body.blockByteLength !== 2048) {
              type += '; block-size=' + descriptor.body.blockByteLength;
            }
            type += '; root=' + (descriptorOffset + descriptor.body.offsetof_rootDirectory)
              + ',' + descriptor.body.sizeof_rootDirectory;
            var volumeSegment = segment.getSegment(
              type,
              0,
              descriptor.body.blockByteLength * descriptor.body.blockCount);
            entries.add(volumeSegment);
            return doVolumeDescriptor(n + 1);
          default:
            return doVolumeDescriptor(n + 1);
        }
      });
    }
    return doVolumeDescriptor(0);
  }
  
  function split_directory_tree(segment, entries) {
    var root = (segment.format.parameters['root'] || '').match(/^(\d+)\s*,\s*(\d+)$/);
    if (!root) return Promise.reject('root must be specified as a block,length pair');
    var blockSize = +(segment.format.parameters['block-size'] || 2048);
    var rootFolderSegment = segment.getSegment('chunk/iso-9660; which=folder; parent=-1', +root[1], +root[2]);
    function doFolderSegment(folderSegment, parentBlock) {
      entries.add(folderSegment);
      return folderSegment.getStruct().then(function(folder) {
        var folderBlock = folder.dataBlockAddress;
        return segment.getBytes(blockSize * folderBlock, folder.dataByteLength)
        .then(function(raw) {
          var promises;
          for (var pos = 0; pos < raw.length; ) {
            if (raw[pos] === 0) {
              pos += blockSize - (pos % blockSize);
              if (pos >= raw.length) break;
            }
            var record = new chunkTypes.DirectoryRecordView(
              raw.buffer,
              raw.byteOffset + pos,
              raw.byteLength - pos);
            if (!record.isDirectory) {
              entries.add(segment.getSegment(
                'chunk/iso-9660; which=file; parent=' + folderBlock,
                blockSize * folderBlock + pos,
                record.byteLength));
            }
            else if (record.dataBlockAddress !== parentBlock && record.dataBlockAddress !== folderBlock) {
              var subfolderSegment = segment.getSegment(
                'chunk/iso-9660; which=folder; parent=' + folderBlock,
                blockSize * folderBlock + pos,
                record.byteLength);
              if (!promises) promises = [];
              promises.push(doFolderSegment(subfolderSegment, folderBlock));
            }
            pos += record.byteLength;
          }
          if (promises) return Promise.all(promises);
        });
      });
    }
    return doFolderSegment(rootFolderSegment, -1);
  }
  
  function split(segment, entries) {
    if (segment.format.parameters['root'] !== null) {
      return split_directory_tree(segment, entries);
    }
    return split_descriptors(segment, entries);
  }
  
  function mount(segment, volume) {
    var gotPrimaryVolumeSegment;
    if (segment.format.parameters['root']) {
      gotPrimaryVolumeSegment = Promise.resolve(segment);
    }
    else {
      gotPrimaryVolumeSegment = new Promise(function(resolve, reject) {
        segment.split(function(segment) {
          if (resolve !== null
          && segment.typeName === 'volume/iso-9660'
          && segment.format.parameters['volume'] === 'primary') {
            var _resolve = resolve;
            resolve = null;
            _resolve(segment);
          }
        },
        function() {
          if (resolve !== null) reject('no primary volume found');
        });
      });
    }
    return gotPrimaryVolumeSegment.then(function(primaryVolumeSegment) {
      var blockSize = +(primaryVolumeSegment.format.parameters['block-size'] || 2048);
      var promiseChain = Promise.resolve(null);
      var parentPaths = {};
      return primaryVolumeSegment.split(function(entry) {
        var parentID = entry.format.parameters['parent'];
        if (entry.format.parameters['which'] === 'folder') {
          promiseChain = promiseChain.then(function() {
            return entry.getStruct()
            .then(function(folderInfo) {
              if (+parentID === -1) {
                parentPaths[folderInfo.dataBlockAddress] = '';
                return;
              }
              parentPaths[folderInfo.dataBlockAddress] = parentPaths[parentID] + encodeURIComponent(folderInfo.name) + '/';
            });
          });
        }
        else {
          promiseChain = promiseChain.then(function() {
            return entry.getStruct()
            .then(function(fileInfo) {
              var name = fileInfo.name;
              var type = volume.guessTypeForFilename(name);
              var path = parentPaths[parentID] + encodeURIComponent(name);
              volume.addFile(path, segment.getSegment(type, fileInfo.dataBlockAddress * blockSize, fileInfo.dataByteLength));
            });
          });
        }
      },
      function() {
        return promiseChain;
      });
    });
  }
  
  return {
    split: split,
    mount: mount,
  };

});
