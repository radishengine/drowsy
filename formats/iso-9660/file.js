define(['Format', 'formats/byExtension'], function(Format, formatsByExtension) {

  'use strict';
  
  const RECORD_FMT = Format('iso-9660/chunk', {which:'file'});
  
  return {
    split: function split(segment, entries) {
      var recordSegment = (segment.format.parameters['record-segment'] || '').match(/^\s*(\d+)\s*,\s*(\d+)\s*$/);
      if (!recordSegment) {
        return Promise.reject('missing or invalid record-segment parameter');
      }
      recordSegment = segment.getSegment(RECORD_FMT, +recordSegment[1], +recordSegment[2]);
      entries.add(recordSegment);
      return recordSegment.getStruct().then(function(record) {
        var ext = record.name.match(/\.([^\.]+)$/);
        ext = ext ? ext[1].toString() : '';
        var dataFormat = formatsByExtension[ext] || Format.generic;
        var dataSegment = (segment.format.parameters['data-segment'] || '').match(/^\s*(\d+)\s*,\s*(\d+)\s*$/);
        if (!dataSegment) {
          return Promise.reject('missing or invalid data-segment parameter');
        }
        dataSegment = segment.getSegment(dataFormat, +dataSegment[1], +dataSegment[2]);
        entries.add(dataSegment);
      });
    },
    getDisplayName: function(segment) {
      return segment.split(RECORD_FMT).then(function(records) {
        if (records.length === 0) {
          return Promise.reject('split failed to find info record');
        }
        return records[0].getStruct().then(function(record) {
          return record.name;
        });
      });
    },
    getTimestamp: function(segment) {
      return segment.split(RECORD_FMT).then(function(records) {
        if (records.length === 0) {
          return Promise.reject('split failed to find info record');
        }
        return records[0].getStruct().then(function(record) {
          return record.modifiedAt || record.createdAt;
        });
      });
    },
  };

});
