define(['../chunk/iso-9660'], function(chunkTypes) {

  'use strict';
  
  function split_descriptors(segment, entries) {
    function doVolumeDescriptor(n) {
      var descriptorSegment = segment.getSegment('chunk/iso-9660; which=volume-descriptor', 2048 * (0x10 + n), 2048);
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
            type += '; root=' + descriptor.body.rootDirectory.dataBlockAddress
              + ',' + descriptor.body.rootDirectory.dataByteLength;
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
    var root = (segment.getTypeParameter('root') || '').match(/^(\d+)\s*,\s*(\d+)$/);
    if (!root) return Promise.reject('root must be specified as a block,length pair');
    var blockSize = +(segment.getTypeParameter('block-size') || 2048);
    function doFolder(blockNumber, byteLength, parentBlockNumber) {
      return segment.getBytes(blockNumber * blockSize, byteLength)
      .then(function(raw) {
        var promises;
        for (var pos = 0; pos < raw.length; ) {
          if (raw[pos] === 0) {
            pos += blockSize - (pos % blockSize);
            if (pos >= raw.length) break;
          }
          var record = new chunkTypes.VolumeDescriptorView(
            raw.buffer,
            raw.byteOffset + pos,
            raw.byteLength - pos);
          if (record.dataBlockAddress === blockNumber) {
            entries.add(segment.getSegment(
              'chunk/iso-9660; which=folder; parent=' + parentBlockNumber,
              (blockNumber * blockSize) + pos,
              record.byteLength));
          }
          else if (!record.isDirectory) {
            entries.add(segment.getSegment(
              'chunk/iso-9660; which=file; parent=' + blockNumber,
              (blockNumber * blockSize) + pos,
              record.byteLength));
          }
          else if (record.dataBlockAddress !== parentBlockNumber) {
            if (!promises) promises = [];
            promises.push(doFolder(
              record.dataBlockAddress,
              record.dataByteLength,
              blockNumber));
          }
          pos += record.byteLength;
        }
        if (promises) return Promise.all(promises);
      });
    }
    return doFolder(+root[1], +root[2], -1);
  }
  
  function split(segment, entries) {
    if (segment.getTypeParameter('root') !== null) {
      return split_directory_tree(segment, entries);
    }
    return split_descriptors(segment, entries);
  }
  
  function mount(segment, volume) {
    var gotPrimaryVolumeSegment;
    if (segment.getTypeParameter('root')) {
      gotPrimaryVolumeSegment = Promise.resolve(segment);
    }
    else {
      gotPrimaryVolumeSegment = new Promise(function(resolve, reject) {
        segment.split(function(segment) {
          if (resolve !== null
          && segment.typeName === 'volume/iso-9660'
          && segment.getTypeParameter('volume') === 'primary') {
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
      var blockSize = +(primaryVolumeSegment.getTypeParameter('block-size') || 2048);
      var promiseChain = Promise.resolve(null);
      var parentPaths = {};
      parentPaths['-1'] = '';
      return primaryVolumeSegment.split(function(entry) {
        var parentID = entry.getTypeParameter('parent');
        if (entry.getTypeParameter('which') === 'folder') {
          promiseChain = promiseChain.then(function() {
            return entry.getStruct()
            .then(function(folderInfo) {
              parentPaths[folderInfo.dataBlockAddress] = parentPaths[parentID] + encodeURIComponent(folderInfo.name) + '/';
            });
          });
        }
        else {
          promiseChain = promiseChain.then(function() {
            return entry.getStruct()
            .then(function(fileInfo) {
              var name = folderInfo.name;
              var type = volume.guessTypeFromFilename(name);
              var path = parentPaths[parentID] + encodeURIComponent(name);
              volume.addFile(name, segment.getSegment(type, fileInfo.dataBlockAddress * blockSize, fileInfo.dataByteLength));
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
