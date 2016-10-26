define(['TypeDescriptor'], function(TypeDescriptor) {

  'use strict';
  
  var imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
  imageTypes.filter = TypeDescriptor.filter('image/*').filter(imageTypes);
  
  var audioTypes, videoTypes;
  if (!document) {
    audioTypes = [];
    audioTypes.filter = TypeDescriptor.none;
    videoTypes = [];
    videoTypes.filter = TypeDescriptor.none;
  }
  else {
    audioTypes = [
      'audio/mp4; codecs="mp4a.40.5"',
      'audio/mpeg',
      'audio/ogg; codecs="vorbis"',
      'audio/flac',
      'audio/ogg; codecs="flac"',
    ];
    videoTypes = [
      'video/mp4; codecs="avc1.4D401E, mp4a.40.2"',
      'video/ogg; codecs="theora, vorbis"',
      'video/ogg; codecs="theora"',
      'video/webm; codecs="vp8.0, vorbis"',
    ];
    var audio = document.createElement('AUDIO');
    var video = document.createElement('VIDEO');
    audioTypes = audioTypes.filter(function(type) {
      return !!audio.canPlayType(type);
    });
    videoTypes = videoTypes.filter(function(type) {
      return !!video.canPlayType(type);
    });
    audioTypes.filter = TypeDescriptor.filter('audio/*').filter(audioTypes);
    videoTypes.filter = TypeDescriptor.filter('video/*').filter(videoTypes);
  }
  
  var documentTypes = ['text/plain', 'text/html'];
  documentTypes.filter = TypeDescriptor.filter('text/*').filter(documentTypes);
  
  var rawTypes = ['image/x-pixels; format=r8g8b8a8', 'audio/x-samples; format=f32'];
  rawTypes.filter = TypeDescriptor.filter(rawTypes);
  
  var browserReady = imageTypes.concat(audioTypes, videoTypes, documentTypes, rawTypes);
  
  browserReady.filter = imageTypes.filter
    .or(audioTypes.filter)
    .or(videoTypes.filter)
    .or(documentTypes.filter)
    .or(rawTypes.filter);
  
  return browserReady;

});
