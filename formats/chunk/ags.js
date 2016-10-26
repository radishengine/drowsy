define(function() {

  'use strict';
  
  var voidBuffer = new ArrayBuffer(0);
  
  var LATEST_FORMAT_VERSION = 43;
  var LATEST_GUI_VERSION = 330;
  
  function getVersionedType(T, formatVersion, guiVersion) {
    if (formatVersion === T.prototype.formatVersion
    && (isNaN(T.prototype.guiVersion) || guiVersion === T.prototype.guiVersion)) {
      return T;
    }
    var idstr = 'v' + formatVersion;
    if (!('guiVersion' in T)) guiVersion = NaN;
    if (!isNaN(guiVersion)) idstr += '_g' + guiVersion;
    if (idstr in T) return T[idstr];
    function TVersioned(buffer, byteOffset, byteLength) {
      T.call(this, buffer, byteOffset, byteLength);
    }
    TVersioned.prototype = new T(voidBuffer, 0, 0);
    TVersioned.prototype.formatVersion = formatVersion;
    if (!isNaN(guiVersion)) {
      TVersioned.prototype.guiVersion = guiVersion;
    }
    return T[idstr] = TVersioned;
  }
  
  function nullTerminated(bytes, offset, length) {
  }
  
  function nullTerminatedList(bytes, offset) {
    var list = new Array(bytes[offset + 0] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24));
    offset += 4;
    for (var i = 0; i < list.length; i++) {
      offset += (list[i] = nullTerminated(bytes, offset)).length + 1;
    }
    list.afterPos = offset;
    return list;
  }
  
  function lenPrefixString(bytes, offset) {
  }
  
  function GameView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  GameView.prototype = {
    get signature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 30));
    },
    get hasValidSignature() {
      return this.signature === 'Adventure Creator Game File v2';
    },
    get formatVersion() {
      return this.dv.getUint32(30, true);
    },
    get engineVersion() {
      return (this.formatVersion < 12) ? null : lenPrefixString(this.bytes, 34);
    },
    get offsetof_header() {
      return (this.formatVersion < 12) ? 30 : 34 + this.getInt32(30, true);
    },
    get header() {
      var header, offset = this.offsetof_header;
      if (this.formatVersion <= 12) {
        header = new VintageHeader(this.dv.buffer, this.dv.byteOffset + offset, this.dv.byteLength - offset);
      }
      else {
        header = new HeaderV2(this.dv.buffer, this.dv.byteOffset + offset, this.dv.byteLength - offset);
      }
      Object.defineProperty(this, 'header', header);
      return header;
    },
  };
  
  function VintageHeader(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  VintageHeader.prototype = {
    get title() {
      return nullTerminated(this.bytes, 0, 50);
    },
    get palette_uses() {
      return this.bytes.subarray(50, 50 + 256);
    },
    get palette() {
      return this.bytes.subarray(50 + 256, 50 + 256 + 256*4);
    },
    get vintageGUIs() {
      var list = new Array(10);
      var pos = 50 + 256 + 256*4 + 2; // extra 2 bytes for 32-bit align
      var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset;
      for (var i = 0; i < list.length; i++) {
        list[i] = new VintageGUI(buffer, byteOffset + pos, VintageGUI.byteLength);
        pos += VintageGUI.byteLength;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'vintageGUIs', list);
      return list;
    },
    get activeGUICount() {
      return this.dv.getInt32(this.vintageGUIs.afterPos, true);
    },
    get viewCount() {
      return this.dv.getInt32(this.vintageGUIs.afterPos + 4, true);
    },
    get cursors() {
      var list = new Array(10), pos = this.vintageGUIs.afterPos + 8;
      var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset;
      for (var i = 0; i < list.length; i++) {
        list[i] = new CursorView(buffer, byteOffset + pos, CursorView.byteLength);
        pos += CursorView.byteLength;
      }
      Object.defineProperty(this, 'cursors', list);
      return list;
    },
  };
  
  function CursorView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  CursorView.prototype = {
    get sprite() {
      return this.dv.getInt32(0, true);
    },
    get handleX() {
      return this.dv.getInt16(4, true);
    },
    get handleY() {
      return this.dv.getInt16(6, true);
    },
    get view() {
      return this.dv.getInt16(8, true); // 0 same as -1 if formatVersion < 32
    },
    get name() {
      return nullTerminated(this.bytes, 10, 10);
    },
    get flags() {
      return this.bytes[20];
    },
    get animatesWhenMoving() {
      return !!(this.flags & 1);
    },
    get isEnabled() {
      return !(this.flags & 2);
    },
    get processClick() {
      return !!(this.flags & 4);
    },
    get animatedOverHotspot() {
      return !!(this.flags & 8);
    },
    // 3 unused bytes (32-bit alignment)
  };
  CursorView.byteLength = 24;
  
  function VintageGUI(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  VintageGUI.prototype = {
    get x() { return this.dv.getInt32(0, true); },
    get y() { return this.dv.getInt32(4, true); },
    get x2() { return this.dv.getInt32(8, true); },
    get y2() { return this.dv.getInt32(12, true); },
    get bgcol() { return this.dv.getInt32(16, true); },
    get fgcol() { return this.dv.getInt32(20, true); },
    get bordercol() { return this.dv.getInt32(24, true); },
    get vtextxp() { return this.dv.getInt32(28, true); },
    get vtextyp() { return this.dv.getInt32(32, true); },
    get vtextalign() { return this.dv.getInt32(36, true); },
    get vtext() { return nullTerminated(this.bytes, 40, 40); },
    get numbuttons() { return this.dv.getInt32(80, true); },
    get buttons() {
      var list = new Array(20);
      var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset;
      for (var i = 0; i < list.length; i++) {
        list[i] = new VintageGUIButton(buffer, byteOffset + 84 + i*36, 36);
      }
      Object.defineProperty(this, 'buttons', {value:list});
      return list;
    },
    get flags() {
      return this.dv.getInt32(804, true);
    },
    // unused: 4 bytes
    get popupyp() {
      return this.dv.getInt32(812, true);
    },
    get popup() {
      return this.dv.getUint8(816);
    },
    get on() {
      return this.dv.getUint8(817);
    },
  };
  VintageGUI.byteLength = 820;
  
  function VintageGUIButton(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  VintageGUIButton.prototype = {
    get x() { return this.dv.getInt32(0, true); },
    get y() { return this.dv.getInt32(4, true); },
    get pic() { return this.dv.getInt32(8, true); },
    get overpic() { return this.dv.getInt32(12, true); },
    get pushpic() { return this.dv.getInt32(16, true); },
    get leftclick() { return this.dv.getInt32(20, true); },
    get rightclick() { return this.dv.getInt32(24, true); },
    get inventoryWidth() { return this.leftclick; },
    get inventoryHeight() { return this.rightclick; },
    // unused: 4 bytes
    get flags() { return this.dv.getUint8(32); },
    // unused: 3 bytes
  };
  VintageGUIButton.byteLength = 36;
  
  function HeaderV2(buffer, byteOffset, byteLength) {
  }
  
  function GUICollectionView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  GUICollectionView.prototype = {
    formatVersion: LATEST_FORMAT_VERSION,
    get signature() {
      return this.dv.getUint32(0, true).toString(16).toUpperCase();
    },
    get hasValidSignature() {
      return this.signature === 'CAFEBEEF';
    },
    get guiVersion() {
      var v = this.getUint32(8, true);
      return (v < 100) ? 0 : v;
    },
    get segmentType() {
      return 'chunk/ags; which=gui-collection; v=' + this.formatVersion;
    },
    get offsetof_guis() {
      return (this.version === 0) ? 8 : 12;
    },
    get guis() {
      var pos = this.offsetof_guis;
      var list = new Array(this.dv.Uint32(pos, true));
      pos += 4;
      var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset, byteLength = this.dv.byteLength;
      var V_GUIView = getVersionedType(GUIView, this.formatVersion, this.guiVersion);
      for (var i = 0; i < list.length; i++) {
        pos += (list[i] = new V_GUIView(buffer, byteOffset + pos, byteLength - pos)).byteLength;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'guis', {value:list});
      return list;
    },
    get buttons() {
      var pos = this.interfaces.afterPos;
      var list = new Array(this.dv.Uint32(pos, true));
      pos += 4;
      var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset, byteLength = this.dv.byteLength;
      var V_ButtonView = getVersionedType(ButtonView, this.formatVersion, this.guiVersion);
      for (var i = 0; i < list.length; i++) {
        pos += (list[i] = new V_ButtonView(buffer, byteOffset + pos, ButtonView.byteLength)).byteLength;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'buttons', {value:list});
      return list;
    },
    get labels() {
      var pos = this.buttons.afterPos;
      var list = new Array(this.dv.Uint32(pos, true));
      pos += 4;
      var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset, byteLength = this.dv.byteLength;
      var V_LabelView = getVersionedType(ListView, this.formatVersion, this.guiVersion);
      for (var i = 0; i < list.length; i++) {
        pos += (list[i] = new V_LabelView(buffer, byteOffset + pos, LabelView.byteLength)).byteLength;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'labels', {value:list});
      return list;
    },
    get inventoryWindows() {
      var pos = this.labels.afterPos;
      var list = new Array(this.dv.Uint32(pos, true));
      pos += 4;
      var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset, byteLength = this.dv.byteLength;
      var V_InventoryWindowView = getVersionedType(InventoryWindowView, this.formatVersion, this.guiVersion);
      for (var i = 0; i < list.length; i++) {
        pos += (list[i] = new InventoryWindowView(buffer, byteOffset + pos, InventoryWindowView.byteLength)).byteLength;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'inventoryWindows', {value:list});
      return list;
    },
    get sliders() {
      var list, pos = this.inventoryWindows.afterPos;
      if (this.guiVersion < 100) {
        list = [];
      }
      else {
        list = new Array(this.dv.getUint32(pos, true));
        pos += 4;
        var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset, byteLength = this.dv.byteLength;
        var V_SliderView = getVersionedType(SliderView, this.formatVersion, this.guiVersion);
        for (var i = 0; i < list.length; i++) {
          pos += (list[i] = new V_SliderView(buffer, byteOffset + pos, byteLength - pos)).byteLength;
        }
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'sliders', {value:list});
      return list;
    },
    get textBoxes() {
      var list, pos = this.sliders.afterPos;
      if (this.guiVersion < 101) {
        list = [];
      }
      else {
        list = new Array(this.dv.getUint32(pos, true));
        pos += 4;
        var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset, byteLength = this.dv.byteLength;
        var V_TextBoxView = getVersionedType(TextBoxView, this.formatVersion, this.guiVersion);
        for (var i = 0; i < list.length; i++) {
          pos += (list[i] = new V_TextBoxView(buffer, byteOffset + pos, byteLength - pos)).byteLength;
        }
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'sliders', {value:list});
      return list;
    },
    get listBoxes() {
      var list, pos = this.textBoxes.afterPos;
      if (this.guiVersion < 102) {
        list = [];
      }
      else {
        list = new Array(this.dv.getUint32(pos, true));
        pos += 4;
        var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset, byteLength = this.dv.byteLength;
        var V_ListBoxView = getVersionedType(ListBoxView, this.formatVersion, this.guiVersion);
        for (var i = 0; i < list.length; i++) {
          pos += (list[i] = new V_ListBoxView(buffer, byteOffset + pos, byteLength - pos)).byteLength;
        }
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'sliders', {value:list});
      return list;
    },
    get byteLength() {
      return this.listBoxes.afterPos;
    },
  };
  
  function GUIView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  GUIView.prototype = {
    formatVersion: LATEST_FORMAT_VERSION,
    guiVersion: LATEST_GUI_VERSION,
    get vtext() {
      return nullTerminated(this.bytes, 0, 4);
    },
    get scriptName() {
      var name = (this.guiVersion < 103) ? 'GUI' + this.dv.getInt32(116, true) : nullTerminated(this.bytes, 4, 16);
      if (!/^g/.test(name) && this.formatVersion <= 32) {
        return 'g' + name.slice(0, 1).toUpperCase() + name.slice(1).toLowerCase();
      }
      return name;
    },
    get onClick() {
      return nullTerminated(this.bytes, 20, 20);
    },
    get x() {
      return this.dv.getInt32(40, true);
    },
    get y() {
      return this.dv.getInt32(44, true);
    },
    get width() {
      return this.dv.getInt32(48, true);
    },
    get height() {
      return Math.max(2, this.dv.getInt32(52, true));
    },
    get focus() {
      return this.dv.getInt32(56, true);
    },
    get controlCount() {
      return this.dv.getInt32(60, true);
    },
    get popupMode() {
      var v = this.dv.getInt32(64, true);
      switch (v) {
        case 0: return 'none';
        case 1: return 'mouseY';
        case 2: return 'script';
        case 3: return 'noAutoRemove';
        case 4: return 'noneInitiallyOff';
        default: return v;
      }
    },
    get isAlwaysShown() {
      return this.popupMode === 'noAutoRemove';
    },
    get isInitiallyShown() {
      return this.popupMode === 'none' || this.isAlwaysShown;
    },
    get pausesGameWhileShown() {
      return this.popupMode === 'script';
    },
    get popupMouseY() {
      return this.dv.getInt32(68, true);
    },
    get backgroundColor() {
      return this.dv.getInt32(72, true);
    },
    get backgroundSprite() {
      return this.dv.getInt32(76, true);
    },
    get borderColor() {
      return this.dv.getInt32(80, true);
    },
    get mouseOver() {
      return this.dv.getInt32(84, true);
    },
    get mouseWasX() {
      return this.dv.getInt32(88, true);
    },
    get mouseWasY() {
      return this.dv.getInt32(92, true);
    },
    get mouseDownOn() {
      return this.dv.getInt32(96, true);
    },
    get highlightObject() {
      return this.dv.getInt32(100, true);
    },
    get flags() {
      return this.dv.getInt32(104, true);
    },
    get isDefault() {
      return !!(this.flags & 0x0001);
    },
    get isEnabled() {
      return !(this.flags & 0x0004);
    },
    get isVisible() {
      return !(this.flags & 0x0010);
    },
    get isClipped() {
      return !!(this.flags & 0x0020);
    },
    get isClickable() {
      return !(this.flags & 0x0040);
    },
    get isTranslated() {
      return !!(this.flags & 0x0080);
    },
    get isDeleted() {
      return !!(this.flags & 0x8000);
    },
    get transparency() {
      return this.dv.getInt32(108, true);
    },
    get zOrder() {
      return (this.guiVersion < 105) ? this.dv.getInt32(116, true) : this.dv.getInt32(112, true);
    },
    get id() {
      return this.dv.getInt32(116, true); // gets overwritten
    },
    // reserved: 20 bytes
    get on() {
      return this.dv.getInt32(140, true);
    },
    // unused: 120 bytes (MAX_OBJS_ON_GUI * 4)
    getControlID: function(n) {
      return this.dv.getInt32(244 + n * 4, true) & 0xffff;
    },
    getControlType: function(n) {
      var v = this.dv.getInt32(244 + n * 4, true) >>> 16;
      switch (v) {
        case 1: return 'button';
        case 2: return 'label';
        case 3: return 'inventory';
        case 4: return 'slider';
        case 5: return 'textBox';
        case 6: return 'listBox';
        default: return v;
      }
    },
    get byteLength() {
      return 364;
    },
  };
  
  function GUIControlView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  GUIControlView.prototype = {
    formatVersion: LATEST_FORMAT_VERSION,
    guiVersion: LATEST_GUI_VERSION,
    get flags() {
      return this.dv.getInt32(0, true);
    },
    get isDefault() {
      return !!(this.flags & 0x0001);
    },
    get isEnabled() {
      return !(this.flags & 0x0004);
    },
    get isVisible() {
      return !(this.flags & 0x0010);
    },
    get isClipped() {
      return !!(this.flags & 0x0020);
    },
    get isClickable() {
      return !(this.flags & 0x0040);
    },
    get isTranslated() {
      return !!(this.flags & 0x0080);
    },
    get isDeleted() {
      return !!(this.flags & 0x8000);
    },
    get x() {
      return this.getInt32(4, true);
    },
    get y() {
      return this.getInt32(8, true);
    },
    get width() {
      return this.getInt32(12, true);
    },
    get height() {
      return this.getInt32(16, true);
    },
    get zOrder() {
      return this.getInt32(20, true);
    },
    get isActivated() {
      return this.getInt32(24, true);
    },
    get offsetof_scriptName() {
      return 28;
    },
    get scriptName() {
      if (this.guiVersion < 106) return null;
      return nullTerminated(this.bytes, this.offsetof_scriptName);
    },
    get offsetof_eventHandlers() {
      var scriptName = this.scriptName;
      return offsetof_scriptName + ((scriptName === null) ? 0 : scriptName.length + 1);
    },
    get eventHandlers() {
      var list;
      if (this.version < 108) {
        list = [];
        list.afterPos = this.offsetof_eventHandlers;
      }
      else {
        list = nullTerminatedList(this.bytes, this.offsetof_eventHandlers);
      }
      Object.defineProperty(this, 'eventHandlers', list);
      return list;
    },
    get byteLength() {
      return this.eventHandlers.afterPos;
    },
    get endof_control() {
      return this.eventHandlers.afterPos;
    },
  };
  
  function ButtonView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  ButtonView.prototype = Object.defineProperties(new GUIControlView(voidBuffer, 0, 0), {
    onClick: {
      get: function() {
        return this.eventHandlers[0];
      },
    },
    isTranslated: {value: true},
    normalSprite: {
      get: function() {
        return this.dv.getInt32(this.endof_control, true);
      },
    },
    mouseOverSprite: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 4, true);
      },
    },
    pushedSprite: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 8, true);
      },
    },
    usepic: { // just copies sprite
      get: function() {
        return this.dv.getInt32(this.endof_control + 12, true);
      },
    },
    isPushed: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 16, true);
      },
    },
    isOver: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 20, true);
      },
    },
    font: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 24, true);
      },
    },
    textColor: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 28, true);
      },
    },
    leftClick: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 32, true);
      },
    },
    rightClick: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 36, true);
      },
    },
    leftClickData: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 40, true);
      },
    },
    rightClickData: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 44, true);
      },
    },
    text: {
      get: function() {
        return nullTerminated(this.bytes, this.endof_control + 48, 50);
      },
    },
    offsetof_alignment: {
      get: function() {
        return this.endof_control + 98;
      },
    },
    alignment: {
      get: function() {
        if (this.guiVersion < 111) return 'topMiddle';
        var alignment = this.dv.getInt32(this.offsetof_alignment, true);
        switch (alignment) {
          case 0: return 'topMiddle';
          case 1: return 'topLeft';
          case 2: return 'topRight';
          case 3: return 'middleLeft';
          case 4: return 'centred';
          case 5: return 'middleRight';
          case 6: return 'bottomLeft';
          case 7: return 'bottomMiddle';
          case 8: return 'bottomRight';
          default: return alignment;
        }
      },
    },
    byteLength: {
      get: function() {
        if (this.guiVersion < 111) return this.offsetof_alignment;
        return this.offsetof_alignment + 4 + 4; // 4 bytes reserved after alignment
      },
    },
  });
  
  function LabelView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  LabelView.prototype = Object.defineProperties(new GUIControlView(voidBuffer, 0, 0), {
    isTranslated: {value:true},
    text: {
      get: function() {
        var pos = this.endof_control;
        if (this.guiVersion < 113) return nullTerminated(this.bytes, pos, 200);
        return nullTerminated(this.bytes, pos + 4, this.getUint32(pos, true));
      },
    },
    offsetof_font: {
      get: function() {
        var pos = this.endof_control;
        return (this.guiVersion < 113) ? (pos + 200) : (pos + 4 + this.getUint32(pos, true));
      },
    },
    font: {
      get: function() {
        return this.dv.getInt32(this.offsetof_font, true);
      },
    },
    textColor: {
      get: function() {
        return this.dv.getInt32(this.offsetof_font + 4, true);
      },
    },
    alignment: {
      get: function() {
        var alignment = this.dv.getInt32(this.offsetof_font + 8, true);
        switch (alignment) {
          case 0: return 'left';
          case 1: return 'right';
          case 3: return 'centre';
          default: return alignment;
        }
      },
    },
    byteLength: {
      get: function() {
        return this.offsetof_font + 12;
      },
    },
  });
  
  function InventoryWindowView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  InventoryWindowView.prototype = Object.defineProperties(new GUIControlView(voidBuffer, 0, 0), {
    forCharacter: {
      get: function() {
        if (this.guiVersion < 109) return -1;
        return this.dv.getInt32(this.endof_control, true);
      },
    },
    itemWidth: {
      get: function() {
        if (this.guiVersion < 109) return 40;
        return this.dv.getInt32(this.endof_control + 4, true);
      },
    },
    itemHeight: {
      get: function() {
        if (this.guiVersion < 109) return 22;
        return this.dv.getInt32(this.endof_control + 8, true);
      },
    },
    topIndex: {
      get: function() {
        if (this.guiVersion < 109) return 0;
        return this.dv.getInt32(this.endof_control + 12, true);
      },
    },
    byteLength: {
      get: function() {
        return this.endof_control + (this.guiVersion < 109 ? 0 : 16);
      },
    },
  });
  
  function SliderView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  SliderView.prototype = Object.defineProperties(new GUIControlView(voidBuffer, 0, 0), {
    minValue: {
      get: function() {
        return this.dv.getInt32(this.endof_control, true);
      },
    },
    maxValue: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 4, true);
      },
    },
    defaultValue: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 8, true);
      },
    },
    mousePressed: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 12, true);
      },
    },
    handleSprite: {
      get: function() {
        if (this.guiVersion < 104) return -1;
        return this.dv.getInt32(this.endof_control + 16, true);
      },
    },
    handleOffset: {
      get: function() {
        if (this.guiVersion < 104) return 0;
        return this.dv.getInt32(this.endof_control + 20, true);
      },
    },
    backgroundSprite: {
      get: function() {
        if (this.guiVersion < 104) return -1;
        return this.dv.getInt32(this.endof_control + 24, true);
      },
    },
    byteLength: {
      get: function() {
        return this.endof_control + (this.guiVersion < 104) ? 16 : 28;
      },
    },
  });
  
  function TextBoxView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  TextBoxView.prototype = Object.defineProperties(new GUIControlView(voidBuffer, 0, 0), {
    defaultText: {
      get: function() {
        return nullTerminated(this.bytes, this.endof_control, 200);
      },
    },
    font: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 200, true);
      },
    },
    textColor: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 204, true);
      },
    },
    extendedFlags: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 208, true);
      },
    },
    hasBorder: {
      get: function() {
        return !(this.extendedFlags & 1);
      },
    },
    byteLength: {
      get: function() {
        return this.endof_control + 212;
      },
    },
  });
  
  function ListBoxView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  ListBoxView.prototype = Object.defineProperties(new GUIControlView(voidBuffer, 0, 0), {
    itemCount: {
      get: function() {
        return this.dv.getInt32(this.endof_control, true);
      },
    },
    selectedTextColor: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 4, true); // non zero
      },
    },
    topItem: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 8, true);
      },
    },
    mouseX: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 12, true);
      },
    },
    mouseY: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 16, true);
      },
    },
    rowHeight: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 20, true);
      },
    },
    num_items_fit: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 24, true);
      },
    },
    font: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 28, true);
      },
    },
    textColor: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 32, true);
      },
    },
    backgroundColor: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 36, true);
      },
    },
    extendedFlags: {
      get: function() {
        return this.dv.getInt32(this.endof_control + 40, true);
      },
    },
    hasBorder: {
      get: function(){ return !(this.extendedFlags & 1); },
    },
    hasArrows: {
      get: function(){ return !(this.extendedFlags & 2); },
    },
    hasSaveGameIndexing: {
      get: function(){ return !!(this.extendedFlags & 4); },
    },
    alignment: {
      get: function() {
        if (this.guiVersion < 112) return 'left';
        var v = this.getInt32(this.endof_control + 44, true);
        switch (v) {
          case 0: return 'left';
          case 1: return 'right';
          case 2: return 'centre';
          default: return v;
        }
      },
    },
    offsetof_selectedBackgroundColor: {
      get: function() {
        if (this.guiVersion < 112) return this.endof_control + 44;
        return this.endof_control + 44 + 4 + 4; // reserved int after alignment
      },
    },
    selectedBackgroundColor: {
      get: function() {
        if (this.guiVersion < 107) return this.textColor;
        return this.dv.getInt32(this.offsetof_selectedBackgroundColor, true);
      },
    },
    offsetof_items: {
      get: function() {
        return this.offsetof_selectedBackgroundColor + (this.guiVersion < 107 ? 0 : 4);
      },
    },
    items: {
      get: function() {
        var list = new Array(this.itemCount);
        var pos = this.offset_items;
        for (var i = 0; i < list.length; i++) {
          var text = nullTerminated(this.bytes, pos);
          list[i] = {text:text, saveGame:-1};
          pos += text.length + 1;
        }
        if (this.guiVersion >= 114 && this.hasSaveGameIndexing) {
          for (var i = 0; i < list.length; i++) {
            list[i].saveGame = this.dv.getInt16(pos, true);
            pos += 2;
          }
        }
        list.afterPos = pos;
        Object.defineProperty(this, 'items', list);
        return list;
      },
    },
    byteLength: {
      get: function() {
        return this.items.afterPos;
      },
    },
  });
  
  function FileListV6View(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  FileListV6View.prototype = {
    get fileCount() {
      return this.dv.getUint16(8, true);
    },
    get fileRecords() {
      var list = new Array(this.fileCount);
      var nameBase = 23;
      var lengthBase = nameBase + 13 * list.length;
      var flagsBase = lengthBase + list.length * 4;
      var byteOffset = 0;
      for (var i = 0; i < list.length; i++) {
        var namePos = nameBase + (13 * i);
        var lengthPos = lengthBase + (4 * i);
        var flagsPos = flagsBase + (2 * i);
        var byteLength = this.dv.getUint32(lengthPos, true);
        list[i] = {
          name: String.fromCharCode.apply(null, this.bytes.subarray(namePos, namePos + 13)).match(/^[^\0]*/)[0],
          byteLength: byteLength,
          flags: this.dv.getUint16(flagsPos, true),
          byteOffset: byteOffset,
        };
        byteOffset += byteLength;
      }
      Object.defineProperty(this, 'fileRecords', {value:list});
      return list;
    },
  };
  
  function Glyph(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  Glyph.prototype = {
    get width() {
      return this.dv.getUint16(0, true);
    },
    get height() {
      return this.dv.getUint16(2, true);
    },
    get stride() {
      return Math.ceil(this.width / 8);
    },
    getBitplanes: function() {
      return this.bytes.slice(4, 4 + this.stride * this.height);
    },
    createImageData: function(ctx2d) {
      var stride = this.stride, width = this.width, height = this.height;
      var bitplanes = this.getBitplanes();
      var imageData = ctx2d.createImageData(width, height);
      for (var y = 0, y_max = this.height; y < y_max; y++) {
        for (var x = 0; x < width; x++) {
          var byte = bitplanes[y * stride + Math.floor(x/8)];
          if (byte & (0x80 >>> (x & 7))) {
            imageData.data[y*width + x + 3] = 0xff;
          }
        }
      }
      return imageData;
    },
  };
  
  function Font(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  Font.prototype = {
    get signature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 15));
    },
    get hasValidSignature() {
      return this.signature === "WGT Font File  ";
    },
    get addressesOffset() {
      return this.dv.getUint16(15, true);
    },
    get characterCount() {
      return (this.dv.byteLength - this.addressesOffset) / 2;
    },
    get characters() {
      var list = new Array(this.characterCount);
      var offset = this.addressesOffset;
      var buffer = this.dv.buffer;
      var byteLength = this.dv.byteLength;
      for (var i = 0; i < list.length; i++) {
        var glyphOffset = this.dv.getUint16(offset + i*2, true);
        list[i] = new Glyph(buffer, glyphOffset, byteLength - glyphOffset);
      }
      Object.defineProperty(this, 'characters', {value:list});
      return list;
    },
  };
  
  return {
    getStructView: function(segment) {
      var v = +segment.getTypeParameter('v'), gv = +segment.getTypeParameter('gv');
      switch (segment.getTypeParameter('which')) {
        case 'file-list-v6': return FileListV6View;
        case 'gui-collection': return getVersionedType(GUICollectionView, v);
        case 'gui': return getVersionedType(GUIView, v, gv);
        case 'control': return getVersionedType(GUIControlView, v, gv);
        case 'button': return getVersionedType(ButtonView, v, gv);
        case 'label': return getVersionedType(LabelView, v, gv);
        case 'inventory-window': return getVersionedType(InventoryWindowView, v, gv);
        case 'slider': return getVersionedType(SliderView, v, gv);
        case 'text-box': return getVersionedType(TextBoxView, v, gv);
        case 'list-box': return getVersionedType(ListBoxView, v, gv);
        case 'font': return Font;
        default: return null;
      }
    },
    GUIView: GUIView,
  };

});
