require(['Volume'], function(Volume) {
  
  'use strict';

  window.Volume = Volume;
  
  var desktop = document.getElementById('desktop');
   if (!desktop) {
    console.error('desktop element not found');
    return;
  }
  
  function onFrameMouseDown(e) {
    desktop.appendChild(this);
    e.stopPropagation();
  }
  
  function onFrameClick(e) {
    if (e.target === this.closeButton) {
      desktop.removeChild(this);
    }
    e.stopPropagation();
  }
  
  const frameProperties = {
    titleText: {
      get: function() {
        return this.titleTextContainer.textContent;
      },
      set: function(newTitle) {
        this.titleTextContainer.textContent = newTitle;
      },
    },
  };
  
  function createFrame(x, y) {
    var frame = document.createElement('DIV');
    frame.className = 'frame';
    desktop.appendChild(frame);
    if (!isNaN(x) && !isNaN(y)) {
      frame.style.left = x + 'px';
      frame.style.top = y + 'px';
    }
    frame.addEventListener('mousedown', onFrameMouseDown);
    frame.addEventListener('click', onFrameClick);
    frame.titleBar = frame.appendChild(document.createElement('DIV'));
    frame.titleBar.className = 'title-bar';
    frame.closeButton = frame.titleBar.appendChild(document.createElement('BUTTON'));
    frame.closeButton.className = 'close-button';
    frame.closeButton.textContent = 'X';
    frame.titleTextContainer = frame.titleBar.appendChild(document.createElement('SPAN'));
    frame.titleTextContainer.className = 'title-text';
    Object.defineProperties(frame, frameProperties);
    return frame;
  }
  
  var dragCount = 0;

  desktop.addEventListener('dragenter', function(e) {
    
    if (++dragCount > 1) return;
    
    var drop = document.createElement('DIV');
    drop.className = 'drop-outline';
    drop.updatePosition = function(mx, my) {
      this.style.left = (this.x = Math.max(0, mx - this.offsetWidth / 2)) + 'px';
      this.style.top = (this.y = Math.max(0, my - this.offsetHeight / 2)) + 'px';
    };
    
    function onDragOver(e) {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      drop.updatePosition(e.pageX, e.pageY);
    }
    
    function onDragLeave(e) {
      if (--dragCount < 1) {
        desktop.removeChild(drop);
        desktop.removeEventListener('dragover', onDragOver);
        desktop.removeEventListener('dragleave', onDragLeave);
        desktop.removeEventListener('drop', onDrop);
        desktop.removeEventListener('mousemove', onMouseMove);
      }
    }
  
    function onDrop(e) {
      dragCount = 0;
      desktop.removeChild(drop);
      createFrame(drop.x, drop.y);
      drop = null;
      e.stopPropagation();
      e.preventDefault();
      desktop.removeEventListener('dragover', onDragOver);
      desktop.removeEventListener('dragleave', onDragLeave);
      desktop.removeEventListener('drop', onDrop);
      desktop.removeEventListener('mousemove', onMouseMove);
    }
    
    function onMouseMove(e) {
      drop.updatePosition(e.pageX, e.pageY);
    }
    
    desktop.addEventListener('dragover', onDragOver);
    desktop.addEventListener('dragleave', onDragLeave);
    desktop.addEventListener('drop', onDrop);
    desktop.addEventListener('mousemove', onMouseMove);
    
    desktop.appendChild(drop);
    drop.updatePosition(e.pageX, e.pageY);
    
  });
  
});
