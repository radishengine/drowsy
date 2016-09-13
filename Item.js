define(function() {

  'use strict';
  
  function Item() {
  }
  
  Item.prototype = {
    eventTarget: window,
    dispatchEvent: function() {
      return this.eventTarget.dispatchEvent.apply(this.eventTarget, arguments);
    },
  };
  
  function ItemCollection() {
  }
  
  ItemCollection.prototype = {
    eventTarget: window,
    dispatchEvent: function() {
      return this.eventTarget.dispatchEvent.apply(this.eventTarget, arguments);
    },
    add: function(item) {
      this.dispatchEvent(new CustomEvent('item-added', {detail:{item:item}}));
    },
  };

  Item.Collection = ItemCollection;

  return Item;

});
