define(function() {

  'use strict';
  
  var _BYTESOURCE = Symbol('byteSource');
  
  var itemObjectModel = {
    createItem: function(title) {
      var itemElement = document.createElement('SECTION');
      
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
    },
  };
  
  function clickItem(e) {
    e.stopPropagation();
    if (e.target.classList.contains('item-download')) {
      if (e.target.href === '#') {
        e.preventDefault();
        this.byteSource.getURL().then(function(url) {
          e.target.href = url;
          e.target.click();
        });
      }
      return;
    }
  }
  
  return itemObjectModel;

});
