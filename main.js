require(['ByteSource', 'Item', 'AppleVolume', 'DataSegment'],
function(ByteSource, Item, AppleVolume, DataSegment)
{
  
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
    
    var ext = droppedFile.name.match(/[^\.]*$/)[0].toLowerCase();
    
    if (/^(iso|toast|dsk|img)$/i.test(ext)) {
      
      var byteSource = ByteSource.from(droppedFile);
      var appleVolume = new AppleVolume(byteSource);
      appleVolume.read({});
    
    }
    else {
      function handleSegment(segment) {
        segment.getCapabilities()
        .then(function(capabilities) {
          if (capabilities.split) {
            console.log('splitting...');
            segment.split(function(entry) {
              console.log('entry', entry);
              handleSegment(entry);
            })
            .then(function() {
              console.log('...split complete');
            });
          }
          if (capabilities.struct) {
            segment.getStruct()
            .then(function(struct) {
              console.log('struct', struct);
            });
          }
        });
      }
      var segment = DataSegment.from(droppedFile);
      handleSegment(segment);
      /*
      var item = new Item(ByteSource.from(droppedFile));
      var extension = droppedFile.name.match(/\.([^\.]+)$/);
      if (extension) {
        extension = extension && encodeURIComponent(extension[1].toUpperCase().replace(/[\\\/\*\"\:\?\|<>]/g, '_'));
        var importString = 'ext/open_' + extension;
        require([importString],
        function(open) {
          open.apply(item);
          item.getListing()
          .then(function(listing) {
            console.log(listing);
          });
        },
        function() {
          console.log('Unsupported extension: ' + extension);
        });
      }
      */
    }

  });
  
});
