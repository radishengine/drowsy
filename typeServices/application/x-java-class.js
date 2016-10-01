define(function() {

  'use strict';
  
  // TODO: !!! this should be modified UTF-8 (long representation for \0)
  var utf8 = new TextDecoder('utf-8');
  
  function descriptorToJSON(descriptor) {
    var pos = 0;
    function parsePart() {
      switch(descriptor[pos++]) {
        case 'I': return 'int32';
        case 'B': return 'int8';
        case 'C': return 'char';
        case 'D': return 'float64';
        case 'F': return 'float32';
        case 'J': return 'int64';
        case 'S': return 'int16';
        case 'Z': return 'boolean';
        case '[': return ['[', parsePart()];
        case 'L':
          var startPos = pos;
          var endPos = descriptor.indexOf(';', pos);
          pos = endPos + 1;
          return descriptor.slice(startPos, endPos);
        case '(':
          var signature = [];
          while (descriptor[pos] !== ')') {
            if (pos > descriptor.length) {
              throw new Error('unterminated parameter list: ' + descriptor);
            }
            signature.push(parsePart());
          }
          var returnType;
          if (descriptor[++pos] === 'V') {
            pos++;
            signature.splice(0, 0, '(', null);
          }
          else {
            signature.splice(0, 0, '(', parsePart());
          }
          return signature;
      }
    }
    var result = parsePart();
    if (pos < descriptor.length) {
      throw new Error('unknown content in descriptor: ' + descriptor);
    }
    return result;
  }
  
  function ClassView(buffer, byteOffset, byteLength) {
    this.dv = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
  }
  ClassView.prototype = {
    get signature() {
      return this.dv.getUint32(0, false).toString(16).toUpperCase();
    },
    get hasValidSignature() {
      return this.signature === 'CAFEBABE';
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
      for (var i = 1; i < c.length; i++) {
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
            i++; // 64-bit constants take two slots
            pos += 8;
            break;
          case 6:
            c[i] = {type:'double', value:dv.getFloat64(pos, false)};
            i++; // 64-bit constants take two slots
            pos += 8;
            break;
          case 7:
            c[i] = {
              type: 'class',
              nameIndex: dv.getUint16(pos, false),
            };
            pos += 2;
            break;
          case 8:
            c[i] = {
              type: 'string',
              index: dv.getUint16(pos, false),
            };
            pos += 2;
            break;
          case 9:
            c[i] = {
              type: 'fieldRef',
              classIndex: dv.getUint16(pos, false),
              nameAndTypeIndex: dv.getUint16(pos + 2, false),
            };
            pos += 4;
            break;
          case 10:
            c[i] = {
              type: 'methodRef',
              classIndex: dv.getUint16(pos, false),
              nameAndTypeIndex: dv.getUint16(pos + 2, false),
            };
            pos += 4;
            break;
          case 11:
            c[i] = {
              type: 'interfaceMethodRef',
              classIndex: dv.getUint16(pos, false),
              nameAndTypeIndex: dv.getUint16(pos + 2, false),
            };
            pos += 4;
            break;
          case 12:
            c[i] = {
              type: 'nameAndType',
              nameIndex: dv.getUint16(pos, false),
              descriptorIndex: dv.getUint16(pos+2, false),
            };
            pos += 4;
            break;
          case 15:
            c[i] = {
              type: 'methodHandle',
              refKind: bytes[pos],
              refIndex: dv.getUint16(pos+1, false),
            };
            pos += 3;
            break;
          case 16:
            c[i] = {
              type: 'methodType',
              descriptorIndex: dv.getUint16(pos, false),
            };
            pos += 2;
            break;
          case 18:
            c[i] = {
              type: 'invokeDynamic',
              bootstrapMethodAttrIndex: dv.getUint16(pos, false),
              nameAndTypeIndex: dv.getUint16(pos+2, false),
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
    get usesOldInvokeSuper() {
      return !(this.accessFlags & 0x0020);
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
    get name() {
      var c = this.constants[this.dv.getUint16(this.constants.afterPos + 2, false)];
      if (typeof c !== 'object' || c.type !== 'class') {
        throw new Error('invalid this_class');
      }
      return this.constants[c.nameIndex];
    },
    get extendsName() {
      var i = this.dv.getUint16(this.constants.afterPos + 4, false);
      if (i === 0) return null; // should only be true for the root Object
      var c = this.constants[i];
      if (typeof c !== 'object' || c.type !== 'class') {
        throw new Error('invalid super_class');
      }
      return this.constants[c.nameIndex];
    },
    get interfaces() {
      var constants = this.constants, dv = this.dv;
      var pos = constants.afterPos + 6;
      var list = new Array(dv.getUint16(pos, false));
      pos += 2;
      for (var i = 0; i < list.length; i++) {
        var c = constants[dv.getUint16(pos, false)];
        if (typeof c !== 'object' || c.type !== 'class') {
          throw new Error('invalid interface');
        }
        list[i] = constants[c.nameIndex];
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
      var constants = this.constants;
      var list = new Array(dv.getUint16(pos, false));
      pos += 2;
      for (var i = 0; i < list.length; i++) {
        pos += (list[i] = new MemberView(constants, buffer, byteOffset + pos, byteLength - pos)).byteLength;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'fields', {value:list});
      return list;
    },
    get methods() {
      var dv = this.dv;
      var buffer = dv.buffer, byteOffset = dv.byteOffset, byteLength = dv.byteLength;
      var pos = this.fields.afterPos;
      var constants = this.constants;
      var list = new Array(dv.getUint16(pos, false));
      pos += 2;
      for (var i = 0; i < list.length; i++) {
        pos += (list[i] = new MemberView(constants, buffer, byteOffset + pos, byteLength - pos)).byteLength;
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
      var constants = this.constants;
      var buffer = dv.buffer, byteOffset = dv.byteOffset, byteLength = dv.byteLength;
      for (var i = 0; i < list.length; i++) {
        var length = 2 + 4 + dv.getUint32(pos + 2, false);
        list[i] = new AttributeView(constants, buffer, byteOffset + pos, length);
        pos += length;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'attributes', {value:list});
      return list;
    },
    toJSON: function() {
      var def = [];
      if (this.isPublic) def.push(['public']);
      if (this.isFinal) def.push(['final']);
      if (this.usesOldInvokeSuper) def.push(['old_invokesuper']);
      if (this.isInterface) def.push(['interface']);
      if (this.isSynthetic) def.push(['synthetic']);
      if (this.isAnnotation) def.push(['annotation']);
      if (this.isEnum) def.push(['enum']);
      if (this.extendsName) {
        def.push(['extends', this.extendsName]);
      }
      for (var i = 0; i < this.interfaces.length; i++) {
        def.push(['implements', this.interfaces[i]]);
      }
      for (var i = 0; i < this.attributes.length; i++) {
        this.attributes[i].pushJSONTo(def);
      }
      for (var i = 0; i < this.fields.length; i++) {
        def.push(this.fields[i].toJSONField());
      }
      for (var i = 0; i < this.methods.length; i++) {
        def.push(this.methods[i].toJSONMethod());
      }
      return ['class', this.name, def];
    },
  };
  
  function MemberView(constants, buffer, byteOffset, byteLength) {
    this.constants = constants;
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  MemberView.prototype = {
    get accessFlags() {
      return this.dv.getUint16(0, false);
    },
    get name() {
      return this.constants[this.dv.getUint16(2, false)];
    },
    get descriptor() {
      return this.constants[this.dv.getUint16(4, false)];
    },
    get attributes() {
      var list = new Array(this.dv.getUint16(6, false));
      var dv = this.dv;
      var pos = 8, buffer = dv.buffer, byteOffset = dv.byteOffset, byteLength = dv.byteLength, constants = this.constants;
      for (var i = 0; i < list.length; i++) {
        var length = 2 + 4 + dv.getUint32(pos + 2, false);
        list[i] = new AttributeView(constants, buffer, byteOffset + pos, length);
        pos += length;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'attributes', {value:list});
      return list;
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
    get byteLength() {
      return this.attributes.afterPos;
    },
    toJSONField: function() {
      var def = [];
      if (this.isPublic) def.push(['public']);
      if (this.isPrivate) def.push(['private']);
      if (this.isProtected) def.push(['protected']);
      if (this.isStatic) def.push(['static']);
      if (this.isFinal) def.push(['final']);
      if (this.isVolatileField) def.push(['volatile']);
      if (this.isTransientField) def.push(['transient']);
      if (this.isSynthetic) def.push(['synthetic']);
      if (this.isEnumField) def.push(['enum']);
      for (var i = 0; i < this.attributes.length; i++) {
        this.attributes[i].pushJSONTo(def);
      }
      var result = ['field', this.name, descriptorToJSON(this.descriptor)];
      if (def.length > 0) result.push(def);
      return result;
    },
    toJSONMethod: function() {
      var signature = descriptorToJSON(this.descriptor);
      if (signature[0] !== '(') {
        throw new Error('method does not have a callable signature');
      }
      var def = [];
      if (signature[1]) {
        def.push(['ret', signature[1]]);
      }
      for (var i = 2; i < signature.length; i++) {
        def.push(['arg', signature[i]]);
      }
      for (var i = 0; i < this.attributes.length; i++) {
        this.attributes[i].pushJSONTo(def);
      }
      var result = ['method', this.name];
      if (def.length > 0) result.push(def);
      return result;
    },
  };
  
  function AttributeView(constants, buffer, byteOffset, byteLength) {
    this.constants = constants;
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  AttributeView.prototype = {
    get name() {
      return this.constants[this.dv.getUint16(0, false)];
    },
    get value() {
      var constants = this.constants;
      var dv = this.dv;
      var buffer = dv.buffer, byteOffset = dv.byteOffset + 6;
      var value;
      switch(this.name) {
        case 'InnerClasses':
          value = new Array(dv.getUint16(6, false));
          for (var i = 0; i < value.length; i++) {
            value[i] = new InnerClassAttrView(constants, buffer, byteOffset + i*8, 8);
          }
          break;
        case 'EnclosingMethod':
          value = new EnclosingMethodAttrView(constants, buffer, byteOffset, 4);
          break;
        case 'Synthetic':
        case 'Deprecated':
          value = true;
          break;
        case 'Signature':
        case 'SourceFile':
          value = constants[dv.getUint16(6, false)];
          break;
        case 'ConstantValue':
          value = constants[dv.getUint16(6, false)];
          break;
        case 'SourceDebugExtension':
          value = utf8.decode(new Uint8Array(buffer, byteOffset, dv.getUint32(2, false)));
          break;
        case 'RuntimeVisibleAnnotations':
        case 'RuntimeInvisibleAnnotations':
          value = new Array(dv.getUint16(6, false));
          var pos = 8;
          for (var i = 0; i < value.length; i++) {
            value[i] = new AnnotationView(constants, buffer, byteOffset + pos, buffer.byteLength - (byteOffset + pos));
            pos += value[i].byteLength;
          }
          break;
        case 'RuntimeVisibleParameterAnnotations':
        case 'RuntimeInvisibleParameterAnnotations':
          value = new Array(dv.getUint8(6));
          var pos = 7;
          for (var i = 0; i < value.length; i++) {
            value[i] = new Array(dv.getUint16(pos, false));
            pos += 2;
            for (var j = 0; j < value[i].length; j++) {
              value[i][j] = new AnnotationView(constants, buffer, byteOffset + pos, buffer.byteLength - (byteOffset + pos));
              pos += value[i][j].byteLength;
            }
          }
          break;
        case 'AnnotationDefault':
          value = new AnnotationValueView(buffer, byteOffset, dv.getUint32(2, false));
          break;
        case 'BootstrapMethods':
          value = new Array(dv.getUint16(6, false));
          var pos = 8;
          for (var i = 0; i < value.length; i++) {
            var method = constants[dv.getUint16(pos)];
            var parameters = new Array(dv.getUint16(pos + 2));
            pos += 4;
            for (var j = 0; j < parameters.length; j++) {
              parameters[i] = constants[dv.getUint16(pos)];
              pos += 2;
            }
            value[i] = {method:method, parameters:parameters};
          }
          break;
        case 'Code':
          value = new CodeView(buffer, byteOffset, dv.getUint32(2, false));
          break;
        case 'LineNumberTable':
          value = new Array(dv.getUint16(6, false));
          for (var i = 0; i < value.length; i++) {
            value[i] = {
              codeOffset: dv.getUint16(8 + i*4, false),
              lineNumber: dv.getUint16(8 + i*4 + 2, false),
            };
          }
          break;
        case 'LocalVariableTable':
        case 'LocalVariableTypeTable':
          value = new Array(dv.getUint16(6, false));
          var fieldName = (this.name === 'LocalVariableTable') ? 'descriptor' : 'signature';
          for (var i = 0; i < value.length; i++) {
            value[i] = {
              codeOffset: dv.getUint16(8 + i*10, false),
              codeLength: dv.getUint16(8 + i*10 + 2, false),
              name: constants[dv.getUint16(8 + i*10 + 4, false)],
              index: dv.getUint16(8 + i*10 + 8, false), // 64-bit types take up 2 slots
            };
            value[i][fieldName] = constants[dv.getUint16(8 + i*10 + 6, false)];
          }
          break;
        case 'StackMapTable':
          value = new Array(dv.getUint16(6, false));
          var pos = 8;
          function readVTI() {
            switch (dv.getUint8(pos++)) {
              case 0: return 'top';
              case 1: return 'int';
              case 2: return 'float';
              case 3: return 'long';
              case 5: return 'null';
              case 6: return 'uninitializedThis';
              case 7:
                value = constants[dv.getUint16(pos, false)];
                pos += 2;
                return value;
              case 8:
                value = {type:'uninitialized', newInstructionOffset:dv.getUint16(pos)};
                pos += 2;
                return value;
            }
          }
          function readVTIList(count) {
            var list = new Array(count);
            for (var i = 0; i < list.length; i++) {
              list[i] = readVTI();
            }
            return list;
          }
          for (var i = 0; i < value.length; i++) {
            var frameType = dv.getUint8(pos++);
            if (frameType < 64) {
              value[i] = {locals:'same', offsetDelta:frameType, stack:[]};
              continue;
            }
            if (frameType < 128) {
              value[i] = {locals:'same', offsetDelta:frameType - 64, stack:readVTIList(1)};
              continue;
            }
            if (frameType < 247) {
              throw new Error('reserved tag: ' + frameType);
            }
            if (frameType === 247) {
              var offsetDelta = dv.getUint16(pos, false);
              pos += 2;
              value[i] = {locals:'same', offsetDelta:offsetDelta, stack:readVTIList(1)};
              continue;
            }
            if (frameType < 251) {
              var offsetDelta = dv.getUint16(pos, false);
              pos += 2;
              value[i] = {locals:'samePopK', k:251-frameType, offsetDelta:offsetDelta, stack:[]};
              continue;
            }
            if (frameType === 251) {
              var offsetDelta = dv.getUint16(pos, false);
              pos += 2;
              value[i] = {local:'same', offsetDelta:offsetDelta, stack:[]};
              continue;
            }
            if (frameType < 255) {
              var offsetDelta = dv.getUint16(pos, false);
              pos += 2;              
              value[i] = {locals:readVTIList(frameType - 251), offsetDelta:offsetDelta, stack:[]};
              continue;
            }
            // frameType === 255
            var offsetDelta = dv.getUint16(pos, false);
            var localCount = dv.getUint16(pos + 2, false);
            pos += 4;
            var locals = readVTIList(localCount);
            var stackCount = dv.getUint16(pos, false);
            pos += 2;
            value[i] = {locals:locals, offsetDelta:offsetDelta, stack:readVTIList(stackCount)};
            continue;
          }
          break;
        case 'Exceptions':
          value = new Array(dv.getUint16(6, false));
          for (var i = 0; i < value.length; i++) {
            value[i] = this.constants[dv.getUint16(8 + i*2)];
          }
          break;
        default: value = new Uint8Array(buffer, byteOffset, dv.getUint32(2, false));
      }
      Object.defineProperty(this, 'value', {value:value});
      return value;
    },
    pushJSONTo: function(def) {
      switch(this.name) {
        case 'InnerClasses':
          for (var i = 0; i < this.value.length; i++) {
            def.push(['inner', this.value[i]]);
          }
          break;
        case 'EnclosingMethod':
          def.push(['enclosed', this.value.className, this.value.methodName]);
          break;
        case 'Signature':
        case 'SourceDebugExtension':
          def.push([this.name.toLowerCase(), this.value]);
          break;
        case 'ConstantValue':
          if (this.value.type === 'string') {
            def.push(['=', this.constants[this.value.index]]);
          }
          else {
            def.push(['=', this.value.value]);
          }
          break;
        case 'SourceFile':
          def.push(['src', this.value]);
          break;
        case 'RuntimeVisibleAnnotations':
          for (var i = 0; i < this.value.length; i++) {
            def.push(['annotation', true, this.value[i]]);
          }
          break;
        case 'RuntimeInvisibleAnnotations':
          for (var i = 0; i < this.value.length; i++) {
            def.push(['annotation', false, this.value[i]]);
          }
          break;
        case 'RuntimeVisibleParameterAnnotations':
          for (var i = 0; i < this.value.length; i++) {
            def.push(['parameter-annotation', true, this.value[i]]);
          }
          break;
        case 'RuntimeInvisibleParameterAnnotations':
          for (var i = 0; i < this.value.length; i++) {
            def.push(['parameter-annotation', false, this.value[i]]);
          }
          break;
        case 'AnnotationDefault':
          def.push(['default', this.value.toJSON()]);
          break;
        case 'BootstrapMethods':
          for (var i = 0; i < this.value.length; i++) {
            def.push(['bootstrap-method', this.value[i].method].concat(this.value[i].parameters));
          }
          break;
        case 'LineNumberTable':
          for (var i = 0; i < value.length; i++) {
            def.push(['L#', value[i].codeOffset, value[i].lineNumber]);
          }
          break;
        case 'LocalVariableTable':
          for (var i = 0; i < value.length; i++) {
            def.push(['var', descriptorToJSON(value[i].descriptor), value[i].name, value[i].codeOffset, value[i].codeLength, value[i].index]);
          }
          break;
        case 'LocalVariableTypeTable':
          for (var i = 0; i < value.length; i++) {
            def.push(['var', descriptorToJSON(value[i].signature), value[i].name, value[i].codeOffset, value[i].codeLength, value[i].index]);
          }
          break;
        case 'Exceptions':
          value = new Array(dv.getUint16(6, false));
          for (var i = 0; i < value.length; i++) {
            value[i] = this.constants[dv.getUint16(8 + i*2)];
          }
          break;
        default: def.push([this.name.toLowerCase()]); break;
      }
    },
  };
  
  function InnerClassAttrView(constants, buffer, byteOffset, byteLength) {
    this.constants = constants;
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  InnerClassAttrView.prototype = {
    get innerClassInfo() {
      return this.constants[this.dv.getUint16(0, false)];
    },
    get outerClassInfo() {
      return this.constants[this.dv.getUint16(2, false)];
    },
    get innerName() {
      return this.constants[this.dv.getUint16(4, false)];
    },
    get innerAccessFlags() {
      return this.dv.getUint16(6, false);
    },
    get isPublic() {
      return !!(this.innerAccessFlags & 1);
    },
    get isPrivate() {
      return !!(this.innerAccessFlags & 2);
    },
    get isProtected() {
      return !!(this.innerAccessFlags & 4);
    },
    get isStatic() {
      return !!(this.innerAccessFlags & 8);
    },
    get isFinal() {
      return !!(this.innerAccessFlags & 0x10);
    },
    get isInterface() {
      return !!(this.innerAccessFlags & 0x200);
    },
    get isAbstract() {
      return !!(this.innerAccessFlags & 0x400);
    },
    get isSynthetic() {
      return !!(this.innerAccessFlags & 0x1000);
    },
    get isAnnotation() {
      return !!(this.innerAccessFlags & 0x2000);
    },
    get isEnum() {
      return !!(this.innerAccessFlags & 0x4000);
    },
  };
  
  function EnclosingMethodAttrView(constants, buffer, byteOffset, byteLength) {
    this.constants = constants;
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  EnclosingMethodAttrView.prototype = {
    get enclosingClass() {
      return this.constants[this.dv.getUint16(0, false)];
    },
    get enclosingMethod() {
      return this.constants[this.dv.getUint16(2, false)];
    },
  };
  
  function AnnotationView(constants, buffer, byteOffset, byteLength) {
    this.constants = constants;
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  AnnotationView.prototype = {
    get type() {
      return this.constants[this.dv.getUint16(0, false)];
    },
    get pairs() {
      var list = new Array(this.dv.getUint16(2, false));
      var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset;
      var pos = 4;
      for (var i = 0; i < list.length; i++) {
        list[i] = new AnnotationValueView(constants, buffer, byteOffset + pos, buffer.byteLength - (byteOffset + pos));
        pos += list[i].byteLength;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'pairs', {value:list});
      return list;
    },
    get byteLength() {
      return this.pairs.afterPos;
    },
  };
  
  function AnnotationValueView(constants, buffer, byteOffset, byteLength) {
    this.constants = constants;
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  AnnotationValueView.prototype = {
    get tag() {
      return String.fromCharCode(this.dv.getUint8(0));
    },
    get byteLength() {
      switch(this.tag) {
        case 'B': case 'C': case 'D': case 'F': case 'I': case 'J': case 'S': case 'Z': case 's': case 'c':
          return 3;
        case 'e':
          return 5;
        case '@': case '[':
          return 1 + this.value.byteLength;
        default:
          throw new Error('unknown annotation value type tag: ' + this.tag);
      }
    },
    get value() {
      var value;
      switch(this.tag) {
        case 'B': case 'C': case 'D': case 'F': case 'I': case 'J': case 'S': case 'Z': case 's': case 'c':
          value = this.constants[this.dv.getUint16(1, false)];
          break;
        case 'e':
          value = {
            enumTypeName: this.constants[this.dv.getUint16(1, false)],
            enumValueName: this.constants[this.dv.getUint16(3, false)],
          };
        case '@':
          value = new AnnotationView(this.dv.buffer, this.dv.byteOffset + 1, this.dv.byteLength - (this.dv.byteOffset + 1));
          break;
        case '[':
          value = new Array(this.dv.getUint16(1, false));
          var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset + 3;
          var baseOffset = byteOffset;
          for (var i = 0; i < value.length; i++) {
            byteOffset += (value[i] = new AnnotationValueView(buffer, byteOffset, buffer.byteLength - byteOffset)).byteLength;
          }
          value.byteLength = 2 + (byteOffset - baseOffset);
          break;
        default:
          throw new Error('unknown annotation value type tag: ' + this.tag);
      }
      Object.defineProperty(this, 'value', {value:value});
      return value;
    },
  };
  
  function CodeView(constants, buffer, byteOffset, byteLength) {
    this.constants = constants;
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  CodeView.prototype = {
    get maxStack() {
      return this.dv.getUint16(0, false);
    },
    get maxLocals() {
      return this.dv.getUint16(2, false);
    },
    get codeBytes() {
      var buffer = this.dv.buffer, byteOffset = this.dv.byteOffset + 8, byteLength = this.dv.getUint32(4, false);
      var bytes = new Uint8Array(buffer, byteOffset, byteLength);
      bytes.afterPos = 8 + bytes.length;
      Object.defineProperty(this, 'codeBytes', {value:bytes});
      return bytes;
    },
    get exceptionTable() {
      var dv = this.dv;
      var pos = this.codeBytes.afterPos;
      var list = new Array(dv.getUint16(pos, false));
      pos += 2;
      for (var i = 0; i < list.length; i++) {
        var startPos = dv.getUint16(pos, false);
        var endPos = dv.getUint16(pos + 2, false);
        var handlerPos = dv.getUint16(pos + 4, false);
        var catchType = dv.getUint16(pos + 6, false);
        catchType = catchType ? this.constants[catchType] : 'finally';
        list[i] = {
          startPos: startPos,
          endPos: endPos,
          handlerPos: handlerPos,
          catchType: catchType,
        };
        pos += 8;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'exceptionTable', {value:list});
      return list;
    },
    get attributes() {
      var pos = this.exceptionTable.afterPos;
      var list = new Array(this.dv.getUint16(pos, false));
      pos += 2;
      var dv = this.dv;
      var buffer = dv.buffer, byteOffset = dv.byteOffset, byteLength = dv.byteLength, constants = this.constants;
      for (var i = 0; i < list.length; i++) {
        var length = 2 + 4 + dv.getUint32(pos + 2, false);
        list[i] = new AttributeView(constants, buffer, byteOffset + pos, length);
        pos += length;
      }
      list.afterPos = pos;
      Object.defineProperty(this, 'attributes', {value:list});
      return list;
    },
  };
  
  return {
    getStructView: function() {
      return ClassView;
    },
  };

});
