define(['itemObjectModel', 'mac/roman', 'ByteSource'], function(itemOM, macRoman, ByteSource) {

  'use strict';
  
  function findNullOffset(bytes, pos) {
    var offset = 0;
    while (bytes[pos + offset]) offset++;
    return offset;
  }
  
  function wordAlign(v) {
    return v + v % 2;
  }
  
  function versionString(bytes, pos) {
    if (!bytes[pos + 3]) return null;
    var versionString = bytes[pos] + '.' + (bytes[pos + 1] >> 4);
    if (bytes[pos + 1] & 7) versionString += '.' + (bytes[pos + 1] & 7);
    switch(bytes[pos + 2]) {
      case 0x20: versionString += 'dev'; break;
      case 0x40: versionString += 'a'; break;
      case 0x60: versionString += 'b'; break;
      case 0x80:
        if (bytes[pos + 3]) versionString += 'rel';
        break;
      default: versionString += '[u' + bytes[pos+2] + ']'; break;
    }
    if (bytes[pos + 3]) versionString += bytes[pos + 3];
    return versionString;
  }
  
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
                blockItem.addItem(scriptItem);
              }));
              break;
            case 'CARD': case 'BKGD':
              blockItem.startAddingItems();
              blockItem.notifyPopulating(blockItem.getBytes().then(function(bytes) {
                var card = new CardView(name === 'BKGD', bytes.buffer, bytes.byteOffset, bytes.byteLength);
                blockItem.setDataObject(card);
                for (var i = 0; i < card.parts.length; i++) {
                  var partItem = itemOM.createItem('part');
                  partItem.byteSource = ByteSource.from(card.parts[i].bytes);
                  partItem.setDataObject(card.parts[i]);
                  if (card.parts[i].script) {
                    var scriptItem = itemOM.createItem('script');
                    scriptItem.setDataObject(card.parts[i].script);
                    partItem.addItem(scriptItem);
                  }
                  blockItem.addItem(partItem);
                }
                for (var i = 0; i < card.partContents.length; i++) {
                  var contentsItem = itemOM.createItem('part contents');
                  contentsItem.byteSource = ByteSource.from(card.partContents[i].bytes);
                  contentsItem.setDataObject(card.partContents[i]);
                  blockItem.addItem(contentsItem);
                }
                if (card.cardScript) {
                  var scriptItem = itemOM.createItem('script');
                  scriptItem.setDataObject(card.cardScript);
                  blockItem.addItem(scriptItem);
                }
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
        version1: this.version1,
        version2: this.version2,
        version3: this.version3,
        version4: this.version4,
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
    get version1() {
      return versionString(this.bytes, 0x54);
    },
    get version2() {
      return versionString(this.bytes, 0x58);
    },
    get version3() {
      return versionString(this.bytes, 0x5C);
    },
    get version4() {
      return versionString(this.bytes, 0x60);
    },
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
  };
  
  function CardView(isBackground, buffer, byteOffset, byteLength) {
    this.isBackground = isBackground;
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  CardView.prototype = {
    toJSON: function() {
      return {
        pictureBitmapID: this.pictureBitmapID,
        flags: this.flags,
        backgroundID: this.backgroundID,
        scriptType: this.scriptType,
        cardName: this.cardName,
        osaScript: this.osaScript,
      };
    },
    // unknown_0x0000: 4 bytes
    get pictureBitmapID() {
      return this.dataView.getInt32(0x4, false); // 0 = transparent
    },
    get flags() {
      return this.dataView.getUint16(0x8, false);
    },
    get canDelete() {
      return !(this.flags & (1 << 14));
    },
    get hideCardPicture() {
      return !!(this.flags & (1 << 13));
    },
    get dontSearch() {
      return !!(this.flags & (1 << 11));
    },
    // unknown_0x0A: 0xE bytes
    get backgroundID() {
      return this.isBackground ? null : this.dataView.getInt32(0x18, false);
    },
    offsetForBackground: function(v) {
      return this.isBackground ? v - 4 : v;
    },
    get partCount() {
      return this.dataView.getUint16(this.offsetForBackground(0x1C), false);
    },
    // unknown_0x1E: 0x6 bytes
    get partContentCount() {
      return this.dataView.getUint16(this.offsetForBackground(0x24), false);
    },
    get scriptType() {
      return this.dataView.getUint32(this.offsetForBackground(0x24), false);
    },
    get parts() {
      var parts = new Array(this.partCount);
      var pos = this.offsetForBackground(0x2A);
      for (var i = 0; i < parts.length; i++) {
        var len = this.dataView.getUint16(pos, false);
        parts[i] = new PartView(this.bytes.buffer, this.bytes.byteOffset + pos, len);
        pos += len + len%2;
      }
      parts.afterPos = pos;
      Object.defineProperty(this, 'parts', {value:parts});
      return parts;
    },
    get partContents() {
      var contents = new Array(this.partContentCount);
      var pos = this.parts.afterPos;
      for (var i = 0; i < contents.length; i++) {
        var len = this.dataView.getUint16(pos + 2, false);
        contents[i] = new ContentsView(this.bytes.buffer, this.bytes.byteOffset + pos, 4 + len);
        pos += 4 + len + len%2;
      }
      contents.afterPos = pos;
      Object.defineProperty(this, 'partContents', {value:contents});
      return contents;
    },
    get cardNamePos() {
      return this.partContents.afterPos;
    },
    get cardName() {
      var len = findNullOffset(this.bytes, this.cardNamePos);
      var val = macRoman(this.bytes, this.partContents.afterPos, len);
      Object.defineProperty(this, 'cardName', {value:val});
      return val;
    },
    get cardNameAfterPos() {
      return this.cardNamePos + this.cardName.length + 1;
    },
    get cardScriptPos() {
      return this.cardNameAfterPos;
    },
    get cardScript() {
      var len = findNullOffset(this.bytes, this.cardScriptPos);
      var val = macRoman(this.bytes, this.cardScriptPos, len);
      Object.defineProperty(this, 'cardScript', {value:val});
      return val;
    },
    get cardScriptAfterPos() {
      return this.cardScriptPos + (this.cardScript || '').length + 1;
    },
    get osaScript() {
      var pos = this.cardScriptAfterPos;
      if (pos + 4 >= this.bytes.length) return null;
      var offset = this.dataView.getUint16(pos, false);
      var len = this.dataView.getUint16(pos + 2, false);
      if (len === 0) return null;
      pos = pos + 2 + offset;
      return macRoman(this.bytes, pos, len);
    },
  };
  
  function PartView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  PartView.prototype = {
    toJSON: function() {
      return {
        type: this.type,
        flags: this.flags,
        isHidden: this.isHidden,
        doNotWrap: this.doNotWrap,
        doNotSearch: this.doNotSearch,
        hasSharedText: this.hasSharedText,
        hasFixedLineHeight: this.hasFixedLineHeight,
        isAutoTab: this.isAutoTab,
        isEnabled: this.isEnabled,
        top: this.top,
        left: this.left,
        bottom: this.bottom,
        right: this.right,
        flags2: this.flags2,
        showName: this.showName,
        autoSelect: this.autoSelect,
        highlight: this.highlight,
        showLines: this.showLines,
        wideMargins: this.wideMargins,
        autoHighlight: this.autoHighlight,
        sharedHighlight: this.sharedHighlight,
        multipleLines: this.multipleLines,
        buttonFamilyNumber: this.buttonFamilyNumber,
        style: this.style,
        titleWidth: this.titleWidth,
        lastSelectedLine: this.lastSelectedLine,
        iconID: this.iconID,
        firstSelectedLine: this.firstSelectedLine,
        textAlignment: this.textAlignment,
        textFontID: this.textFontID,
        textFontSize: this.textFontSize,
        lineHeight: this.lineHeight,
        textStyleFlags: this.textStyleFlags,
        hasTextStyleGroup: this.hasTextStyleGroup,
        hasTextStyleExtend: this.hasTextStyleExtend,
        hasTextStyleCondense: this.hasTextStyleCondense,
        hasTextStyleShadow: this.hasTextStyleShadow,
        hasTextStyleOutline: this.hasTextStyleOutline,
        hasTextStyleUnderline: this.hasTextStyleUnderline,
        hasTextStyleItalic: this.hasTextStyleItalic,
        hasTextStyleBold: this.hasTextStyleBold,
        lineHeight2: this.lineHeight2,
        name: this.name,
      };
    },
    get type() {
      var value = this.bytes[2];
      switch(value) {
        case 1: return 'button';
        case 2: return 'field';
        default: return value;
      }
    },
    get flags() {
      return this.bytes[3];
    },
    get isHidden() {
      return !!(this.flags & (1 << 7));
    },
    get doNotWrap() {
      return !!(this.flags & (1 << 5));
    },
    get doNotSearch() {
      return !!(this.flags & (1 << 4));
    },
    get hasSharedText() {
      return !!(this.flags & (1 << 3));
    },
    get hasFixedLineHeight() {
      return !!(this.flags & (1 << 2));
    },
    get isAutoTab() {
      return !!(this.flags & (1 << 1));
    },
    get isEnabled() {
      return !(this.flags & (1 << 0));
    },
    get top() {
      return this.dataView.getInt16(4, false);
    },
    get left() {
      return this.dataView.getInt16(6, false);
    },
    get bottom() {
      return this.dataView.getInt16(8, false);
    },
    get right() {
      return this.dataView.getInt16(10, false);
    },
    get flags2() {
      return this.dataView.getUint16(12, false);
    },
    get showName() {
      return !!(this.flags2 & (1 << 15));
    },
    get autoSelect() {
      return this.showName;
    },
    get highlight() {
      return !!(this.flags2 & (1 << 14));
    },
    get showLines() {
      return this.highlight;
    },
    get wideMargins() {
      return !!(this.flags2 & (1 << 13));
    },
    get autoHighlight() {
      return this.wideMargins;
    },
    get sharedHighlight() {
      return !!(this.flags2 & (1 << 12));
    },
    get multipleLines() {
      return this.sharedHighlight;
    },
    get buttonFamilyNumber() {
      return (this.flags2 >> 8) & 0xf;
    },
    get style() {
      var v = (this.flags2 & 0xf);
      switch(this.type) {
        default: return v;
        case 'button':
          switch(v) {
            case 0: return 'transparent';
            case 1: return 'opaque';
            case 2: return 'rectangle';
            case 3: return 'roundrect';
            case 4: return 'shadow';
            case 5: return 'checkbox';
            case 6: return 'radiobutton';
            case 8: return 'standard';
            case 9: return 'default';
            case 10: return 'oval';
            case 11: return 'popup';
            default: return v;
          }
        case 'field':
          switch(v) {
            case 0: return 'transparent';
            case 1: return 'opaque';
            case 2: return 'rectangle';
            case 4: return 'shadow';
            case 7: return 'scrolling';
            default: return v;
          }
      }
    },
    get titleWidth() {
      return this.dataView.getUint16(14, false);
    },
    get lastSelectedLine() {
      return this.titleWidth;
    },
    get iconID() {
      return this.dataView.getInt16(16, false);
    },
    get firstSelectedLine() {
      return this.iconID;
    },
    get textAlignment() {
      var v = this.dataView.getInt16(18, false);
      switch(v) {
        case 0: return 'default';
        case 1: return 'center';
        case -1: return 'right';
        case -2: return 'left';
        default: return v;
      }
    },
    get textFontID() {
      return this.dataView.getInt16(20, false);
    },
    get textFontSize() {
      return this.dataView.getUint16(22, false);
    },
    get lineHeight() {
      return this.dataView.getInt16(24, false);
    },
    get textStyleFlags() {
      return this.dataView.getUint16(26, false);
    },
    get hasTextStyleGroup() {
      return !!(this.textStyleFlags & (1 << 15));
    },
    get hasTextStyleExtend() {
      return !!(this.textStyleFlags & (1 << 14));
    },
    get hasTextStyleCondense() {
      return !!(this.textStyleFlags & (1 << 13));
    },
    get hasTextStyleShadow() {
      return !!(this.textStyleFlags & (1 << 12));
    },
    get hasTextStyleOutline() {
      return !!(this.textStyleFlags & (1 << 11));
    },
    get hasTextStyleUnderline() {
      return !!(this.textStyleFlags & (1 << 10));
    },
    get hasTextStyleItalic() {
      return !!(this.textStyleFlags & (1 << 9));
    },
    get hasTextStyleBold() {
      return !!(this.textStyleFlags & (1 << 8));
    },
    get lineHeight2() {
      return this.dataView.getUint16(28, false);
    },
    get namePos() {
      return 30;
    },
    get name() {
      var name = macRoman(this.bytes, this.namePos, findNullOffset(this.bytes, this.namePos));
      Object.defineProperty(this, 'name', {value:name});
      return name;
    },
    get nameAfterPos() {
      return this.namePos + (this.name || '').length + 2;
    },
    get scriptPos() {
      return this.nameAfterPos;
    },
    get script() {
      return macRoman(this.bytes, this.scriptPos).replace(/\0.*/, '');
    },
  };
  
  function ContentsView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  ContentsView.prototype = {
    toJSON: function() {
      return {
        forPart: this.forPart,
        text: this.text,
      };
    },
    get forPart() {
      var v = this.dataView.getInt16(0, false);
      return (v < 0) ? {type:'card', id:-v} : {type:'background', id:v};
    },
    get text() {
      var len = this.dataView.getUint16(4, false);
      if (len > 32767) {
        len -= 32770;
        return macRoman(this.bytes, 6 + len).replace(/\0.*/, '');
      }
      else {
        return macRoman(this.bytes, 7).replace(/\0.*/, '');
      }
    },
  };
  
  return open;

});
