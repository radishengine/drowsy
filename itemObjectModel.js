define(function() {

  'use strict';
  
  var itemObjectModel = {
    createItem: function(title) {
      var itemElement = document.createElement('SECTION');
      
      itemElement.appendChild(itemElement.titleElement = document.createElement('HEADER'));
      
      itemElement.titleTextElement = itemElement.titleElement;
      
      Object.defineProperties(itemElement, this.itemProperties);
      
      if (title) itemElement.itemTitle = title;

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
    },
  };
  
  return itemObjectModel;

});
