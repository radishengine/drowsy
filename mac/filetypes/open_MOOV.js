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
            case 'mhvd':
              atomItem.notifyPopulating(atomItem.byteSource.getBytes().then(function(bytes) {
                atomItem.setDataObject(new MovieHeaderView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
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
  
  return open;

});
