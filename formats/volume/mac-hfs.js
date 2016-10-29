define(['Format', 'formats/dispatch', 'DataSegment'], function(Format, dispatch, DataSegment) {
  
  'use strict';
  
  const MDB_FMT = Format('chunk/mac-hfs', {which:'master-directory-block'});
  
  function getSegmentFromExtents(allocationSegment, chunkSize, type, byteLength, extents) {
    if (byteLength === 0) return new DataSegment.Empty(type);
    if (byteLength <= chunkSize * extents[0].length) {
      return allocationSegment.getSegment(type, chunkSize * extents[0].offset, byteLength);
    }
    var list = [], i = 0;
    do {
      if (i > extents.length) throw new Error('insufficient space in extents');
      var offset = chunkSize * extents[i].offset, len = Math.min(byteLength, chunkSize * extents[i].length);
      list.push(allocationSegment.getSegment(allocationSegment.type, offset, len));
      byteLength -= len;
      i++;
    } while (byteLength > 0);
    return DataSegment.from(list, type);
  }
  
  function split(segment, entries) {
    var mdbSegment = segment.getSegment(MDB_FMT, 512 * 2, 512);
    return mdbSegment.getStruct()
    .then(function(masterDirectoryBlock) {
      if (!masterDirectoryBlock.hasValidSignature) {
        return Promise.reject('not an HFS volume');
      }
      entries.add(mdbSegment);
      /*
      var allocationType = 'chunk/mac-hfs; which=allocation';
      var allocChunkSize = masterDirectoryBlock.allocationChunkByteLength;
      allocationType += '; chunk=' + allocChunkSize;
      var allocSegment = segment.getSegment(allocationType,
        masterDirectoryBlock.firstAllocationBlock * 512,
        masterDirectoryBlock.allocationChunkCount * masterDirectoryBlock.allocationChunkByteLength);
      entries.add(allocSegment);
      entries.add(getSegmentFromExtents(
        allocSegment,
        allocChunkSize,
        'chunk/mac-hfs-btree; tree=catalog',
        masterDirectoryBlock.catalogFileByteLength,
        masterDirectoryBlock.catalogFileExtentRecord));
      entries.add(getSegmentFromExtents(
        allocSegment,
        allocChunkSize,
        'chunk/mac-hfs-btree; tree=overflow',
        masterDirectoryBlock.extentsOverflowFileByteLength,
        masterDirectoryBlock.extentsOverflowFileExtentRecord));
      */
    });
  }
  
  function mount(segment, volume) {
    return segment.split().then(function(parts) {
      var mdb, allocation, catalog, overflow, chunkSize;
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].format.name === 'chunk/mac-hfs') {
          switch (parts[i].format.parameters['which']) {
            case 'master-directory-block':
              mdb = parts[i];
              break;
            case 'allocation':
              allocation = parts[i];
              chunkSize = +allocation.format.parameters['chunk'];
              if (isNaN(chunkSize)) return Promise.reject('chunk parameter must be set on allocation table');
              break;
          }
        }
        else if (parts[i].format.name === 'chunk/mac-hfs-btree') {
          switch(parts[i].getTypeParameter('tree')) {
            case 'catalog': catalog = parts[i]; break;
            case 'overflow': overflow = parts[i]; break;
          }
        }
      }
      if (!(mdb && allocation && catalog && overflow)) {
        return Promise.reject('HFS split did not yield mdb, allocation, catalog and overflow');
      }
      var parentPaths = {};
      parentPaths[0] = '';
      parentPaths[1] = '';
      parentPaths[2] = '$EXTENTS/';
      parentPaths[3] = '$CATALOG/';
      parentPaths[4] = '$BADALLOC/';
      
      var lastOverflowLeaf = null, nextLeafRecord_i = 0;
      function getOverflowExtents(fileID, dataBlockCount, resourceBlockCount) {
        if (lastOverflowLeaf === null) {
          var overflowHeaderSegment = overflow.getSegment('chunk/mac-hfs-btree; tree=overflow; node=header', 0, 512);
          lastOverflowLeaf = overflowHeaderSegment.getStruct().then(function(overflowHeader) {
            if (overflowHeader.firstLeaf === 0) return Promise.reject('no leaf found');
            var firstLeafSegment = overflow.getSegment(
              'chunk/mac-hfs-btree; tree=overflow; node=leaf',
              overflowHeader.firstLeaf * 512,
              512);
            return firstLeafSegment.getStruct();
          });
        }
        var result = {dataExtents:[], resourceExtents:[]};
        function onOverflowLeaf(leaf) {
          for (; nextLeafRecord_i < leaf.records.length; nextLeafRecord_i++) {
            var record = leaf.records[nextLeafRecord_i];
            if (record.overflowFileID === 5) {
              // file ID 5 is used for bad block
              continue;
            }
            if (record.overflowFileID < fileID) {
              if (record.overflowExtentDataRecord[0].length !== 0) {
                return Promise.reject('unretrieved extents for file ' + record.overflowFileID);
              }
              continue;
            }
            if (record.overflowFileID > fileID) {
              return Promise.reject('missing extents for file ' + fileID);
            }
            var addMe = record.overflowExtentDataRecord;
            switch (record.overflowForkType) {
              case 'data':
                var addTo = result.dataExtents;
                for (var i = 0; i < addMe.length; i++) {
                  addTo.push(addMe[i]);
                  dataBlockCount -= addMe[i].length;
                }
                if (dataBlockCount <= 0) {
                  nextLeafRecord_i++;
                  return result;
                }
                break;
              case 'resource':
                var addTo = result.resourceExtents;
                for (var i = 0; i < addMe.length; i++) {
                  addTo.push(addMe[i]);
                  resourceBlockCount -= addMe[i].length;
                }
                if (resourceBlockCount <= 0) {
                  nextLeafRecord_i++;
                  return result;
                }
                break;
              default: return Promise.reject('unknown overflow record fork type');
            }
          }
          if (leaf.nextNodeNumber === 0) {
            return Promise.reject('missing extents for file ' + fileID);
          }
          var nextLeafSegment = overflow.getSegment(
            'chunk/mac-hfs-btree; tree=overflow; node=leaf',
            leaf.nextNodeNumber * 512,
            512);
          nextLeafRecord_i = 0;
          return (lastOverflowLeaf = nextLeafSegment.getStruct()).then(onLeaf);
        }
        return lastOverflowLeaf.then(onOverflowLeaf);
      }
      
      var promiseChain = Promise.resolve(null);
      
      function onLeaf(leaf) {
        for (var i = 0; i < leaf.records.length; i++) {
          var record = leaf.records[i];
          if (!/^(folder|file)$/.test(record.leafType)) continue;
          var parentPath = parentPaths[record.parentFolderID];
          var path = parentPath + encodeURIComponent(record.name);
          if (record.leafType === 'folder') {
            parentPaths[record.folderInfo.id] = path + '/';
            continue;
          }
          var dataFork = record.fileInfo.dataForkInfo;
          var resourceFork = record.fileInfo.resourceForkInfo;
          var type = record.fileInfo.type;
          if (type) {
            type = dispatch.byMacFileType[type] || ('application/octet-stream; mac-type=' + encodeURIComponent(type));
          }
          else {
            type = 'application/octet-stream';
          }
          var creator = record.fileInfo.creator;
          if (creator) {
            type += '; mac-creator=' + encodeURIComponent(creator);
          }
          var dataForkExtents, resourceForkExtents, needDataBlocks, needResourceBlocks;
          if (dataFork.logicalEOF === 0) {
            needDataBlocks = 0;
            volume.addFile(path, new DataSegment.Empty(type));
          }
          else {
            dataForkExtents = record.fileInfo.dataForkFirstExtentRecord;
            needDataBlocks = Math.ceil(dataFork.logicalEOF / chunkSize);
            needDataBlocks -= dataForkExtents.reduce(function(total,e){ return total + e.length; }, 0);
            if (needDataBlocks <= 0) {
              var dataForkSegment = getSegmentFromExtents(
                allocation,
                chunkSize,
                type,
                dataFork.logicalEOF,
                dataForkExtents);
              volume.addFile(path, dataForkSegment);
            }
          }
          if (resourceFork.logicalEOF === 0) {
            needResourceBlocks = 0;
          }
          else {
            resourceForkExtents = record.fileInfo.resourceForkFirstExtentRecord;
            needResourceBlocks = Math.ceil(resourceFork.logicalEOF / chunkSize);
            needResourceBlocks -= resourceForkExtents.reduce(function(total,e){ return total + e.length; }, 0);
            if (needResourceBlocks <= 0) {
              var resourceForkSegment = getSegmentFromExtents(
                allocation,
                chunkSize,
                'application/x-mac-resource-fork',
                resourceFork.logicalEOF,
                resourceForkExtents);
              volume.addFile(path + '/resources', resourceForkSegment);
            }
          }
          if (needDataBlocks > 0 || needResourceBlocks > 0) {
            if (needDataBlocks <= 0) dataForkExtents = null;
            if (needResourceBlocks <= 0) resourceForkExtents = null;
            promiseChain = (function(promiseChain, dataForkExtents, resourceForkExtents, record, dataFork, resourceFork, type, path) {
              return promiseChain
              .then(getOverflowExtents(record.fileInfo.id, needDataBlocks, needResourceBlocks))
              .then(function(result) {
                if (dataForkExtents) {
                  dataForkExtents = dataForkExtents.concat(result.dataExtents);
                  var dataForkSegment = getSegmentFromExtents(
                    allocation,
                    chunkSize,
                    type,
                    dataFork.logicalEOF,
                    dataForkExtents);
                  volume.addFile(path, dataForkSegment);
                }
                if (resourceForkExtents) {
                  resourceForkExtents = resourceForkExtents.concat(result.resourceExtents);
                  var resourceForkSegment = getSegmentFromExtents(
                    allocation,
                    chunkSize,
                    'application/x-mac-resource-fork',
                    resourceFork.logicalEOF,
                    resourceForkExtents);
                  volume.addFile(path + '/resources', resourceForkSegment);
                }
              });
            })(promiseChain, dataForkExtents, resourceForkExtents, record, dataFork, resourceFork, type, path);
          }
        }
      }
      
      return catalog.split(function(entry) {
        if (entry.format.parameters['node'] === 'leaf') {
          entry.getStruct().then(onLeaf);
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
    getDisplayName: function getDisplayName(segment) {
      return segment.split(MDB_FMT).then(function(mdbs) {
        if (mdbs.length === 0) {
          return Promise.reject('master directory block not found');
        }
        return mdbs[0].getStruct().then(function(mdb) {
          return mdb.name;
        });
      });
    },
    getTimestamp: function getDisplayName(segment) {
      return segment.split(MDB_FMT).then(function(mdbs) {
        if (mdbs.length === 0) {
          return Promise.reject('master directory block not found');
        }
        return mdbs[0].getStruct().then(function(mdb) {
          return mdb.lastModifiedAt;
        });
      });
    },
  };
  
});
