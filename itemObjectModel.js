define(function() {

  'use strict';
  
  var itemObjectModel = {
    createItem: function() {
      var itemElement = document.createElement('SECTION');
      
      itemElement.titleElement = document.createElement('HEADER');
      itemElement.appendChild(titleElement);
      
      itemElement.titleTextElement = itemElement.titleElement;
      
      Object.defineProperties(itemElement, this.itemProperties);

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
