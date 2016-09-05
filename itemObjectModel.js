define(function() {

  'use strict';
  
  var _BYTESOURCE = Symbol('byteSource');
  
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
