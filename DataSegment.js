if (typeof self === Worker) {
  importScripts('require.js');
}

define('DataSegment', ['typeServices/dispatch'], function(typeDispatch) {
  
  var emptyBuffer = new ArrayBuffer(0);
  var emptyBytes = new Uint8Array(emptyBuffer);
  var emptyBlob = new Blob([emptyBytes]);
  var p_emptyBuffer = Promise.resolve(emptyBuffer);
  var p_emptyBytes = Promise.resolve(emptyBytes);
  
  var handlerCache = {};
  
  function getTypeHandler(t) {
    if (t in handlerCache) return handlerCache[t];
    var self = this;
    return handlerCache[t] = new Promise(function(resolve, reject) {
      var handlerModule = 'typeServices/' + self.typeName;
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
  
  function normalizeRegion(offset, length, contextLength, contextOffset) {
    if (isNaN(offset)) offset = 0;
    if (isNaN(length)) length = Infinity;
    if (isNaN(contextLength)) contextLength = Infinity;
    if (!isNaN(contextOffset) && (offset >= 0 || contextOffset >= 0)) {
      offset += contextOffset;
    }
    if (offset < 0) {
      if (!isFinite(length)) length = -offset;
      else if (length > -offset) {
        throw new Error('length exceeds negative offset');
      }
    }
    if (isFinite(contextLength)) {
      if (offset >= contextLength && length !== 0) {
        throw new RangeError('offset out of range (' + offset + ' of ' + contextLength + ')');
      }
      if (offset < 0) {
        offset = contextLength + offset;
        if (offset < 0) {
          throw new RangeError('offset out of range (' + offset + ' of ' + contextLength + ')');
        }
      }
      if (!isFinite(length)) length = contextLength - offset;
    }
    if (length < 0) {
      throw new Error('length cannot be negative');
    }
    return {offset:offset, length:length};
  }
  
  function DataSegment() {
  }
  DataSegment.prototype = {
    type: 'application/octet-stream',
    get typeName() {
      return this.type.match(/^[^;\s]*/)[0];
    },
    get typeCategory() {
      return this.type.match(/^[^\/]*/)[0];
    },
    get typeParameters() {
      var params = this.type.split(';');
      var obj = {};
      for (var i = 1; i < params.length; i++) {
        var param = params[i].match(/^\s*([^\s=]+)\s*=\s*(.*?)\s*$/);
        if (!param) throw new Error('malformed parameters: ' + this.type);
        var key = param[1];
        var value = param[2];
        obj[key] = value;
      }
      Object.defineProperty(this, 'typeParameters', {value:obj});
      return obj;
    },
    getTypeParameter: function(name) {
      return this.typeParameters[name] || null;
    },
    get subtype() {
      return this.type.replace(/^.*?\//, '').replace(/;.*/, '');
    },
    knownLength: Infinity,
    offset: 0,
    get hasKnownLength() {
      return isFinite(this.knownLength);
    },
    getLength() {
      if (isFinite(this.knownLength)) return Promise.resolve(this.knownLength);
      if (typeof this.calculateLength === 'function') return this.calculateLength();
      throw new Error('no method defined to calculate length');
    },
    getSegmentNormalized: function(type, offset, length) {
      return new DataSegmentWrapper(this, type, offset, length);
    },
    getBufferOrViewNormalized: function(offset, length) {
      throw new Error('no method defined to get bytes');
    },
    getArrayBufferNormalized: function(offset, length) {
      return this.getBufferOrViewNormalized(offset, length)
      .then(function(borv) {
        if (borv instanceof ArrayBuffer) return borv;
        if (borv.byteOffset === 0 && borv.byteLength === borv.buffer.byteLength) {
          return borv.buffer;
        }
        var copy = new ArrayBuffer(borv.byteLength);
        if (!(borv instanceof Uint8Array)) {
          borv = new Uint8Array(borv.buffer, borv.byteOffset, borv.byteLength);
        }
        new Uint8Array(copy).set(borv);
        return copy;
      });
    },
    getSegment: function(type, offset, length) {
      var region = normalizeRegion(offset, length, this.knownLength, this.offset);
      if (region.length === 0) return new EmptySegment(type);
      return this.getSegmentNormalized(type, region.offset, region.length);
    },
    getBytesNormalized: function(offset, length) {
      var region = normalizeRegion(offset, length, this.knownLength, this.offset);
      return this.getBufferOrViewNormalized(region.offset, region.length)
      .then(function(borv) {
        if (borv instanceof ArrayBuffer) return new Uint8Array(borv);
        if (borv instanceof Uint8Array) return borv;
        return new Uint8Array(borv.buffer, borv.byteOffet, borv.byteLength);
      });
    },
    getArrayBuffer: function(offset, length) {
      var region = normalizeRegion(offset, length, this.knownLength, this.offset);
      if (region.length === 0) return p_emptyBuffer;
      return this.getArrayBufferNormalized(region.offset, region.length);
    },
    getBytes: function(offset, length) {
      var region = normalizeRegion(offset, length, this.knownLength, this.offset);
      if (region.length === 0) return p_emptyBytes;
      return this.getBytesNormalized(region.offset, region.length);
    },
    asBlobParameter: null,
    getBlob: function() {
      var blobParam = this.asBlobParameter;
      if (blobParam) return Promise.resolve(new Blob([blobParam], this.type));
      var self = this;
      return this.getArrayBuffer().then(function(bytes) {
        return new Blob([bytes], self.type);
      });
    },
    saveForTransfer: function(transferables) {
      throw new Error('saveForTransfer not implemented');
    },
    toRemote: function(worker) {
      return new RemoteDataSegment(worker).transfer(this);
    },
    toLocal: function() {
      return Promise.resolve(this);
    },
    getTypeHandler: function() {
      return getTypeHandler(this.typeName);
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
      return this.getTypeHandler()
      .then(function(handler) {
        return {
          split: typeof handler.split === 'function',
          join: typeof handler.join === 'function',
          struct: typeof handler.getStructView === 'function' && handler.getStructView(self) !== null,
        };
      });
    },
    split: function(eachCallback, endCallback) {
      if (arguments.length === 0) {
        var list = [];
        eachCallback = function(entry) {
          list.add(entry);
        };
        endCallback = function() {
          return Promise.resolve(list);
        };
      }
      var self = this;
      return this.getTypeHandler().then(function(handler) {
        if (typeof handler.split !== 'function') {
          return Promise.reject('split operation not defined for ' + self.typeName);
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
  
  function EmptySegment(type) {
    this.type = type;
  }
  EmptySegment.prototype = Object.assign(new DataSegment, {
    knownLength: 0,
    asBlobParameter: emptyBuffer,
    getSegmentNormalized: function(type, offset, length) {
      if (offset || length) {
        throw new RangeError('cannot get ' + offset + '-' + (offset+length) + ' range from an empty segment');
      }
      return (type === this.type) ? this : new EmptySegment(type);
    },
    getArrayBufferNormalized: function(offset, length) {
      if (offset || length) {
        throw new RangeError('cannot get ' + offset + '-' + (offset+length) + ' range from an empty segment');
      }
      return p_emptyBuffer;
    },
    getBytesNormalized: function(offset, length) {
      if (offset || length) {
        throw new RangeError('cannot get ' + offset + '-' + (offset+length) + ' range from an empty segment');
      }
      return p_emptyBytes;
    },
    saveForTransfer: function(transferables) {
      return ['Empty', this.type];
    },
  });
  
  function DataSegmentFromBlob(blob) {
    this.blob = blob;
  }
  DataSegmentFromBlob.prototype = Object.assign(new DataSegment, {
    getSegmentNormalized: function(type, offset, length) {
      if (offset === 0 && length === this.blob.size && type === this.blob.type) {
        return this;
      }
      return new DataSegmentFromBlob(this.blob.slice(offset, offset+length, type));
    },
    getBufferOrViewNormalized: function(offset, length) {
      return this.getArrayBufferNormalized(offset, length);
    },
    getBytesNormalized: function(offset, length) {
      return this.getArrayBufferNormalized(offset, length)
      .then(function(buffer){ return new Uint8Array(buffer); });
    },
    getArrayBufferNormalized: function(offset, length) {
      var blob = this.blob;
      if (offset !== 0 || length !== blob.size) {
        blob = blob.slice(offset, offset + length);
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
    hasKnownLength: {value:true},
    type: {
      get: function() { return this.blob.type || 'application/octet-stream'; },
    },
    knownLength: {
      get: function() { return this.blob.size; },
    },
    asBlobParameter: {
      get: function() { return this.blob; },
    },
  });
  
  function DataSegmentWrapper(wrappedSegment, type, offset, length) {
    this.wrappedSegment = wrappedSegment;
    this.type = type;
    var region = normalizeRegion(offset, length, wrappedSegment.knownLength);
    this.offset = region.offset;
    this.knownLength = region.length;
  }
  DataSegmentWrapper.prototype = Object.assign(new DataSegment, {
    getSegmentNormalized: function(type, offset, length) {
      if (type === this.type && offset === this.offset && length === this.knownLength) {
        return this;
      }
      return new DataSegmentWrapper(this.wrappedSegment, type, offset, length);
    },
    getBufferOrViewNormalized: function(offset, length) {
      return this.wrappedSegment.getBufferOrViewNormalized(offset, length);
    },
    getArrayBufferNormalized: function(offset, length) {
      return this.wrappedSegment.getArrayBufferNormalized(offset, length);
    },
    getBytesNormalized: function(offset, length) {
      return this.wrappedSegment.getBytesNormalized(offset, length);
    },
    saveForTransfer: function(transferables) {
      return ['Wrapper', this.wrappedSegment.saveForTransfer(transferables), this.type, this.offset, this.length];
    },
  });
  Object.defineProperties(DataSegmentWrapper.prototype, {
    asBlobParameter: {
      get: function() {
        var inner = this.wrappedSegment.asBlobParameter;
        if (inner instanceof Blob) return inner.slice(this.offset, this.offset + this.length);
        if (inner instanceof ArrayBuffer) return new Uint8Array(inner, this.offset, this.length);
        if (ArrayBuffer.isView(inner)) return new Uint8Array(inner.buffer, inner.byteOffset + this.offset, this.length);
        return null;
      },
    },
  });
  
  function DataSegmentFromArrayBuffer(type, buffer, byteOffset, byteLength) {
    this.type = type;
    var region = normalizeRegion(byteOffset, byteLength, buffer.byteLength, buffer.byteOffset || 0);
    if (ArrayBuffer.isView(buffer)) {
      buffer = buffer.buffer;
    }
    this.buffer = buffer;
    this.offset = region.offset;
    this.knownLength = region.length;
  }
  DataSegmentFromArrayBuffer.prototype = Object.assign(new DataSegment, {
    getSegmentNormalized: function(type, offset, length) {
      if (type === this.type && offset === this.offset && length === this.knownLength) {
        return this;
      }
      return new DataSegmentFromArrayBuffer(type, this.buffer, offset, length);
    },
    getBytesNormalized: function(offset, length) {
      return Promise.resolve(new Uint8Array(this.buffer, offset, length));
    },
    getBufferOrViewNormalized: function(offset, length) {
      if (offset === 0 && length === this.buffer.byteLength) {
        return Promise.resolve(this.buffer);
      }
      return Promise.resolve(new Uint8Array(this.buffer, offset, length));
    },
    saveForTransfer: function(transferables) {
      transferables.push(this.buffer);
      return ['FromArrayBuffer', this.buffer, this.offset, this.knownLength];
    },
  });
  Object.defineProperties(DataSegmentFromArrayBuffer.prototype, {
    asBlobParameter: {
      get: function() {
        if (this.offset === 0 && this.knownLength === this.buffer.byteLength) {
          return this.buffer;
        }
        return new Uint8Array(this.buffer, this.offset, this.byteLength);
      },
    },
    hasKnownLength: {value:true},
  });
  
  function DataSegmentSequence(type, segments) {
    this.type = type;
    this.segments = segments;
    var length = 0;
    for (var i = 0; i < segments.length; i++) {
      length += segments[i].knownLength;
      if (!isFinite(length)) break;
    }
    this.knownLength = length;
  }
  DataSegmentSequence.prototype = Object.assign(new DataSegment, {
    getLength: function() {
      if (this.hasKnownLength) return Promise.resolve(this.knownLength);
      var self = this;
      return this.p_knownLength = this.p_knownLength
      || Promise.all(this.segments.map(function(seg){ return seg.getLength(); }))
        .then(function(allSizes) {
          delete self.p_knownLength;
          return self.knownLength = allSizes.reduce(function(total, size){ return total + size; }, 0);
        });
    },
    getSegmentNormalized: function(type, offset, length) {
      if (offset === 0 && length === this.knownLength) {
        if (type === this.type) {
          return this;
        }
        return new DataSegmentSequence(type, this.segments);
      }
      var segments = this.segments;
      function onAddSegment(list, i) {
        if (i >= segments.length) {
          return Promise.reject('segment subset out of range');
        }
        return segments[i].getLength().then(function(segmentLength) {
          list.push(segments[i].getSegment(0, Math.min(segmentLength, length)));
          length -= segmentLength;
          return length > 0 ? onAddSegment(list, ++i) : DataSegment.from(list, type);
        });
      }
      function onSegment(i) {
        if (i >= segments.length) {
          return Promise.reject('segment subset out of range');
        }
        var segment = segments[i];
        return segments[i].getLength().then(function(segmentLength) {
          if (offset >= segmentLength) {
            offset -= segmentLength;
            return onSegment(++i);
          }
          var availableLength = segmentLength - offset;
          if (availableLength >= length) {
            return segment.getSegment(type, offset, length);
          }
          segment = segment.getSegment('application/octet-stream', offset, availableLength);
          offset = 0;
          length -= availableLength;
          return onAddSegment([segment], ++i);
        });
      }
      return onSegment(0);
    },
    getBufferOrViewNormalized: function(type, offset, length) {
      var segments = this.segments;
      function onAddBytes(list, i) {
        if (i >= segments.length) {
          return Promise.reject('segment subset out of range');
        }
        return segments[i].getLength().then(function(segmentLength) {
          list.push(segments[i].getBytes(0, Math.min(segmentLength, length)));
          length -= segmentLength;
          if (length > 0) {
            return onAddBytes(list, ++i);
          }
          return Promise.all(list).then(function(bytesList) {
            var bytes = new Uint8Array(bytesList.reduce(function(total, b){ return total + b.length; }, 0));
            for (var i = 0, pos = 0; i < bytesList.length; i++) {
              bytes.set(bytesList[i], pos);
              pos += bytesList[i].length;
            }
            return bytes;
          });
        });
      }
      function onSetBytes(promises, bytes, pos, i) {
        if (i >= segments.length) {
          return Promise.reject('segment subset out of range');
        }
        return segments[i].getLength().then(function(segmentLength) {
          var chunkLength = Math.min(segmentLength, length);
          promises.push(segments[i].getBytes(0, chunkLength).then(function(part) {
            bytes.set(part, pos);
          }));
          length -= chunkLength;
          return (length > 0)
            ? onSetBytes(promises, bytes, pos + chunkLength, ++i)
            : Promise.all(promises).then(Promise.resolve(bytes));
        });
      }
      function onSegment(i) {
        if (i >= segments.length) {
          return Promise.reject('segment subset out of range');
        }
        var segment = segments[i];
        return segments[i].getLength().then(function(segmentLength) {
          if (offset >= segmentLength) {
            offset -= segmentLength;
            return onSegment(++i);
          }
          var availableLength = segmentLength - offset;
          if (availableLength >= length) {
            return segment.getBytesNormalized(offset, length);
          }
          if (isFinite(length)) {
            var bytes = new Uint8Array(length);
            var promises = [segment.getBytes().then(function(part) {
              bytes.set(part);
            })];
            return onSetBytes(promises, bytes, 0, ++i);
          }
          offset = 0;
          length -= availableLength;
          return onAddBytes([segment.getBytes()], ++i);
        });
      }
      return onSegment(0);
    },
    getBlob: function() {
      var promised = [];
      for (var i = 0; i < this.segments.length; i++) {
        var blobParam = this.segments[i].asBlobParameter;
        promised[i] = blobParam ? Promise.resolve(blobParam) : this.segments[i].getBlob();
      }
      var self = this;
      return Promise.all(promised).then(function(blobParts) {
        return new Blob(blobParts, self.type);
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
        return new Blob(blobParams, this.type);
      },
    },
  });
  
  function DataSegmentFromURL(url, offset, length, type) {
    this.url = url;
    if (type) {
      this.type = type;
    }
    else {
      var extension = url.replace(/[?#].*/, '').match(/\.([^\.]+)$/);
      if (extension) {
        extension = extension[1].toLowerCase();
        if (typeDispatch.byExtension.hasOwnProperty(extension)) {
          this.type = typeDispatch.byExtension[extension];
        }
      }
    }
    var region = normalizeRegion(offset, length);
    this.offset = region.offset;
    this.knownLength = region.length;
  }
  DataSegmentFromURL.prototype = Object.assign(new DataSegment, {
    getSegmentNormalized: function(type, offset, length) {
      return new DataSegmentFromURL(this.url, offset, length, type);
    },
    runXHRNormalized: function(req, offset, length) {
      var range;
      if (offset < 0) {
        range = 'bytes='+offset;
        if (length !== -offset) {
          throw new Error('length cannot be specified for a suffix range');
        }
      }
      else {
        range = 'bytes='+offset+'-';
        if (isFinite(length)) {
          range += (offset + length - 1);
        }
      }
      req.open('GET', this.url);
      if (range !== 'bytes=0-') {
        req.setRequestHeader('Range', this.range);
      }
      return new Promise(function(resolve, reject) {
        req.addEventListener('load', function(e) {
          resolve(req.response);
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
    getBufferOrViewNormalized: function(offset, length) {
      var req = new XMLHttpRequest();
      req.responseType = 'arraybuffer';
      if (offset < 0 && length < -offset) {
        return this.runXHRNormalized(req, offset, -offset)
        .then(function(buffer) {
          return new Uint8Array(buffer, 0, length);
        });
      }
      return this.runXHRNormalized(req, offset, length);
    },
    getBlob: function() {
      var req = new XMLHttpRequest();
      req.responseType = 'blob';
      var type = this.type, offset = this.offset, length = this.knownLength;
      if (offset < 0 && length < -offset) {
        return this.runXHRNormalized(req, offset, -offset)
        .then(function(blob) {
          return blob.slice(0, length, type);
        });
      }
      return this.runXHRNormalized(req, offset, length)
      .then(function(blob) {
        return blob.slice(0, blob.size, type);
      });
    },
    saveForTransfer: function(transferables) {
      return ['FromURL', this.url, this.offset, this.byteLength];
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
  
  function BufferedSegment(wrappedSegment, type, offset, length) {
    var region;
    if (wrappedSegment instanceof BufferedSegment) {
      region = normalizeRegion(offset, length, wrappedSegment.knownLength, wrappedSegment.offset);
      this.buffered = wrappedSegment.buffered;
      this.readyCallbacks = wrappedSegment.readyCallbacks;
      this.wrappedSegment = wrappedSegment.wrappedSegment;
    }
    else {
      region = normalizeRegion(offset, length, wrappedSegment.knownLength);
      this.buffered = [];
      this.readyCallbacks = [];
      this.wrappedSegment = wrappedSegment;
    }
    this.offset = region.offset;
    this.knownLength = region.length;
  }
  BufferedSegment.prototype = Object.assign(new DataSegment, {
    BUFSIZE: 32 * 1024,
    getSegmentNormalized: function(type, offset, length) {
      if (type === this.type && offset === this.offset && length === this.knownLength) {
        return this;
      }
      return new BufferedSegment(this, type, offset, length);
    },
    getLength: function() {
      return this.wrappedSegment.getLength();
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
      var region = normalizeRegion(offset, length, this.knownLength, this.offset);
    },
  });
  Object.defineProperties(BufferedSegment.prototype, {
    knownLength: {
      get: function() {
        return this.wrappedSegment.knownLength;
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
    from: function(value, overrideType) {
      if (value instanceof DataSegment) {
        return overrideType ? value.getSegment(overrideType) : value;
      }
      if (value instanceof Blob) {
        if (!overrideType) {
          var ext = (value.name || '').match(/\.([^\.]+)$/);
          if (ext) {
            ext = ext[1].toLowerCase();
            if (typeDispatch.byExtension.hasOwnProperty(ext)) {
              overrideType = typeDispatch.byExtension[ext];
            }
          }
        }
        if (overrideType) {
          value = value.slice(0, value.size, overrideType);
        }
        if (value.size === 0) return new EmptySegment(value.type || 'application/octet-stream');
        return new DataSegmentFromBlob(value);
      }
      if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        overrideType = overrideType || 'application/octet-stream';
        if (length === 0) return new EmptySegment(overrideType);
        return new DataSegmentFromArrayBuffer(overrideType, value);
      }
      if (Array.isArray(value)) {
        if (value.length === 0) return new EmptySegment(overrideType || 'application/octet-stream');
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
          return new DataSegmentFromBlob(new Blob(blobParams, overrideType || 'application/octet-stream'));
        }
        value = value.map(DataSegment.from);
        return new DataSegmentFromSequence(overrideType || value[0].type, value);
      }
      if (value instanceof ImageData) {
        overrideType = overrideType || ('image/x-pixels; format=r8g8b8a8; width='+value.width+'; height='+value.height);
        return new DataSegmentFromArrayBuffer(value.data, overrideType);
      }
      if (typeof value === 'string') {
        throw new TypeError('please use DataSegment.fromURL() if this was intended');
      }
    },
    fromURL: function(url, overrideType) {
      var asDataURL = value.match(/^data:([^,;]+)?(;base64)?,(.*)$/);
      if (asDataURL) {
        overrideType = overrideType || asDataURL[1] || (asDataURL[2] ? 'application/octet-stream' : 'text/plain');
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
        return new DataSegmentFromArrayBuffer(overrideType, data);
      }
      return new DataSegmentFromURL(url, 0, Infinity, overrideType);
    },
    loadAfterTransfer: function(serialized) {
      switch(serialized[0]) {
        case 'Empty': return new EmptySegment(serialized[1]);
        case 'FromBlob': return new DataSegmentFromBlob(serialized[1]);
        case 'Wrapper': return new DataSegmentWrapper(serialized[1], serialized[2], serialized[3]);
        case 'FromArrayBuffer': return new DataSegmentFromArrayBuffer(serialized[1], serialized[2], serialized[3]);
        case 'Sequence': return new DataSegmentSequence(serialized.subarray(1).map(DataSegment.loadAfterTransfer));
        case 'FromURL': return new DataSegmentFromURL(serialized[1], serialized[2], serialized[3]);
        default: throw new Error('unsupported segment type: ' + serialized[0]);
      }
    },
    join: function(type, parts) {
      return getTypeHandler(type).then(function(handler) {
        if (typeof handler.join === 'function') return handler.join(parts);
        return DataSegment.from(parts, type);
      });
    },
  });
  
});

if (typeof self === Worker) {
  self.addEventListener('message', function(e) {
  });
}
