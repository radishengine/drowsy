
var loaded = {};
var contexts = {};

// service.postMessage(['load', '<format>']) --> ['loaded', '<format>'] OR ['loadfailed', '<format>']
// service.postMessage(['init', context, 'format', ...extra]) --> ['init', context] OR ['failed', context]
// service.postMessage(['process', context, ...extra]) --> ['more', context, ...extra] OR ['done', context, ...extra]
// service.postMessage(['abandon', context]) --> ['abandoned', context]

self.onmessage = function(e) {
  var command = e.data;
  switch(command[0]) {
    case 'load':
      var lib = command[1];
      if (!(command in loaded)) {
        try {
          importScripts('ww/' + command + '.js');
        }
        catch {
          postMessage(['loadfailed', lib]);
          return;
        }
        loaded[command] = true;
      }
      self.postMessage(['loaded', lib]);
      break;
    case 'init':
      var context = command[1];
      var format = command[2];
      command.splice(0, 3);
      try {
        contexts[context] = self['init_' + format].apply(null, command);
      }
      catch {
        self.postMessage(['failed', context]);
        return;
      }
      self.postMessage(['init', context]);
      break;
    case 'process':
      var id = command.splice(0, 2)[1];
      var context = contexts[id];
      var result;
      try {
        result = context.process.apply(context, command);
      }
      catch {
        delete contexts[id];
        self.postMessage(['failed', id]);
        return;
      }
      if (result.done) delete contexts[id];
      postMessage([result.done ? 'done' : 'more', id, result.value]);
      break;
    case 'abandon':
      delete contexts[command[1]];
      self.postMessage(['abandoned', command[1]]);
      break;
  }
};
