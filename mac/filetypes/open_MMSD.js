define(['itemObjectModel'], function(itemOM) {

  'use strict';
  
  function open(item) {
  
    function onSubitem(subitem) {
      switch(subitem.dataset.resourceType) {
        case 'STR ':
          subitem.getDataObject()
            .then(function(names) {
              names = names.split(/;/g);
              for (var i = 0; i < names.length; i++) {
                var namedItem = itemOM.createItem(names[i]);
                item.addItem(namedItem);
              }
            });
          break;
        case 'CSND':
          break;
      }
    }
    
    var subitems = item.subitemsElement && item.subitemsElement.children;
    if (subitems) {
      for (var i = 0; i < subitems.length; i++) {
        onSubitem(subitems[i]);
      }
    }
    item.addEventListener(itemOM.EVT_ITEM_ADDED, function(e) {
      onSubitem(e.detail.item);
    });
    
    return Promise.resolve(item);
  }
  
  return open;
  
});
