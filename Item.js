define(function() {

  'use strict';
  
  var _PARENT = Symbol('parent');
  var _SUBITEMS = Symbol('subitems');
  
  function Item() {
    this[_SUBITEMS] = [];
  }
  
  Item.prototype = {
    eventTarget: window,
    dispatchEvent: function() {
      return this.eventTarget.dispatchEvent.apply(this.eventTarget, arguments);
    },
    get parentItem() {
      return this[_PARENT];
    },
    set parentItem(newParent) {
      newParent = newParent || null;
      if (newParent === this[_PARENT]) return;
      if (newParent) {
        if (!(newParent instanceof Item)) {
          throw new TypeError('parent must be an Item or null');
        }
        for (var ancestor = newParent; ancestor; ancestor = newParent.parentItem) {
          if (ancestor === this) {
            throw new Error('an Item cannot be its own parent or ancestor');
          }
        }
      }
      var oldParent = this[_PARENT];
      if (oldParent && !oldParent.dispatchEvent(new CustomEvent(Item.EVT_REMOVING_SUBITEM,
          {cancelable:true, detail:{item:oldParent, subitem:this}}))) {
        throw new Error('existing parent ' + oldParent + ' prevented reassignment');
      }
      if (newParent && !newParent.dispatchEvent(new CustomEvent(Item.EVT_ADDING_SUBITEM,
          {detail:{item:newParent, subitem:this}}))) {
        throw new Error(newParent + ' refused to accept subitem');
      }
      this[_PARENT] = newParent;
      
      if (oldParent) {
        oldParent[_SUBITEMS].splice(oldParent[_SUBITEMS].indexOf(this), 1);
        oldParent.dispatchEvent(new CustomEvent(Item.EVT_SUBITEM_REMOVED,
          {detail:{item:oldParent, subitem:this}}));
      }
      if (newParent) {
        newParent[_SUBITEMS].push(this);
        newParent.dispatchEvent(new CustomEvent(Item.EVT_SUBITEM_ADDED, 
          {detail:{item:newParent, subitem:this}}));
      }
    },
    get subitemCount() {
      return this[_SUBITEMS].length;
    },
    sliceSubitems: function() {
      return this[_SUBITEMS].slice.apply(this[_SUBITEMS], arguments);
    },
  };
  Item.prototype[_PARENT] = null;
  
  Item.EVT_ADDING_SUBITEM = 'adding-subitem';
  Item.EVT_SUBITEM_ADDED = 'subitem-added';
  Item.EVT_REMOVING_SUBITEM = 'removing-subitem';
  Item.EVT_SUBITEM_REMOVED = 'subitem-removed';
  
  return Item;

});
