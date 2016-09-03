define(['mac/roman'], function(macintoshRoman) {

  return function(resourceInfo, byteSource, containerEl) {
    return byteSource.getBytes()
    .then(function(bytes) {
      var text = document.createElement('PRE');
      text.appendChild(document.createTextNode(macintoshRoman(bytes, 0, bytes.length)));
      containerEl.appendChild(text);
    });
  };

});
