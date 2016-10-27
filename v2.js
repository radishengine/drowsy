require(['Volume'], function(Volume) {
  
  'use strict';

  window.Volume = Volume;
  
  var desktop = document.getElementById('desktop');
   if (!desktop) {
    console.error('desktop element not found');
    return;
  }
  
  desktop.addEventListener('dragenter', function(e) {
    
    e.dataTransfer.dropEffect = 'copy';
    
    var drop = document.createElement('DIV');
    drop.className = 'drop-outline';
    drop.updatePosition = function(mx, my) {
      console.log(mx, my, this.offsetWidth, this.offsetHeight);
      this.style.left = Math.max(0, mx - this.offsetWidth / 2) + 'px';
      this.style.top = Math.max(0, my - this.offsetHeight / 2) + 'px';
    };
    
    function onDragOver(e) {
      console.log(e.type, e.target);
      e.stopPropagation();
      e.preventDefault();
      drop.updatePosition(e.screenX, e.screenY);
    }
    
    function onDragLeave(e) {
      console.log(e.type, e.target);
      desktop.removeChild(drop);
      desktop.removeEventListener('dragover', onDragOver);
      desktop.removeEventListener('dragleave', onDragLeave);
      desktop.removeEventListener('drop', onDrop);
      desktop.removeEventListener('mousemove', onMouseMove);
    }
  
    function onDrop(e) {
      console.log(e.type, e.target);
      desktop.removeChild(drop);
      e.stopPropagation();
      e.preventDefault();
      desktop.removeEventListener('dragover', onDragOver);
      desktop.removeEventListener('dragleave', onDragLeave);
      desktop.removeEventListener('drop', onDrop);
      desktop.removeEventListener('mousemove', onMouseMove);
    }
    
    function onMouseMove(e) {
      console.log(e.type, e.target);
      drop.updatePosition(e.screenX, e.screenY);
    }
    
    desktop.addEventListener('dragover', onDragOver);
    desktop.addEventListener('dragleave', onDragLeave);
    desktop.addEventListener('drop', onDrop);
    //desktop.addEventListener('mousemove', onMouseMove);
    
    desktop.appendChild(drop);
    drop.updatePosition(e.screenX, e.screenY);
    
  });
  
});
