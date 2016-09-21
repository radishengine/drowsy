define(function() {

  var services = {
    create: function() {
      var worker = Object.assign(new Worker('ww/service.js'), services.methods);
      worker.addEventListener('message', services.onmessage);
      return worker;
    },
    methods: {
      load: function(format) {
        if (!('loaded' in this)) this.loaded = {};
        else if (format in this.loaded) return this.loaded[format];
        var self = this;
        return this.loaded[format] = new Promise(function(resolve, reject) {
          function onMessage(e) {
            var command = e.data;
            switch(command[0]) {
              case 'loaded':
                if (command[1] === format) {
                  this.removeEventListener('message', onMessage);
                  resolve();
                }
                break;
              case 'loadfailed':
                if (command[1] === format) {
                  this.removeEventListener('message', onMessage);
                  reject('failed to load');
                }
                break;
            }
          }
          self.addEventListener('message', onMessage);
          self.postMessage(['load', format]);
        });
      },
      init: function(format, params, transferables) {
        var randomID;
        do {
          randomID = '_' + ((Math.random() * 0xffffffff) >>> 0).toString(16);
        } while (randomID in this);
        this[randomID] = true;
        var self = this;
        return new Promise(function(resolve, reject) {
          function onMessage(e) {
            var command = e.data;
            switch(command[0]) {
              case 'init':
                if (command[1] === randomID) {
                  self.removeEventListener('message', onMessage);
                  var obj = {};
                  obj.process = function(args, transferables) {
                    return new Promise(function(resolve, reject) {
                      function afterProcess(e) {
                        var command = e.command;
                        switch (command[0]) {
                          case 'done':
                            if (command[1] === randomID) {
                              self.removeEventListener('message', afterProcess);
                              delete self[randomID];
                              resolve([true, command[2]]);
                            }
                            break;
                          case 'more':
                            if (command[1] === randomID) {
                              self.removeEventListener('message', afterProcess);
                              delete self[randomID];
                              resolve([false, command[2]]);
                            }
                            break;
                          case 'failed':
                            if (command[1] === randomID) {
                              self.removeEventListener('message', afterProcess);
                              delete self[randomID];
                              reject('process failed');
                            }
                            break;
                        }
                      }
                      self.addEventListener('message', afterProcess);
                      self.postMessage(['process', randomID].concat(args), transferables);
                    });
                  };
                  resolve(obj);
                }
                break;
              case 'failed':
                if (command[1] === randomID) {
                  self.removeEventListener('message', onMessage);
                  delete self[randomID];
                  reject('init failed');
                }
                break;
            }
          }
          self.addEventListener('message', onMessage);
          self.postMessage(['init', randomID, format].concat(params), transferables);
        });
      },
    },
  };

  return services;

});
