define(function() {

  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
    
      var ibyte = 0, ibit = 0;
      function unsigned(bits) {
        var available = 8 - ibit;
        if (available < bits) {
          var topBits = bytes[ibyte] << (32 - available) >>> (32 - available);
          ibyte++; ibit = 0;
          bits -= available;
          return (topBits << bits) | unsigned(bits);
        }
        var value = bytes[ibyte] << (24 + ibit) >>> (32 - bits);
        ibit += bits;
        if (ibit === 8) { ibyte++; ibit = 0; }
        return value;
      }
      
      var mode = unsigned(3);
      
      var height = unsigned(1) ? unsigned(10) : unsigned(6);
      var width = unsigned(1) ? unsigned(10) : unsigned(6);
      var stride = (width % 16) ? width + 16 - (width % 16) : width;
      
      console.log(mode, height, width, stride);

    });
  }
  
  return open;

});
