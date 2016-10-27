require(['Volume'], function(Volume) {
  
  'use strict';

  window.Volume = Volume;
  
  var desktop = document.getElementById('desktop');
   if (!desktop) {
    console.error('desktop element not found');
    return;
  }
  
  desktop.addEventListener('dragenter', function(e) {
    
    if (e.dataTransfer.files.length === 0) {
      return;
    }
    
    e.dataTransfer.dropEffect = 'copy';
    
    var drop = document.createElement('DIV');
    drop.className = 'drop-outline';
    drop.updatePosition = function(mx, my) {
      this.style.left = Math.max(0, mx - this.offsetWidth / 2) + 'px';
      this.style.top = Math.max(0, my - this.offsetHeight / 2) + 'px';
    };
    
    function onDragOver(e) {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      drop.updatePosition(e.clientX, e.clientY);
    }
    
    function onDragLeave(e) {
      desktop.removeChild(drop);
      desktop.removeEventListener('dragover', onDragOver);
      desktop.removeEventListener('dragleave', onDragLeave);
      desktop.removeEventListener('drop', onDrop);
      desktop.removeEventListener('mousemove', onMouseMove);
    }
  
    function onDrop(e) {
      desktop.removeChild(drop);
      e.stopPropagation();
      e.preventDefault();
      desktop.removeEventListener('dragover', onDragOver);
      desktop.removeEventListener('dragleave', onDragLeave);
      desktop.removeEventListener('drop', onDrop);
      desktop.removeEventListener('mousemove', onMouseMove);
    }
    
    function onMouseMove(e) {
      drop.updatePosition(e.clientX, e.clientY);
    }
    
    desktop.addEventListener('dragover', onDragOver);
    desktop.addEventListener('dragleave', onDragLeave);
    desktop.addEventListener('drop', onDrop);
    desktop.addEventListener('mousemove', onMouseMove);
    
    drop.updatePosition(e.clientX, e.clientY);
    desktop.appendChild(drop);
    
  });
  
});
