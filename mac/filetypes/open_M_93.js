define(['itemObjectModel'], function(itemObjectModel) {

  'use strict';

  function open(item) {
    return item.getBytes().then(function(bytes) {
      if (String.fromCharCode.apply(null, bytes.subarray(0, 4)) !== 'RIFX'
        || String.fromCharCode.apply(null, bytes.subarray(8, 12)) !== 'MV93') {
        return Promise.reject('not a MV93 RIFX file');
      }
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (bytes.length < dv.getUint32(4, false) + 8) {
        return Promise.reject('bad length');
      }
      item.notifyPopulating(new Promise(function(resolve, reject) {
        for (var pos = 12; pos < bytes.length; ) {
          var chunkName = String.fromCharCode.apply(null, bytes.subarray(pos, pos+4));
          var chunkItem = itemObjectModel.createItem(chunkName);
          var chunkLen = dv.getUint32(pos + 4);
          if (chunkLen !== 0) {
            chunkItem.byteSource = item.byteSource.slice(pos + 8, pos + 8 + dv.getUint32(pos + 4));
          }
          switch (chunkName) {
            case 'mmap':
              chunkItem.startAddingItems();
              chunkItem.addEventListener(itemObjectModel.EVT_POPULATE, MMapView.itemPopulator);
              break;
          }
          item.addItem(chunkItem);
          pos += 8 + chunkLen + chunkLen % 2;
        }
        resolve(item);
      }));

    });
  }
  
  function MMapView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  MMapView.itemPopulator = function() {
    var self = this;
    this.notifyPopulating(this.getBytes().then(function(bytes) {
      var mmap = new MMapView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      self.setDataObject(mmap);
    }));
  };
  MMapView.prototype = {
    toJSON: function() {
      return this.entries;
    },
  };
  Object.defineProperties(MMapView.prototype, {
    entryCount: {
      get: function() {
        return this.dataView.getUint32(0, false);
      },
    },
    entries: {
      get: function() {
        var entries = new Array(this.entryCount);
        var buffer = this.dataView.buffer, byteOffset = this.dataView.byteOffset;
        for (var i = 0; i < entries.length; i++) {
          entries.push(new MMapRecordView(
            buffer,
            byteOffset + (i + 1) * MMapRecordView.byteLength,
            MMapRecordView.byteLength));
        }
        return entries;
      },
    },
  });
  
  function MMapRecordView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
      bytes: {value:new Uint8Array(buffer, byteOffset, byteLength)},
    });
  }
  MMapRecordView.prototype = {
    toJSON: function() {
      if (this.isUnused) return null;
      return {
        unknown1: this.unknown1,
        chunkName: this.chunkName,
        chunkLength: this.chunkLength,
        chunkOffset: this.chunkOffset,
        unknown2: this.unknown2,
      };
    },
  };
  Object.defineProperties(MMapRecordView.prototype, {
    unknown1: {
      get: function() {
        return this.dataView.getUint32(0, false);
      },
    },
    chunkName: {
      get: function() {
        return String.fromCharCode.apply(null, this.bytes.subarray(4, 8));
      },
    },
    isUnused: {
      get: function() {
        switch (this.chunkName) {
          case 'free': case 'junk': return true;
          default: return false;
        }
      },
    },
    chunkLength: {
      get: function() {
        return this.dataView.getUint32(8, false);
      },
    },
    chunkOffset: {
      get: function() {
        return this.dataView.getUint32(12, false);
      },
    },
    unknown2: {
      get: function() {
        return this.dataView.getUint32(16, false);
      },
    },
  });
  MMapRecordView.byteLength = 20;
  
  return open;

});
