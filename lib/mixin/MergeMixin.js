(function() {
  var Buffer, MergeHelperPump, MergeMixin, Pump,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Pump = require('../Pump');

  Buffer = require('../Buffer');

  MergeHelperPump = (function(superClass) {
    extend(MergeHelperPump, superClass);

    function MergeHelperPump() {
      return MergeHelperPump.__super__.constructor.apply(this, arguments);
    }

    MergeHelperPump.prototype.sealOutputBuffers = function() {
      return this.emit('sealOutput');
    };

    return MergeHelperPump;

  })(Pump);

  module.exports = MergeMixin = function(pump) {
    pump.from(new Buffer());
    pump._fromBuffers = [];
    return pump.from = function(buffer) {
      var helperPump, sourceBuffer;
      if (buffer == null) {
        buffer = null;
      }
      if (buffer === null) {
        return this._from;
      }
      if (this._state === Pump.STARTED) {
        throw new Error('Cannot change source buffer after pumping has been started');
      }
      if (buffer instanceof Buffer) {
        sourceBuffer = buffer;
      } else if (buffer instanceof Pump) {
        sourceBuffer = buffer.buffer();
      } else if (buffer instanceof require('stream')) {
        sourceBuffer = new Buffer({
          size: 1000
        });
        buffer.on('data', (function(_this) {
          return function(data) {
            return sourceBuffer.write(data);
          };
        })(this));
        buffer.on('end', (function(_this) {
          return function() {
            return sourceBuffer.seal();
          };
        })(this));
        buffer.on('error', (function(_this) {
          return function(err) {
            return _this.writeError(err);
          };
        })(this));
        sourceBuffer.on('full', function() {
          return buffer.pause();
        });
        sourceBuffer.on('release', function() {
          return buffer.resume();
        });
      } else {
        throw new Error('Argument must be datapumps.Buffer or stream');
      }
      this._fromBuffers.push(sourceBuffer);
      (helperPump = new MergeHelperPump()).from(sourceBuffer).buffer('output', this._from).process(function(data) {
        return this.copy(data);
      });
      helperPump.on('sealOutput', function() {
        var allEnded, i, len, ref;
        allEnded = true;
        ref = pump._fromBuffers;
        for (i = 0, len = ref.length; i < len; i++) {
          buffer = ref[i];
          if (!buffer.isEnded()) {
            allEnded = false;
          }
        }
        if (!allEnded) {
          return;
        }
        if (!pump._from.isSealed()) {
          return pump._from.seal();
        }
      }).start();
      return this;
    };
  };

}).call(this);
