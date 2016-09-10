define(['itemObjectModel', 'mac/roman', 'mac/date', 'mac/fixedPoint'], function(itemOM, macRoman, macDate, fixedPoint) {

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
  
  return open;

});
