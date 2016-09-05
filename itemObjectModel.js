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

      return itemElement;
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
          this.classList.add('itemizing');
          this.subitemsElement.appendChild(item);
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
          var textContainer = document.createElement('PRE');
          textContainer.appendChild(document.createTextNode(text));
          this.addItem(textContainer);
        },
      },
      getBytes: {
        value: function() {
          return this.byteSource.getBytes();
        },
      },
      setDataObject: {
        value: function(value) {
          var textContainer = document.createElement('PRE');
          textContainer.appendChild(document.createTextNode(JSON.stringify(value, 2)));
          this.addItem(textContainer);
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
        this.dispatchEvent(new Event(itemObjectModel.EVT_POPULATE));
      }
    }
  }
  
  Object.defineProperties(itemObjectModel, {
    EVT_POPULATE: {value:'item-populate'},
  });
  
  return itemObjectModel;

});
