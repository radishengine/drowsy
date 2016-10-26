
(function(worker) {

  'use strict';
  
  importScripts('../require.js');
  
  function onMessage(e) {
    var command = e.data;
    var commandName = command[0];
    var contextID = command[1];
    switch (commandName) {
      case 'split':
        var type = command[2];
        if (!type) {
          this.postMessage(['failed', contextID, 'split: data type must be specified']);
          break;
        }
        var entryFilter = command[3];
        var context = Context.get(contextID, type);
        context.split(entryFilter).then(
          function() {
            context.send('complete');
          },
          function(reason) {
            context.send('failed', reason);
          });
        break;
      case 'close':
        if (context) context.close();
        else worker.postMessage(['failed', null, 'attempt to close unrecognized context: ' + contextID]);
        break;
      default:
        this.postMessage(['failed', contextID, 'unknown command: ' + commandName]);
        break;
    }
  }
  
  function Context(type, id) {
    this.type = type;
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
    split: function(entryFilter) {
      var self = this;
      return new Promise(function(resolve, reject) {
        require(this.type,
          function(typeHandler) {
            if (typeof typeHandler.split === 'function') {
              var entries = new SplitEntryCollection(self, entryFilter);
              resolve(typeHandler.split.call(self, entries));
            }
            else {
              reject('split not defined for ' + type);
            }
          },
          function() {
            reject('failed to load type handler for ' + type);
          });
      });
    },
  };
  Context.get = function(contextID, type) {
    if (!contextID) return null;
    if (this.hasOwnProperty(contextID)) return this[contextID];
    return this[contextID] = new Context(contextID, type);
  };
  
  // TODO: support filter parameter
  function SplitEntryCollection(context, filter) {
    this.context = context;
  }
  SplitEntryCollection.prototype = {
    add: function(entry) {
      this.context.send('entry', entry);
    },
    accepts: function() {
      return true;
    },
  };

  this.addEventListener('message', onMessage);

}).apply(self);
