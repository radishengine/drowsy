define(function() {

  'use strict';

  function open(item) {
    item.getSubitem(/VWSC/)
    .then(function(vwsc) {
      vwsc.populate()
      .then(function() {
        var testScreen = document.createElement('CANVAS');
        testScreen.width = 640;
        testScreen.height = 400;
        var ctx = testScreen.getContext('2d');
        var playHead = testScreen.playHead = vwsc.playHeadFactory.create();
        var sprites = playHead.sprites;
        testScreen.playHead.eventTarget = testScreen;
        testScreen.addEventListener('enter-frame', function() {
          ctx.clearRect(0, 0, 640, 480);
          for (var i = 0; i < sprites.length; i++) {
            if (!sprites[i].cast) continue;
            ctx.fillStyle = 'rgb(' + Math.floor(Math.random() * 255)
              + ',' + Math.floor(Math.random() * 255)
              + ',' + Math.floor(Math.random() * 255) + ')';
            ctx.fillRect(sprites[i].top, sprites[i].left, sprites[i].width, sprites[i].height);
          }
        });
        item.addItem(testScreen);
        testScreen.playHead.next();
      });
    });
  }
  
  return open;

});
