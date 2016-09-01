define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  function ResourceMapView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  ResourceMapView.prototype = {
    get isReadOnly() {
      return !!(this.getUint16(0, false) & 0x0080);
    },
    get typeListOffset() {
      var offset = this.getUint16(2, false);
      Object.defineProperty(this, 'typeListOffset', {value:offset});
      return offset;
    },
    get nameListOffset() {
      var offset = this.getUint16(4, false);
      Object.defineProperty(this, 'nameListOffset', {value:offset});
      return offset;
    },
    get typeCount() {
      var count = this.getInt16(this.typeListOffset, false) + 1;
      Object.defineProperty(this, 'typeCount', {value:count});
      return count;
    },
    get typeList() {
      var list = new Array(this.typeCount);
      var buffer = this.dataView.buffer;
      var byteOffset = this.dataView.byteOffset + this.typeListOffset + 2;
      var byteLength = ResourceTypeListEntryView.byteLength;
      for (var i = 0; i < list.length; i++) {
        list[i] = new ResourceTypeListEntryView(buffer, byteOffset, byteLength);
        byteOffset += byteLength * i;
      }
      Object.defineProperty(this, 'typeList', {value:list});
      return list;
    },
    getReferenceList: function(offset, count) {
      var buffer = this.dataView.buffer;
      var byteOffset = this.dataView.byteOffset + this.typeListOffset + offset;
      var byteLength = ReferenceListEntryView.byteLength;
      var list = new Array(count);
      for (var i = 0; i < list.length; i++) {
        list[i] = new ReferenceListEntryView(buffer, byteOffset, byteLength);
        byteOffset += byteLength;
      }
      return list;
    },
    getName: function(offset) {
      if (offset === null) return null;
      offset += this.nameListOffset;
      return macintoshRoman(this.bytes, offset + 1, this.bytes[offset]);
    },
    get resourceList() {
      var list = [];
      for (var i = 0; i < this.typeList.length; i++) {
        var type = this.typeList[i].typeName;
        var withType = this.getReferenceList(
          this.typeList[i].referenceListOffset,
          this.typeList[i].resourceCount);
        for (var j = 0; j < withType.length; j++) {
          var resourceInfo = withType[j];
          resourceInfo.type = typeName;
          reourceInfo.name = this.getName(resourceInfo.nameOffset);
        }
      }
      Object.defineProperty(this, 'resourceList', {value:list});
      return list;
    },
  };
  
  function ResourceTypeListEntryView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  ResourceTypeListEntryView.prototype = {
    get typeName() {
      return macintoshRoman(this.bytes, 0, 4);
    },
    get resourceCount() {
      return this.getInt16(4, false) + 1;
    },
    get referenceListOffset() {
      return this.getUint16(6, false);
    },
  };
  ResourceTypeListEntryView.byteLength = 8;
  
  function ReferenceListEntryView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  ReferenceListEntryView.prototype = {
    get id() {
      return this.dataView.getInt16(0, false);
    },
    get nameOffset() {
      var offset = this.dataView.getInt16(2, false);
      if (offset === -1) offset = null;
      return offset;
    },
    get isLoadedInSystemHeap() {
      return !!(this.bytes[4] & 0x40);
    },
    get mayBePagedOutOfMemory() {
      return !!(this.bytes[4] & 0x20);
    },
    get doNotMoveInMemory() {
      return !!(this.bytes[4] & 0x10);
    },
    get isReadOnly() {
      return !!(this.bytes[4] & 0x08);
    },
    get isPreloaded() {
      return !!(this.bytes[4] & 0x04);
    },
    get isCompressed() {
      return !!(this.bytes[4] & 0x01);
    },
    get dataOffset() {
      return this.dataView.getUint32(4, false) & 0xffffff;
    },
  };
  ReferenceListEntryView.byteLength = 12;

  return ResourceMapView;

});
