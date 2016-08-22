
require([ByteSource], function(ByteSource) {
  
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
    
    var byteSource = ByteSource.from(droppedFile);
    
    byteSource.read({
      onbytes: function(bytes) {
        console.log(bytes.length, bytes);
      },
    });
    
  });
  
});
