define(['mac/roman'], function(macintoshRoman) {

  return function(resource) {
    resource.text = macintoshRoman(resource.data, 0, resource.data.length);
  };

});
