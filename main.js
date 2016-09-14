
require(['ByteSource', 'Item', 'AppleVolume'], function(ByteSource, Item, AppleVolume) {
  
  'use strict';
  
  function makeFileDrop(el, callback) {
    if (typeof el === 'string') {
      el = document.getElementById(el);
      if (!el) {
        console.error('filedrop element not found');
        return;
      }
      el.addEventListener('dragenter', function(e) {
        el.classList.add('dropping');
      });
      el.addEventListener('dragleave', function(e) {
        el.classList.remove('dropping');
      });
      el.addEventListener('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });
      el.addEventListener('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        el.classList.remove('dropping');
        if (e.dataTransfer.files[0]) {
          callback(e.dataTransfer.files[0]);
        }
      });
      el.classList.add('drop-target');
    }
  }
  
  makeFileDrop('drop-zone', function(droppedFile) {
    
    if (/\.(iso|toast|dsk|img)$/i.test(droppedFile.name)) {
      
      var byteSource = ByteSource.from(droppedFile);
      var appleVolume = new AppleVolume(byteSource);
      appleVolume.read({});
    
    }
    else {
      var item = new Item(ByteSource.from(droppedFile));
      var extension = droppedFile.name.match(/\.([^\.]+)$/);
      if (extension) {
        extension = extension && encodeURIComponent(extension[1].toUpperCase().replace(/[\\\/\*\"\:\?\|<>]/g, '_'));
        var importString = 'ext/open_' + extension;
        require([importString],
        function(open) {
          open(item);
          item.getListing()
          .then(function(listing) {
            console.log(listing);
          });
        },
        function() {
          console.log('Unsupported extension: ' + extension);
        });
      }
    }

  });
  
});
