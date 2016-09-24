
(function(worker) {

  'use strict';
  
  importScripts('../require.js');
  
  function Context(id) {
    this.id = id;
    this.transferables = [];
  }
  Context.prototype = {
    pushTransferables: function() {
      this.transferables.push.apply(this.transferables, arguments);
      return this;
    },
    popTransferables: function() {
      return this.transferables.splice(0, this.transferables.length);
    },
    close: function() {
      delete Context[this.id];
      this.send('closed');
    },
    send: function(commandName, args) {
      worker.postMessage([commandName, this.id].concat(args || []), this.popTransferables());
      return this;
    },
  };
  Context.get = function(contextID) {
    if (!contextID) return null;
    if (this.hasOwnProperty(contextID)) return this[contextID];
    return this[contextID] = new Context(contextID);
  };

  function onMessage(e) {
    var command = e.data;
    var commandName = command[0];
    var contextID = command[1];
    var context = Context.get(contextID);
    switch (commandName) {
      case 'split':
        var type = command[2];
        if (!type) {
          this.postMessage(['error', contextID, 'split: data type must be specified']);
          break;
        }
        var worker = this;
        require(type,
          function(typeHandler) {
            if (typeof typeHandler.split !== 'function') {
              worker.postMessage(['error', contextID, 'split not defined for ' + type]);
            }
            else {
              command.splice(0, 3, context);
              var result = typeHandler.split.apply(typeHandler, command);
            }
          },
          function() {
            worker.postMessage(['error', command[1], 'failed to load handler for type ' + type]);
          });
        break;
      case 'close':
        if (context) context.close();
        else worker.postMessage(['error', null, 'attempt to close unrecognized context: ' + contextID]);
        break;
      default:
        this.postMessage(['error', contextID, 'unknown command: ' + commandName]);
        break;
    }
  }
  
  this.addEventListener('message', onMessage);

}).apply(self);
