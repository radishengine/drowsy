define(function() {

  'use strict';
  
  /*
  DOS unpackers: STEALTH, ZZAP, PCI FID
  
  ZZAP: ICE, LBR, LZH, MD, PAK, SDN, ZIP, ZOO
  STEALTH: ZIP, ARC, ZOO, DWC, LHARC, ARJ, PAK, SDN, SQZ, ICE, LARC, HAP, HYPER
  PCI FID: AIN, ARC, ARI, ARJ, ARK, BSN, COD, DWC, ESP, HAP, HA, HPK, HYP, ICE,
     JAR, J, LIM, LZH, LZS, MAR, PAK, RAR, RKV, SAR, SHK, SQZ, UFA, UC2, YC, ZET,
     ZIP, ZOO, ZPK
  */
  
  return {
    byExtension: {
      '7z': 'application/x-7z-compressed',
      ace: 'application/x-ace-compressed',
      adf: 'application/x-amiga-disk-format',
      adz: 'application/gzip; compressed-type=application/x-amiga-disk-format',
      aif: 'audio/x-aiff',
      aiff: 'audio/x-aiff',
      au: 'audio/basic',
      avi: 'video/x-avi',
      bat: 'application/x-bat',
      bmp: 'image/bmp',
      bz: 'application/x-bzip',
      bz2: 'application/x-bzip2',
      cdy: 'application/vnd.cinderella',
      chm: 'application/vnd.ms-htmlhelp',
      class: 'application/x-java-class',
      com: 'application/x-exe-msdos-simple',
      css: 'text/css',
      csv: 'text/csv',
      dll: 'application/x-exe-ambiguous',
      dms: 'application/x-disk-masher-system',
      doc: 'application/x-doc-ambiguous',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      dsk: 'volume/ambiguous',
      emf: 'image/emf',
      exe: 'application/x-exe-ambiguous',
      flc: 'video/x-flic',
      fli: 'video/x-flic',
      flv: 'video/x-flv',
      gif: 'image/gif',
      hlp: 'application/x-winhelp',
      htm: 'text/html',
      html: 'text/html',
      ico: 'image/vnd.microsoft.icon',
      img: 'volume/ambiguous',
      ini: 'application/x-ini',
      iso: 'volume/optical-media',
      jar: 'application/zip',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      js: 'application/js',
      json: 'application/json',
      lha: 'application/x-lha',
      markdown: 'text/markdown',
      md: 'text/markdown',
      mid: 'audio/midi',
      midi: 'audio/midi',
      mp1: 'audio/mpeg; layer=1',
      mp2: 'audio/mpeg; layer=2',
      mp3: 'audio/mpeg; layer=3',
      mov: 'video/quicktime',
      ogg: 'application/ogg',
      pct: 'image/x-pict',
      pcx: 'image/vnd.zbrush.pcx',
      pdf: 'application/pdf',
      pic: 'image/x-pict',
      pict: 'image/x-pict',
      png: 'image/png',
      ppt: 'application/vnd.ms-powerpoint',
      ps: 'application/postscript',
      psd: 'image/x-photoshop',
      rar: 'application/vnd.rar',
      rsrc: 'application/x-mac-resource-fork',
      rtf: 'application/rtf',
      sit: 'application/x-stuffit',
      swf: 'application/x-shockwave-flash',
      tar: 'application/x-tar',
      tga: 'image/x-targa',
      tgz: 'application/gzip; compressed-type=application/x-tar',
      tiff: 'image/tiff',
      toast: 'volume/optical-media',
      txt: 'text/plain',
      wav: 'audio/x-wav',
      wmf: 'image/wmf',
      wri: 'application/x-mswrite',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      zip: 'application/zip',
      zzt: 'application/x-zzt',
    },
    byMacResourceType: {
      '8BIM': 'image/x-photoshop-image-resource-block',
      ACHR: 'chunk/world-builder; which=character',
      ACOD: 'chunk/world-builder; which=code',
      TPIC: 'image/x-targa',
    },
    byMacFileType: {
      AIFF: 'audio/x-aiff',
      MOOV: 'video/quicktime',
      MV93: 'application/x-director',
      'M!93': 'application/x-director',
    },
  };

});
