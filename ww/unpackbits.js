
onmessage = function(e) {
  var command = e.command;
  var packed = command.compressedBytes;
  var buf_length = packed.length;
  var buf_pos = 0;
  var buf = new Uint8Array(buf);
  function checkOutputSpace(n) {
    if (buf_pos + n > buf_length) {
      buf_length *= 2;
      var new_buf = new Uint8Array(buf_length);
      new_buf.set(buf);
      buf = new_buf;
    }
  }
  var pos = 0;
  while (pos < packed.length) {
    var b = packed[pos++];
    if (b & 0x80) {
      if (b === 0x80) continue;
      var count = 257 - b;
      var rep = packed[pos++];
      checkOutputSpace(count);
      for (var i = 0; i < count; i++) {
        buf[buf_pos++] = rep;
      }
    }
    else {
      var length = b + 1;
      checkOutputSpace(length);
      buf.set(packed.subarray(pos, pos + length), buf_pos);
      pos += length;
      buf_pos += length;
    }
  }
  postMessage(buf, [buf.buffer]);
};
