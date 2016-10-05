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
      var t = this.type;
      switch (t) {
        default: return 'volume/unknown; type=' + t.toLowerCase(); break;
        case 'Apple_Boot': return 'boot/mac; type=openfirmware-3'; break;
        case 'Apple_Boot_RAID': return 'boot/mac; type=raid'; break;
        case 'Apple_Bootstrap': return 'boot/mac; type=new-world'; break;
        case 'Apple_Driver': return 'volume/mac-drivers'; break;
        case 'Apple_Driver43': return 'volume/mac-drivers; for=scsi-manager-4.3'; break;
        case 'Apple_Driver43_CD': return 'volume/mac-drivers; for=scsi-manager-4.3-cd'; break;
        case 'Apple_Driver_ATA': return 'volume/mac-drivers; for=ata'; break;
        case 'Apple_Driver_ATAPI': return 'volume/mac-drivers; for=atapi'; break;
        case 'Apple_Driver_IOKit': return 'volume/mac-drivers; for=io-kit';
        case 'Apple_Driver_OpenFirmware': return 'volume/mac-drivers; for=openfirmware';
        case 'Apple_Extra': return 'application/octet-stream; unused=true';
        case 'Apple_Free': return 'application/octet-stream; unused=true';
        case 'Apple_FWDriver': return 'volume/mac-drivers; for=firewire';
        case 'Apple_HFS': return 'volume/ambiguous; possible=hfs,hfsplus,fat';
        case 'Apple_HFSX': return 'volume/hfsplus; variant=no-wrapper';
        case 'Apple_Loader': return 'boot/mac; type=xcoff';
        case 'Apple_MFS': return 'volume/mac; filesystem=mfs'; // macintosh 128K in 1984
        case 'Apple_Partition_Map': return 'chunk/apple-partition-map; count=' + this.blockCount;
        case 'Apple_Patches': return 'volume/mac-patches';
        case 'Apple_ProDOS': return 'volume/prodos';
        case 'Apple_RAID': return 'volume/apple-raid';
        case 'Apple_Rhapsody_UFS': return 'volume/unix-file-system; for=apple-rhapsody';
        case 'Apple_Scratch': return 'application/octet-stream; unused=true';
        case 'Apple_Second': return 'boot/mac; stage=second';
        case 'Apple_UFS': return 'volume/unix-file-system; for=mac';
        case 'Apple_UNIX_SVR2': return 'volume/system-v-release-2; for=mac';
        case 'Apple_Void': return 'application/octet-stream; unused=true';
        case 'Be_BFS': return 'volume/beos';
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
