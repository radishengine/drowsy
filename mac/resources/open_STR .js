define(['mac/roman'], function(macintoshRoman) {

  return function(resourceInfo, byteSource, containerEl) {
    return byteSource.getBytes()
    .then(function(bytes) {
      var text = document.createElement('PRE');
      text.appendChild(document.createTextNode(macintoshRoman(resource.data, 0, resource.data.length)));
      containerEl.appendChild(text);
    });
  };

});
