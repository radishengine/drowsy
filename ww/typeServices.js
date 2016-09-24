
importScripts('../require.js');

require([],
function() {

  'use strict';
  
  function onMessage(e) {
    console.log(e.data);
  }
  
  self.addEventListener('message', onMessage);

});
