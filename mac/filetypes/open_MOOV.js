define(
['itemObjectModel', 'mac/roman', 'mac/date', 'mac/fixedPoint'],
function(itemOM, macRoman, macDate, fixedPoint) {

  'use strict';
  
  function open(item) {
    function onAtom(item, byteSource) {
      return byteSource.slice(0, 8).getBytes().then(function(headerBytes) {
        var length = new DataView(headerBytes.buffer, headerBytes.byteOffset, 4).getUint32(0, false);
        var name = macRoman(headerBytes, 4, 4);
        var atomItem = itemOM.createItem(name);
        item.addItem(atomItem);
        if (length > 8) {
          atomItem.byteSource = byteSource.slice(8, length);
          switch (name) {
            case 'moov': case 'trak': case 'clip': case 'udta': case 'matt':
            case 'edts': case 'mdia': case 'minf': case 'stbl': case 'tref':
            case 'imap': case 'dinf':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(onAtom(atomItem, atomItem.byteSource));
              break;
            case 'mvhd':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new MovieHeaderView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'tkhd':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new TrackHeaderView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'elst':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new EditListView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'WLOC':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new WindowLocationView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'mdhd':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new MediaHeaderView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'hdlr':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new HandlerReferenceView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'smhd':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new SoundHeaderView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'vmhd':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new VideoHeaderView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'dref':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new DataReferenceView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'stsd':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new SampleDescriptionView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'stss': case 'stsz': case 'stco':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new Uint32ListView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'stts':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new TimeToSampleView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
            case 'stsc':
              atomItem.startAddingItems();
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new SampleToChunkView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
              }));
              break;
          }
        }
        if (byteSource.byteLength >= (length + 8)) {
          return onAtom(item, byteSource.slice(length));
        }
      });
    }
    return onAtom(item, item.byteSource);
  }
  
  function MovieHeaderView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  MovieHeaderView.prototype = {
    toJSON: function() {
      return {
        version: this.version,
        flags: this.flags,
        creationTime: this.creationTime,
        modificationTime: this.modificationTime,
        timeScale: this.timeScale,
        duration: this.duration,
        preferredRate: this.preferredRate,
        preferredVolume: this.preferredVolume,
        matrix: this.matrix,
        previewTime: this.previewTime,
        previewDuration: this.previewDuration,
        posterTime: this.posterTime,
        selectionTime: this.selectionTime,
        selectionDuration: this.selectionDuration,
        currentTime: this.currentTime,
        nextTrackID: this.nextTrackID,
      };
    },
    get version() {
      return this.dataView.getUint8(0);
    },
    get flags() {
      return this.dataView.getUint32(0) & 0xffffff; // unused?
    },
    get creationTime() {
      return macDate(this.dataView, 4);
    },
    get modificationTime() {
      return macDate(this.dataView, 8);
    },
    get timeScale() {
      return this.dataView.getUint32(12, false); // time units per second
    },
    get duration() {
      return this.dataView.getUint32(16, false); // in time units
    },
    get preferredRate() {
      return fixedPoint.fromInt32(this.dataView.getInt32(20, false)); // 1.0 = normal
    },
    get preferredVolume() {
      return fixedPoint.fromUint16(this.dataView.getUint16(24, false)); // 1.0 = normal
    },
    // reserved: 10 bytes
    get matrix() {
      var matrix = new MatrixView(this.dataView.buffer, this.dataView.byteOffset + 36, MatrixView.byteLength);
      Object.defineProperty(this, 'matrix', {value:matrix});
      return matrix;
    },
    get previewTime() {
      return this.dataView.getUint32(72, false); // in time units
    },
    get previewDuration() {
      return this.dataView.getUint32(76, false); // in time units
    },
    get posterTime() {
      return this.dataView.getUint32(80, false); // in time units
    },
    get selectionTime() {
      return this.dataView.getUint32(84, false); // in time units
    },
    get selectionDuration() {
      return this.dataView.getUint32(88, false); // in time units
    },
    get currentTime() {
      return this.dataView.getUint32(92, false); // in time units
    },
    get nextTrackID() {
      return this.dataView.getUint32(96, false); // zero is not a valid track number
    },
  };
  MovieHeaderView.byteLength = 100;
  
  function MatrixView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  MatrixView.prototype = {
    toJSON: function() {
      return {
        a: this.a, b: this.b, u: this.u,
        c: this.c, d: this.d, v: this.v,
        x: this.x, y: this.y, w: this.w,
      };
    },
    get a() { return fixedPoint.fromInt32(this.dataView.getInt32(0, false)); },
    get b() { return fixedPoint.fromInt32(this.dataView.getInt32(4, false)); },
    get u() { return fixedPoint.fromInt32_2_30(this.dataView.getInt32(8, false)) },
    get c() { return fixedPoint.fromInt32(this.dataView.getInt32(12, false)); },
    get d() { return fixedPoint.fromInt32(this.dataView.getInt32(16, false)); },
    get v() { return fixedPoint.fromInt32_2_30(this.dataView.getInt32(20, false)) },
    get x() { return fixedPoint.fromInt32(this.dataView.getInt32(24, false)); },
    get y() { return fixedPoint.fromInt32(this.dataView.getInt32(28, false)) },
    get w() { return fixedPoint.fromInt32_2_30(this.dataView.getInt32(32, false)) },
  };
  MatrixView.byteLength = 4 * 9;
  
  function TrackHeaderView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  TrackHeaderView.prototype = {
    toJSON: function() {
      return {
        version: this.version,
        isEnabled: this.isEnabled,
        isUsedInMovie: this.isUsedInMovie,
        isUsedInPreview: this.isUsedInPreview,
        isUsedInPoster: this.isUsedInPoster,
        creationTime: this.creationTime,
        modificationTime: this.modificationTime,
        trackID: this.trackID,
        duration: this.duration,
        layer: this.layer,
        alternateGroup: this.alternateGroup,
        preferredVolume: this.preferredVolume,
        matrix: this.matrix,
        pixelWidth: this.pixelWidth,
        pixelHeight: this.pixelHeight,
      };
    },
    get version() {
      return this.dataView.getUint8(0);
    },
    get isEnabled() {
      return !!(this.dataView.getUint8(3) & 1);
    },
    get isUsedInMovie() {
      return !!(this.dataView.getUint8(3) & 2);
    },
    get isUsedInPreview() {
      return !!(this.dataView.getUint8(3) & 4);
    },
    get isUsedInPoster() {
      return !!(this.dataView.getUint8(3) & 8);
    },
    get creationTime() {
      return macDate(this.dataView, 4);
    },
    get modificationTime() {
      return macDate(this.dataView, 8);
    },
    get trackID() {
      return this.dataView.getUint32(12, false); // time units per second
    },
    // reserved: 4 bytes
    get duration() {
      // if edit list is present: the sum of track's edits
      // otherwise: the sum of sample durations, converted to time units
      return this.dataView.getUint32(20, false); // in time units
    },
    // reserved: 8 bytes
    get layer() {
      return this.dataView.getUint16(32, false); // z-ordering: lower-numbered layers appear first
    },
    get alternateGroup() {
      return this.dataView.getUint16(34, false);
    },
    get preferredVolume() {
      return fixedPoint.fromUint16(this.dataView.getUint16(36, false)); // 1.0 = normal
    },
    // reserved: 2 bytes
    get matrix() {
      var matrix = new MatrixView(this.dataView.buffer, this.dataView.byteOffset + 40, MatrixView.byteLength);
      Object.defineProperty(this, 'matrix', {value:matrix});
      return matrix;
    },
    get pixelWidth() {
      return fixedPoint.fromInt32(this.dataView.getInt32(76, false));
    },
    get pixelHeight() {
      return fixedPoint.fromInt32(this.dataView.getInt32(80, false));
    },
  };
  TrackHeaderView.byteLength = 84;
  
  function EditListView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  EditListView.prototype = {
    toJSON: function() {
      return this.entries;
    },
    get entries() {
      var entries = new Array(this.dataView.getUint32(4, false));
      for (var i = 0; i < entries.length; i++) {
        entries[i] = {
          duration: this.dataView.getUint32(8 + i * 12, false),
          startTime: this.dataView.getInt32(8 + i * 12 + 4, false), // -1: empty edit
          relativeRate: fixedPoint.fromInt32(this.dataView.getInt32(8 + i * 12 + 8, false)),
        };
      }
      Object.defineProperty(this, 'entries', entries);
      return entries;
    },
  };
  
  function WindowLocationView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  WindowLocationView.prototype = {
    toJSON: function() {
      return {x:this.x, y:this.y};
    },
    get x() {
      return this.dataView.getInt16(0, false);
    },
    get y() {
      return this.dataView.getInt16(2, false);
    },
  };
  WindowLocationView.byteLength = 4;
  
  function MediaHeaderView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  MediaHeaderView.prototype = {
    toJSON: function() {
      return {
        version: this.version,
        creationTime: this.creationTime,
        modificationTime: this.modificationTime,
        timeScale: this.timeScale,
        duration: this.duration,
        languageCode: this.languageCode,
        quality: this.quality,
      };
    },
    get version() {
      return this.dataView.getUint8(0);
    },
    // unused: 24 bits of flags
    get creationTime() {
      return macDate(this.dataView, 4);
    },
    get modificationTime() {
      return macDate(this.dataView, 8);
    },
    get timeScale() {
      return this.dataView.getUint32(12, false); // time units per second
    },
    get duration() {
      return this.dataView.getUint32(16, false); // time units
    },
    get languageCode() {
      return this.dataView.getUint16(20, false);
    },
    get quality() {
      return this.dataView.getUint16(22, false);
    },
  };
  MediaHeaderView.byteLength = 24;
  
  function HandlerReferenceView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
      bytes: {value:new Uint8Array(buffer, byteOffset, byteLength)},
    });
  }
  HandlerReferenceView.prototype = {
    toJSON: function() {
      return {
        version: this.version,
        componentType: this.componentType,
        componentSubtype: this.componentSubtype,
        name: this.name,
      };
    },
    get version() {
      return this.dataView.getUint8(0);
    },
    // unused: 24 bits of flags
    get componentType() {
      // mhlr for media handlers, dhlr for data handlers
      return macRoman(this.bytes, 4, 4);
    },
    get componentSubtype() {
      return macRoman(this.bytes, 8, 4);
    },
    // reserved: 12 bytes
    get name() {
      return macRoman(this.bytes, 25, this.bytes[24]);
    },
  };
  
  function SoundHeaderView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  SoundHeaderView.prototype = {
    toJSON: function() {
      return {
        version: this.version,
        balance: this.balance,
      };
    },
    get version() {
      return this.dataView.getUint8(0);
    },
    // unused: 24 bits of flags
    get balance() {
      return fixedPoint.fromUint16(this.dataView.getUint16(4, false)); // -1..+1 = full left to full right
    },
    // reserved: 2 bytes
  };
  SoundHeaderView.byteLength = 8;
  
  function VideoHeaderView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  VideoHeaderView.prototype = {
    toJSON: function() {
      return {
        version: this.version,
        noLeanAhead: this.noLeanAhead,
        graphicsMode: this.graphicsMode,
        opColor: this.opColor,
      };
    },
    get version() {
      return this.dataView.getUint8(0);
    },
    get noLeanAhead() {
      return !!(this.dataView.getUint8(3) & 1); // should only ever be zero in a Quicktime 1.0 file
    },
    get graphicsMode() {
      var mode = this.dataView.getUint16(4, false);
      switch(mode) {
        case 0x0000: return 'copy';
        case 0x0040: return 'ditherCopy';
        case 0x0020: return 'blend';
        case 0x0024: return 'transparent';
        case 0x0100: return 'straightAlpha';
        case 0x0101: return 'premulWhiteAlpha';
        case 0x0102: return 'premulBlackAlpha';
        case 0x0104: return 'straightAlphaBlend';
        case 0x0103: return 'composition'; // drawn offscreen, then composed on screen with dither copy
      }
      return mode;
    },
    get opColor() {
      return {
        red: this.dataView.getUint16(6, false),
        green: this.dataView.getUint16(8, false),
        blue: this.dataView.getUint16(10, false),
      };
    },
  };
  VideoHeaderView.byteLength = 12;
  
  function DataReferenceView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
      bytes: {value:new Uint8Array(buffer, byteOffset, byteLength)},
    });
  }
  DataReferenceView.prototype = {
    toJSON: function() {
      return {
        version: this.version,
        entries: this.entries,
      };
    },
    get version() {
      return this.dataView.getUint8(0);
    },
    get entries() {
      var entries = new Array(this.dataView.getUint32(4, false));
      var pos = 8;
      for (var i = 0; i < entries.length; i++) {
        var size = this.dataView.getUint32(pos, false);
        var type = macRoman(this.bytes, pos + 4, 4);
        var version = this.bytes[pos + 8];
        entries[i] = {
          type: type,
          version: version,
        };
        if (this.bytes[pos + 11] & 1) entries[i].isThisFile = true;
        if (size > 12) {
          entries[i].data = this.bytes.subarray(pos + 12, pos + size);
        }
        pos += size;
      }
      Object.defineProperty(this, 'entries', entries);
      return entries;
    },
  };
  
  function SampleDescriptionView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  SampleDescriptionView.prototype = {
    toJSON: function() {
      return this.entries;
    },
    get entryCount() {
      return this.dataView.getUint32(4);
    },
    get entries() {
      var entries = new Array(this.entryCount);
      var pos = 8;
      for (var i = 0; i < entries.length; i++) {
        var size = this.dataView.getUint32(pos);
        var type = macRoman(this.bytes, pos + 4, 4);
        var data;
        switch(type) {
          case 'cvid': case 'jpeg': case 'Yuv2':
          case 'smc ': case 'rle ': case 'rpza': case 'kpcd':
          case 'mpeg': case 'mjpa': case 'mjpb': case 'svqi':
            entries[i] = new VideoSampleDescriptionView(
              this.bytes.buffer,
              this.bytes.byteOffset + pos + 16,
              VideoSampleDescriptionView.byteLength);
            if (size > (16 + VideoSampleDescriptionView.byteLength)) {
              entries[i].data = this.bytes.subarray(
                pos + 16 + VideoSampleDescriptionView.byteLength,
                pos + size);
            }
            break;
          case 'raw ': // may be audio or video
            if (size >= (16 + VideoSampleDescriptionView.byteLength)) {
              entries[i] = new VideoSampleDescriptionView(
                this.bytes.buffer,
                this.bytes.byteOffset + pos + 16,
                VideoSampleDescriptionView.byteLength);
              if (size > (16 + VideoSampleDescriptionView.byteLength)) {
                entries[i].data = this.bytes.subarray(
                  pos + 16 + VideoSampleDescriptionView.byteLength,
                  pos + size);
              }
            }
            else {
              entries[i] = {};
              if (size > 16) {
                entries[i].data = this.bytes.subarray(pos + 16, pos + size);
              }
            }
            break;
          default:
            entries[i] = {};
            if (size > 16) {
              entries[i].data = this.bytes.subarray(pos + 16, pos + size);
            }
            break;
        }
        entries[i].type = type;
        entries[i].dataReferenceIndex = this.dataView.getUint16(pos + 14, false),
        pos += size;
      }
      Object.defineProperty(this, 'entries', entries);
      return entries;
    },
  };
  
  function VideoSampleDescriptionView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  VideoSampleDescriptionView.prototype = {
    toJSON: function() {
      return {
        version: this.version,
        revisionLevel: this.revisionLevel,
        vendor: this.vendor,
        temporalQuality: this.temporalQuality,
        spatialQuality: this.spatialQuality,
        pixelWidth: this.pixelWidth,
        pixelHeight: this.pixelHeight,
        pixelsPerInchX: this.pixelsPerInchX,
        pixelsPerInchY: this.pixelsPerInchY,
        dataSize: this.dataSize,
        framesPerSample: this.framesPerSample,
        compressorName: this.compressorName,
        depth: this.depth,
        colorTableID: this.colorTableID,
      };
    },
    get version() {
      return this.dataView.getUint16(0, false);
    },
    get revisionLevel() {
      return this.dataView.getUint16(2, false); // must be 0, apparently
    },
    get vendor() {
      return macRoman(this.bytes, 4, 4);
    },
    get temporalQuality() {
      return this.dataView.getUint32(8, false); // degree of compression 0 to 1023
    },
    get spatialQuality() {
      return this.dataView.getUint32(12, false); // degree of compression 0 to 1024
    },
    get pixelWidth() {
      return this.dataView.getUint16(16, false);
    },
    get pixelHeight() {
      return this.dataView.getUint16(18, false);
    },
    get pixelsPerInchX() {
      return fixedPoint.fromInt32(this.dataView.getInt32(20, false));
    },
    get pixelsPerInchY() {
      return fixedPoint.fromInt32(this.dataView.getInt32(24, false));
    },
    get dataSize() {
      return this.dataView.getUint32(28, false); // must be 0
    },
    get framesPerSample() {
      return this.dataView.getUint16(32, false); // usually 1
    },
    get compressorName() {
      return macRoman(this.bytes, 35, this.bytes[34]); // 32-byte buffer for Pascal string
    },
    get depth() {
      // 1,2,4,8,16,24,32 (alpha)
      // 34: 2-bit grayscale
      // 36: 4-bit grayscale
      // 40: 8-bit grayscale
      return this.dataView.getUint16(66, false);
    },
    get colorTableID() {
      return this.dataView.getInt16(68, false); // -1: default palette
    },
  };
  VideoSampleDescriptionView.byteLength = 70;
  
  function Uint32ListView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  Uint32ListView.prototype = {
    toJSON: function() {
      return this.entries;
    },
    get entryCount() {
      return this.dataView.getUint32(4, false);
    },
    get entries() {
      var entries = new Array(this.entryCount);
      for (var i = 0; i < entries.length; i++) {
        entries[i] = this.dataView.getUint32(8 + i * 4, false);
      }
      Object.defineProperty(this, 'entries', entries);
      return entries;
    },
  };
  
  function TimeToSampleView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  TimeToSampleView.prototype = {
    toJSON: function() {
      return this.entries;
    },
    get entryCount() {
      return this.dataView.getUint32(4, false);
    },
    get entries() {
      var entries = new Array(this.entryCount);
      for (var i = 0; i < entries.length; i++) {
        entries[i] = {
          sampleCount: this.dataView.getUint32(8 + i * 8, false),
          sampleDuration: this.dataView.getUint32(8 + i * 8 + 4, false),
        };
      }
      Object.defineProperty(this, 'entries', entries);
      return entries;
    },
  };
  
  function SampleToChunkView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  SampleToChunkView.prototype = {
    toJSON: function() {
      return this.entries;
    },
    get entryCount() {
      return this.dataView.getUint32(4, false);
    },
    get entries() {
      var entries = new Array(this.entryCount);
      for (var i = 0; i < entries.length; i++) {
        entries[i] = {
          firstChunk: this.dataView.getUint32(8 + i * 12, false),
          samplesPerChunk: this.dataView.getUint32(8 + i * 12 + 4, false),
          sampleDescriptionID: this.dataView.getUint32(8 + i * 12 + 8, false),
        };
      }
      Object.defineProperty(this, 'entries', entries);
      return entries;
    },
  };
  
  return open;

});
