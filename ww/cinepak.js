
function CinepakFrameServer() {
  
}
CinepakFrameServer.prototype = {
  process: function(frame_buf, frame_pos) {
    var flags = frame_buf[frame_pos];
    var dataLength = frame_buf[frame_pos + 1] << 24 | frame_buf[frame_pos + 2] << 16 | frame_buf[frame_pos + 3];
    frame_pos += 3;
    var width = frame_buf[frame_pos] << 8 | frame_buf[frame_pos + 1];
    frame_pos += 2;
    var height = frame_buf[frame_pos] << 8 | frame_buf[frame_pos + 1];
    frame_pos += 2;
    var strip_count = frame_buf[frame_pos] << 8 | frame_buf[frame_pos + 1];
    frame_pos += 2;
    for (var strip_i = 0; strip_i < strip_count; strip_i++) {
      var strip_pos = frame_pos;
      var id = frame_buf[frame_pos] << 8 | frame_buf[frame_pos + 1];
      frame_pos += 2;
      var dataSize = frame_buf[frame_pos] << 8 | frame_buf[frame_pos + 1];
      var strip_end = strip_pos + dataSize;
      frame_pos += 2;
      var top = frame_buf[frame_pos] << 8 | frame_buf[frame_pos + 1];
      frame_pos += 2;
      var left = frame_buf[frame_pos] << 8 | frame_buf[frame_pos + 1];
      frame_pos += 2;
      var bottom = frame_buf[frame_pos] << 8 | frame_buf[frame_pos + 1];
      frame_pos += 2;
      var right = frame_buf[frame_pos] << 8 | frame_buf[frame_pos + 1];
      frame_pos += 2;
      
      // TODO: chunks
      
      frame_pos = strip_end;
    }
  },
};

self.init_cinepak = function() {
  return new CinepakFrameServer();
};
