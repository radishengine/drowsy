define(function() {

  'use strict';
  
  // TODO: !!! this should be modified UTF-8 (long representation for \0)
  var utf8 = new TextDecoder('utf-8');
  
  function descriptorToJSON(descriptor) {
    var pos = 0;
    function parsePart() {
      switch(descriptor[pos++]) {
        case 'I': return 'i32';
        case 'B': return 'i8';
        case 'C': return 'char';
        case 'D': return 'f64';
        case 'F': return 'f32';
        case 'J': return 'i64';
        case 'S': return 'i16';
        case 'Z': return 'boolean';
        case '[':
          var elementType = parsePart();
          if (typeof elementType === 'string') return elementType + '[]';
          return ['T[]', elementType];
        case 'L':
          var startPos = pos;
          var endPos = descriptor.indexOf(';', pos);
          pos = endPos + 1;
          var className = descriptor.slice(startPos, endPos);
          if (className === 'java/lang/Object') return 'object';
          if (className === 'java/lang/String') return 'string';
          return className;
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
      if (this.extendsName !== 'java/lang/Object') {
        def.push(['extends', this.extendsName || null]);
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
      var def = [[':', descriptorToJSON(this.descriptor)]];
      if (this.isPublic) def.push(['public']);
      if (this.isPrivate) def.push(['private']);
      if (this.isProtected) def.push(['protected']);
      if (this.isFinal) def.push(['final']);
      if (this.isVolatileField) def.push(['volatile']);
      if (this.isTransientField) def.push(['transient']);
      if (this.isSynthetic) def.push(['synthetic']);
      if (this.isEnumField) def.push(['enum']);
      for (var i = 0; i < this.attributes.length; i++) {
        this.attributes[i].pushJSONTo(def);
      }
      var result = ['.', this.name, def];
      if (this.isStatic) result = ['static', result];
      return result;
    },
    toJSONMethod: function() {
      var signature = descriptorToJSON(this.descriptor);
      if (signature[0] !== '(') {
        throw new Error('method does not have a callable signature');
      }
      var def = [];
      if (this.isPublic) def.push(['public']);
      if (this.isPrivate) def.push(['private']);
      if (this.isProtected) def.push(['protected']);
      if (this.isFinal) def.push(['final']);
      if (this.isSynchronizedMethod) def.push(['synchronized']);
      if (this.isBridgeMethod) def.push(['bridge']);
      if (this.isNativeMethod) def.push(['native']);
      if (this.isAbstractMethod) def.push(['abstract']);
      if (this.isSynthetic) def.push(['synthetic']);
      if (signature[1]) {
        def.push(['ret', signature[1]]);
      }
      for (var i = 2; i < signature.length; i++) {
        def.push(['arg', signature[i]]);
      }
      if (this.isVarargsMethods) def.push(['varargs']);
      
      for (var i = 0; i < this.attributes.length; i++) {
        this.attributes[i].pushJSONTo(def);
      }
      var result = ['m()', this.name];
      if (def.length > 0) result.push(def);
      if (this.isStatic) result = ['static', result];
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
          value = new CodeView(constants, buffer, byteOffset, dv.getUint32(2, false));
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
      var value = this.value;
      switch(this.name) {
        case 'InnerClasses':
          for (var i = 0; i < value.length; i++) {
            def.push(['class', value[i]]);
          }
          break;
        case 'EnclosingMethod':
          def.push(['enclosed', value.className, value.methodName]);
          break;
        case 'Signature':
        case 'SourceDebugExtension':
          def.push([this.name.toLowerCase(), value]);
          break;
        case 'ConstantValue':
          if (this.value.type === 'string') {
            def.push(['=', this.constants[value.index]]);
          }
          else {
            def.push(['=', value.value]);
          }
          break;
        case 'SourceFile':
          def.push(['src', value]);
          break;
        case 'Code':
          def.push(value.toJSON());
          break;
        case 'RuntimeVisibleAnnotations':
          for (var i = 0; i < value.length; i++) {
            def.push(['@', true, value[i]]);
          }
          break;
        case 'RuntimeInvisibleAnnotations':
          for (var i = 0; i < value.length; i++) {
            def.push(['@', false, value[i]]);
          }
          break;
        case 'RuntimeVisibleParameterAnnotations':
          for (var i = 0; i < value.length; i++) {
            def.push(['arg@', true, value[i]]);
          }
          break;
        case 'RuntimeInvisibleParameterAnnotations':
          for (var i = 0; i < value.length; i++) {
            def.push(['arg@', false, value[i]]);
          }
          break;
        case 'AnnotationDefault':
          def.push(['default', value.toJSON()]);
          break;
        case 'BootstrapMethods':
          for (var i = 0; i < value.length; i++) {
            def.push(['bootstrap-method', value[i].method].concat(value[i].parameters));
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
          for (var i = 0; i < value.length; i++) {
            def.push(['throws', value[i]]);
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
    toJSON: function() {
      var def = [];
      var bytes = this.codeBytes;
      for (var pos = 0; pos < bytes.length; ) {
        var opcode;
        switch (opcode = bytes[pos++]) {
          case 0x32: def.push(['aaload']); break;
          case 0x53: def.push(['aastore']); break;
          case 0x01: def.push(['aconst_null']); break;
          case 0x19: def.push(['aload', bytes[pos++]]); break;
          case 0x2A: def.push(['aload', 0]); break;
          case 0x2B: def.push(['aload', 1]); break;
          case 0x2C: def.push(['aload', 2]); break;
          case 0x2D: def.push(['aload', 3]); break;
          case 0xBD:
            def.push(['anewarray', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xB0: def.push(['areturn']); break;
          case 0xBE: def.push(['arraylength']); break;
          case 0x3A: def.push(['astore', bytes[pos++]]); break;
          case 0x4B: def.push(['astore', 0]); break;
          case 0x4C: def.push(['astore', 1]); break;
          case 0x4D: def.push(['astore', 2]); break;
          case 0x4E: def.push(['astore', 3]); break;
          case 0xBF: def.push(['athrow']); break;
          case 0x33: def.push(['baload']); break;
          case 0x54: def.push(['bastore']); break;
          case 0x10: def.push(['bipush', bytes[pos++]]); break;
          case 0x34: def.push(['caload']); break;
          case 0x55: def.push(['castore']); break;
          case 0xC0:
            def.push(['checkcast', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x90: def.push(['d2f']); break;
          case 0x8E: def.push(['d2i']); break;
          case 0x8F: def.push(['d2l']); break;
          case 0x63: def.push(['dadd']); break;
          case 0x31: def.push(['daload']); break;
          case 0x52: def.push(['dastore']); break;
          case 0x98: def.push(['dcmpg']); break;
          case 0x97: def.push(['dcmpl']); break;
          case 0x0E: def.push(['dconst', 0]); break;
          case 0x0F: def.push(['dconst', 1]); break;
          case 0x6F: def.push(['ddiv']); break;
          case 0x18: def.push(['dload', bytes[pos++]]); break;
          case 0x26: def.push(['dload', 0]); break;
          case 0x27: def.push(['dload', 1]); break;
          case 0x28: def.push(['dload', 2]); break;
          case 0x29: def.push(['dload', 3]); break;
          case 0x6B: def.push(['dmul']); break;
          case 0x77: def.push(['dneg']); break;
          case 0x73: def.push(['drem']); break;
          case 0xAF: def.push(['dreturn']); break;
          case 0x39: def.push(['dstore', bytes[pos++]]); break;
          case 0x47: def.push(['dstore', 0]); break;
          case 0x48: def.push(['dstore', 1]); break;
          case 0x49: def.push(['dstore', 2]); break;
          case 0x4A: def.push(['dstore', 3]); break;
          case 0x67: def.push(['dsub']); break;
          case 0x59: def.push(['dup']); break;
          case 0x5A: def.push(['dup_x1']); break;
          case 0x5B: def.push(['dup_x2']); break;
          case 0x5C: def.push(['dup2']); break;
          case 0x5D: def.push(['dup2_x1']); break;
          case 0x5E: def.push(['dup2_x2']); break;
          case 0x8D: def.push(['f2d']); break;
          case 0x8B: def.push(['f2i']); break;
          case 0x8C: def.push(['f2l']); break;
          case 0x62: def.push(['fadd']); break;
          case 0x30: def.push(['faload']); break;
          case 0x51: def.push(['fastore']); break;
          case 0x96: def.push(['fcmpg']); break;
          case 0x95: def.push(['fcmpl']); break;
          case 0x0B: def.push(['fconst', 0]); break;
          case 0x0C: def.push(['fconst', 1]); break;
          case 0x0D: def.push(['fconst', 2]); break;
          case 0x6E: def.push(['fdiv']); break;
          case 0x17: def.push(['fload', bytes[pos++]]); break;
          case 0x22: def.push(['fload', 0]); break;
          case 0x23: def.push(['fload', 1]); break;
          case 0x24: def.push(['fload', 2]); break;
          case 0x25: def.push(['fload', 3]); break;
          case 0x6A: def.push(['fmul']); break;
          case 0x76: def.push(['fneg']); break;
          case 0x72: def.push(['frem']); break;
          case 0xAE: def.push(['freturn']); break;
          case 0x38: def.push(['fstore', bytes[pos++]]); break;
          case 0x43: def.push(['fstore', 0]); break;
          case 0x44: def.push(['fstore', 1]); break;
          case 0x45: def.push(['fstore', 2]); break;
          case 0x46: def.push(['fstore', 3]); break;
          case 0x66: def.push(['fsub']); break;
          case 0xB4:
            def.push(['getfield', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xB2:
            def.push(['getstatic', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xA7:
            def.push(['goto', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xC8:
            def.push(['goto', (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]]);
            pos += 4;
            break;
          case 0x91: def.push(['i2b']); break;
          case 0x92: def.push(['i2c']); break;
          case 0x87: def.push(['i2d']); break;
          case 0x86: def.push(['i2f']); break;
          case 0x85: def.push(['i2l']); break;
          case 0x93: def.push(['i2s']); break;
          case 0x60: def.push(['iadd']); break;
          case 0x2E: def.push(['iaload']); break;
          case 0x7E: def.push(['iand']); break;
          case 0x4F: def.push(['iastore']); break;
          case 0x02: def.push(['iconst', -1]); break;
          case 0x03: def.push(['iconst', 0]); break;
          case 0x04: def.push(['iconst', 1]); break;
          case 0x05: def.push(['iconst', 2]); break;
          case 0x06: def.push(['iconst', 3]); break;
          case 0x07: def.push(['iconst', 4]); break;
          case 0x08: def.push(['iconst', 5]); break;
          case 0x6C: def.push(['idiv']); break;
          case 0xA5:
            def.push(['if_acmpeq', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xA6:
            def.push(['if_acmpne', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x9F:
            def.push(['if_icmpeq', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xA0:
            def.push(['if_icmpne', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xA1:
            def.push(['if_icmplt', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xA2:
            def.push(['if_icmpge', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xA3:
            def.push(['if_icmpgt', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xA4:
            def.push(['if_icmple', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x99:
            def.push(['ifeq', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x9A:
            def.push(['ifne', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x9B:
            def.push(['iflt', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x9C:
            def.push(['ifge', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x9D:
            def.push(['ifgt', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x9E:
            def.push(['ifle', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xC7:
            def.push(['ifnonnull', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xC6:
            def.push(['ifnull', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x84:
            def.push(['iinc', bytes[pos], bytes[pos+1] << 24 >> 24]);
            pos += 2;
            break;
          case 0x15: def.push(['iload', bytes[pos++]]); break;
          case 0x1A: def.push(['iload', 0]); break;
          case 0x1B: def.push(['iload', 1]); break;
          case 0x1C: def.push(['iload', 2]); break;
          case 0x1D: def.push(['iload', 3]); break;
          case 0x68: def.push(['imul']); break;
          case 0x74: def.push(['ineg']); break;
          case 0xC1:
            def.push(['instanceof', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xBA:
            def.push(['invokedynamic', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 4; // indexbyte1, indexbyte2, 0, 0
            break;
          case 0xB9:
            def.push(['invokeinterface', (bytes[pos] << 8) | bytes[pos + 1], bytes[pos + 2]]);
            pos += 4; // indexbyte1, indexbyte2, count, 0
            break;
          case 0xB7:
            def.push(['invokespecial', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xB8:
            def.push(['invokestatic', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xB6:
            def.push(['invokevirtual', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x80: def.push(['ior']); break;
          case 0x70: def.push(['irem']); break;
          case 0xAC: def.push(['ireturn']); break;
          case 0x78: def.push(['ishl']); break;
          case 0x7A: def.push(['ishr']); break;
          case 0x36: def.push(['istore', bytes[pos++]]); break;
          case 0x3B: def.push(['istore', 0]); break;
          case 0x3C: def.push(['istore', 1]); break;
          case 0x3D: def.push(['istore', 2]); break;
          case 0x3E: def.push(['istore', 3]); break;
          case 0x64: def.push(['isub']); break;
          case 0x7C: def.push(['iushr']); break;
          case 0x82: def.push(['ixor']); break;
          case 0xA8:
            def.push(['jsr', (bytes[pos] << 24 >> 16) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xC9:
            def.push(['jsr', (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]]);
            pos += 2;
            break;
          case 0x8A: def.push(['l2d']); break;
          case 0x89: def.push(['l2f']); break;
          case 0x88: def.push(['l2i']); break;
          case 0x61: def.push(['ladd']); break;
          case 0x2F: def.push(['laload']); break;
          case 0x7F: def.push(['land']); break;
          case 0x50: def.push(['lastore']); break;
          case 0x94: def.push(['lcmp']); break;
          case 0x09: def.push(['lconst', 0]); break;
          case 0x0A: def.push(['lconst', 1]); break;
          case 0x12: def.push(['ldc', bytes[pos++]]); break;
          case 0x13:
            def.push(['ldc', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x14:
            def.push(['ldc2', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x6D: def.push(['ldiv']); break;
          case 0x16: def.push(['lload', bytes[pos++]]); break;
          case 0x1E: def.push(['lload', 0]); break;
          case 0x1F: def.push(['lload', 1]); break;
          case 0x20: def.push(['lload', 2]); break;
          case 0x21: def.push(['lload', 3]); break;
          case 0x69: def.push(['lmul']); break;
          case 0x75: def.push(['lneg']); break;
          case 0xAB:
            if (pos%4) pos += 4 - (pos%4); // skip padding
            var defaultOffset = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4;
            var npairs = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4;
            var op = ['lookupswitch'];
            for (var i = 0; i < npairs; i++) {
              var match = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
              pos += 4;
              var offset = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
              pos += 4;
              op.push(match, offset);
            }
            op.push('default', defaultOffset);
            def.push(op);
            break;
          case 0x81: def.push(['lor']); break;
          case 0x71: def.push(['lrem']); break;
          case 0xAD: def.push(['lreturn']); break;
          case 0x79: def.push(['lshl']); break;
          case 0x7B: def.push(['lshr']); break;
          case 0x37: def.push(['lstore', bytes[pos++]]); break;
          case 0x3F: def.push(['lstore', 0]); break;
          case 0x40: def.push(['lstore', 1]); break;
          case 0x41: def.push(['lstore', 2]); break;
          case 0x42: def.push(['lstore', 3]); break;
          case 0x65: def.push(['lsub']); break;
          case 0x7D: def.push(['lushr']); break;
          case 0x83: def.push(['lxor']); break;
          case 0xC2: def.push(['monitorenter']); break;
          case 0xC3: def.push(['monitorexit']); break;
          case 0xC5:
            def.push(['multianewarray', (bytes[pos] << 8) | bytes[pos + 1], bytes[pos + 2]]);
            pos += 3;
            break;
          case 0xBB:
            def.push(['new', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xBC:
            var elType;
            switch(bytes[pos++]) {
              case 4: elType = 'boolean'; break;
              case 5: elType = 'char'; break;
              case 6: elType = 'f32'; break;
              case 7: elType = 'f64'; break;
              case 8: elType = 'i8'; break;
              case 9: elType = 'i16'; break;
              case 10: elType = 'i32'; break;
              case 11: elType = 'i64'; break;
              default: throw new Error('unknown type code for newarray: ' + bytes[--pos]);
            }
            def.push(['newarray', elType]);
            break;
          case 0x00: break; // nop
          case 0x57: def.push(['pop']); break;
          case 0x58: def.push(['pop2']); break;
          case 0xB5:
            def.push(['putfield', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xB3:
            def.push(['putstatic', (bytes[pos] << 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0xA9: def.push(['ret', bytes[pos++]]); break;
          case 0xB1: def.push(['return']); break;
          case 0x35: def.push(['saload']); break;
          case 0x56: def.push(['sastore']); break;
          case 0x11:
            def.push(['sipush', (bytes[pos] << 24 >> 8) | bytes[pos + 1]]);
            pos += 2;
            break;
          case 0x5F: def.push(['swap']); break;
          case 0xAA:
            if (pos%4) pos += 4 - (pos%4);
            var defaultOffset = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4;
            var low = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4;
            var high = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4;
            var op = ['tableswitch', low];
            for (var i = low; i <= high; i++) {
              op.push((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]);;
              pos += 4;
            }
            op.push('default', defaultOffset);
            def.push(op);
            break;
          case 0xC4:
            var opcode = bytes[pos], arg = (bytes[pos + 1] << 8) | bytes[pos + 2];
            pos += 3;
            switch(opcode) {
              case 0x15: def.push(['iload', arg]); break;
              case 0x16: def.push(['lload', arg]); break;
              case 0x17: def.push(['fload', arg]); break;
              case 0x18: def.push(['dload', arg]); break;
              case 0x19: def.push(['aload', arg]); break;
              case 0x36: def.push(['istore', arg]); break;
              case 0x38: def.push(['fstore', arg]); break;
              case 0x3A: def.push(['astore', arg]); break;
              case 0x37: def.push(['lstore', arg]); break;
              case 0x39: def.push(['dstore', arg]); break;
              case 0xA9: def.push(['ret', arg]); break;
              case 0xC4:
                var arg2 = (bytes[pos] << 8) | bytes[pos + 1];
                pos += 2;
                def.push(['iinc', arg, arg2]);
                break;
              default: throw new Error('unsupported opcode for wide: 0x' + opcode.toString(16));
            }
            break;
          default: throw new Error('unknown opcode: 0x' + opcode.toString(16));
        }
      }
      return ['code', def];
    },
  };
  
  return {
    getStructView: function() {
      return ClassView;
    },
  };

});
