
function fromUint8s(buf) {
  var samples = new Float32Array(buf.length);
  for (var i = 0; i < buf.length; i++) {
    samples[i] = (buf[i] - 128) / 128;
  }
  return samples;
}

function fromInt8s(buf) {
  var samples = new Float32Array(buf.length);
  for (var i = 0; i < buf.length; i++) {
    samples[i] = buf[i] / 128;
  }
  return samples;
}
