define(function() {

  'use strict';

  function open(item) {
    return item.getBytes().then(function(bytes) {
    
      var pos = 12;
    
      function block() {
        var block = [];
        while (pos < bytes.length) {
          switch(bytes[pos++]) {
            case 0x80:
              var condition = expression();
              var thenBlock = block();
              block.push(['if', condition, thenBlock]);
              break;
            case 0x87:
              block.push(['exit']);
              break;
            case 0x88:
              return block;
            case 0x89:
              // TODO: operands
              block.push(['move']);
              break;
            case 0x8B:
              // TODO: operands
              block.push(['print']);
              break;
            case 0x8C:
              // TODO: operands
              block.push(['sound']);
              break;
            case 0x8E:
              // TODO: operands
              block.push(['let']);
              break;
            case 0x95:
              // TODO: operands
              block.push(['menu']);
              break;
          }
        }
        return block;
      }
      
      function expression() {
        var expr = operand();
        for (var op = operator(); op; op = operator()) {
          expr = [op, expr, operand()];
        }
        return expr;
      }
      
      function operand() {
        switch(bytes[pos++]) {
          case 0xA0: return 'text_input';
          case 0xA1: return 'click_input';
          case 0xC0: return 'STORAGE@';
          case 0xC1: return 'SCENE@';
          case 0xC2: return 'PLAYER@';
          case 0xC3: return 'MONSTER@';
          case 0xC4: return 'RANDOMSCN@';
          case 0xC5: return 'RANDOMCHR@';
          case 0xC6: return 'RANDOMOBJ@';
          case 0xB0: return 'VISITS#';
          case 0xB1: return 'RANDOM#'; // sometimes VISITS# instead?
          case 0xB5: return 'RANDOM#';
          case 0xB2: return 'LOOP#';
          case 0xB3: return 'VICTORY#';
          case 0xB4: return 'BADCOPY#';
          case 0xFF: return ['user variable', bytes[pos++]];
          case 0xD0: return ['base', 'PLAYER@', 'physicalStrength'];
          case 0xD1: return ['base', 'PLAYER@', 'physicalHP'];
          case 0xD2: return ['base', 'PLAYER@', 'naturalArmor'];
          case 0xD3: return ['base', 'PLAYER@', 'physicalAccuracy'];
          case 0xD4: return ['base', 'PLAYER@', 'spiritualStrength'];
          case 0xD5: return ['base', 'PLAYER@', 'spiritualHP'];
          case 0xD6: return ['base', 'PLAYER@', 'resistanceToMagic'];
          case 0xD7: return ['base', 'PLAYER@', 'spiritualAccuracy'];
          case 0xD8: return ['base', 'PLAYER@', 'runningSpeed'];
          case 0xE0: return ['current', 'PLAYER@', 'physicalStrength'];
          case 0xE1: return ['current', 'PLAYER@', 'physicalHP'];
          case 0xE2: return ['current', 'PLAYER@', 'naturalArmor'];
          case 0xE3: return ['current', 'PLAYER@', 'physicalAccuracy'];
          case 0xE4: return ['current', 'PLAYER@', 'spiritualStrength'];
          case 0xE5: return ['current', 'PLAYER@', 'spiritualHP'];
          case 0xE6: return ['current', 'PLAYER@', 'resistanceToMagic'];
          case 0xE7: return ['current', 'PLAYER@', 'spiritualAccuracy'];
          case 0xE8: return ['current', 'PLAYER@', 'runningSpeed'];
          default:
            // TODO: string operand
            throw new Error('unknown operand');
        }
      }
      
      item.setDataObject(block());
    
    });
  }
  
  return open;

});
