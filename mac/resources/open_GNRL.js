define(function() {
  
  // http://seancode.com/webventure/formats.html#GNRL
  
  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      switch(item.resourceID) {
        case 0x80:
          item.setDataObject(new GeneralSettingsView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
          break;
        default:
          console.warn('unsupported GNRL resource ID: ' + item.resourceID);
          break;
      }
    });
  }
  
  function GeneralSettingsView(buffer, byteOffset, byteLength) {
    this.dataView = new DataView(buffer, byteOffset, byteLength);
  }
  GeneralSettingsView.prototype = {
    toJSON: function() {
      return {
        objectCount: this.objectCount,
        globalCount: this.globalCount,
        groupCount: this.groupCount,
        commands: this.commands,
        attributes: this.attributes,
        inventory: {
          top: this.inventoryTop,
          left: this.inventoryLeft,
          height: this.inventoryHeight;
          width: this.inventoryWidth,
          offsetX: this.inventoryOffsetX,
          offsetY: this.inventoryOffsetY,
        },
        defaultFont: this.defaultFont,
        defaultFontSize: this.defaultFontSize,
      };
    },
    get objectCount() {
      return this.dataView.getUint16(0, false);
    },
    get globalCount() {
      return this.dataView.getUint16(2, false);
    },
    get commandCount() {
      return this.dataView.getUint16(4, false);
    },
    get attributeCount() {
      return this.dataView.getUint16(6, false);
    },
    get groupCount() {
      return this.dataView.getUint16(8, false);
    },
    // unknown: 2 bytes
    get inventoryTop() {
      return this.dataView.getUint16(12, false);
    },
    get inventoryLeft() {
      return this.dataView.getUint16(14, false);
    },
    get inventoryHeight() {
      return this.dataView.getUint16(16, false);
    },
    get inventoryWidth() {
      return this.dataView.getUint16(18, false);
    },
    get inventoryOffsetY() {
      return this.dataView.getUint16(20, false);
    },
    get inventoryOffsetX() {
      return this.dataView.getUint16(22, false);
    },
    get defaultFont() {
      return this.dataView.getUint16(24, false);
    },
    get defaultFontSize() {
      return this.dataView.getUint16(26, false);
    },
    get attributeIndices() {
      var indices = new Array(this.attributeCount);
      var pos = 28;
      for (var i = 0; i < indices.length; i++) {
        indices[i] = this.dataView.getUint8(pos++);
      }
      indices.afterPos = pos;
      Object.defineProperty(this, 'attributeIndices', indices);
      return indices;
    },
    get attributeMasks() {
      var masks = new Array(this.attributeCount);
      var pos = this.attributeIndices.afterPos;
      for (var i = 0; i < masks.length; i++) {
        masks[i] = this.dataView.getUint16(pos);
        pos += 2;
      }
      masks.afterPos = pos;
      Object.defineProperty(this, 'attributeMasks', masks);
      return masks;
    },
    get attributeBitShifts() {
      var shifts = new Array(this.attributeCount);
      var pos = this.attributeMasks.afterPos;
      for (var i = 0; i < shifts.length; i++) {
        shifts[i] = this.dataView.getUint8(pos++);
      }
      shifts.afterPos = pos;
      Object.defineProperty(this, 'attributeBitShifts', shifts);
      return shifts;
    },
    get commandArgumentCounts() {
      var counts = new Array(this.commandCount);
      var pos = this.attributeBitShifts.afterPos;
      for (var i = 0; i < counts.length; i++) {
        counts[i] = this.dataView.getUint8(pos++);
      }
      counts.afterPos = pos;
      Object.defineProperty(this, 'commandArgumentCounts', counts);
      return counts;
    },
    get commandButtons() {
      var buttons = new Array(this.commandCount);
      var pos = this.commandArgumentCounts.afterPos;
      for (var i = 0; i < buttons.length; i++) {
        buttons[i] = this.dataView.getUint8(pos++);
      }
      buttons.afterPos = pos;
      Object.defineProperty(this, 'commandButtons', buttons);
      return buttons;
    },
    get attributes() {
      var attributes = new Array(this.argumentCount);
      for (var i = 0; i < attributes.length; i++) {
        attributes[i] = {
          index: this.attributeIndices[i],
          mask: this.attributeMasks[i],
          bitShift: this.attributeBitShifts[i],
        };
      }
      Object.defineProperty(this, 'attributes', attributes);
      return attributes;
    },
    get commands() {
      var commands = new Array(this.commandCount);
      for (var i = 0; i < commands.length; i++) {
        commands[i] = {
          argumentCount: this.commandArgumentCounts[i],
          button: this.commandButtons[i],
        };
      }
      Object.defineProperty(this, 'commands', commands);
      return commands;
    },
  };
  
  return open;
  
});
