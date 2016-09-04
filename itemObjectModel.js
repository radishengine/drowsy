define(function() {

  'use strict';
  
  var itemObjectModel = {
    createItem: function(title) {
      var itemElement = document.createElement('SECTION');
      
      itemElement.titleElement = document.createElement('HEADER');
      itemElement.appendChild(titleElement);
      
      itemElement.titleTextElement = itemElement.titleElement;
      
      Object.defineProperties(itemElement, this.itemProperties);
      
      if (title) itemElement.itemTitle = title;

      return item;
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
