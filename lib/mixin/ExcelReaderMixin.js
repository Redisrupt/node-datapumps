(function() {
  var Buffer, ExcelReaderMixin, convertSheetToJson, readFile, ref, ref1;

  ref = require('xlsx'), readFile = ref.readFile, (ref1 = ref.utils, convertSheetToJson = ref1.sheet_to_json);

  Buffer = require('../Buffer');

  ExcelReaderMixin = function(arg) {
    var columnMapping, path, worksheet;
    worksheet = arg.worksheet, columnMapping = arg.columnMapping, path = arg.path;
    return function(target) {
      var buffer, content, data, i, len, mapColumnNames, ref2, workbook;
      if (path != null) {
        workbook = readFile(path);
        worksheet = workbook.Sheets[worksheet];
      }
      if (worksheet == null) {
        throw new Error('worksheet property is required for ExcelReaderMixin');
      }
      target._excel = {
        worksheet: worksheet,
        columnMapping: columnMapping
      };
      mapColumnNames = function(data) {
        var from, result, to;
        result = {};
        for (from in columnMapping) {
          to = columnMapping[from];
          result[to] = data[from];
        }
        return result;
      };
      content = [];
      if (columnMapping) {
        ref2 = convertSheetToJson(worksheet);
        for (i = 0, len = ref2.length; i < len; i++) {
          data = ref2[i];
          content.push(mapColumnNames(data));
        }
      } else {
        content = convertSheetToJson(worksheet);
      }
      buffer = new Buffer({
        content: content
      });
      target.from(buffer);
      return buffer.seal();
    };
  };

  module.exports = ExcelReaderMixin;

}).call(this);
