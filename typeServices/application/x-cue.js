define(function() {

  var token = /("([^"]+)"|[^\s"]*)(\s*)/g;

  function parse(text) {
    var lines = text.split(/\r?\n|\r/).filter(function(l){ return /\S/.test(l); });
    var tokenized = new Array(lines.length);
    for (var i = 0; i < lines.length; i++) {
      var parts = lines.match(/^\s*(\S+)\s*(.*?)\s*$/);
      var cmd = parts[1].toLowerCase(), data = parts[2];
      if (!data) {
        tokenized[i] = [cmd];
        continue;
      }
      if (cmd === 'rem') {
        // don't tokenize a comment
        tokenized[i] = [cmd, data];
        continue;
      }
      token.lastIndex = 0;
      cmd = [cmd];
      var lastIndex = token.lastIndex;
      for (var match = token.exec(data); match; match = token.exec(data)) {
        if (match.index !== lastIndex) {
          throw new Error('unexpected content in cue file: ' + lines[i]);
        }
        lastIndex = token.lastIndex;
        var token = match[2] || match[1];
        if (!match[2] && /^\d+/.test(match[1])) token = +token;
        cmd.push(token);
      }
      if (token.lastIndex < data.length) {
        throw new Error('unexpected content in cue file: ' + lines[i]);
      }
    }
    return tokenized;
  }
  
  return {
    parse: parse,
  };

});
