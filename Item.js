define(function() {

  'use strict';
  
  function Item(byteSource) {
    this.byteSource = byteSource;
  }
  
  Item.prototype = {
    eventTarget: window,
    dispatchEvent: function() {
      return this.eventTarget.dispatchEvent.apply(this.eventTarget, arguments);
    },
  };

  return Item;

});
