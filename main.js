require(['ByteSource', 'Item', 'AppleVolume', 'DataSegment', 'runtime/Volume'],
function(ByteSource, Item, AppleVolume, DataSegment, Volume)
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
    
    if (false && /^(iso|toast|dsk|img)$/i.test(ext)) {
      
      var byteSource = ByteSource.from(droppedFile);
      var appleVolume = new AppleVolume(byteSource);
      appleVolume.read({});
    
    }
    else {
      
      var segment = DataSegment.from(droppedFile);
      segment.getCapabilities()
      .then(function(capabilities) {
        console.log(capabilities);
        if (capabilities.mount) {
          var volume = new Volume();
          volume.onfile = function(path, segment) {
            console.log(path, segment.type, segment.fixedLength);
          }
          segment.mount(volume);
        }
      });
      
    }

  });
  
});
