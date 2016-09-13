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

  return Item;

});
