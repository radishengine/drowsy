define(['mac/roman'], function(macintoshRoman) {

  return function(item) {
    return item.getBytes().then(function(bytes) {
      item.text = macintoshRoman(bytes, 1, bytes[0]);
    });
  };

});
