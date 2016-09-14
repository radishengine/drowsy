define(function() {

  'use strict';
  
  function Item(byteSource) {
    this.byteSource = byteSource;
    this.explorers = [];
  }
  
  Item.prototype = {
    eventTarget: window,
    dispatchEvent: function() {
      return this.eventTarget.dispatchEvent.apply(this.eventTarget, arguments);
    },
    addExplorer: function(explorer) {
      this.explorers.push(explorer);
    },
    getListing: function() {
      var self = this;
      return new Promise(function(resolve, reject) {
        var expedition = {
          explorers: self.explorers.slice(),
          resolvedCount: 0,
          listing: [],
          foundItem: function(item) {
            this.listing.push(item);
          },
          conclude: function() {
            if (++this.resolvedCount === this.explorers.length) {
              resolve(this.listing);
            }
          },
          abandon: reject,
          go: function() {
            if (this.explorers.length === 0) {
              resolve([]);
              return;
            }
            for (var i = 0; i < this.explorers.count; i++) {
              this.explorers[i].apply(self, this);
            }
          },
        };
        expedition.go();
      });
      var expedition = {
        listing: [],
        foundItem: function(item) {
          this.listing.push(item);
        },
        explorers: this.explorers.slice(),
        go: function(resolve, reject) {
          if (this.explorers.length === 0) {
            return Promise.resolve(this.listing);
          }
          for (var i = 0; i < this.explorers.length; i++) {
            this.explorers[i](this);
          }
        },
      };
      return new Promise(expedition.go.bind(expedition));
    },
  };

  return Item;

});
