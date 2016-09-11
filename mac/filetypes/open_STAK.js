define(['itemObjectModel', 'mac/roman'], function(itemOM, macRoman) {

  'use strict';
  
  function open(item) {
    function onBlock(item, byteSource) {
      return byteSource.slice(0, 12).getBytes().then(function(headerBytes) {
        var dv = new DataView(
          headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);
        var length = dv.getUint32(0, false);
        var name = macRoman(headerBytes, 4, 4);
        var id = dv.getInt32(8, false);
        var blockItem = itemOM.createItem(name + " " + id);
        item.addItem(blockItem);
        if (length > 8) {
          blockItem.byteSource = byteSource.slice(12, length);
          switch (name) {
            case 'STAK':
              blockItem.startAddingItems();
              blockItem.notifyPopulating(blockItem.getBytes().then(function(bytes) {
                var stack = new StackView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                blockItem.setDataObject(stack);
                for (var i = 0; i < stack.patternCount; i++) {
                  var patternItem = itemOM.createItem('pattern ' + i);
                  var patternData = stack.getRawPattern(i);
                  patternItem.withPixels(8, 8, function(pixelData) {
                    for (var y = 0; y < 8; y++) {
                      for (var x = 0; x < 8; x++) {
                        if (patternData[y] & (0x80 >> x)) {
                          pixelData[4 * (y*8 + x) + 3] = 0xff;
                        }
                      }
                    }
                  });
                  blockItem.addItem(patternItem);
                }
                var scriptItem = itemOM.createItem('script');
                scriptItem.setDataObject(stack.getScript());
              }));
              break;
          }
        }
        if (byteSource.byteLength >= (length + 12)) {
          return onBlock(item, byteSource.slice(length));
        }
      });
    }
    return onBlock(item, item.byteSource);
  }
  
  function StackView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  StackView.prototype = {
    toJSON: function() {
      return {
        cardCount: this.cardCount,
        listBlockID: this.listBlockID,
        userLevelSetting: this.userLevelSetting,
        canPeek: this.canPeek,
        canAbort: this.canAbort,
        hasPrivateAccess: this.hasPrivateAccess,
        canDelete: this.canDelete,
        canModify: this.canModify,
        screenHeight: this.screenHeight,
        screenWidth: this.screenWidth,
      };
    },
    // unknown_0x00: 0x20 bytes
    get cardCount() {
      return this.dataView.getUint32(0x20, false);
    },
    // unknown_0x24: card ID for unknown reasons
    get listBlockID() {
      return this.dataView.getInt32(0x28, false);
    },
    // unknown_0x2C: 0x10 bytes
    get userLevelSetting() {
      return this.dataView.getUint16(0x3C, false);
    },
    // unknown_0x3E: 0x02 bytes
    get flags() {
      return this.dataView.getUint16(0x40, false);
    },
    get canPeek() {
      return !(this.flags & (1 << 10));
    },
    get canAbort() {
      return !(this.flags & (1 << 11));
    },
    get hasPrivateAccess() {
      return !!(this.flags & (1 << 13));
    },
    get canDelete() {
      return !(this.flags & (1 << 14));
    },
    get canModify() {
      return !(this.flags & (1 << 15));
    },
    // unknown_0x42: 0x12 bytes
    // unknown_0x64: 0x148 bytes
    get screenHeight() {
      return this.dataView.getUint16(0x1ac, false);
    },
    get screenWidth() {
      return this.dataView.getUint16(0x1ae, false);
    },
    // unknown_0x1AE: 0x106 bytes
    get patternCount() {
      return 40;
    },
    getRawPattern: function(n) {
      return this.bytes.subarray(0x2B4 + n * 8, 0x2B4 + (n + 1) * 8);
    },
    // unknown_0x3F4: 0x200 bytes
    getScript: function() {
      return macRoman(this.bytes, 0x5F4).replace(/\0.*/, '');
    },
    // TODO: support NumVersion info for HyperCard version numbers
  };
  
  return open;

});
