define(['mac/roman'], function(macintoshRoman) {

  'use strict';
  
  function getRegionName(code) {
    switch(code) {
      case 0: return 'US';
      case 1: return 'FR';
      case 2: return 'GB';
      case 3: return 'DE';
      case 4: return 'IT';
      case 5: return 'NL';
      case 6: return 'BE/LU';
      case 7: return 'SE';
      case 8: return 'ES';
      case 9: return 'DK';
      case 10: return 'PT';
      case 11: return 'fr-CA';
      case 12: return 'NO';
      case 13: return 'IL';
      case 14: return 'JP';
      case 15: return 'AU';
      case 16: return 'ar';
      case 17: return 'FI';
      case 18: return 'fr-CH';
      case 19: return 'de-CH';
      case 20: return 'GR';
      case 21: return 'IS';
      case 22: return 'MT';
      case 23: return 'CY';
      case 24: return 'TR';
      case 25: return 'hr-BA';
      case 33: return 'hi-IN';
      case 34: return 'ur-PK';
      case 41: return 'LT';
      case 42: return 'PL';
      case 43: return 'HU';
      case 44: return 'EE';
      case 45: return 'LV';
      case 46: return 'FI-10'; // Lapland
      case 47: return 'FO';
      case 48: return 'IR';
      case 49: return 'RU';
      case 50: return 'IE';
      case 51: return 'KR';
      case 52: return 'CN';
      case 53: return 'TW';
      case 54: return 'TH';
      default: return code;
    }
  }
  
  return function(item) {
    return item.getBytes().then(function(bytes) {
      var dataObject = {
        major: bytes[0],
        minor: bytes[1],
        developmentStage: (function(v) {
          switch(v) {
            case 0x20: return 'development';
            case 0x40: return 'alpha';
            case 0x60: return 'beta';
            case 0x80: return 'release';
            default: return v;
          }
        })(bytes[2]),
        prereleaseRevisionLevel: bytes[3],
        region: getRegionName((bytes[4] << 8) | bytes[5]),
      };
      dataObject.versionNumber = macintoshRoman(bytes, 7, bytes[6]);
      var pos = 7 + bytes[6];
      dataObject.versionMessage = macintoshRoman(bytes, pos + 1, bytes[pos]);
      item.setDataObject(dataObject);
    });
  };

});
