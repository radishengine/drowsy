define(function() {

  'use strict';
  
  return {
    byExtension: {
      adf: 'application/x-amiga-disk-format',
      avi: 'video/x-avi',
      bmp: 'image/bmp',
      class: 'application/x-java-class',
      dll: 'application/x-exe-ambiguous',
      dms: 'application/x-disk-masher-system',
      exe: 'application/x-exe-ambiguous',
      flc: 'video/x-flic',
      fli: 'video/x-flic',
      hlp: 'application/x-winhelp',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      lha: 'application/x-lha',
      mid: 'audio/midi',
      midi: 'audio/midi',
      mov: 'video/quicktime',
      ogg: 'application/ogg',
      png: 'image/png',
      rsrc: 'application/x-mac-resource-fork',
      swf: 'application/x-shockwave-flash',
      tiff: 'image/tiff',
      wav: 'audio/x-wav',
      wri: 'application/x-mswrite',
      zip: 'application/zip',
    },
    byMacResourceType: {
      '8BIM': 'image/x-photoshop-image-resource-block',
      ACHR: 'application/x-world-builder-character',
      ACOD: 'application/x-world-builder-code',
    },
    byMacFileType: {
      AIFF: 'audio/x-aiff',
      MOOV: 'video/quicktime',
      MV93: 'application/x-director',
      'M!93: 'application/x-director',
    },
  };

});
