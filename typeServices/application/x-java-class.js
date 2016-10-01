define(function() {

  'use strict';
  
  function ClassView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  ClassView.prototype = {
    get signature() {
      return this.dv.getUint32(0, false);
    },
    get hasValidSignature() {
      return this.signature === 0xCAFEBABE;
    },
    get versionMinor() {
      return this.dv.getUint16(4, false);
    },
    get versionMajor() {
      return this.dv.getUint16(6, false);
    },
    get constantPools() {
      var c = new Array(this.dv.getUint16(8, false));
      var pos = 10;
      var bytes = this.bytes;
      var dv = this.dv;
      for (var i = 1; i < c.length; i++) {
        var constantType = bytes[pos++];
        switch (constantType) {
          case 1:
            var length = dv.getUint16(pos, false);
            pos += 2;
            c[i] = {type:'utf9', value:new TextDecoder('utf-8').decode(bytes.subarray(pos, pos + length))};
            pos += length;
            break;
          case 3:
            c[i] = {type:'integer', value:dv.getInt32(pos, false)};
            pos += 4;
            break;
          case 4:
            c[i] = {type:'float', value:dv.getFloat32(pos, false)};
            pos += 4;
            break;
          case 5:
            c[i] = {type:'long', valueHi:dv.getInt32(pos, false), valueLo:dv.getInt32(pos+4, false)};
            pos += 8;
            break;
          case 6:
            c[i] = {type:'double', value:dv.getFloat64(pos, false)};
            pos += 8;
            break;
          case 7:
            c[i] = {type:'class', nameIndex:dv.getUint16(pos, false)};
            pos += 2;
            break;
          case 8:
            c[i] = {type:'string', utf8Index:dv.getUint16(pos, false)};
            pos += 2;
            break;
          case 9:
            c[i] = {type:'fieldRef', classIndex:dv.getUint16(pos, false), nameAndTypeIndex:dv.getUint16(pos + 2, false)};
            pos += 4;
            break;
          case 10:
            c[i] = {type:'methodRef', classIndex:dv.getUint16(pos, false), nameAndTypeIndex:dv.getUint16(pos + 2, false)};
            pos += 4;
            break;
          case 11:
            c[i] = {type:'interfacMethodRef', classIndex:dv.getUint16(pos, false), nameAndTypeIndex:dv.getUint16(pos + 2, false)};
            pos += 4;
            break;
          case 12:
            c[i] = {type:'nameAndType', nameIndex:dv.getUint16(pos, false), descriptorIndex:dv.getUint16(pos+2, false)};
            pos += 4;
            break;
          case 15:
            c[i] = {type:'methodHandle', refKind:bytes[pos], refIndex:dv.getUint16(pos+1, false)};
            pos += 3;
            break;
          case 16:
            c[i] = {type:'methodType', descriptorIndex:dv.getUint16(pos, false)};
            pos += 2;
            break;
          case 18:
            c[i] = {
              type:'invokeDynamic',
              bootstrapMethodAttrIndex:dv.getUint16(pos, false),
              nameAndTypeIndex:dv.getUint16(pos+2, false),
            };
            pos += 4;
            break;
          default: throw new Error('unknown constant type code: ' + constantType);
        }
      }
      c.afterPos = pos;
      Object.defineProperty(this, 'constantPools', {value:c});
      return c;
    },
  };
  
  return {
    getStructView: function() {
      return ClassView;
    },
  };

});
