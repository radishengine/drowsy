define(['mac/roman'], function(macRoman) {
  
  'use strict';
  
  function open(item) {
    return item.getBytes().then(function(bytes) {
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var designLength = dv.getUint16(0, false);
      var pos = designLength;
      
      var obj = {
        top: dv.getInt16(pos, false),
        left: dv.getInt16(pos + 2, false),
        bottom: dv.getInt16(pos + 4, false),
        right: dv.getInt16(pos + 6, false),
        physicalStrength: bytes[pos + 8],
        physicalHP: bytes[pos + 9],
        naturalArmor: bytes[pos + 10],
        physicalAccuracy: bytes[pos + 11],
        spiritualStrength: bytes[pos + 12],
        spiritualHP: bytes[pos + 13],
        resistanceToMagic: bytes[pos + 14],
        spiritualAccuracy: bytes[pos + 15],
        runningSpeed: bytes[pos + 16],
        rejectsOffers: bytes[pos + 17],
        followsOpponent: bytes[pos + 18],
        // unknown: 1 byte
        // unknown: 4 bytes
        weaponDamage1: bytes[pos + 24],
        weaponDamage2: bytes[pos + 25],
        // unknown: 1 byte
        isPlayerCharacter: bytes[pos + 27],
        maximumCarriedObjects: bytes[pos + 28],
        returnTo: bytes[pos + 29],
        winningWeapons: bytes[pos + 30],
        winningMagic: bytes[pos + 31],
        winningRun: bytes[pos + 32],
        winningOffer: bytes[pos + 33],
        losingWeapons: bytes[pos + 34],
        losingMagic: bytes[pos + 35],
        losingRun: bytes[pos + 36],
        losingOffer: bytes[pos + 37],
        gender: bytes[pos + 38],
        properNoun: !!bytes[pos + 39],
      };
      pos += 40;
      obj.initialScene = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.nativeWeapon1 = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.operativeVerb1 = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.nativeWeapon2 = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.operativeVerb2 = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.initialComment = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.scoresHitComment = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.receivesHitComment = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.makesOfferComment = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.rejectsOfferComment = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.acceptsOfferComment = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.dyingWords = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.initialSound = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.scoresHitSound = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.receivesHitSound = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.dyingSound = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.weaponSound1 = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];
      obj.weaponSound2 = macRoman(bytes, pos + 1, bytes[pos]);
      pos += 1 + bytes[pos];

      item.setDataObject(obj);
    });
  }
  
  return open;
  
});
