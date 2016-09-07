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
            case 'KEY*':
              chunkItem.startAddingItems();
              chunkItem.addEventListener(itemObjectModel.EVT_POPULATE, KeyStarView.itemPopulator);
              break;
            case 'VWCF':
              chunkItem.startAddingItems();
              chunkItem.addEventListener(itemObjectModel.EVT_POPULATE, VWCFView.itemPopulator);
              break;
            case 'CAS*':
              chunkItem.startAddingItems();
              chunkItem.addEventListener(itemObjectModel.EVT_POPULATE, uint32ArrayItemPopulator);
              break;
          }
          item.addItem(chunkItem);
          pos += 8 + chunkLen + chunkLen % 2;
        }
        resolve(item);
      }));

    });
  }
  
  function uint32ArrayItemPopulator() {
    var item = this;
    item.notifyPopulating(item.getBytes().then(function(bytes) {
      var array = new Array(bytes.length / 4);
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (var i = 0; i < array.length; i++) {
        array[i] = dv.getUint32(i * 4, false);
      }
      item.setDataObject(array);
    }));
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
      return {
        unknown_0x00: this.unknown_0x00,
        unknown_0x04: this.unknown_0x04,
        entries: this.entries,
        unknown_0x0C: this.unknown_0x0C,
        unknown_0x10: this.unknown_0x10,
      };
    },
  };
  Object.defineProperties(MMapView.prototype, {
    unknown_0x00: {
      get: function() {
        return this.dataView.getUint32(0, false);
      },
    },
    unknown_0x04: {
      get: function() {
        return this.dataView.getUint32(4, false);
      },
    },
    entryCount: {
      get: function() {
        return this.dataView.getUint32(8, false);
      },
    },
    unknown_0x0C: {
      get: function() {
        return this.dataView.getUint32(12, false);
      },
    },
    unknown_0x10: {
      get: function() {
        return this.dataView.getUint32(16, false);
      },
    },
    entries: {
      get: function() {
        var entries = new Array(this.entryCount);
        var buffer = this.dataView.buffer, byteOffset = this.dataView.byteOffset;
        for (var i = 0; i < entries.length; i++) {
          entries[i] = new MMapRecordView(
            buffer,
            byteOffset + (i + 1) * MMapRecordView.byteLength,
            MMapRecordView.byteLength);
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
  
  function KeyStarView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  KeyStarView.itemPopulator = function() {
    var self = this;
    this.notifyPopulating(this.getBytes().then(function(bytes) {
      self.setDataObject(new KeyStarView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    }));
  };
  KeyStarView.prototype = {
    toJSON: function() {
      return {
        unknown_0x00: this.unknown_0x00,
        unknown_0x02: this.unknown_0x02,
        unknown_0x04: this.unknown_0x04,
        entries: this.entries,
      };
    },
  };
  Object.defineProperties(KeyStarView.prototype, {
    unknown_0x00: {
      get: function() {
        return this.dataView.getUint16(0, false);
      },
    },
    unknown_0x02: {
      get: function() {
        return this.dataView.getUint16(2, false);
      },
    },
    unknown_0x04: {
      get: function() {
        return this.dataView.getUint32(4, false);
      },
    },
    entryCount: {
      get: function() {
        return this.dataView.getUint32(8, false);
      },
    },
    entries: {
      get: function() {
        var entries = new Array(this.entryCount);
        var buffer = this.dataView.buffer, byteOffset = this.dataView.byteOffset;
        for (var i = 0; i < entries.length; i++) {
          entries[i] = new KeyStarRecordView(
            buffer,
            byteOffset + (i + 1) * KeyStarRecordView.byteLength,
            KeyStarRecordView.byteLength);
        }
        return entries;
      },
    },
  });
  
  function KeyStarRecordView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
      bytes: {value:new Uint8Array(buffer, byteOffset, byteLength)},
    });
  }
  KeyStarRecordView.prototype = {
    toJSON: function() {
      return {
        parentNumber: this.parentNumber,
        childNumber: this.childNumber,
        childName: this.childName,
      };
    },
  };
  Object.defineProperties(KeyStarRecordView.prototype, {
    childNumber: {
      get: function() {
        return this.dataView.getUint32(0, false);
      },
    },
    parentNumber: {
      get: function() {
        return this.dataView.getUint32(4, false);
      },
    },
    childName: {
      get: function() {
        return String.fromCharCode.apply(null, this.bytes.subarray(8, 12));
      },
    },
  });
  KeyStarRecordView.byteLength = 12;
  
  function VWCFView(buffer, byteOffset, byteLength) {
    Object.defineProperties(this, {
      dataView: {value:new DataView(buffer, byteOffset, byteLength)},
    });
  }
  VWCFView.prototype = {
    toJSON: function() {
      return {
        width: this.width,
        height: this.height,
        frameDuration: this.frameDuration,
        stageColor: this.stageColor,
        defaultPalette: this.defaultPalette,
      };
    },
  };
  VWCFView.itemPopulator = function() {
    var item = this;
    item.notifyPopulating(item.getBytes().then(function(bytes) {
      item.setDataObject(new VWCFView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    }));
  };
  Object.defineProperties(VWCFView.prototype, {
    frameDuration: {
      get: function() {
        return 1000/this.dataView.getUint8(0x37);
      },
    },
    height: {
      get: function() {
        return this.dataView.getUint16(0x8, false);
      },
    },
    width: {
      get: function() {
        return this.dataView.getUint16(0xA, false);
      },
    },
    stageColor: {
      get: function() {
        return this.dataView.getUint8(0x1B);
      },
    },
    defaultPalette: {
      get: function() {
				return this.dataView.getInt16(0x46, false);
      },
    },
  });
  
  return open;

});
