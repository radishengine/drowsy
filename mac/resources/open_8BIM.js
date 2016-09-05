define(['mac/roman', 'mac/fixedPoint'], function(macintoshRoman, fixedPoint) {

  'use strict';
  
  return function(item) {
    item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      switch(item.resourceID) {
        case 1000: // 2-byte values: number of channels, rows, columns, depth, mode
          break;
        case 1001: // Printing Manager TPrint record
          if (bytes.length !== 120) {
            return Promise.reject('unexpected length for Printing Manager TPrint record');
          }
          item.setDataObject({
            iPrVersion: dv.getInt16(0, false),
            prInfo: {
              iDev: dv.getInt16(2, false),
              iVRes: dv.getInt16(4, false),
              iHRes: dv.getInt16(6, false),
              rPage: {
                top: dv.getInt16(8, false),
                left: dv.getInt16(10, false),
                bottom: dv.getInt16(12, false),
                right: dv.getInt16(14, false),
              },
            },
            rPaper: {
              top: dv.getInt16(16, false),
              left: dv.getInt16(18, false),
              bottom: dv.getInt16(20, false),
              right: dv.getInt16(22, false),
            },
            prStl: {
              wDev: dv.getInt16(24, false),
              iPageV: dv.getInt16(26, false),
              iPageH: dv.getInt16(28, false),
              bPort: dv.getInt8(30),
              feed: dv.getInt8(31),
            },
            prInfoPT: {
              iDev: dv.getInt16(32, false),
              iVRes: dv.getInt16(34, false),
              iHRes: dv.getInt16(36, false),
              rPage: {
                top: dv.getInt16(38, false),
                left: dv.getInt16(40, false),
                bottom: dv.getInt16(42, false),
                right: dv.getInt16(44, false),
              },
            },
            prXInfo: {
              iRowBytes: dv.getInt16(46, false),
              iBandV: dv.getInt16(48, false),
              iBandH: dv.getInt16(50, false),
              iDevBytes: dv.getInt16(52, false),
              iBands: dv.getInt16(54, false),
              bPatScale: dv.getInt8(56),
              bUlThick: dv.getInt8(57),
              bUlOffset: dv.getInt8(58),
              bUlShadow: dv.getInt8(59),
              scan: dv.getInt8(60),
              bXInfoX: dv.getInt8(61),
            },
            prJob: {
              iFstPage: dv.getInt16(62, false),
              iLstPage: dv.getInt16(64, false),
              iCopies: dv.getInt16(66, false),
              bJDocLoop: dv.getInt8(68, false),
              fFromUsr: dv.getUint8(69, false),
              pIdleProc: dv.getInt32(70, false),
              pFileName: dv.getInt32(74, false),
              iFileVol: dv.getInt16(78, false),
              bFileVers: dv.getInt8(80),
              bJobX: dv.getInt8(81),
            },
            printX: [
              dv.getInt16(82, false),
              dv.getInt16(84, false),
              dv.getInt16(86, false),
              dv.getInt16(88, false),
              dv.getInt16(90, false),
              dv.getInt16(92, false),
              dv.getInt16(94, false),
              dv.getInt16(96, false),
              dv.getInt16(98, false),
              dv.getInt16(100, false),
              dv.getInt16(102, false),
              dv.getInt16(104, false),
              dv.getInt16(106, false),
              dv.getInt16(108, false),
              dv.getInt16(110, false),
              dv.getInt16(112, false),
              dv.getInt16(114, false),
              dv.getInt16(116, false),
              dv.getInt16(118, false),
            ],
          });
          break;
        case 1002: // Macintosh page format info
          break;
        case 1003: // indexed color table
          break;
        case 1005: // ResolutionInfo
          if (bytes.length !== 16) {
            return Promise.reject('unexpected length for ResolutionInfo record');
          }
          item.setDataObject({
            hRes: fixedPoint.fromInt32(dv.getInt32(0, false)),
            hResUnit: dv.getInt16(4, false),
            widthUnit: dv.getInt16(6, false),
            vRes: fixedPoint.fromInt32(dv.getInt32(8, false)),
            vResUnit: dv.getInt16(12, false),
            heightUnit: dv.getInt16(14, false),
          });
          break;
        case 1006: // Names of the alpha channels as a series of Pascal strings.
          break;
        case 1007: // ID 1077 DisplayInfo structure. See Appendix A in Photoshop API Guide.pdf.
          break;
        case 1008: // The caption as a Pascal string.
          break;
        case 1009:
          // Border info
          // fixed number (2 bytes real, 2 bytes fraction) for the border width
          // 2 bytes for border units (1 = inches, 2 = cm, 3 = points, 4 = picas, 5 = columns)
          break;
        case 1010: // Background color
          if (bytes.length !== 10) {
            console.error('unexpected length for Color record');
            return;
          }
          switch(dv.getUint16(0, false)) {
            case 0:
              item.setDataObject({
                type: 'rgb',
                red: dv.getUint16(2, false),
                green: dv.getUint16(4, false),
                blue: dv.getUint16(6, false),
              });
              break;
            case 1:
              item.setDataObject({
                type: 'hsb',
                hue: dv.getUint16(2, false),
                saturation: dv.getUint16(4, false),
                brightness: dv.getUint16(6, false),
              });
              break;
            case 2:
              item.setDataObject({
                type: 'cmyk',
                cyan: dv.getUint16(2, false),
                magenta: dv.getUint16(4, false),
                yellow: dv.getUint16(6, false),
                black: dv.getUint16(8, false),
              });
              break;
            case 7:
              item.setDataObject({
                type: 'lab',
                lightness: dv.getUint16(2, false), // 0...10000
                aChrominance: dv.getInt16(4, false),
                bChrominance: dv.getInt16(6, false),
              });
              break;
            case 8:
              item.setDataObject({
                type: 'grayscale',
                gray: dv.getUint16(2, false), // 0...10000
              });
              break;
            default:
              return Promise.reject('unknown color space code: ' + dv.getUint16(0, false));
          }
          break;
        case 1011:
          // Print flags
          // one-byte booleans (see Page Setup dialog):
          // labels, crop marks, color bars, registration marks, negative, flip, interpolate, caption, print flags
          if (bytes.length !== 7 && bytes.length !== 8) {
            return Promise.reject('unexpected length for print flags');
          }
          var dataObject = {
            labels: !!bytes[0],
            cropMarks: !!bytes[1],
            colorBars: !!bytes[2],
            registrationMarks: !!bytes[3],
            negative: !!bytes[4],
            flip: !!bytes[5],
            interpolate: !!bytes[6],
          };
          if (bytes.length > 7) {
            dataObject.caption = bytes[7];
          }
          item.setDataObject(dataObject);
          break;
        case 1012: // Grayscale and multichannel halftoning information
          break;
        case 1013: // Color halftoning information
          if (bytes.length < 4*18) {
            // extra length is custom dot drawing function (not yet supported)
            return Promise.reject('unexpected length for halftoning information');
          }
          var dataObject = [];
          for (var i = 0; i < 4; i++) {
            var offset = i * 18;
            dataObject.push({
              screenFrequency: fixedPoint.fromInt32(dv.getInt32(offset, false)),
              screenFrequencyUnits: (function(code) {
                switch(code) {
                  case 1: return 'linesPerInch';
                  case 2: return 'linesPerCm';
                  default: return code;
                }
              })( dv.getUint16(offset + 4, false) ),
              screenAngle: fixedPoint.fromInt32(dv.getInt32(offset + 6, false)),
              halftoneDotShape: (function(code) {
                // TODO: negative numbers indicate size of custom PostScript dot-drawing function
                //  coming after the 4 screens' data
                switch(code) {
                  case 0: return 'round';
                  case 1: return 'ellipse';
                  case 2: return 'line';
                  case 3: return 'square';
                  case 4: return 'cross';
                  case 6: return 'diamond';
                  default: return code;
                }
              })( dv.getUint16(offset + 10) ),
              // 4 bytes not used
              useAccurateScreens: !!bytes[offset + 16],
              usePrintersDefaultScreens: !!bytes[offset + 17],
            });
          }
          item.setDataObject(dataObject);
          break;
        case 1014: // Duotone halftoning information
          break;
        case 1015: // Grayscale and multichannel transfer function
          break;
        case 1016: // Color transfer functions
          if (bytes.length !== 4 * 28) {
            return Promise.reject('unexpected length for Transfer Function');
          }
          var dataObject = [];
          for (var i = 0; i < 4; i++) {
            var offset = 28 * i;
            var curve = [];
            var notNull = true;
            for (var j = 0; j < 13; j++) {
              var v = dv.getInt16(offset + j * 2, false);
              if (v === -1) v = null;
              curve.push(v);
              notNull = notNull && (
                (j === 0) ? (v === 0)
                : (j === 12) ? (v === 1000)
                : (v !== null)
              );
            }
            if (!notNull) curve = null;
            dataObject.push({
              curve: curve,
              overridePrinterCurve: !!dv.getUint16(offset + 26, false),
            });
          }
          item.setDataObject(dataObject);
          break;
        case 1017: // Duotone transfer functions
          break;
        case 1018: // Duotone image information
          break;
        case 1019: // Two bytes for the effective black and white values for the dot range
          break;
        case 1020: // (Obsolete)
          break;
        case 1021: // EPS options
          break;
        case 1022: // Quick Mask information. 2 bytes containing Quick Mask channel ID; 1- byte boolean indicating whether the mask was initially empty.
          break;
        case 1023: // (Obsolete)
          break;
        case 1024: // Layer state information. 2 bytes containing the index of target layer (0 = bottom layer).
          break;
        case 1025: // Working path (not saved). See See Path resource format.
          break;
        case 1026: // Layers group information. 2 bytes per layer containing a group ID for the dragging groups. Layers in a group have the same group ID.
          break;
        case 1027: // (Obsolete)
          break;
        case 1028: // IPTC-NAA record. Contains the File Info... information. See the documentation in the IPTC folder of the Documentation folder.
          break;
        case 1029: // Image mode for raw format files
          break;
        case 1030: // JPEG quality. Private.
          break;
        case 1032: // (Photoshop 4.0) Grid and guides information. See See Grid and guides resource format.
          break;
        case 1033: // (Photoshop 4.0) Thumbnail resource for Photoshop 4.0 only. See See Thumbnail resource format.
          break;
        case 1034: // (Photoshop 4.0) Copyright flag. Boolean indicating whether image is copyrighted. Can be set via Property suite or by user in File Info...
          break;
        case 1035: // (Photoshop 4.0) URL. Handle of a text string with uniform resource locator. Can be set via Property suite or by user in File Info...
          break;
        case 1036: // (Photoshop 5.0) Thumbnail resource (supersedes resource 1033). See See Thumbnail resource format.
          break;
        case 1037: // (Photoshop 5.0) Global Angle. 4 bytes that contain an integer between 0 and 359, which is the global lighting angle for effects layer. If not present, assumed to be 30.
          break;
        case 1038: // (Obsolete) See ID 1073 below. (Photoshop 5.0) Color samplers resource. See See Color samplers resource format.
          break;
        case 1039: // (Photoshop 5.0) ICC Profile. The raw bytes of an ICC (International Color Consortium) format profile. See ICC1v42_2006-05.pdf in the Documentation folder and icProfileHeader.h in Sample Code\Common\Includes .
          break;
        case 1040: // (Photoshop 5.0) Watermark. One byte.
          break;
        case 1041: // (Photoshop 5.0) ICC Untagged Profile. 1 byte that disables any assumed profile handling when opening the file. 1 = intentionally untagged.
          break;
        case 1042: // (Photoshop 5.0) Effects visible. 1-byte global flag to show/hide all the effects layer. Only present when they are hidden.
          break;
        case 1043: // (Photoshop 5.0) Spot Halftone. 4 bytes for version, 4 bytes for length, and the variable length data.
          break;
        case 1044: // (Photoshop 5.0) Document-specific IDs seed number. 4 bytes: Base value, starting at which layer IDs will be generated (or a greater value if existing IDs already exceed it). Its purpose is to avoid the case where we add layers, flatten, save, open, and then add more layers that end up with the same IDs as the first set.
          break;
        case 1045: // (Photoshop 5.0) Unicode Alpha Names. Unicode string
          break;
        case 1046: // (Photoshop 6.0) Indexed Color Table Count. 2 bytes for the number of colors in table that are actually defined
          break;
        case 1047: // (Photoshop 6.0) Transparency Index. 2 bytes for the index of transparent color, if any.
          break;
        case 1049: // (Photoshop 6.0) Global Altitude. 4 byte entry for altitude
          break;
        case 1050: // (Photoshop 6.0) Slices. See See Slices resource format.
          break;
        case 1051: // (Photoshop 6.0) Workflow URL. Unicode string
          break;
        case 1052: // (Photoshop 6.0) Jump To XPEP. 2 bytes major version, 2 bytes minor version, 4 bytes count. Following is repeated for count: 4 bytes block size, 4 bytes key, if key = 'jtDd' , then next is a Boolean for the dirty flag; otherwise it's a 4 byte entry for the mod date.
          break;
        case 1053: // (Photoshop 6.0) Alpha Identifiers. 4 bytes of length, followed by 4 bytes each for every alpha identifier.
          break;
        case 1054: // (Photoshop 6.0) URL List. 4 byte count of URLs, followed by 4 byte long, 4 byte ID, and Unicode string for each count.
          break;
        case 1057: // (Photoshop 6.0) Version Info. 4 bytes version, 1 byte hasRealMergedData , Unicode string: writer name, Unicode string: reader name, 4 bytes file version.
          break;
        case 1058: // (Photoshop 7.0) EXIF data 1. See http://www.kodak.com/global/plugins/acrobat/en/service/digCam/exifStandard2.pdf
          break;
        case 1059: // (Photoshop 7.0) EXIF data 3. See http://www.kodak.com/global/plugins/acrobat/en/service/digCam/exifStandard2.pdf
          break;
        case 1060: // (Photoshop 7.0) XMP metadata. File info as XML description. See http://www.adobe.com/devnet/xmp/
          break;
        case 1061: // (Photoshop 7.0) Caption digest. 16 bytes: RSA Data Security, MD5 message-digest algorithm
          break;
        case 1062: // (Photoshop 7.0) Print scale. 2 bytes style (0 = centered, 1 = size to fit, 2 = user defined). 4 bytes x location (floating point). 4 bytes y location (floating point). 4 bytes scale (floating point)
          break;
        case 1064: // (Photoshop CS) Pixel Aspect Ratio. 4 bytes (version = 1 or 2), 8 bytes double, x / y of a pixel. Version 2, attempting to correct values for NTSC and PAL, previously off by a factor of approx. 5%.
          break;
        case 1065: // (Photoshop CS) Layer Comps. 4 bytes (descriptor version = 16), Descriptor (see See Descriptor structure)
          break;
        case 1066: // (Photoshop CS) Alternate Duotone Colors. 2 bytes (version = 1), 2 bytes count, following is repeated for each count: [ Color: 2 bytes for space followed by 4 * 2 byte color component ], following this is another 2 byte count, usually 256, followed by Lab colors one byte each for L, a, b. This resource is not read or used by Photoshop.
          break;
        case 1067: // (Photoshop CS)Alternate Spot Colors. 2 bytes (version = 1), 2 bytes channel count, following is repeated for each count: 4 bytes channel ID, Color: 2 bytes for space followed by 4 * 2 byte color component. This resource is not read or used by Photoshop.
          break;
        case 1069: // (Photoshop CS2) Layer Selection ID(s). 2 bytes count, following is repeated for each count: 4 bytes layer ID
          break;
        case 1070: // (Photoshop CS2) HDR Toning information
          break;
        case 1071: // (Photoshop CS2) Print info
          break;
        case 1072: // (Photoshop CS2) Layer Group(s) Enabled ID. 1 byte for each layer in the document, repeated by length of the resource. NOTE: Layer groups have start and end markers
          break;
        case 1073: // (Photoshop CS3) Color samplers resource. Also see ID 1038 for old format. See See Color samplers resource format.
          break;
        case 1074: // (Photoshop CS3) Measurement Scale. 4 bytes (descriptor version = 16), Descriptor (see See Descriptor structure)
          break;
        case 1075: // (Photoshop CS3) Timeline Information. 4 bytes (descriptor version = 16), Descriptor (see See Descriptor structure)
          break;
        case 1076: // (Photoshop CS3) Sheet Disclosure. 4 bytes (descriptor version = 16), Descriptor (see See Descriptor structure)
          break;
        case 1077: // (Photoshop CS3) DisplayInfo structure to support floating point clors. Also see ID 1007. See Appendix A in Photoshop API Guide.pdf .
          break;
        case 1078: // (Photoshop CS3) Onion Skins. 4 bytes (descriptor version = 16), Descriptor (see See Descriptor structure)
          break;
        case 1080: // (Photoshop CS4) Count Information. 4 bytes (descriptor version = 16), Descriptor (see See Descriptor structure) Information about the count in the document. See the Count Tool.
          break;
        case 1082: // (Photoshop CS5) Print Information. 4 bytes (descriptor version = 16), Descriptor (see See Descriptor structure) Information about the current print settings in the document. The color management options.
          break;
        case 1083: // (Photoshop CS5) Print Style. 4 bytes (descriptor version = 16), Descriptor (see See Descriptor structure) Information about the current print style in the document. The printing marks, labels, ornaments, etc.
          break;
        case 1084: // (Photoshop CS5) Macintosh NSPrintInfo. Variable OS specific info for Macintosh. NSPrintInfo. It is recommened that you do not interpret or use this data.
          break;
        case 1085: // (Photoshop CS5) Windows DEVMODE. Variable OS specific info for Windows. DEVMODE. It is recommened that you do not interpret or use this data.
          break;
        case 1086: // (Photoshop CS6) Auto Save File Path. Unicode string. It is recommened that you do not interpret or use this data.
          break;
        case 1087: // (Photoshop CS6) Auto Save Format. Unicode string. It is recommened that you do not interpret or use this data.
          break;
        case 1088: // (Photoshop CC) Path Selection State. 4 bytes (descriptor version = 16), Descriptor (see See Descriptor structure) Information about the current path selection state.
          break;
  /*
        case 2000-2997: // Path Information (saved paths). See See Path resource format.
  */
        case 2999: // Name of clipping path. See See Path resource format.
          break;
        case 3000: // (Photoshop CC) Origin Path Info. 4 bytes (descriptor version = 16), Descriptor (see See Descriptor structure) Information about the origin path data.
          break;
  /*
        case 4000-4999: // Plug-In resource(s). Resources added by a plug-in. See the plug-in API found in the SDK documentation
  */
        case 7000: // Image Ready variables. XML representation of variables definition
          break;
        case 7001: // Image Ready data sets
          break;
        case 7002: // Image Ready default selected state
          break;
        case 7003: // Image Ready 7 rollover expanded state
          break;
        case 7004: // Image Ready rollover expanded state
          break;
        case 7005: // Image Ready save layer settings
          break;
        case 7006: // Image Ready version
          break;
        case 8000: // (Photoshop CS3) Lightroom workflow, if present the document is in the middle of a Lightroom workflow.
          break;
        case 10000:
          // Print flags:
          // 2 bytes version ( = 1)
          // 1 byte center crop marks
          // 1 byte ( = 0)
          // 4 bytes bleed width value
          // 2 bytes bleed width scale
          break;
      }
    });
  };

});
