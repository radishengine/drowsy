if (typeof self === Worker) {
  importScripts('require.js');
}

define('DataSegment', ['Format', 'formats/byExtension'], function(Format, formatsByExtension) {
  
  var emptyBuffer = new ArrayBuffer(0);
  var emptyBytes = new Uint8Array(emptyBuffer);
  var emptyBlob = new Blob([emptyBytes]);
  var p_emptyBuffer = Promise.resolve(emptyBuffer);
  var p_emptyBytes = Promise.resolve(emptyBytes);
  
  var handlerCache = {};
  
  function toFormat(v) {
    if (typeof v.length === 'number') {
      return Format.apply(null, v);
    }
    if (typeof v === 'undefined' || v === null) {
      return Format.generic;
    }
    return Format(v);
  }
  
  function getFormatHandler(t) {
    if (t in handlerCache) return handlerCache[t];
    return handlerCache[t] = new Promise(function(resolve, reject) {
      var handlerModule = 'formats/' + t;
      require([handlerModule],
      function(handler) {
        resolve(handler);
      },
      function() {
        requirejs.undef(handlerModule);
        var handler = {};
        define(handlerModule, handler);
        resolve(handler);
      });
    });
  }
  
  function normalizeRegion(
  offset, minLength, maxLength,
  ctxOffset, ctxMinLength, ctxMaxLength) {
    // normalize the value range
    if (isNaN(offset) && offset !== 'suffix') offset = 0;
    if (isNaN(minLength)) {
      minLength = 0;
      if (isNaN(maxLength)) maxLength = Infinity;
    }
    else if (isNaN(maxLength)) maxLength = minLength;
    if (offset === 'suffix' && !isFinite(maxLength)) {
      offset = 0;
    }
    if ((offset !== 'suffix' && offset < 0) || minLength < 0 || maxLength < 0 ) {
      throw new RangeError('offset and range length values must not be negative');
    }
    if (!isFinite(minLength) || (offset !== 'suffix' && !isFinite(offset))) {
      throw new RangeError('offset and min length must be finite');
    }
    if (minLength > maxLength) {
      throw new RangeError('min length must not exceed max length');
    }
    // normalize the context range
    if (isNaN(ctxOffset) && ctxOffset !== 'suffix') ctxOffset = 0;
    if (isNaN(ctxMinLength)) {
      ctxMinLength = 0;
      if (isNaN(ctxMaxLength)) ctxMaxLength = Infinity;
    }
    else if (isNaN(ctxMaxLength)) ctxMaxLength = ctxMinLength;
    if (ctxOffset === 'suffix' && !isFinite(ctxMaxLength)) {
      ctxOffset = 0;
    }
    if ((ctxOffset !== 'suffix' && ctxOffset < 0) || ctxMinLength < 0 || ctxMaxLength < 0 ) {
      throw new RangeError('offset and range length values must not be negative');
    }
    if (!isFinite(ctxMinLength) || (ctxOffset !== 'suffix' && !isFinite(ctxOffset))) {
      throw new RangeError('offset and min length must be finite');
    }
    if (ctxMinLength > ctxMaxLength) {
      throw new RangeError('context min length must not exceed max length');
    }
  
    // at this stage:
    // - offset is either 'suffix', or a finite number >= 0
    // - min length is a finite number >= 0
    // - max length is a number >= min length
    // - max length MAY be infinite, UNLESS offset is 'suffix'
    
    // put the values in context, if applicable
    if (ctxOffset === 'suffix') {
      // so ctxMaxLength must be finite
      if (offset !== 'suffix') {
        if (offset > ctxMaxLength) {
          throw new RangeError('offset out of range ('+offset+' in '+ctxMaxLength+' bytes)');
        }
        if ((offset + maxLength) < ctxMaxLength) {
          throw new RangeError('cannot derive a non-suffix from a suffix context');
        }
        offset = 'suffix';
        minLength = maxLength = ctxMaxLength - offset;
      }
    }
    else {
      if (offset === 'suffix') {
        if (ctxMinLength === ctxMaxLength && minLength === maxLength) {
          offset = ctxMinLength - minLength;
        }
      }
      else {
        if (minLength > ctxMaxLength) {
          throw new RangeError('cannot get '+minLength+' bytes from '+ctxMaxLength+' bytes)');
        }
        maxLength = Math.min(maxLength, ctxMaxLength - offset);
        minLength = Math.min(maxLength, Math.max(minLength, ctxMinLength - offset));
        offset += ctxOffset;
      }
    }
    
    return {offset:offset, minLength:minLength, maxLength:maxLength};
  }
  
  function DataSegment() {
  }
  DataSegment.prototype = {
    format: Format.generic,
    get fixedLength() {
      var min = this.minLength, max = this.maxLength;
      return (min === max) ? min : NaN;
    },
    offset: 0,
    minLength: 0,
    maxLength: Infinity,
    get hasFixedLength() {
      return this.minLength === this.maxLength;
    },
    withFixedLength() {
      if (this.hasFixedLength) return Promise.resolve(this);
      throw new Error('withFixedLength not defined for ' + this);
    },
    getSegmentNormalized: function(format, offset, minLength, maxLength) {
      return new DataSegmentWrapper(this, format, offset, minLength, maxLength);
    },
    getBufferOrViewNormalized: function(offset, minLength, maxLength) {
      throw new Error('no method defined to get bytes');
    },
    getArrayBufferNormalized: function(offset, minLength, maxLength) {
      return this.getBufferOrViewNormalized(offset, minLength, maxLength)
      .then(function(borv) {
        if (borv instanceof ArrayBuffer) return borv;
        if (borv.byteLength === borv.buffer.byteLength) {
          return borv.buffer;
        }
        return borv.buffer.slice(borv.byteOffset, borv.byteOffset + borv.byteLength);
      });
    },
    getSegment: function(format, offset, minLength, maxLength) {
      format = toFormat(format);
      var region = normalizeRegion(
        offset, minLength, maxLength,
        this.offset, this.minLength, this.maxLength);
      if (region.maxLength === 0) return new EmptySegment(format);
      return this.getSegmentNormalized(format, region.offset, region.minLength, region.maxLength);
    },
    getBytesNormalized: function(offset, minLength, maxLength) {
      return this.getBufferOrViewNormalized(offset, minLength, maxLength)
      .then(function(borv) {
        if (borv instanceof ArrayBuffer) return new Uint8Array(borv);
        if (borv instanceof Uint8Array) return borv;
        return new Uint8Array(borv.buffer, borv.byteOffset, borv.byteLength);
      });
    },
    getArrayBuffer: function(offset, minLength, maxLength) {
      var region = normalizeRegion(
        offset, minLength, maxLength,
        this.offset, this.minLength, this.maxLength);
      if (region.maxLength === 0) return p_emptyBuffer;
      return this.getArrayBufferNormalized(region.offset, region.minLength, region.maxLength);
    },
    getDataView: function(offset, minLength, maxLength) {
      var region = normalizeRegion(
        offset, minLength, maxLength,
        this.offset, this.minLength, this.maxLength);
      if (region.maxLength === 0) return new DataView(p_emptyBuffer);
      return this.getBufferOrViewNormalized(region.offset, region.minLength, region.maxLength)
      .then(function(borv) {
        if (borv instanceof ArrayBuffer) return new DataView(borv);
        return new DataView(borv.buffer, borv.byteOffset, borv.byteLength);
      });
    },
    getUint8: function(offset) {
      return this.getBufferOrViewNormalized(region.offset, 1, 1)
      .then(function(borv) {
        if (borv instanceof Uint8Array) return borv[0];
        if (borv instanceof ArrayBuffer) return new Uint8Array(borv)[0];
        return new Uint8Array(borv.buffer, borv.byteOffset, 1)[0];
      });
    },
    getInt16: function(offset, littleEndian) {
      return this.getDataView(offset, 2, 2)
      .then(function(dv) {
        return dv.getInt16(0, littleEndian);
      });
    },
    getUint16: function(offset, littleEndian) {
      return this.getDataView(offset, 2, 2)
      .then(function(dv) {
        return dv.getUint16(0, littleEndian);
      });
    },
    getInt32: function(offset, littleEndian) {
      return this.getDataView(offset, 4, 4)
      .then(function(dv) {
        return dv.getInt32(0, littleEndian);
      });
    },
    getUint32: function(offset, littleEndian) {
      return this.getDataView(offset, 4, 4)
      .then(function(dv) {
        return dv.getUint32(0, littleEndian);
      });
    },
    getFloat32: function(offset, littleEndian) {
      return this.getDataView(offset, 4, 4)
      .then(function(dv) {
        return dv.getFloat32(0, littleEndian);
      });
    },
    getFloat64: function(offset, littleEndian) {
      return this.getDataView(offset, 8, 8)
      .then(function(dv) {
        return dv.getFloat64(0, littleEndian);
      });
    },
    getBytes: function(offset, minLength, maxLength) {
      var region = normalizeRegion(
        offset, minLength, maxLength,
        this.offset, this.minLength, this.maxLength);
      if (region.maxLength === 0) return p_emptyBytes;
      return this.getBytesNormalized(region.offset, region.minLength, region.maxLength);
    },
    get asBlobParameter() {
      throw new Error('asBlobParameter not defined for ' + this);
    },
    getBlob: function() {
      var blobParam = this.asBlobParameter;
      if (blobParam) return Promise.resolve(new Blob([blobParam], this.format.toString()));
      var self = this;
      return this.getBufferOrViewNormalized(0, this.minLength, this.maxLength)
      .then(function(borv) {
        return new Blob([borv], self.format.toString());
      });
    },
    saveForTransfer: function(transferables) {
      throw new Error('saveForTransfer not implemented on ' + this);
    },
    toRemote: function(worker) {
      return new RemoteDataSegment(worker).transfer(this);
    },
    toLocal: function() {
      return Promise.resolve(this);
    },
    getFormatHandler: function() {
      return getFormatHandler(this.format.name);
    },
    getStructView: function() {
      var self = this;
      return this.getTypeHandler().then(function(handler) {
        var TView;
        if (typeof handler.getStructView !== 'function'
        || !(TView = handler.getStructView(self))) {
          return Promise.reject('no struct view defined for ' + self.type);
        }
        return TView;
      });
    },
    mount: function(volume) {
      var self = this;
      return this.getFormatHandler().then(function(handler) {
        if (typeof handler.mount !== 'function') {
          return Promise.reject('mount not implemented for ' + self.format.name);
        }
        return handler.mount(self, volume);
      });
    },
    getStruct: function() {
      var self = this;
      return Promise.all([this.getStructView(), this.getBytes()])
      .then(function(values) {
        var TView = values[0], bytes = values[1];
        if (typeof TView.byteLength === 'number') {
          return new TView(bytes.buffer, bytes.byteOffset, TView.byteLength);
        }
        else {
          return new TView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        }
      });
    },
    getCapabilities: function() {
      var self = this;
      return this.getFormatHandler()
      .then(function(handler) {
        return {
          split: typeof handler.split === 'function',
          join: typeof handler.join === 'function',
          struct: typeof handler.getStructView === 'function' && handler.getStructView(self) !== null,
          mount: typeof handler.mount === 'function',
        };
      });
    },
    split: function(eachCallback, endCallback) {
      if (arguments.length === 0) {
        var list = [];
        eachCallback = function(entry) {
          list.push(entry);
        };
        endCallback = function() {
          return Promise.resolve(list);
        };
      }
      var self = this;
      return this.getFormatHandler().then(function(handler) {
        if (typeof handler.split !== 'function') {
          return Promise.reject('split operation not defined for ' + self.format.name);
        }
        var entries = new SplitEntries(eachCallback);
        var result = handler.split(self, entries);
        return endCallback ? result.then(endCallback) : result;
      });
    },
    hint: function(what) {
      console.warn('unused hint on '+this+': '+what);
      return this;
    },
  };
  
  function EmptySegment(format) {
    this.format = format;
  }
  EmptySegment.prototype = Object.assign(new DataSegment, {
    getSegmentNormalized: function(format, offset, minLength, maxLength) {
      return (format === this.format) ? this : new EmptySegment(format);
    },
    getArrayBufferNormalized: function(offset, minLength, maxLength) {
      return p_emptyBuffer;
    },
    getBytesNormalized: function(offset, minLength, maxLength) {
      return p_emptyBytes;
    },
    saveForTransfer: function(transferables) {
      return ['Empty', this.format.toString()];
    },
  });
  Object.defineProperties(EmptySegment.prototype, {
    asBlobParameter: {value:emptyBuffer},
    fixedLength: {value:0},
    minLength: {value:0},
    maxLength: {value:0},
    hasFixedLength: {value:true},
  });
  
  function DataSegmentFromBlob(blob) {
    this.blob = blob;
  }
  DataSegmentFromBlob.prototype = Object.assign(new DataSegment, {
    getSegmentNormalized: function(format, offset, minLength, maxLength) {
      // in this normalized context, we should not have to worry about:
      // - 'suffix' ranges
      // - offset out of range
      // - offset+minLength out of range
      if (offset === 0 && maxLength >= this.blob.size && format === this.format) return this;
      return new DataSegmentFromBlob(this.blob.slice(offset, offset+maxLength, format));
    },
    getBufferOrViewNormalized: function(offset, minLength, maxLength) {
      return this.getArrayBufferNormalized(offset, minLength, maxLength);
    },
    getBytesNormalized: function(offset, minLength, maxLength) {
      return this.getArrayBufferNormalized(offset, minLength, maxLength)
      .then(function(buffer){ return new Uint8Array(buffer); });
    },
    getArrayBufferNormalized: function(offset, minLength, maxLength) {
      var blob = this.blob;
      if (offset !== 0 || maxLength < blob.size) {
        blob = blob.slice(offset, offset + maxLength);
      }
      var frdr = new FileReader();
      return new Promise(function(resolve, reject) {
        frdr.addEventListener('load', function(e) {
          resolve(frdr.result);
        });
        frdr.addEventListener('abort', function(e) {
          reject('aborted');
        });
        frdr.addEventListener('error', function(e) {
          reject(e.message);
        });
        frdr.readAsArrayBuffer(blob);
      });
    },
    getBlob: function() {
      return Promise.resolve(this.blob);
    },
    saveForTransfer: function(transferables) {
      return ['FromBlob', this.blob];
    },
  });
  Object.defineProperties(DataSegmentFromBlob.prototype, {
    hasFixedLength: {value:true},
    format: {
      get: function() { return Format(this.blob.type || 'application/octet-stream'); },
    },
    fixedLength: {
      get: function() { return this.blob.size; },
    },
    minLength: {
      get: function() { return this.blob.size; },
    },
    maxLength: {
      get: function() { return this.blob.size; },
    },
    asBlobParameter: {
      get: function() { return this.blob; },
    },
  });
  
  function DataSegmentWrapper(wrappedSegment, format, offset, minLength, maxLength) {
    this.wrappedSegment = wrappedSegment;
    this.format = format;
    var region = normalizeRegion(
      offset, minLength, maxLength,
      0, wrappedSegment.minLength, wrappedSegment.maxLength);
    this.offset = region.offset;
    this.minLength = region.minLength;
    this.maxLength = region.maxLength;
  }
  DataSegmentWrapper.prototype = Object.assign(new DataSegment, {
    getSegmentNormalized: function(format, offset, minLength, maxLength) {
      if (format === this.format && offset === this.offset && minLength <= this.minLength && maxLength >= this.maxLength) {
        return this;
      }
      return new DataSegmentWrapper(this.wrappedSegment, format, offset, minLength, maxLength);
    },
    getBufferOrViewNormalized: function(offset, minLength, maxLength) {
      return this.wrappedSegment.getBufferOrViewNormalized(offset, minLength, maxLength);
    },
    getArrayBufferNormalized: function(offset, minLength, maxLength) {
      return this.wrappedSegment.getArrayBufferNormalized(offset, minLength, maxLength);
    },
    getBytesNormalized: function(offset, length, minLength, maxLength) {
      return this.wrappedSegment.getBytesNormalized(offset, minLength, maxLength);
    },
    saveForTransfer: function(transferables) {
      return ['Wrapper', this.wrappedSegment.saveForTransfer(transferables), this.format, this.offset, this.minLength, this.maxLength];
    },
  });
  Object.defineProperties(DataSegmentWrapper.prototype, {
    asBlobParameter: {
      get: function() {
        var inner = this.wrappedSegment.asBlobParameter;
        if (inner instanceof Blob) {
          if (inner.size < this.minLength) {
            throw new RangeError('not enough bytes (wanted ' + this.minLength + ', got ' + inner.size + ')');
          }
          if (this.offset === 'suffix') {
            if (inner.size > this.maxLength) {
              inner = inner.slice(-this.maxLength);
            }
          }
          else if (this.offset !== 0 || inner.size > this.maxLength) {
            inner = inner.slice(this.offset, Math.min(inner.size, this.offset + this.maxLength));
          }
          return inner;
        }
        if (inner instanceof ArrayBuffer) {
          if (inner.byteLength < this.minLength) {
            throw new RangeError('not enough bytes (wanted ' + this.minLength + ', got ' + inner.byteLength + ')');
          }
          if (this.offset === 'suffix') {
            if (inner.byteLength > this.maxLength) {
              inner = new Uint8Array(inner, inner.byteLength-this.maxLength, this.maxLength);
            }
          }
          else if (this.offset !== 0 || inner.byteLength > this.maxLength) {
            inner = new Uint8Array(inner, this.offset, Math.min(inner.byteLength - this.offset, this.maxLength));
          }
          return inner;
        }
        if (ArrayBuffer.isView(inner)) {
          if (inner.byteLength < this.minLength) {
            throw new RangeError('not enough bytes (wanted '+this.minLength+', got '+inner.byteLength+')');
          }
          if (this.offset === 'suffix') {
            if (inner.byteLength > this.maxLength) {
              inner = new Uint8Array(inner.buffer, inner.byteOffset + inner.byteLength - this.maxLength, this.maxLength);
            }
          }
          else if (this.offset !== 0 || inner.byteLength > this.maxLength) {
            inner = new Uint8Array(
              inner.buffer,
              inner.byteOffset + this.offset,
              Math.min(inner.byteLength - this.offset, this.maxLength));
          }
          return inner;
        }
        return null;
      },
    },
  });
  
  function DataSegmentFromArrayBuffer(format, buffer, byteOffset, byteLength) {
    format = toFormat(format);
    this.format = format;
    var region = normalizeRegion(
      byteOffset, byteLength, byteLength,
      buffer.byteOffset || 0, buffer.byteLength, buffer.byteLength);
    if (ArrayBuffer.isView(buffer)) {
      buffer = buffer.buffer;
    }
    Object.defineProperties(this, {
      buffer: {value:buffer},
      offset: {value:region.offset},
      fixedLength: {value:region.minLength},
      minLength: {value:region.minLength},
      maxLength: {value:region.maxLength},
    });
  }
  DataSegmentFromArrayBuffer.prototype = Object.assign(new DataSegment, {
    getSegmentNormalized: function(format, offset, minLength, maxLength) {
      if (format === this.format && offset === this.offset && minLength <= this.fixedLength && maxLength >= this.fixedLength) {
        return this;
      }
      return new DataSegmentFromArrayBuffer(format, this.buffer, offset, minLength, maxLength);
    },
    getBytesNormalized: function(offset, minLength, maxLength) {
      return Promise.resolve(new Uint8Array(this.buffer, offset, maxLength));
    },
    getBufferOrViewNormalized: function(offset, minLength, maxLength) {
      if (offset === 0 && maxLength >= this.fixedLength) {
        return Promise.resolve(this.buffer);
      }
      return Promise.resolve(new Uint8Array(this.buffer, offset, maxLength));
    },
    saveForTransfer: function(transferables) {
      transferables.push(this.buffer);
      return ['FromArrayBuffer', this.buffer, this.offset, this.fixedLength];
    },
  });
  Object.defineProperties(DataSegmentFromArrayBuffer.prototype, {
    asBlobParameter: {
      get: function() {
        if (this.offset === 0 && this.fixedLength === this.buffer.byteLength) {
          return this.buffer;
        }
        return new Uint8Array(this.buffer, this.offset, this.fixedLength);
      },
    },
    hasFixedLength: {value:true},
  });
  
  function DataSegmentSequence(format, segments) {
    format = toFormat(format);
    this.format = format;
    this.segments = segments;
    var minLength = 0, maxLength = 0;
    for (var i = 0; i < segments.length; i++) {
      minLength += segments[i].minLength;
      maxLength += segments[i].maxLength;
    }
    this.minLength = minLength;
    this.maxLength = maxLength;
  }
  DataSegmentSequence.prototype = Object.assign(new DataSegment, {
    withFixedLength: function() {
      if (this.hasFixedLength) return Promise.resolve(this);
      var self = this;
      return Promise.all(this.segments.map(function(seg){ return seg.withFixedLength(); }))
      .then(function(allFixed) {
        return DataSegment.from(allFixed, self.format);
      });
    },
    getSegmentNormalized: function(format, offset, minLength, maxLength) {
      if (offset === 0 && minLength <= this.minLength && maxLength >= this.maxLength) {
        if (format === this.format) {
          return this;
        }
        return new DataSegmentSequence(format, this.segments);
      }
      var segments = this.segments;
      function onAddSegment(list, i) {
        if (i >= segments.length) {
          return Promise.reject('segment subset out of range');
        }
        var segment = segments[i];
        if (segment.minLength >= minLength) {
          list.push(segment.getSegmentNormalized(segment.format, 0, minLength, maxLength));
          return DataSegment.from(list, format);
        }
        return segment.getSegmentNormalized(segment.format, 0, 0, maxLength).withFixedLength().then(function(segment) {
          list.push(segment);
          minLength -= segment.fixedLength;
          maxLength -= segment.fixedLength;
          return (minLength > 0) ? onAddSegment(list, i + 1) : DataSegment.from(list, format);
        });
      }
      function onAddSuffix(list, i) {
        if (i < 0) {
          return Promise.reject('segment subset out of range');
        }
        var segment = segments[i];
        if (segment.minLength >= minLength) {
          list.unshift(segment.getSegmentNormalized(segment.format, 'suffix', minLength, maxLength));
          return DataSegment.from(list, format);
        }
        return segment.getSegmentNormalized(segment.format, 'suffix', 0, maxLength).withFixedLength().then(function(segment) {
          list.unshift(segment);
          minLength -= segment.fixedLength;
          maxLength -= segment.fixedLength;
          return (minLength > 0) ? onAddSuffix(list, i - 1) : DataSegment.from(list, format);
        });
      }
      function onSegment(i) {
        if (i >= segments.length) {
          return Promise.reject('segment subset out of range');
        }
        var segment = segments[i];
        if ((offset + minLength) <= segment.minLength) {
          return segment.getSegment(format, offset, minLength, maxLength);
        }
        return segment.withFixedLength().then(function(segment) {
          if (offset >= segment.fixedLength) {
            offset -= segment.fixedLength;
            return onSegment(i + 1);
          }
          var availableLength = segment.fixedLength - offset;
          if (availableLength >= minLength) {
            return segment.getSegmentNormalized(format, offset, Math.min(maxLength, availableLength));
          }
          segment = segment.getSegmentNormalized(segment.format, offset, availableLength);
          offset = 0;
          minLength -= availableLength;
          maxLength -= availableLength;
          return onAddSegment([segment], ++i);
        });
      }
      function onSuffix(i) {
        if (i < 0) {
          return Promise.reject('segment subset out of range');
        }
        var segment = segments[i];
        if (minLength <= segment.minLength) {
          return segment.getSegment(format, 'suffix', minLength, maxLength);
        }
        return segment.withFixedLength().then(function(segment) {
          var availableLength = segment.fixedLength;
          if (availableLength >= minLength) {
            return segment.getSegmentNormalized(format, 'suffix', minLength, Math.min(maxLength, availableLength));
          }
          minLength -= availableLength;
          maxLength -= availableLength;
          return onAddSuffix([segment], i - 1);
        });
      }
      return (offset === 'suffix') ? onSuffix(segments.length-1) : onSegment(0);
    },
    getBufferOrViewNormalized: function(format, offset, minLength, maxLength) {
      var segments = this.segments;
      function concatBuffers(buffers) {
        var totalLength = buffers.reduce(function(count, b){ return count + b.byteLength; }, 0);
        var buffer = new ArrayBuffer(totalLength);
        var bytes = new Uint8Array(buffer);
        for (var i=0, pos=0; i < buffers.length; i++) {
          var el = buffers[i];
          if (!(el instanceof Uint8Array)) {
            el = new Uint8Array(el.buffer || el, el.byteOffset || 0, el.byteLength);
          }
          bytes.set(el, pos);
          pos += el.byteLength;
        }
        return buffer;
      }
      function appendBorV(promises, i) {
        if (i >= segments.length) {
          return Promise.reject('segment subset out of range');
        }
        var segment = segment[i];
        if (segment.minLength >= minLength) {
          promises.push(segment.getSegment(segment.format, 0, minLength, maxLength));
          return Promise.all(promises).then(concatBuffers);
        }
        return segment.getSegment(segment.format, 0, maxLength).withFixedLength().then(function(segment) {
          promises.push(segment.getBufferOrViewNormalized(segment.offset, segment.minLength, segment.maxLength));
          minLength -= segment.fixedLength;
          maxLength -= segment.fixedLength;
          return (minLength > 0) ? appendBorV(promises, i + 1) : Promise.all(promises).then(concatBuffers);
        });
      }
      function prependBorV(promises, i) {
        if (i < 0) {
          return Promise.reject('segment subset out of range');
        }
        var segment = segment[i];
        if (segment.minLength >= minLength) {
          maxLength = Math.min(segment.maxLength, maxLength);
          promises.unshift(segment.getBufferOrViewNormalized(
            segment.format,
            'suffix',
            minLength,
            maxLength));
          return Promise.all(promises).then(concatBuffers);
        }
        return segment.getSegmentNormalized(segment.format, 0, maxLength).withFixedLength().then(function(segment) {
          promises.unshift(segment.getBufferOrViewNormalized(segment.offset, segment.minLength, segment.maxLength));
          minLength -= segment.fixedLength;
          maxLength -= segment.fixedLength;
          return (minLength > 0) ? appendBorV(promises, i - 1) : Promise.all(promises).then(concatBuffers);
        });
      }
      function onSegment(i) {
        if (i >= segments.length) {
          return Promise.reject('segment subset out of range');
        }
        var segment = segments[i];
        if ((offset + minLength) <= segment.minLength) {
          return segment.getBufferOrViewNormalized(offset, minLength, maxLength);
        }
        return segment.withFixedLength().then(function(segment) {
          if (offset >= segment.fixedLength) {
            offset -= segment.fixedLength;
            return onSegment(i + 1);
          }
          var availableLength = segment.fixedLength - offset;
          if (availableLength >= minLength) {
            return segment.getBufferOrViewNormalized(offset, Math.min(maxLength, availableLength));
          }
          segment = segment.getSegment(segment.format, offset, availableLength);
          offset = 0;
          minLength -= availableLength;
          maxLength -= availableLength;
          return appendBorV([segment.getBufferOrView()], i + 1);
        });
      }
      function onSuffix(i) {
        if (i < 0) {
          return Promise.reject('segment subset out of range');
        }
        var segment = segments[i];
        if (minLength <= segment.minLength) {
          return segment.getBufferOrViewNormalized('suffix', minLength, maxLength);
        }
        return segment.withFixedLength().then(function(segment) {
          var availableLength = segment.fixedLength;
          if (availableLength >= minLength) {
            availableLength = Math.min(maxLength, availableLength);
            return segment.getBufferOrViewNormalized('suffix', availableLength, availableLength);
          }
          segment = segment.getSegmentNormalized(segment.format, 'suffix', availableLength, availableLength);
          minLength -= availableLength;
          maxLength -= availableLength;
          return prependBorV([segment.getBufferOrView()], i + 1);
        });
      }
      return (offset === 'suffix') ? onSuffix(segments.length - 1) : onSegment(0);
    },
    getBlob: function() {
      var promised = [];
      for (var i = 0; i < this.segments.length; i++) {
        var blobParam = this.segments[i].asBlobParameter;
        promised[i] = blobParam ? Promise.resolve(blobParam) : this.segments[i].getBlob();
      }
      var self = this;
      return Promise.all(promised).then(function(blobParts) {
        return new Blob(blobParts, self.format.toString());
      });
    },
    saveForTransfer: function(transferables) {
      var list = ['Sequence'];
      for (var i = 0; i < this.segments.length; i++) {
        list.push(this.segments[i].saveForTransfer(transferables));
      }
      return list;
    },
  });
  Object.defineProperties(DataSegmentSequence, {
    asBlobParameter: {
      get: function() {
        var blobParams = [];
        for (var i = 0; i < this.segments.length; i++) {
          if (!(blobParams[i] = this.segments[i].asBlobParameter)) return null;
        }
        return new Blob(blobParams, this.format.toString());
      },
    },
  });
  
  function DataSegmentFromURL(url, format, offset, minLength, maxLength) {
    this.url = url;
    if (format) {
      format = toFormat(format);
      this.format = format;
    }
    else {
      var extension = url.replace(/[?#].*/, '').match(/\.([^\.]+)$/);
      if (extension) {
        extension = extension[1].toLowerCase();
        if (formatsByExtension.hasOwnProperty(extension)) {
          this.format = formatsByExtension[extension];
        }
      }
    }
    var region = normalizeRegion(
      offset, minLength, maxLength,
      0, 0, Infinity);
    this.offset = region.offset;
    this.minLength = region.minLength;
    this.maxLength = region.maxLength;
  }
  DataSegmentFromURL.prototype = Object.assign(new DataSegment, {
    getSegmentNormalized: function(format, offset, minLength, maxLength) {
      return new DataSegmentFromURL(this.url, format, offset, minLength, maxLength);
    },
    runXHRNormalized: function(req, offset, minLength, maxLength) {
      var range;
      if (offset === 'suffix') {
        range = 'bytes=-'+maxLength;
        if (length !== -offset) {
          throw new Error('length cannot be specified for a suffix range');
        }
      }
      else {
        range = 'bytes='+offset+'-';
        if (isFinite(maxLength)) {
          range += (offset + maxLength - 1);
        }
      }
      req.open('GET', this.url);
      if (range !== 'bytes=0-') {
        req.setRequestHeader('Range', this.range);
      }
      return new Promise(function(resolve, reject) {
        req.addEventListener('load', function(e) {
          var size = (req.responseType === 'blob') ? req.response.size : req.response.byteLength;
          if (size < minLength) {
            reject('not enough bytes returned - need ' + minLength + ', got ' + size);
          }
          else {
            resolve(req.response);
          }
        });
        req.addEventListener('abort', function(e) {
          reject('request aborted');
        });
        req.addEventListener('error', function(e) {
          reject(e.message);
        });
        req.send();
      });
    },
    getBufferOrViewNormalized: function(offset, minLength, maxLength) {
      var req = new XMLHttpRequest();
      req.responseType = 'arraybuffer';
      return this.runXHRNormalized(req, offset, minLength, maxLength);
    },
    getBlob: function() {
      var req = new XMLHttpRequest();
      req.responseType = 'blob';
      var type = this.format.toString();
      return this.runXHRNormalized(req, this.offset, this.minLength, this.maxLength)
      .then(function(blob) {
        return blob.slice(0, blob.size, type);
      });
    },
    saveForTransfer: function(transferables) {
      return ['FromURL', this.url, this.offset, this.minLength, this.maxLength];
    },
  });
  
  function RemoteDataSegment(worker) {
    this.worker = worker;
    var id;
    do {
      id = '_' + ((Math.random() * 0xffffffff) >>> 0).toString(16).toUpperCase();
    } while (id in worker);
    this.id = id;
    worker[id] = this;
    this.onMessage = this.onMessage.bind(this);
    worker.addEventListener('message', this.onMessage);
  }
  RemoteDataSegment.prototype = Object.assign(new DataSegment, {
    onMessage: function(msg) {
      if (msg[0] !== this.id) return;
    },
    transfer: function(segment) {
      var transferables = [];
      var saved = segment.saveForTransfer(transferables);
      this.worker.postMessage([this.id, 'transfer', saved], transferables);
      return Promise.resolve(this);
    },
    toRemote: function() {
      return Promise.reject('segment is already remote');
    },
    toLocal: function() {
      var self = this, worker = this.worker, id = this.id;
      return new Promise(function(resolve, reject) {
        worker.removeEventListener('message', self.onMessage);
        delete self.worker;
        delete worker[id];
        function onMessage(msg) {
          if (msg[0] !== id || msg[1] !== 'transfer') return;
          worker.removeEventListener('message', onMessage);
          resolve(DataSegment.loadAfterTransfer(msg[2]));
        }
        worker.addEventListener('message', onMessage);
        worker.postMessage([id, 'request-transfer']);
      });
    },
  });
  
  function BufferedSegment(wrappedSegment, format, offset, minLength, maxLength) {
    var region;
    if (wrappedSegment instanceof BufferedSegment) {
      region = normalizeRegion(
        offset, minLength, maxLength,
        wrappedSegment.offset, wrappedSegment.minLength, wrappedSegment.maxLength);
      this.buffered = wrappedSegment.buffered;
      this.readyCallbacks = wrappedSegment.readyCallbacks;
      this.wrappedSegment = wrappedSegment.wrappedSegment;
    }
    else {
      region = normalizeRegion(
        offset, minLength, maxLength,
        0, wrappedSegment.minLength, wrappedSegment.maxLength);
      this.buffered = [];
      this.readyCallbacks = [];
      this.wrappedSegment = wrappedSegment;
    }
    this.offset = region.offset;
    this.minLength = region.minLength;
    this.maxLength = region.maxLength;
  }
  BufferedSegment.prototype = Object.assign(new DataSegment, {
    BUFSIZE: 32 * 1024,
    getSegmentNormalized: function(format, offset, minLength, maxLength) {
      if (format === this.format && offset === this.offset && minLength <= this.minLength && maxLength >= this.maxLength) {
        return this;
      }
      return new BufferedSegment(this, format, offset, minLength, maxLength);
    },
    withFixedLength: function() {
      var self = this;
      return this.wrappedSegment.withFixedLength().then(function(segment) {
        if (segment === self.wrappedSegment) return self;
        return new BufferedSegment(segment, self.format, self.offset, self.minLength, self.maxLength);
      });
    },
    getIndex: function(offset) {
      offset += this.offset;
      var buffered = this.buffered;
      for (var min_i = 0, max_i = buffered.length - 1; min_i <= max_i; ) {
        var i = Math.floor((min_i + max_i) / 2);
        if (offset < buffered[i].offset) {
          max_i = i - 1;
          if (max_i < 0 || offset >= (buffered[max_i].segmentOffset + buffered[max_i].byteLength)) {
            return ~i;
          }
          continue;
        }
        if (offset >= (buffered[i].segmentOffset + buffered[i].byteLength)) {
          min_i = i + 1;
          continue;
        }
        return i;
      }
      return ~buffered.length;
    },
    put: function(part) {
      var i = this.getIndex(part.segmentOffset);
      var buffered = this.buffered;
      if (i < 0) {
        i = ~i;
      }
      else if (buffered[i].segmentOffset < part.segmentOffset) {
        if (buffered[i] instanceof ArrayBuffer) {
          buffered[i] = Object.assign(new Uint8Array(buffered[i], 0, part.segmentOffset - buffered[i].segmentOffset), {
            segmentOffset: buffered[i].segmentOffset,
          });
        }
        else if (buffered[i] instanceof Uint8Array) {
          buffered[i] = Object.assign(buffered[i].subarray(0, part.segmentOffset - buffered[i].segmentOffset), {
            segmentOffset: buffered[i].segmentOffset,
          });
        }
        else {
          buffered[i].byteLength = part.segmentOffset - buffered[i].segmentOffset;
        }
        i++;
      }
      buffered.splice(i++, 0, part);
      var end = part.segmentOffset + part.byteLength;
      while (i < buffered.length && buffered[i].segmentOffset < end) {
        if (end >= (buffered[i].segmentOffset + buffered[i].length)) {
          buffered.splice(i, 1);
          continue;
        }
        var removePrefix = end - buffered[i].segmentOffset;
        if (buffered[i] instanceof ArrayBuffer) {
          buffered[i] = Object.assign(new Uint8Array(buffered[i], removePrefix), {
            segmentOffset: end,
          });
        }
        else if (buffered[i] instanceof Uint8Array) {
          buffered[i] = Object.assign(buffered[i].subarray(removePrefix), {
            segmentOffset: end,
          });
        }
        else {
          buffered[i].segmentOffset += removePrefix;
          buffered[i].byteLength -= removePrefix;
        }
        break;
      }
      for (var i = this.readyCallbacks.length; i >= 0; i--) {
        if (this.readyCallbacks[i](readyBytes.offset, readyBytes.length)) {
          this.readyCallbacks.splice(i, 1);
        }
      }
    },
    putPlaceholders: function(offset, end) {
      var newPlaceholders = [];
      newPlaceholders.bytesRemaining = 0;
      var buffered = this.buffered;
      var i = this.getIndex(offset);
      if (i < 0) {
        i = ~i;
        if (i < buffered.length) {
          var prefixPlaceholder = {segmentOffset: offset, byteLength:buffered[i].segmentOffset - offset};
          newPlaceholders.push(prefixPlaceholder);
          newPlaceholders.bytesRemaining += prefixPlaceholder.byteLength;
          offset = buffered[i].segmentOffset;
          buffered.splice(i, 0, prefixPlaceholder);
          i++;
        }
      }
      while (i < buffered.length) {
        if (buffered[i] instanceof ArrayBuffer || buffered[i] instanceof Uint8Array) {
          offset = Math.min(end, offset + buffered[i].byteLength);
        }
        else {
          var placeholderLen = Math.min(end - offset, buffered[i].byteLength);
          newPlaceholders.bytesRemaining += placeholderLen;
          offset += placeholderLen;
        }
        if (offset === end) {
          return newPlaceholders;
        }
        i++;
        if (i < buffered.length && buffered[i].segmentOffset > offset) {
          var placeholder = {segmentOffset: offset, byteLength: buffered[i].segmentOffset - offset};
          newPlaceholders.push(placeholder);
          newPlaceholders.bytesRemaining += placeholder.byteLength;
          buffered.splice(i, 0, placeholder);
          i++;
        }
      }
      var finalPart = {segmentOffset:offset, byteLength:end - offset};
      newPlaceholders.push(finalPart);
      buffered.push(finalPart);
      newPlaceholders.bytesRemaining += end - offset;
      return newPlaceholders;
    },
    rawGet: function(offset, length) {
      
    },
    getBufferOrViewNormalized: function(offset, length) {
      if (offset < 0) {
        var self = this;
        return this.getLength().then(function(totalLength) {
          return self.getBufferOrViewNormalized(totalLength + offset, length);
        });
      }
      else if (!isFinite(length)) {
        var self = this;
        return this.getLength().then(function(totalLength) {
          return self.getBufferOrViewNormalized(offset, totalLength - offset);
        });
      }
      var BUFSIZE = this.BUFSIZE;
      var bufferedOffset = offset - offset % BUFSIZE;
      var bufferedLength = length + offset % BUFSIZE;
      if (bufferedLength % BUFSIZE !== 0) bufferedLength += BUFSIZE - (bufferedLength % BUFSIZE);
      var placeholders = this.putPlaceholders(bufferedOffset, bufferedLength);
      var self = this;
      if (placeholders.bytesRemaining === 0) {
        return this.rawGet(offset, length);
      }
      var bytesRemaining = length;
      var result = new Promise(function(resolve, reject) {
        this.readyCallbacks.push(function(readyOffset, readyLength) {
          // TODO: subtract from bytesRemaining here
          if (bytesRemaining === 0) {
            resolve(self.rawGet(offset, length));
            return true;
          }
        });
      });
      placeholders.forEach(function(placeholder) {
        self.wrappedSegment.getBufferOrViewNormalized(placeholder.segmentOffset, placeholder.byteLength)
        .then(function(borv) {
          borv.segmentOffset = placeholder.segmentOffset;
          self.put(borv);
        });
      });
      return result;
    },
    hint: function(what, offset, length) {
      if (what !== 'interesting' && what !== 'boring') {
        return DataSegment.prototype.hint.apply(this, arguments);
      }
      var region = normalizeRegion(
        offset, length, length,
        this.offset, this.minLength, this.maxLength);
    },
  });
  Object.defineProperties(BufferedSegment.prototype, {
    fixedLength: {
      get: function() {
        return this.wrappedSegment.fixedLength;
      },
    },
    minLength: {
      get: function() {
        return this.wrappedSegment.minLength;
      },
    },
    maxLength: {
      get: function() {
        return this.wrappedSegment.maxLength;
      },
    },
  });
  
  function SplitEntries(cb) {
    this.callback = cb;
  }
  SplitEntries.prototype = {
    add: function(entry) {
      this.callback(entry);
    },
    accepted: function() {
      return true;
    },
  };
  
  function toBlobParameter(v) {
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return v;
    if (v instanceof DataSegment) return v.asBlobParameter;
    return null;
  }
  
  return Object.assign(DataSegment, {
    Empty: EmptySegment,
    FromBlob: DataSegmentFromBlob,
    Wrapper: DataSegmentWrapper,
    FromArrayBuffer: DataSegmentFromArrayBuffer,
    Sequence: DataSegmentSequence,
    FromURL: DataSegmentFromURL,
    Remote: RemoteDataSegment,
    Buffered: BufferedSegment,
    from: function(value, overrideFormat) {
      if (value instanceof DataSegment) {
        return overrideFormat ? value.getSegment(overrideFormat) : value;
      }
      if (value instanceof Blob) {
        if (!overrideFormat) {
          var ext = (value.name || '').match(/\.([^\.]+)$/);
          if (ext) {
            ext = ext[1].toLowerCase();
            if (formatsByExtension.hasOwnProperty(ext)) {
              overrideFormat = formatsByExtension[ext];
            }
          }
        }
        if (overrideFormat) {
          value = value.slice(0, value.size, overrideFormat);
        }
        if (value.size === 0) return new EmptySegment(value.type || 'application/octet-stream');
        return new DataSegmentFromBlob(value);
      }
      if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        overrideFormat = overrideFormat || Format.generic;
        if (length === 0) return new EmptySegment(overrideFormat);
        return new DataSegmentFromArrayBuffer(overrideFormat, value);
      }
      if (Array.isArray(value)) {
        if (value.length === 0) return new EmptySegment(overrideFormat || 'application/octet-stream');
        var blobParams = new Array(value.length);
        for (var i = 0; i < value.length; i++) {
          var blobParam = toBlobParameter(value[i]);
          if (blobParam === null) {
            blobParams = null;
            break;
          }
          blobParams[i] = blobParam;
        }
        if (blobParams !== null) {
          return new DataSegmentFromBlob(new Blob(blobParams, overrideFormat || 'application/octet-stream'));
        }
        value = value.map(DataSegment.from);
        return new DataSegmentFromSequence(overrideFormat || value[0].format, value);
      }
      if (value instanceof ImageData) {
        overrideFormat = overrideFormat || Format('image/x-pixels; format=r8g8b8a8; width='+value.width+'; height='+value.height);
        return new DataSegmentFromArrayBuffer(value.data, overrideFormat);
      }
      if (typeof value === 'string') {
        throw new TypeError('please use DataSegment.fromURL() if this was intended');
      }
    },
    fromURL: function(url, overrideFormat) {
      var asDataURL = value.match(/^data:([^,;]+)?(;base64)?,(.*)$/);
      if (asDataURL) {
        overrideFormat = overrideFormat || asDataURL[1] || (asDataURL[2] ? 'application/octet-stream' : 'text/plain');
        var data = asDataURL[3];
        if (asDataURL[2]) {
          data = atob(data);
          var bytes = new Uint8Array(data);
          for (var i = 0; i < data.length; i++) {
            bytes[i] = data.charCodeAt(i);
          }
          data = bytes;
        }
        else {
          data = new TextDecode('utf-8').decode(decodeURIComponent(data));
        }
        return new DataSegmentFromArrayBuffer(overrideFormat, data);
      }
      return new DataSegmentFromURL(url, 0, Infinity, overrideFormat);
    },
    loadAfterTransfer: function(serialized) {
      switch(serialized[0]) {
        case 'Empty': return new EmptySegment(serialized[1]);
        case 'FromBlob': return new DataSegmentFromBlob(serialized[1]);
        case 'Wrapper': return new DataSegmentWrapper(serialized[1], serialized[2], serialized[3], serialized[4]);
        case 'FromArrayBuffer': return new DataSegmentFromArrayBuffer(serialized[1], serialized[2], serialized[3]);
        case 'Sequence': return new DataSegmentSequence(serialized.subarray(1).map(DataSegment.loadAfterTransfer));
        case 'FromURL': return new DataSegmentFromURL(serialized[1], serialized[2], serialized[3], serialized[4]);
        default: throw new Error('unsupported segment type: ' + serialized[0]);
      }
    },
    join: function(format, parts) {
      format = toFormat(format);
      return getFormatHandler(format).then(function(handler) {
        if (typeof handler.join === 'function') return handler.join(parts);
        return DataSegment.from(parts, format);
      });
    },
  });
  
});

if (typeof self === Worker) {
  self.addEventListener('message', function(e) {
  });
}
