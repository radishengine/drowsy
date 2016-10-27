require(['Volume'], function(Volume) {
  
  'use strict';

  window.Volume = Volume;
  
  var desktop = document.getElementById('desktop');
   if (!desktop) {
    console.error('desktop element not found');
    return;
  }
  
  function onHandleMouseDown(frame, handle, pageX, pageY) {
    var onMouseMove;
    var width = frame.offsetWidth, height = frame.offsetHeight;
    function onMouseMoveX(e) {
      frame.style.width = (width + e.pageX - pageX) + 'px';
    }
    function onMouseMoveY(e) {
      frame.style.height = (height + e.pageY - pageY) + 'px';
    }
    function onMouseUp(e) {
      document.removeEventListener('mousemove', onMouseMoveX);
      document.removeEventListener('mousemove', onMouseMoveY);
      document.removeEventListener('mouseup', onMouseUp);
    }
    if (handle.handle === 'x' || handle.handle === 'corner') {
      document.addEventListener(onMouseMoveX);
    }
    if (handle.handle === 'y' || handle.handle === 'corner') {
      document.addEventListener(onMouseMoveY);
    }
    document.addEventListener(onMouseUp);
  }
  
  function onFrameMouseDown(e) {
    if (e.target.handle) {
      return onHandleMouseDown(this, e.target, e.pageX, e.pageY);
    }
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
    frame.xHandle = frame.appendChild(document.createElement('DIV'));
    frame.xHandle.handle = 'x';
    frame.xHandle.className = 'x-handle';
    frame.yHandle = frame.appendChild(document.createElement('DIV'));
    frame.yHandle.handle = 'y';
    frame.yHandle.className = 'y-handle';
    frame.cornerHandle = frame.appendChild(document.createElement('DIV'));
    frame.cornerHandle.handle = 'corner';
    frame.cornerHandle.className = 'corner-handle';
    frame.titleBar = frame.appendChild(document.createElement('DIV'));
    frame.titleBar.className = 'title-bar';
    frame.closeButton = frame.titleBar.appendChild(document.createElement('BUTTON'));
    frame.closeButton.className = 'close-button';
    frame.closeButton.textContent = 'X';
    frame.titleTextContainer = frame.titleBar.appendChild(document.createElement('SPAN'));
    frame.titleTextContainer.className = 'title-text';
    frame.content = frame.appendChild(document.createElement('DIV'));
    frame.content.className = 'content';
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
