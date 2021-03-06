define(function() {
  
  'use strict';
  
  var services;
  
  function Context(format, id) {
    this.format = format;
    this.id = id;
  }
  Context.prototype = {
    process: function(args, transferables) {
      var self = this;
      var worker = self.format.worker;
      return new Promise(function(resolve, reject) {
        function afterProcess(e) {
          var command = e.data;
          switch (command[0]) {
            case 'done':
              if (command[1] === self.id) {
                worker.removeEventListener('message', afterProcess);
                delete worker[self.id];
                resolve([true, command[2]]);
              }
              break;
            case 'more':
              if (command[1] === self.id) {
                worker.removeEventListener('message', afterProcess);
                delete worker[self.id];
                resolve([false, command[2]]);
              }
              break;
            case 'failed':
              if (command[1] === self.id) {
                worker.removeEventListener('message', afterProcess);
                delete worker[self.id];
                reject('process failed');
              }
              break;
          }
        }
        worker.addEventListener('message', afterProcess);
        worker.postMessage(['process', self.id].concat(args), transferables);
      });
    },
  };
  
  function Format(worker, format) {
    this.worker = worker;
    this.name = format;
  }
  Format.prototype = {
    init: function(params, transferables) {
      var id;
      do {
        id = '_' + ((Math.random() * 0xffffffff) >>> 0).toString(16);
      } while (id in this.worker);
      var context = new Context(this, id);
      var worker = this.worker;
      worker[id] = context;
      var self = this;
      return new Promise(function(resolve, reject) {
        function onMessage(e) {
          var command = e.data;
          switch(command[0]) {
            case 'init':
              if (command[1] === id) {
                worker.removeEventListener('message', onMessage);
                resolve(context);
              }
              break;
            case 'failed':
              if (command[1] === id) {
                worker.removeEventListener('message', onMessage);
                delete worker[id];
                reject('init failed');
              }
              break;
          }
        }
        worker.addEventListener('message', onMessage);
        worker.postMessage(['init', id, self.name].concat(params), transferables);
      });
    },
  };

  services = {
    existing: {},
    getService: function(name) {
      return (name in this.existing) ? this.existing[name] : this.existing[name] = this.create();
    },
    init: function(format, args, transferables) {
      var service;
      var split = format.match(/^([^:]*):(.*)$/);
      if (split) {
        service = split[1];
        format = split[2];
      }
      else {
        service = 'general';
      }
      return this.getService(service).init(format, args, transferables);
    },
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
                  resolve(new Format(self, format));
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
      init: function(formatName, params, transferables) {
        return this.load(formatName)
        .then(function(format) {
          return format.init(params, transferables);
        });
      },
    },
  };

  return services;

});
