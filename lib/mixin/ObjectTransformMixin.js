(function() {
  var objectTransformMixin;

  objectTransformMixin = function() {
    return function(target) {
      target.propertiesToLowerCase = function(data) {
        var prop, result, value;
        result = {};
        for (prop in data) {
          value = data[prop];
          result[prop.toLowerCase()] = value;
        }
        return result;
      };
      target.requireProperty = function(obj, properties) {
        var i, j, len, len1, property, result;
        properties = Array.isArray(properties) ? properties : [properties];
        for (i = 0, len = properties.length; i < len; i++) {
          property = properties[i];
          if (obj[property] == null) {
            throw new Error('Missing property: ' + property);
          }
        }
        if (properties.length === 1) {
          return obj[properties[0]];
        } else {
          result = {};
          for (j = 0, len1 = properties.length; j < len1; j++) {
            property = properties[j];
            result[property] = obj[property];
          }
          return result;
        }
      };
      return target.boolValueOf = function(obj) {
        return !(obj === null || obj === void 0 || obj === false || obj === 'off' || obj === 'false' || obj === 0 || obj === 'no');
      };
    };
  };

  module.exports = objectTransformMixin;

}).call(this);
