define(function() {

  'use strict';
  
  var _BYTESOURCE = Symbol('byteSource');
  
  var wavHeaderTemplate = new Uint8Array([
  	'R'.charCodeAt(0),
  	'I'.charCodeAt(0),
  	'F'.charCodeAt(0),
  	'F'.charCodeAt(0),
  	0,0,0,0, // uint32 @ 4: set to wavHeaderTemplate.length + data length (aligned to 2)
  	'W'.charCodeAt(0),
  	'A'.charCodeAt(0),
  	'V'.charCodeAt(0),
  	'E'.charCodeAt(0),
  	'f'.charCodeAt(0),
  	'm'.charCodeAt(0),
  	't'.charCodeAt(0),
  	' '.charCodeAt(0),
  	16,0,0,0,
  	1,0,
  	1,0,     // uint16 @ 22: number of channels
  	22,56,0,0, // uint32 @ 24: sampling rate
  	22,56,0,0, // uint32 @ 28: sampling rate * channels * bytes per sample
  	1,0, // uint16 @ 32: block align, channels * bytes per sample
  	8,0, // uint16 @ 34: bytes per sample * 8
  	'd'.charCodeAt(0),
  	'a'.charCodeAt(0),
  	't'.charCodeAt(0),
  	'a'.charCodeAt(0),
  	0,0,0,0 // uint32 @ 40: number of bytes
  	]);
  
  var itemObjectModel = {
    createItem: function(title) {
      var itemElement = document.createElement('SECTION');
      itemElement.classList.add('item');
      
      itemElement.appendChild(itemElement.titleElement = document.createElement('HEADER'));
      
      itemElement.titleTextElement = itemElement.titleElement;
      
      Object.defineProperties(itemElement, this.itemProperties);
      
      if (title) itemElement.itemTitle = title;
      
      itemElement.addEventListener('click', clickItem);
      itemElement.addEventListener(itemObjectModel.EVT_POPULATE_STARTED, itemObjectModel.startItemPopulate);
      itemElement.addEventListener(itemObjectModel.EVT_POPULATE_ENDED, itemObjectModel.endItemPopulate);

      return itemElement;
    },
    startItemPopulate: function() {
      this.populatedOnce = true;
      this.startAddingItems();
      this.classList.add('itemizing');
    },
    endItemPopulate: function() {
      this.confirmAllItemsAdded();
    },
    itemProperties: {
      itemTitle: {
        get: function() {
          return this.titleTextElement.innerText;
        },
        set: function(text) {
          this.titleTextElement.innerText = text;
        },
        enumerable: true,
      },
      byteSource: {
        get: function() {
          return this[_BYTESOURCE];
        },
        set: function(byteSource) {
          this[_BYTESOURCE] = byteSource;
          if (!byteSource) {
            this.titleElement.innerText = this.titleTextElement.innerText;
            this.titleTextElement = this.titleElement;
          }
          else {
            var link = document.createElement('A');
            link.href = '#';
            link.classList.add('item-download');
            link.download = this.itemTitle.replace(/[\\\/:"<>\*\?\|]/g, '_');
            link.innerText = this.titleTextElement.innerText;
            this.titleElement.innerHTML = '';
            this.titleElement.appendChild(this.titleTextElement = link);
          }
        },
      },
      startAddingItems: {
        value: function() {
          if (!this.classList.contains('has-subitems')) {
            this.classList.add('has-subitems');
            this.appendChild(this.subitemsElement = document.createElement('SECTION'));
            this.subitemsElement.classList.add('subitems');
          }
        },
      },
      addItem: {
        value: function(item) {
          this.startAddingItems();
          this.subitemsElement.appendChild(item);
          this.dispatchEvent(new CustomEvent(itemObjectModel.EVT_ITEM_ADDED, {detail:{item:item}}));
        },
      },
      confirmAllItemsAdded: {
        value: function() {
          this.classList.remove('itemizing');
          this.classList.add('itemized');
        },
      },
      text: {
        set: function(text) {
          this.setDataObject(text);
        },
      },
      getBytes: {
        value: function() {
          return this.byteSource.getBytes();
        },
      },
      setDataObject: {
        value: function(value) {
          this.dispatchEvent(new CustomEvent(itemObjectModel.EVT_ITEM_DATA_OBJECT, {detail:{dataObject:value}}));
          this.dataObject = value;
          var textContainer = document.createElement('PRE');
          if (typeof value === 'string') {
            textContainer.appendChild(document.createTextNode(value));
          }
          else {
            textContainer.appendChild(document.createTextNode(JSON.stringify(value, null, 2)));
          }
          this.addItem(textContainer);
        },
      },
      getDataObject: {
        value: function() {
          if ('dataObject' in this) return Promise.resolve(this.dataObject);
          var item = this;
          var promise = new Promise(function(resolve, reject) {
            function onDataObject(e) {
              item.removeEventListener(itemObjectModel.EVT_ITEM_DATA_OBJECT, onDataObject);
              resolve(e.detail.dataObject);
            }
            item.addEventListener(itemObjectModel.EVT_ITEM_DATA_OBJECT, onDataObject);
          });
          this.populate();
          return promise;
        },
      },
      withPixels: {
        value: function(width, height, callback) {
          var canvas = document.createElement('CANVAS');
          canvas.width = width;
          canvas.height = height;
          this.addItem(canvas);
          var ctx = canvas.getContext('2d');
          var imageData = ctx.createImageData(width, height);
          callback(imageData.data);
          ctx.putImageData(imageData, 0, 0);
        },
      },
      with2DContext: {
        value: function(width, height, callback) {
          var canvas = document.createElement('CANVAS');
          canvas.width = width;
          canvas.height = height;
          this.addItem(canvas);
          var ctx = canvas.getContext('2d');
          callback(ctx);
        },
      },
      setHotspot: {
        value: function(x, y) {
          this.dataset.hotspotX = x;
          this.dataset.hotspotY = y;
        },
      },
      setOffset: {
        value: function(x, y) {
          this.dataset.offsetX = x;
          this.dataset.offsetY = y;
        },
      },
      populatedOnce: {
        value: false,
        writable: true,
      },
      populate: {
        value: function() {
          this.dispatchEvent(new Event(itemObjectModel.EVT_POPULATE));
          if (populatedOnce && this.populatorCount === 0) return Promise.resolve(this);
          var self = this;
          return new Promise(function(resolve, reject) {
            function onPopulateEnd() {
              self.removeEventListener(itemObjectModel.EVT_POPULATE_ENDED, onPopulateEnd);
              resolve(self);
            }
            self.addEventListener(itemObjectModel.EVT_POPULATE_ENDED, onPopulateEnd);
          });
        },
      },
      populatorCount: {
        value: 0,
        writable: true,
      },
      notifyPopulating: {
        value: function(promise) {
          if (++this.populatorCount === 1) {
            this.dispatchEvent(new Event(itemObjectModel.EVT_POPULATE_STARTED));
          }
          var self = this;
          promise.then(
            function() {
              if (--self.populatorCount === 0) {
                self.dispatchEvent(new Event(itemObjectModel.EVT_POPULATE_ENDED));
              }
            },
            function(reason) {
              self.dispatchEvent(new CustomEvent(itemObjectModel.EVT_POPULATE_ERROR, {detail:{message:reason}}));
              if (--self.populatorCount === 0) {
                self.dispatchEvent(new Event(itemObjectModel.EVT_POPULATE_ENDED));
              }
            });
        },
      },
      setRawAudio: {
        value: function(audioInfo) {
          var channelCount = audioInfo.channels || 1;
          var samplingRate = audioInfo.samplingRate || 22050;
          var samples = audioInfo.samples;
          var bytesPerSample = audioInfo.bytesPerSample || 1;
          
          var wavHeader = new Uint8Array(wavHeaderTemplate.length);
          wavHeader.set(wavHeaderTemplate);
          
          var wavFooter = new Uint8Array(samples.byteLength % 2);
  
          var wavView = new DataView(wavHeader.buffer, wavHeader.byteOffset, wavHeader.byteLength);
          wavView.setUint32(4, wavHeader.byteLength + samples.byteLength + wavFooter.byteLength, true);
          wavView.setUint16(22, channelCount, true);
          wavView.setUint32(24, samplingRate, true);
          wavView.setUint32(28, samplingRate * channelCount * bytesPerSample, true);
          wavView.setUint16(32, channelCount * bytesPerSample, true);
          wavView.setUint16(34, bytesPerSample * 8, true);
          wavView.setUint32(40, samples.byteLength, true);
          
          var resourceEl = document.createElement('AUDIO');
          resourceEl.src = URL.createObjectURL(new Blob([wavHeader, samples, wavFooter], {type:'audio/wav'}));
          resourceEl.controls = true;
          this.addItem(resourceEl);
        },
      },
      getSubitem: {
        value: function(matcher) {
          if (typeof matcher === 'string') {
            var str = matcher;
            matcher = function(item){ return item.itemTitle === str; };
          }
          if (matcher instanceof RegExp) {
            var rex = matcher;
            matcher = function(item){ return rex.test(item.itemTitle); };
          }
          if (this.subitemsElement) {
            for (var i = 0; i < this.subitemsElement.children.length; i++) {
              if (matcher(this.subitemsElement.children[i])) {
                return Promise.resolve(this.subitemsElement.children[i]);
              }
            }
          }
          var self = this;
          var promise = new Promise(function(resolve, reject) {
            function onAddItem(e) {
              if (matcher(e.detail.item)) {
                self.removeEventListener(itemObjectModel.EVT_ITEM_ADDED, onAddItem);
                resolve(e.detail.item);
              }
            }
            self.addEventListener(itemObjectModel.EVT_ITEM_ADDED, onAddItem);
          });
          this.populate();
          return promise;
        },
      },
    },
  };
  
  function clickItem(e) {
    e.stopPropagation();
    if (e.target.classList.contains('item-download')) {
      if (!e.target.classList.contains('prepared')) {
        e.preventDefault();
        if (!e.target.classList.contains('preparing')) {
          e.target.classList.add('preparing');
          this.byteSource.getURL().then(function(url) {
            e.target.classList.remove('preparing');
            e.target.classList.add('prepared');
            e.target.href = url;
            e.target.click();
          });
        }
      }
      return;
    }
    if (this.classList.contains('has-subitems')) {
      if (this.classList.toggle('open')) {
        this.populate();
      }
    }
  }
  
  Object.defineProperties(itemObjectModel, {
    EVT_POPULATE: {value:'item-populate'},
    EVT_POPULATE_ERROR: {value:'item-population-error'},
    EVT_POPULATE_STARTED: {value:'item-populate-started'},
    EVT_POPULATE_ENDED: {value: 'item-populate-ended'},
    EVT_ITEM_ADDED: {value:'item-added'},
    EVT_ITEM_DATA_OBJECT: {value:'item-data-object'},
  });
  
  return itemObjectModel;

});
