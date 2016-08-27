define(function() {

  return function(resource) {
    var dv = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    var entryCount = dv.getInt16(6, false) + 1;
    if (entryCount < 0) {
      console.error('color table resource: invalid number of entries');
    }
    var palCanvas = document.createElement('CANVAS');
    palCanvas.width = entryCount;
    if (entryCount === 0) {
      palCanvas.height = 0;
    }
    else {
      palCanvas.height = 1;
      var palCtx = palCanvas.getContext('2d');
      var palData = palCtx.createImageData(entryCount, 1);
      for (var icolor = 0; icolor < entryCount; icolor++) {
        var offset = dv.getInt16(8 + icolor*8, false) * 4;
        if (offset >= 0) {
          palData.data[offset] = resource.data[8 + icolor*8 + 2];
          palData.data[offset + 1] = resource.data[8 + icolor*8 + 4];
          palData.data[offset + 2] = resource.data[8 + icolor*8 + 6];
          palData.data[offset + 3] = 255;
        }
      }
      palCtx.putImageData(palData, 0, 0);
    },
    resource.image = {
      width: palCanvas.width,
      height: palCanvas.height,
      url: palCanvas.toDataURL(),
    };

  };

});
