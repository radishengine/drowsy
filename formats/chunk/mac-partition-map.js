define(['mac/roman'], function(macRoman) {

  'use strict';
  
  function nullTerminate(str) {
    return str.replace(/\0.*/, '');
  }
  
  function PartitionRecordView(buffer, byteOffset) {
    this.dv = new DataView(buffer, byteOffset || 0, PartitionRecordView.byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset || 0, PartitionRecordView.byteLength);
  }
  PartitionRecordView.prototype = {
    get hasValidTag() {
      return String.fromCharCode.apply(null, this.bytes.subarray(0, 4)) === 'PM\0\0';
    },
    get totalPartitionCount() {
      return this.dv.getInt32(4, false);
    },
    get blockOffset() {
      return this.dv.getInt32(8, false);
    },
    get blockCount() {
      return this.dv.getInt32(12, false);
    },
    get name() {
      return nullTerminate(macRoman(this.bytes, 16, 32));
    },
    get type() {
      return nullTerminate(macRoman(this.bytes, 48, 32));
    },
    get partitionSegmentType() {
      var t = this.type.toLowerCase();
      switch (t) {
        default: return 'volume/unknown; type=' + t; break;
        case 'apple_boot': return 'boot/mac; type=openfirmware-3'; break;
        case 'apple_boot_raid': return 'boot/mac; type=raid'; break;
        case 'apple_bootstrap': return 'boot/mac; type=new-world'; break;
        case 'apple_driver': return 'volume/mac-drivers'; break;
        case 'apple_driver43': return 'volume/mac-drivers; for=scsi-manager-4.3'; break;
        case 'apple_driver43_cd': return 'volume/mac-drivers; for=scsi-manager-4.3-cd'; break;
        case 'apple_driver_ata': return 'volume/mac-drivers; for=ata'; break;
        case 'apple_driver_atapi': return 'volume/mac-drivers; for=atapi'; break;
        case 'apple_driver_iokit': return 'volume/mac-drivers; for=io-kit';
        case 'apple_driver_openfirmware': return 'volume/mac-drivers; for=openfirmware';
        case 'apple_extra': return 'application/octet-stream; unused=true';
        case 'apple_free': return 'application/octet-stream; unused=true';
        case 'apple_fwdriver': return 'volume/mac-drivers; for=firewire';
        case 'apple_hfx': return 'volume/ambiguous; possible=hfs,hfsplus,fat';
        case 'apple_hfsx': return 'volume/hfsplus; variant=no-wrapper';
        case 'apple_loader': return 'boot/mac; type=xcoff';
        case 'apple_mfs': return 'volume/mac; filesystem=mfs'; // macintosh 128K in 1984
        case 'apple_partition_map': return 'chunk/apple-partition-map; count=' + this.blockCount;
        case 'apple_patches': return 'volume/mac-patches';
        case 'apple_prodos': return 'volume/prodos';
        case 'apple_raid': return 'volume/apple-raid';
        case 'apple_rhapsody_ufs': return 'volume/unix-file-system; for=apple-rhapsody';
        case 'apple_scratch': return 'application/octet-stream; unused=true';
        case 'apple_second': return 'boot/mac; stage=second';
        case 'apple_ufs': return 'volume/unix-file-system; for=mac';
        case 'apple_unix_svr2': return 'volume/system-v-release-2; for=mac';
        case 'apple_void': return 'application/octet-stream; unused=true';
        case 'be_bfs': return 'volume/beos';
      }
    },
    get status() {
      return this.dv.getInt32(88, false);
    },
    get dataArea() {
      var blockCount = this.dv.getInt32(84, false);
      if (!blockCount) return null;
      return {
        blockCount: blockCount,
        blockOffset: this.dv.getInt32(80, false),
      };
    },
    get bootCode() {
      var byteLength = this.dv.getInt32(96, false);
      if (!byteLength) return null;
      return {
        byteLength: byteLength,
        blockOffset: this.dv.getInt32(92, false),
        loadAddress: this.dv.getInt32(100, false),
        entryPoint: this.dv.getInt32(108, false),
        checksum: this.dv.getInt32(116, false),
      };
    },
    get processorType() {
      return nullTerminate(macRoman(this.bytes, 124, 16));
    },
  };
  
  return {
    getStructView: function() {
      return PartitionRecordView;
    },
  };

});
