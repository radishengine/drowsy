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
  
  var rootContainer = document.createElement('DIV');
  document.body.appendChild(rootContainer);

  makeFileDrop('drop-zone', function(droppedFile) {
    
    var ext = droppedFile.name.match(/[^\.]*$/)[0].toLowerCase();
    
    if (!/new/.test(location.hash) && /^(iso|toast|dsk|img)$/i.test(ext)) {
      
      var byteSource = ByteSource.from(droppedFile);
      var appleVolume = new AppleVolume(byteSource);
      appleVolume.read({});
    
    }
    else {
      
      function handleSegment(segment, container) {
        segment.getCapabilities()
        .then(function(capabilities) {
          console.log(capabilities);
          if (capabilities.mount) {
            var volume = new Volume();
            volume.onfile = function(path, segment) {
              var pathParts = path.split('/').map(decodeURIComponent);
              var context = container;
              for (var i = 0; i < pathParts.length; i++) {
                var part = '/' + pathParts[i];
                if (part in context) {
                  context = context[part];
                }
                else {
                  var newContext = document.createElement('DIV');
                  context[part] = newContext;
                  if (!('childContainer' in context)) {
                    context.appendChild(context.childContainer = document.createElement('DIV'));
                    context.childContainer.style.paddingLeft = '1em';
                  }
                  context.childContainer.appendChild(newContext);
                  context = newContext;
                  context.appendChild(document.createTextNode(pathParts[i]));
                }
              }
              // console.log([path, segment.type, segment.fixedLength]);
              segment.getCapabilities()
              .then(function(caps) {
                if (caps.mount) {
                  var button = document.createElement('BUTTON');
                  button.innerHTML = 'open';
                  if ('childContainer' in context) {
                    context.insertBefore(button, context.childContainer);
                  }
                  else {
                    context.appendChild(button);
                  }
                  button.onclick = function() {
                    context.removeChild(button);
                    context.mount(volume.getSubVolume(path + '/'));
                  };
                }
              });
            }
            segment.mount(volume);
          }
          else if (capabilities.split) {
            segment.split(function(subsegment) {
              console.log(subsegment);
              // handleSegment(subsegment);
            });
          }
        });
      }
      
      var segment = DataSegment.from(droppedFile);
      
      handleSegment(segment, rootContainer);
      
    }

  });
  
});
