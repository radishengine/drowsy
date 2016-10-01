define(function() {

  'use strict';
  
  var utf8 = new TextDecoder('utf-8');
  
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
    get constants() {
      var c = new Array(this.dv.getUint16(8, false));
      var pos = 10;
      var bytes = this.bytes;
      var dv = this.dv;
      for (var i = 2; i < c.length; i++) {
        var constantType = bytes[pos++];
        switch (constantType) {
          case 1:
            var length = dv.getUint16(pos, false);
            pos += 2;
            c[i] = utf8.decode(bytes.subarray(pos, pos + length));
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
      Object.defineProperty(this, 'constants', {value:c});
      return c;
    },
    get accessFlags() {
      return this.dv.getUint16(this.constants.afterPos, false);
    },
    get isPublic() {
      return !!(this.accessFlags & 0x0001);
    },
    get isFinal() {
      return !!(this.accessFlags & 0x0010);
    },
    get isSuper() {
      return !!(this.accessFlags & 0x0020);
    },
    get isInterface() {
      return !!(this.accessFlags & 0x0200);
    },
    get isAbstract() {
      return !!(this.accessFlags & 0x0400);
    },
    get isSynthetic() {
      return !!(this.accessFlags & 0x1000);
    },
    get isAnnotation() {
      return !!(this.accessFlags & 0x2000);
    },
    get isEnum() {
      return !!(this.accessFlags & 0x4000);
    },
    get thisClass() {
      return this.constants[this.dv.getUint16(this.constants.afterPos + 2, false)];
    },
    get superClass() {
      return this.constants[this.dv.getUint16(this.constants.afterPos + 4, false)];
    },
    get interfaces() {
      var pos = this.constants.afterPos + 6;
      var list = new Array(this.dv.getUint16(pos, false));
      pos += 2;
      for (var i = 0; i < list.length; i++) {
        list[i] = this.constants[this.dv.getUint16(pos, false)];
        pos += 2;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'interfaces', {value:list});
      return list;
    },
    get fields() {
      var dv = this.dv;
      var buffer = dv.buffer, byteOffset = dv.byteOffset, byteLength = dv.byteLength;
      var pos = this.interfaces.afterPos;
      var list = new Array(dv.getUint16(pos, false));
      pos += 2;
      for (var i = 0; i < list.length; i++) {
        pos += (list[i] = new MemberView(buffer, byteOffset + pos, byteLength - pos)).byteLength;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'fields', {value:list});
      return list;
    },
    get methods() {
      var dv = this.dv;
      var buffer = dv.buffer, byteOffset = dv.byteOffset, byteLength = dv.byteLength;
      var pos = this.fields.afterPos;
      var list = new Array(dv.getUint16(pos, false));
      pos += 2;
      for (var i = 0; i < list.length; i++) {
        pos += (list[i] = new MemberView(buffer, byteOffset + pos, byteLength - pos)).byteLength;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'methods', {value:list});
      return list;
    },
    get attributes() {
      var pos = this.methods.afterPos;
      var list = new Array(this.dv.getUint16(pos, false));
      pos += 2;
      var dv = this.dv;
      var buffer = dv.buffer, byteOffset = dv.byteOffset, byteLength = dv.byteLength;
      for (var i = 0; i < list.length; i++) {
        var length = 2 + 4 + dv.getUint32(pos + 2, false);
        list[i] = new AttributeView(buffer, byteOffset + pos, length);
        pos += length;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'attributes', {value:list});
      return list;
    },
  };
  
  function MemberView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  MemberView.prototype = {
    get accessFlags() {
      return this.dv.getUint16(0, false);
    },
    get isPublic() {
      return !!(this.accessFlags & 1);
    },
    get isPrivate() {
      return !!(this.accessFlags & 2);
    },
    get isProtected() {
      return !!(this.accessFlags & 4);
    },
    get isStatic() {
      return !!(this.accessFlags & 8);
    },
    get isFinal() {
      return !!(this.accessFlags & 0x10);
    },
    get isSynchronizedMethod() {
      return !!(this.accessFlags & 0x20);
    },
    get isBridgeMethod() {
      return !!(this.accessFlags & 0x40);
    },
    get isVolatileField() {
      return !!(this.accessFlags & 0x40);
    },
    get isVarargsMethod() {
      return !!(this.accessFlags & 0x80);
    },
    get isTransientField() {
      return !!(this.accessFlags & 0x80);
    },
    get isNativeMethod() {
      return !!(this.accessFlags & 0x100);
    },
    get isAbstractMethod() {
      return !!(this.accessFlags & 0x400);
    },
    get isStrictMethod() {
      return !!(this.accessFlags & 0x800);
    },
    get isSynthetic() {
      return !!(this.accessFlags & 0x1000);
    },
    get isEnumField() {
      return !!(this.accessFlags & 0x4000);
    },
    get nameIndex() {
      return this.dv.getUint16(2, false);
    },
    get descriptorIndex() {
      return this.dv.getUint16(4, false);
    },
    get attributes() {
      var list = new Array(this.dv.getUint16(6, false));
      var dv = this.dv;
      var pos = 8, buffer = dv.buffer, byteOffset = dv.byteOffset, byteLength = dv.byteLength;
      for (var i = 0; i < list.length; i++) {
        var length = 2 + 4 + dv.getUint32(pos + 2, false);
        list[i] = new AttributeView(buffer, byteOffset + pos, length);
        pos += length;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'attributes', {value:list});
      return list;
    },
    get byteLength() {
      return this.attributes.afterPos;
    },
  };
  
  function AttributeView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.info = new Uint8Array(buffer, byteOffset + 6, this.dv.getUint32(2, false));
  }
  AttributeView.prototype = {
    get nameIndex() {
      return this.dv.getUint16(0, false);
    },
  };
  
  return {
    getStructView: function() {
      return ClassView;
    },
  };

});
