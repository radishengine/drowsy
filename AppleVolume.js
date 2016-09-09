define([
  'itemObjectModel', 'ByteSource', 'mac/roman', 'mac/hfs/BTreeNodeView', 'mac/hfs/PartitionRecordView',
  'mac/hfs/ResourceHeaderView', 'mac/hfs/ResourceMapView', 'mac/hfs/MasterDirectoryBlockView',
  'mac/hfs/BTreeByteSink'],
function(
  itemObjectModel, ByteSource, macintoshRoman, BTreeNodeView, PartitionRecordView,
  ResourceHeaderView, ResourceMapView, MasterDirectoryBlockView,
  BTreeByteSink) {

  'use strict';
  
  var PHYSICAL_BLOCK_BYTES = 512;
  var BTREE_NODE_BYTES = 512;

  function macintoshDate(dv, offset) {
    var offset = dv.getUint32(offset, false);
    if (offset === 0) return null;
    return new Date(new Date(1904, 0).getTime() + offset * 1000);
  }
  
  function nullTerminate(str) {
    return str.replace(/\0.*/, '');
  }
  
  function extentDataRecord(dv, offset) {
    var record = [];
    for (var i = 0; i < 3; i++) {
      record.push({
        offset: dv.getUint16(offset + i*4, false),
        length: dv.getUint16(offset + i*4 + 2, false),
      });
    }
    return record;
  }
  
  function hfsPlusForkData(dv, offset) {
    var forkData = {
      logicalSize1: dv.getUint32(offset, false),
      logicalSize2: dv.getUint32(offset + 4, false),
      clumpSize: dv.getUint32(offset + 8, false),
      totalBlocks: dv.getUint32(offset + 12, false),
      extents: [],
    };
    for (var i = 0; i < 8; i++) {
      forkData.extents.push({
        startBlock: dv.getUint32(offset + 16 + (i * 8), false),
        blockCount: dv.getUint32(offset + 16 + (i * 8) + 4, false),
      });
    }
    return forkData;
  }
  hfsPlusForkData.byteLength = 8 + 4 + 4 + (8 * (4 + 4));

  function AppleVolume(byteSource) {
    this.byteSource = byteSource;
  }
  AppleVolume.prototype = {
    read: function(reader) {
      this.readPartitions(this.byteSource, reader);
    },
    readPartitions: function(byteSource, reader) {
      var self = this;
      function doPartition(n) {
        byteSource.slice(PHYSICAL_BLOCK_BYTES * n, PHYSICAL_BLOCK_BYTES * (n+1)).read({
          onbytes: function(bytes) {
            var partition = new PartitionRecordView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            if (!partition.hasValidTag) {
              if (n === 1) {
                self.readHFS(byteSource, reader);
                return;
              }
              console.error('invalid partition map signature');
              return;
            }
            switch (partition.type) {
              case 'Apple_HFS':
                self.readHFS(
                  byteSource.slice(
                    PHYSICAL_BLOCK_BYTES * partition.blockOffset,
                    PHYSICAL_BLOCK_BYTES * (partition.blockOffset + partition.blockCount)),
                  reader);
                break;
              default:
                break;
            }
            if (typeof reader.onpartition === 'function') {
              reader.onpartition(partition);
            }
            if (n < partition.totalPartitionCount) {
              doPartition(n + 1);
            }
          },
        });
        
      }
      doPartition(1);
    },
    readHFS: function(byteSource, reader) {
      var self = this;
      // first 2 blocks are boot blocks
      var masterDirectoryBlock = byteSource.slice(PHYSICAL_BLOCK_BYTES * 2, PHYSICAL_BLOCK_BYTES * (2+1));
      masterDirectoryBlock.read({
        onbytes: function(bytes) {
          var tag;
          switch(tag = macintoshRoman(bytes, 0, 2)) {
            case 'BD':
              this.onhfs(bytes);
              break;
            case 'H+':
              this.onhfsplus(bytes);
              break;
            default:
              console.error('Unknown master directory block signature: ' + tag);
              break;
          }
        },
        onhfs: function(bytes) {
          var volumeInfo = new MasterDirectoryBlockView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          if (typeof reader.onvolumestart === 'function') {
            reader.onvolumestart(volumeInfo);
          }
          var allocationBlocksAt = PHYSICAL_BLOCK_BYTES * volumeInfo.firstAllocationBlock;
          var allocationBlocksLen = volumeInfo.allocationChunkByteLength * volumeInfo.allocationChunkCount;
          var allocationBlocks = byteSource.slice(allocationBlocksAt, allocationBlocksAt + allocationBlocksLen);
          allocationBlocks.blockSize = volumeInfo.allocationChunkByteLength;
          var catalogExtents = volumeInfo.catalogFileExtentRecord[0];
          catalogExtents = allocationBlocks.slice(
            allocationBlocks.blockSize * catalogExtents.offset,
            allocationBlocks.blockSize * catalogExtents.offset + volumeInfo.catalogFileByteLength);
          catalogExtents.allocationBlocks = allocationBlocks;
          self.readCatalog(catalogExtents, {
            
          });
        },
        onhfsplus: function(bytes) {
          var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          var volumeInfo = {
            version: dv.getUint16(2, false),
            attributes: dv.getUint32(4, false),
            lastMountedVersion: macintoshRoman(bytes, 8, 4),
            journalInfoBlock: dv.getUint32(12, false),
            createdAt: macintoshDate(dv, 16),
            lastModifiedAt: macintoshDate(dv, 20),
            backupAt: macintoshDate(dv, 24),
            fileCount: dv.getUint32(28, false),
            folderCount: dv.getUint32(32, false),
            blockSize: dv.getUint32(36, false),
            totalBlocks: dv.getUint32(40, false),
            freeBlocks: dv.getUint32(44, false),
            nextAllocation: dv.getUint32(48, false),
            resourceClumpSize: dv.getUint32(52, false),
            dataClumpSize: dv.getUint32(56, false),
            nextCatalogId: dv.getUint32(60, false),
            writeCount: dv.getUint32(64, false),
            encodingsBitmap1: dv.getUint32(68, false),
            encodingsBitmap2: dv.getUint32(72, false),
            finderInfo: [
              dv.getInt32(76, false),
              dv.getInt32(80, false),
              dv.getInt32(84, false),
              dv.getInt32(88, false),
              dv.getInt32(92, false),
              dv.getInt32(96, false),
              dv.getInt32(100, false),
              dv.getInt32(104, false),
            ],
            allocationFile: hfsPlusForkData(dv, 108),
            extentsFile: hfsPlusForkData(dv, 108 + hfsPlusForkData.byteLength),
            catalogFile: hfsPlusForkData(dv, 108 + hfsPlusForkData.byteLength * 2),
            attributesFile: hfsPlusForkData(dv, 108 + hfsPlusForkData.byteLength * 3),
            startupFile: hfsPlusForkData(dv, 108 + hfsPlusForkData.byteLength * 4),
          };
        },
      });
    },
    readCatalog: function(byteSource, reader) {
      var btree = new BTreeByteSink(byteSource);
      var allocation = byteSource.allocationBlocks;
      function onFolderPopulate(e) {
        this.removeEventListener(itemObjectModel.EVT_POPULATE, onFolderPopulate);
        this.notifyPopulating(listFolderTo(this.catalogID, this));
      }
      function onFilePopulate(e) {
        this.removeEventListener(itemObjectModel.EVT_POPULATE, onFilePopulate);
        var self = this;
        var dataByteSource;
        this.notifyPopulating(this.resourceForkByteSource.slice(0, ResourceHeaderView.byteLength).getBytes()
        .then(function(headerBytes) {
          var header = new ResourceHeaderView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);
          dataByteSource = self.resourceForkByteSource.slice(header.dataOffset, header.dataOffset + header.dataLength);
          return self.resourceForkByteSource.slice(header.mapOffset, header.mapOffset + header.mapLength).getBytes();
        })
        .then(function(mapBytes) {
          var map = new ResourceMapView(mapBytes.buffer, mapBytes.byteOffset, mapBytes.byteLength);
          map.resourceList.forEach(function(resourceInfo) {
            var idString = (resourceInfo.id < 0)
              ? '-' + ('0000' + (-resourceInfo.id)).slice(-5)
              : '_' + ('0000' +   resourceInfo.id ).slice(-5);
            var titleString = '[' + resourceInfo.type + idString + ']';
            if (resourceInfo.name) titleString += ' ' + resourceInfo.name;
            var itemEl = itemObjectModel.createItem(titleString);
            
            Object.defineProperties(itemEl, {
              resourceID: {
                get: function() {
                  return +this.dataset.resourceId;
                },
              },
            });
            itemEl.dataset.resourceId = resourceInfo.id;
            itemEl.dataset.resourceType = resourceInfo.type;
            
            itemEl.classList.add('invisible');
            
            var promisedByteSource = dataByteSource.slice(
              resourceInfo.dataOffset,
              resourceInfo.dataOffset + 4).getBytes()
            .then(function(lengthBytes) {
              var length = new DataView(
                lengthBytes.buffer,
                lengthBytes.byteOffset,
                lengthBytes.byteLength).getUint32(0, false);
              itemEl.byteSource = dataByteSource.slice(
                resourceInfo.dataOffset + 4,
                resourceInfo.dataOffset + 4 + length);
            });

            var loaderImport = 'mac/resources/open_' + resourceInfo.type.toUpperCase().replace(/[^A-Z0-9]/g, '_');
            
            require(
              [loaderImport],
              function(open) {
                itemEl.startAddingItems();
                function onResourcePopulate() {
                  this.removeEventListener(itemObjectModel.EVT_POPULATE, onResourcePopulate);
                  this.notifyPopulating(
                    promisedByteSource
                    .then(function() {
                      open(itemEl, resourceInfo.type);
                    })
                  );
                }
                promisedByteSource.then(function() {
                  itemEl.addEventListener(itemObjectModel.EVT_POPULATE, onResourcePopulate);
                });
              },
              function() {
              });
            
            self.addItem(itemEl);
          });
        }));
      }
      function makeItemForRecord(record) {
        var subitem = itemObjectModel.createItem(record.name);
        
        switch (record.leafType) {
          case 'file':
            if (record.fileInfo.isInvisible) {
              subitem.classList.add('invisible');
            }
            if (record.fileInfo.creator) {
              subitem.classList.add('creator-' + encodeURIComponent(record.fileInfo.creator));
            }
            if (record.fileInfo.type) {
              subitem.classList.add('filetype-' + encodeURIComponent(record.fileInfo.type));
            }
            subitem.setAttribute('title', 'File Type: ' + record.fileInfo.type + '\nCreator: ' + record.fileInfo.creator);
            subitem.dataset.catalogId = record.fileInfo.id;
            if (record.fileInfo.dataForkInfo.logicalEOF) {
              var extent = record.fileInfo.dataForkFirstExtentRecord[0];
              subitem.byteSource = allocation.slice(
                allocation.blockSize * extent.offset,
                allocation.blockSize * extent.offset + record.fileInfo.dataForkInfo.logicalEOF);
            }
            if (record.fileInfo.resourceForkInfo.logicalEOF) {
              var extent = record.fileInfo.resourceForkFirstExtentRecord[0];
              subitem.resourceForkByteSource = allocation.slice(
                allocation.blockSize * extent.offset,
                allocation.blockSize * extent.offset + record.fileInfo.resourceForkInfo.logicalEOF);
              subitem.startAddingItems();
              subitem.addEventListener(itemObjectModel.EVT_POPULATE, onFilePopulate);
            }
            if (record.fileInfo.type) {
              var importString = 'mac/filetypes/open_' + record.fileInfo.type.toUpperCase().replace(/[^A-Z0-9]/g, '_');
              require(
                [importString],
                function(open) {
                  subitem.startAddingItems();
                  function onTypedFilePopulate() {
                    this.removeEventListener(itemObjectModel.EVT_POPULATE, onTypedFilePopulate);
                    open(this, record.fileInfo.type);
                  }
                  subitem.addEventListener(itemObjectModel.EVT_POPULATE, onTypedFilePopulate);
                },
                function() {
                });
            }
            break;
          case 'folder':
            subitem.startAddingItems();
            if (record.folderInfo.isInvisible) {
              subitem.classList.add('invisible');
            }
            subitem.dataset.catalogId = record.folderInfo.id;
            subitem.addEventListener(itemObjectModel.EVT_POPULATE, onFolderPopulate);
            break;
        }
        
        Object.defineProperties(subitem, {
          catalogID: {
            get: function() {
              return +this.dataset.catalogId
            },
            enumerable: true,
          },
        });

        return subitem;
      }
      function listFolderTo(folderID, item) {
        return btree.findLeafForParentFolderID(folderID)
        .then(function(leaf) {
          var i;
          for (i = 0; i < leaf.records.length; i++) {
            if (leaf.records[i].parentFolderID === folderID) break;
          }
          if (i >= leaf.records.length) return Promise.reject('folder not found');
          do {
            if (leaf.records[i].parentFolderID !== folderID) return;
            switch(leaf.records[i].leafType) {
              case 'file': case 'folder':
                item.addItem(makeItemForRecord(leaf.records[i]));
                break;
            }
          } while (++i < leaf.records.length);
          if (!leaf.forwardLink) return;
          function onNextLeaf(nextLeaf) {
            for (var j = 0; j < nextLeaf.records.length; j++) {
              if (nextLeaf.records[j].parentFolderID !== folderID) return;
              switch(nextLeaf.records[j].leafType) {
                case 'file': case 'folder':
                  item.addItem(makeItemForRecord(nextLeaf.records[j]));
                  break;
              }
            }
            if (!nextLeaf.forwardLink) return;
            return btree.getNode(nextLeaf.forwardLink).then(onNextLeaf);
          }
          return btree.getNode(leaf.forwardLink).then(onNextLeaf);
        });
      }
      var rootItem = itemObjectModel.createItem('');
      rootItem.startAddingItems();
      rootItem.classList.add('open');
      listFolderTo(1, rootItem).then(function() {
        rootItem.confirmAllItemsAdded();
        var volumeItem = rootItem.subitemsElement.children[0];
        document.body.appendChild(volumeItem);
        volumeItem.click();
      });
    },
  };
  
  return AppleVolume;

});
