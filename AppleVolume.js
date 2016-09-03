define([
  'ByteSource', 'mac/roman', 'mac/hfs/BTreeNodeView', 'mac/hfs/PartitionRecordView',
  'mac/hfs/ResourceHeaderView', 'mac/hfs/ResourceMapView', 'mac/hfs/MasterDirectoryBlockView'],
function(
  ByteSource, macintoshRoman, BTreeNodeView, PartitionRecordView,
  ResourceHeaderView, ResourceMapView, MasterDirectoryBlockView) {

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
  
  var wavHeaderTemplate = new Uint8Array([
  	'R'.charCodeAt(0),
  	'I'.charCodeAt(0),
  	'F'.charCodeAt(0),
  	'F'.charCodeAt(0),
  	0,0,0,0, // uint32 @ 4: set to wavHeaderTemplate.length + data length (aligned to 2)
  	'W'.charCodeAt(0),
  	'A'.charCodeAt(0),
  	'V'.charCodeAt(0),
  	'E'.charCodeAt(0),
  	'f'.charCodeAt(0),
  	'm'.charCodeAt(0),
  	't'.charCodeAt(0),
  	' '.charCodeAt(0),
  	16,0,0,0,
  	1,0,
  	1,0,     // uint16 @ 22: number of channels
  	22,56,0,0, // uint32 @ 24: sampling rate
  	22,56,0,0, // uint32 @ 28: sampling rate * channels * bytes per sample
  	1,0, // uint16 @ 32: block align, channels * bytes per sample
  	8,0, // uint16 @ 34: bytes per sample * 8
  	'd'.charCodeAt(0),
  	'a'.charCodeAt(0),
  	't'.charCodeAt(0),
  	'a'.charCodeAt(0),
  	0,0,0,0 // uint32 @ 40: number of bytes
  	]);
  
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
      var self = this;
      var folders = {};
      var allocation = byteSource.allocationBlocks;
      this.getFirstLeaf(byteSource)
      .then(function(leaf) {
        console.log(leaf);
      });
      this.readBTreeNode(byteSource, 0, [], {
        onheadernode: function(headerNode, chain) {
          self.readBTreeNode(byteSource, headerNode.rootNodeNumber, chain, this);
        },
        onindexnode: function(indexNode, chain) {
          console.log('index', chain, indexNode);
          for (var i = 0; i < indexNode.pointers.length; i++) {
            self.readBTreeNode(byteSource, indexNode.pointers[i].nodeNumber, chain, this);
          }
        },
        onfolderthread: function(threadInfo, chain) {
          console.log('folder thread', chain, threadInfo);
        },
        onfilethread: function(threadInfo, chain) {
          console.log('file thread', chain, threadInfo);
        },
        onfolder: function(folderInfo, chain) {
          console.log('folder', chain, folderInfo);
          var container = document.createElement('SECTION');
          if (folderInfo.isInvisible) {
            container.classList.add('invisible');
          }
          container.classList.add('folder');
          container.dataset.name = folderInfo.name;
          var title = document.createElement('HEADER');
          title.innerHTML = folderInfo.name;
          function clickExpand(e) {
            container.classList.toggle('open');
            e.preventDefault();
            e.stopPropagation();
          }
          container.addEventListener('click', clickExpand);
          container.appendChild(title);
          var timestamp = folderInfo.modifiedAt || folderInfo.createdAt;
          if (timestamp) {
            container.dataset.lastModified = timestamp.toISOString();
          }
          if (folderInfo.id in folders) {
            container.appendChild(folders[folderInfo.id]);
          }
          else {
            var children = document.createElement('SECTION');
            children.classList.add('folder-children');
            container.appendChild(children);
            folders[folderInfo.id] = children;
          }
          if (folderInfo.parentFolderID === 1) {
            container.classList.add('open');
            document.body.appendChild(container);
          }
          else if (folderInfo.parentFolderID in folders) {
            folders[folderInfo.parentFolderID].appendChild(container);
          }
          else {
            var siblings = document.createElement('SECTION');
            siblings.classList.add('folder-children');
            siblings.appendChild(container);
            folders[folderInfo.parentFolderID] = siblings;
          }
        },
        onleafnode: function(leaf, chain) {
          console.log('leaf', chain, leaf);
          for (var i = 0; i < leaf.records.length; i++) {
            var record = leaf.records[i];
            record.leafNodeNumber = leaf.number;
            switch(record.leafType) {
              case 'folder':
                record.folderInfo.name = record.name;
                record.folderInfo.parentFolderID = record.parentFolderID;
                this.onfolder(record.folderInfo, chain.concat(i));
                break;
              case 'file':
                record.fileInfo.name = record.name;
                record.fileInfo.parentFolderID = record.parentFolderID;
                this.onfile(record.fileInfo, chain.concat(i));
                break;
              case 'folderthread':
                this.onfolderthread(record.threadInfo, chain.concat(i));
                break;
              case 'filethread':
                this.onfilethread(record.threadInfo, chain.concat(i));
                break;
              default:
                console.error('unknown folder record type');
                break;
            }
          }
        },
        onfile: function(fileInfo, chain) {
          console.log('file', chain, fileInfo);
          var container = document.createElement('SECTION');
          if (fileInfo.isInvisible) {
            container.classList.add('invisible');
          }
          container.classList.add('file');
          container.dataset.name = fileInfo.name;
          if (fileInfo.type !== null) {
            container.dataset.macType = fileInfo.type;
          }
          if (fileInfo.creator !== null) {
            container.dataset.macCreator = fileInfo.creator;
          }
          var timestamp = fileInfo.modifiedAt || fileInfo.createdAt;
          if (timestamp) {
            container.dataset.lastModified = timestamp.toISOString();
          }
          var title = document.createElement('HEADER');
          if (fileInfo.dataForkInfo.logicalEOF) {
            container.dataset.size = fileInfo.dataForkInfo.logicalEOF;
            var downloadLink = document.createElement('A');
            downloadLink.innerHTML = '&#x1f4be;';
            downloadLink.href = '#';
            downloadLink.title = 'Download (' + fileInfo.dataForkInfo.logicalEOF + ' bytes)';
            downloadLink.setAttribute('download', fileInfo.name);
            var extent = fileInfo.dataForkFirstExtentRecord[0];
            var downloadByteSource = allocation.slice(
              allocation.blockSize * extent.offset,
              allocation.blockSize * extent.offset + fileInfo.dataForkInfo.logicalEOF
            );
            function clickDownloadLink(e) {
              e.preventDefault();
              downloadByteSource.getURL()
                .then(function(url) {
                  downloadLink.href = url;
                  downloadLink.click();
                });
              downloadLink.removeEventListener('click', clickDownloadLink);
            }
            downloadLink.addEventListener('click', clickDownloadLink);
            title.appendChild(document.createTextNode(fileInfo.name + ' '));
            title.appendChild(downloadLink);
          }
          else {
            title.appendChild(document.createTextNode(fileInfo.name));
          }
          container.appendChild(title);
          if (fileInfo.resourceForkInfo.logicalEOF) {
            var extent = fileInfo.resourceForkFirstExtentRecord[0];
            var resourceForkByteSource = allocation.slice(
              allocation.blockSize * extent.offset,
              allocation.blockSize * extent.offset + fileInfo.resourceForkInfo.logicalEOF);
            var resources = document.createElement('SECTION');
            resources.classList.add('folder-children');
            container.appendChild(resources);
            container.classList.add('folder');
            function clickExpand(e) {
              container.classList.toggle('open');
              e.preventDefault();
              e.stopPropagation();
            }
            function clickLoad(e) {
              container.classList.add('loading', 'open');
              e.preventDefault();
              e.stopPropagation();
              container.removeEventListener('click', clickLoad);
              container.addEventListener('click', clickExpand);
              
              var header, map, dataByteSource;
              resourceForkByteSource.slice(0, ResourceHeaderView.byteLength).getBytes()
              .then(function(headerBytes) {
                header = new ResourceHeaderView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);
                dataByteSource = resourceForkByteSource.slice(header.dataOffset, header.dataOffset + header.dataLength);
                return resourceForkByteSource.slice(header.mapOffset, header.mapOffset + header.mapLength).getBytes();
              })
              .then(function(mapBytes) {
                map = new ResourceMapView(mapBytes.buffer, mapBytes.byteOffset, mapBytes.byteLength);
                return Promise.all(map.resourceList.map(function(resource) {
                  var resourceEl = document.createElement('SECTION');
                  resourceEl.classList.add('file');
                  function clickResource(e) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                  resourceEl.addEventListener('click', clickResource);
                  var resourceTitleString = '[' + resource.type + '] #' + resource.id;
                  if (resource.name) {
                    resourceTitleString += ' "' + resource.name + '"';
                  }
                  var resourceTitle = document.createElement('HEADER');
                  resourceTitle.appendChild(document.createTextNode(resourceTitleString + ' '));
                  resourceEl.appendChild(resourceTitle);
                  resources.appendChild(resourceEl);
                  return dataByteSource.slice(
                    resource.dataOffset,
                    resource.dataOffset + 4)
                  .getBytes()
                  .then(function(lengthBytes) {
                    var length = new DataView(
                      lengthBytes.buffer,
                      lengthBytes.byteOffset,
                      lengthBytes.byteLength).getUint32(0, false);
                    resource.byteSource = dataByteSource.slice(
                      resource.dataOffset + 4,
                      resource.dataOffset + 4 + length);
                    var downloadLink = document.createElement('A');
                    downloadLink.innerHTML = '&#x1f4be;';
                    downloadLink.href = '#';
                    downloadLink.title = 'Download (' + resource.byteSource.byteLength + ' bytes)';
                    downloadLink.setAttribute('download', 'resource.dat');
                    function clickDownloadLink(e) {
                        e.preventDefault();
                        resource.byteSource.getURL()
                            .then(function(url) {
                                downloadLink.href = url;
                                downloadLink.click();
                            });
                        downloadLink.removeEventListener('click', clickDownloadLink);
                    }
                    downloadLink.addEventListener('click', clickDownloadLink);
                    resourceTitle.appendChild(downloadLink);
                  });
                  
                  /*
                  return dataByteSource.slice(
                    resource.dataOffset,
                    resource.dataOffset + 4)
                  .getBytes()
                  .then(function(lengthBytes) {
                    var length = new DataView(
                      lengthBytes.buffer,
                      lengthBytes.byteOffset,
                      lengthBytes.byteLength).getUint32(0, false);
                    resource.byteSource = dataByteSource.slice(
                      resource.dataOffset + 4,
                      resource.dataOffset + 4 + length);
                  });
                  */
                }));
              })
              .then(function() {
                container.classList.remove('loading');
              });
            }
            container.addEventListener('click', clickLoad);
            /*
            self.readResourceFork(resourceForkByteSource), {
              onresource: function(resource) {
                var resourceEl;
                if ('image' in resource) {
                  resourceEl = document.createElement('IMG');
                  resourceEl.width = resource.image.width;
                  resourceEl.height = resource.image.height;
                  if ('offsetX' in resource.image) {
                    resourceEl.dataset.offsetX = resource.image.offsetX;
                  }
                  if ('offsetY' in resource.image) {
                    resourceEl.dataset.offsetY = resource.image.offsetY;
                  }
                  resourceEl.src = resource.image.url;
                  if ('hotspot' in resource) {
                    resourceEl.style.cursor = 'url(' + resource.image.url + ') '
                      + resource.hotspot.x + ' ' + resource.hotspot.y + ', url(' + resource.image.url + '), auto';
                  }
                }
                else if ('text' in resource) {
                  resourceEl = document.createElement('SCRIPT');
                  resourceEl.setAttribute('type', 'text/plain');
                  resourceEl.appendChild(document.createTextNode(resource.text.replace(/\r/g, '\n')));
                }
                else if ('dataObject' in resource) {
                  resourceEl = document.createElement('SCRIPT');
                  resourceEl.setAttribute('type', 'application/json');
                  resourceEl.appendChild(document.createTextNode(JSON.stringify(resource.dataObject, null, 2)));
                }
                else if ('soundData' in resource) {
                  var channelCount = resource.soundData.channels || 1;
                  var samplingRate = resource.soundData.samplingRate || 22050;
                  var samples = resource.soundData.samples;
                  var bytesPerSample = resource.soundData.bytesPerSample || 1;
                  
                  var wavHeader = new Uint8Array(wavHeaderTemplate.length);
                  wavHeader.set(wavHeaderTemplate);
                  
                  var wavFooter = new Uint8Array(samples.byteLength % 2);

                  var wavView = new DataView(wavHeader.buffer, wavHeader.byteOffset, wavHeader.byteLength);
                  wavView.setUint32(4, wavHeader.byteLength + samples.byteLength + wavFooter.byteLength, true);
                  wavView.setUint16(22, channelCount, true);
                  wavView.setUint32(24, samplingRate, true);
                  wavView.setUint32(28, samplingRate * channelCount * bytesPerSample, true);
                  wavView.setUint16(32, channelCount * bytesPerSample, true);
                  wavView.setUint16(34, bytesPerSample * 8, true);
                  wavView.setUint32(40, samples.byteLength, true);
                  
                  resourceEl = document.createElement('AUDIO');
                  resourceEl.src = URL.createObjectURL(new Blob([wavHeader, samples, wavFooter], {type:'audio/wav'}));
                  resourceEl.controls = true;
                }
                else {
                  resourceEl = document.createElement('DIV');
                  resourceEl.dataset.size = resource.data.length;
                }
                resourceEl.classList.add('resource');
                if (resource.name !== null) {
                  resourceEl.dataset.name = resource.name;
                }
                resourceEl.dataset.type = resource.type;
                resourceEl.dataset.id = resource.id;
                container.appendChild(resourceEl);
              }
            });
            */
          }
          else {
            function clickExpand(e) {
              e.preventDefault();
              e.stopPropagation();
            }
            container.addEventListener('click', clickExpand);
          }
          if (fileInfo.parentFolderID === 1) {
            document.body.appendChild(container);
          }
          else if (fileInfo.parentFolderID in folders) {
            folders[fileInfo.parentFolderID].appendChild(container);
          }
          else {
            var siblings = document.createElement('SECTION');
            siblings.classList.add('folder-children');
            siblings.appendChild(container);
            folders[fileInfo.parentFolderID] = siblings;
          }
        },
      });
    },
    readResourceFork: function(byteSource, reader) {
      var header, map, dataByteSource;
      byteSource.slice(0, ResourceHeaderView.byteLength).getBytes()
      .then(function(headerBytes) {
        header = new ResourceHeaderView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);
        dataByteSource = byteSource.slice(header.dataOffset, header.dataOffset + header.dataLength);
        return byteSource.slice(header.mapOffset, header.mapOffset + header.mapLength).getBytes();
      })
      .then(function(mapBytes) {
        map = new ResourceMapView(mapBytes.buffer, mapBytes.byteOffset, mapBytes.byteLength);
        map.resourceList.forEach(function(resource) {
          dataByteSource.slice(
            resource.dataOffset,
            resource.dataOffset + 4)
          .getBytes()
          .then(function(lengthBytes) {
            return new DataView(
              lengthBytes.buffer,
              lengthBytes.byteOffset,
              lengthBytes.byteLength).getUint32(0, false);
          })
          .then(function(length) {
            resource.byteSource = dataByteSource.slice(
              resource.dataOffset + 4,
              resource.dataOffset + 4 + length);
            if (typeof reader.onresource === 'function') {
              reader.onresource(resource);
            }
            //return resource.byteSource.getBytes();
          })
          /*
          .then(function(data) {
            resource.data = data;
            switch (resource.type) {
              default:
                (function(resource) {
                  var importString = 'mac/resources/open_' + encodeURIComponent(resource.type);
                  require([importString],
                    function(open_resource) {
                      open_resource(resource);
                      if (typeof reader.onresource === 'function') {
                        reader.onresource(resource);
                      }
                    },
                    function(err) {
                      requirejs.undef(importString);
                      function defaultHandler(resource) {
                        if (resource.data.length === 0) {
                          resource.dataObject = null;
                          return;
                        }
                        for (var i = 0; i < resource.data.length; i++) {
                          var b = resource.data[i];
                          if (b >= 32) {
                            if (b === 127) return;
                            continue;
                          }
                          if (b !== 9 && b !== 13) return;
                        }
                        resource.text = macintoshRoman(resource.data, 0, resource.data.length);
                      }
                      define(importString, function() { return defaultHandler; });
                      defaultHandler(resource);
                      if (typeof reader.onresource === 'function') {
                        reader.onresource(resource);
                      }
                    });
                })(resource);
                break;
              case 'CLUT':
              case 'clut':
                var clut = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
                var seed = clut.getInt32(0, false); // resource ID
                var flags = clut.getUint16(4, false); // 0x8000: color map for indexed device
                if (flags !== 0x0000) {
                  console.log(resource.type, resource.name, resource.data);
                  break;
                }
                var entryCount = clut.getUint16(6, false) + 1;
                var palCanvas = document.createElement('CANVAS');
                palCanvas.width = entryCount;
                palCanvas.height = 1;
                var palCtx = palCanvas.getContext('2d');
                var palData = palCtx.createImageData(entryCount, 1);
                for (var icolor = 0; icolor < entryCount; icolor++) {
                  var offset = clut.getInt16(8 + icolor*8, false) * 4;
                  if (offset >= 0) {
                    palData.data[offset] = resource.data[8 + icolor*8 + 2];
                    palData.data[offset + 1] = resource.data[8 + icolor*8 + 4];
                    palData.data[offset + 2] = resource.data[8 + icolor*8 + 6];
                    palData.data[offset + 3] = 255;
                  }
                }
                palCtx.putImageData(palData, 0, 0);
                resource.image = {
                  width: entryCount,
                  height: 1,
                  url: palCanvas.toDataURL(),
                };
                if (typeof reader.onresource === 'function') {
                  reader.onresource(resource);
                }
                break;
            }
          })*/;
        });
      });
    },
    getFirstLeaf: function(byteSource) {
      return byteSource.slice(0, BTREE_NODE_BYTES).getBytes()
      .then(function(rawHeader) {
        var header = new BTreeNodeView(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength);
        if (header.type !== 'header') return Promise.reject('node zero is not a header node');
        function indexRecurser(rawNode) {
          var node = new BTreeNodeView(rawNode.buffer, rawNode.byteOffset, rawNode.byteLength);
          switch (node.type) {
            case 'leaf': return node;
            case 'index':
              return byteSource.slice(
                node.records[0].nodeNumber * BTREE_NODE_BYTES,
                (node.records[0].nodeNumber + 1) * BTREE_NODE_BYTES).then(indexRecurser);
            default:
              return Promise.reject('node is not an index or leaf node');
          }
        }
        return byteSource.slice(
          header.rootNodeNumber * BTREE_NODE_BYTES,
          (header.rootNodeNumber + 1) * BTREE_NODE_BYTES).then(indexRecurser);
      });
    },
    readBTreeNode: function(byteSource, nodeNumber, chain, reader) {
      var self = this;
      chain = chain.concat(nodeNumber);
      byteSource.slice(nodeNumber * BTREE_NODE_BYTES, (nodeNumber + 1) * BTREE_NODE_BYTES).read({
        onbytes: function(bytes) {
          var node = new BTreeNodeView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          node.number = nodeNumber;
          switch(node.nodeType) {
            case 'index':
              node.pointers = node.records;
              if (typeof reader.onindexnode === 'function') {
                reader.onindexnode(node, chain);
              }
              break;
            case 'header':
              var header = node.records[0];
              header.number = nodeNumber;
              header.bitmap = node.records[2];
              if (typeof reader.onheadernode === 'function') {
                reader.onheadernode(header, chain);
              }
              break;
            case 'map':
              console.error('NYI: map node');
              break;
            case 'leaf':
              if (typeof reader.onleafnode === 'function') {
                reader.onleafnode(node, chain);
              }
              break;
            default:
              console.error('unknown node type: ' + bytes[8]);
              break;
          }
        }
      });
    },
  };
  
  return AppleVolume;

});
