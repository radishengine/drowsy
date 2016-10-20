define(function() {

  function HeaderView(buffer, byteOffset, byteLength) {
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.dv = new DataView(buffer, byteOffset, byteLength);
  }
  HeaderView.prototype = {
    get signature() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4));
    },
    get hasValidSignature() {
      return this.signature === 'MThd';
    },
    get dataLength() {
      return this.dv.getUint32(4, false);
    },
    get hasValidDataLength() {
      return this.dataLength === 6;
    },
    get format() {
      var value = this.dv.getUint16(8, false);
      switch (value) {
        case 0: return 'singleTrack';
        case 1: return 'multipleTrack';
        case 2: return 'multipleSong';
        default: return value;
      }
    },
    get trackCount() {
      return this.dv.getUint16(10, false);
    },
    get deltaTimeValue() {
      return Math.abs(this.getUint16(12, false));
    },
    get deltaTimeUnits() {
      return this.getUint16(12, false) >= 0 ? 'ticksPerBeat' : 'smpte';
    },
  };
  HeaderView.byteLength = 8 + 6;
  
  function trackToSquareScript(buffer, byteOffset, byteLength) {
    var raw = new Uint8Array(buffer, byteOffset, byteLength);
    var steps = [];
    var pos = 0;
    function readNumber() {
      var value = 0;
      var byte;
      do {
        value = (value << 7) | ((byte = raw[pos++]) & 0x7f);
      } while (byte & 0x80);
      return value;
    }
    function readControlModeChange(channel, setting) {
      if (setting < 0x40) {
        var value = raw[pos++], mask;
        if (setting & 0x20) {
          mask = 0x3f80;
          value <<= 7;
          setting &= 0x1F;
        }
        else {
          mask = 0x7f;
        }
        switch (setting) {
          case 1: setting = 'modulation-wheel'; break;
          case 2: setting = 'breath-control'; break;
          case 4: setting = 'foot-control'; break;
          case 5: setting = 'portamento-time'; break;
          case 6: setting = 'data-entry'; break;
          case 7: setting = 'main-volume'; break;
        }
        return ['continuous', channel, setting, mask, value];
      }
      if (setting < 0x60) {
        var value = raw[pos++] !== 0;
        setting -= 0x40;
        switch (setting) {
          case 0x00: setting = 'damper-pedal'; break;
          case 0x01: setting = 'portamento'; break;
          case 0x02: setting = 'sustento'; break;
          case 0x03: setting = 'soft-pedal'; break;
        }
        return ['toggle', channel, setting, value];
      }
      switch (setting) {
        case 0x60:
        case 0x61:
          var command = setting === 0x60 ? 'data-entry+1' : 'data-entry-1';
          if (raw[pos++] !== 127) {
            throw new Error('unexpected value for ' + command);
          }
          return [command, channel];
        case 0x7A:
          return ['toggle', channel, 'local-control', raw[pos++] !== 0];
        case 0x7B:
          if (raw[pos++] !== 0) {
            throw new Error('unexpected value for all-notes-off');
          }
          return ['all-notes-off', channel];
        case 0x7C:
          if (raw[pos++] !== 0) {
            throw new Error('unexpected value for omni-mode-off');
          }
          return ['omni-mode-off', channel];
        case 0x7D:
          if (raw[pos++] !== 0) {
            throw new Error('unexpected value for omni-mode-on');
          }
          return ['omni-mode-on', channel];
        case 0x7E:
          return ['poly-mode-on-off', channel, raw[pos++]];
        case 0x7F:
          if (raw[pos++] !== 0) {
            throw new Error('unexpected value for poly-mode-on');
          }
          return ['poly-mode-on', channel];
      }
      if (setting >= 0x80) {
        throw new Error('unknown setting');
      }
      return ['setting', channel, setting];
    }
    readTrack: while (pos < raw.length) {
      var delta = readNumber();
      var event = raw[pos++];
      if (event < 0x80) {
        throw new Error('badly-formed track data');
      }
      var hi = (event >>> 4) & 0x7, lo = event & 0xf;
      switch (hi) {
        case 0x0:
        case 0x1:
          var channel = lo + 1;
          var note = raw[pos++];
          var velocity = raw[pos++];
          var command = hi === 0x9 ? 'note-on' : 'note-off';
          steps.push([command, channel, note, velocity]);
          continue readTrack;
        case 0x2:
        case 0x5:
          var channel = lo + 1;
          var note = raw[pos++];
          var pressure = raw[pos++];
          var command = hi === 0xA ? 'polyphonic-aftertouch' : 'aftertouch';
          steps.push([command, channel, note, pressure]);
          continue readTrack;
        case 0x3:
          var channel = lo + 1;
          steps.push(readControlModeChange(channel, raw[pos++])));
          continue readTrack;
        case 0x4:
          var channel = lo + 1;
          var programNumber = raw[pos++];
          steps.push(['program-change', channel, programNumber]);
          continue readTrack;
        case 0x6:
          var channel = lo + 1;
          var wheel = raw[pos++];
          wheel |= raw[pos++] << 7;
          steps.push(['pitch-wheel-range', channel, wheel]);
          continue readTrack;
        case 0x7:
          break; // fall through to next switch
      }
      switch (lo) {
        case 0x0:
        case 0x7:
          // system exclusive mode
          var systemExclusiveLength = readNumber();
          var step = ['system-exclusive'];
          if (event === 0xF0) step.push(0xF0);
          step = step.concat(raw.subarray(pos, pos + systemExclusiveLength));
          steps.push(step);
          pos += systemExclusiveLength;
          continue readTrack;
        case 0x1:
        case 0x4:
        case 0x5:
          steps.push(['system-common', event.toString(16)]);
          continue readTrack;
        case 0x2:
          var pointer = raw[pos++];
          pointer |= raw[pos++] << 8;
          steps.push(['system-common-song-position-pointer', pointer]);
          continue readTrack;
        case 0x3:
          steps.push(['system-common-song-select', raw[pos++]]);
          continue readTrack;
        case 0x6:
          steps.push(['system-common-tune-request']);
          continue readTrack;
        case 0x8:
          steps.push(['system-real-time-timing-clock']);
          continue readTrack;
        case 0x9:
        case 0xD:
          steps.push(['system-real-time-undefined']);
          continue readTrack;
        case 0xA:
          steps.push(['system-real-time-start']);
          continue readTrack;
        case 0xB:
          steps.push(['system-real-time-continue']);
          continue readTrack;
        case 0xC:
          steps.push(['system-real-time-stop']);
          continue readTrack;
        case 0xE:
          steps.push(['system-real-time-active-sensing']);
          continue readTrack;
        case 0xF:
          break; // fall through to next switch
      }
      // meta events
      var metaContextChannel = null;
      do {
        event = raw[pos++];
        var data = raw.subarray(pos, pos + readNumber());
        pos += data.length;
        switch (event) {
          case 0x00:
            steps.push(['sequence-number', metaContextChannel, data[0] | (data[1] << 8)]);
            break;
          case 0x01:
            steps.push(['text', metaContextChannel, String.fromCharCode.apply(null, data)]);
            break;
          case 0x02:
            steps.push(['copyright', metaContextChannel, String.fromCharCode.apply(null, data)]);
            break;
          case 0x03:
            steps.push(['name', metaContextChannel, String.fromCharCode.apply(null, data)]);
            break;
          case 0x04:
            steps.push(['instrument-name', metaContextChannel, String.fromCharCode.apply(null, data)]);
            break;
          case 0x05:
            steps.push(['lyric-text', metaContextChannel, String.fromCharCode.apply(null, data)]);
            break;
          case 0x06:
            steps.push(['marker-text', metaContextChannel, String.fromCharCode.apply(null, data)]);
            break;
          case 0x07:
            steps.push(['cue-point', metaContextChannel, String.fromCharCode.apply(null, data)]);
            break;
          case 0x20:
            metaContextChannel = data[0];
            break;
          case 0x2F:
            // end of track
            break readTrack;
          case 0x51:
            steps.push(['set-tempo', metaContextChannel, data[0] << 16 | data[1] << 8 | data[2]]);
            break;
          case 0x54:
            // hours minutes seconds frames fractionalFrames
            steps.push(['smpte-offset', metaContextChannel].concat(data));
            break;
          case 0x58:
            // numerator, denominator, MIDI clocks/metronome click, notated 32nd-notes in MIDI quarter-note
            steps.push(['time-signature', metaContextChannel].concat(data));
            break;
          case 0x59:
            // -7 (7 flats) .. 0 (key of C) .. 7 (7 sharps), 0=major key 1=minor key
            steps.push(['key-signature', metaContextChannel].concat(data));
            break;
          case 0x7F:
            steps.push(['sequencer-specific', metaContextChannel, String.fromCharCode.apply(null, data)]);
            break;
          default:
            steps.push(['meta', event, metaContextChannel, String.fromCharCode.apply(null, data)]);
        }
      } while (pos < raw.length && raw[pos++] === 0xFF);
      pos--;
    }
    return steps;
  }

  return {
    HeaderView: HeaderView,
    getStructView: function(segment) {
      switch (segment.getTypeParameter('which')) {
        case 'header': return HeaderView;
        default: return null;
      }
    },
    trackToSquareScript: trackToSquareScript,
  };

});
