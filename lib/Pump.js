(function() {
  var Buffer, BufferDebugMixin, EventEmitter, Promise, Pump,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;

  Promise = require('bluebird');

  Buffer = require('./Buffer');

  BufferDebugMixin = require('./mixin/BufferDebugMixin');

  module.exports = Pump = (function(superClass) {
    extend(Pump, superClass);

    Pump.STOPPED = 0;

    Pump.STARTED = 1;

    Pump.PAUSED = 2;

    Pump.ENDED = 3;

    Pump.ABORTED = 3;

    function Pump() {
      this._state = Pump.STOPPED;
      this._from = null;
      this._id = null;
      this._errorBuffer = new Buffer;
      this._debug = false;
      this.buffers({
        output: new Buffer
      });
    }

    Pump.prototype.id = function(id) {
      if (id == null) {
        id = null;
      }
      if (id === null) {
        return this._id;
      }
      this._id = id;
      return this;
    };

    Pump.prototype.from = function(buffer) {
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
        this._from = buffer;
      } else if (buffer instanceof Pump) {
        this._from = buffer.buffer();
      } else if (buffer instanceof require('stream')) {
        this._from = new Buffer({
          size: 1000
        });
        buffer.on('data', (function(_this) {
          return function(data) {
            return _this._from.write(data);
          };
        })(this));
        buffer.on('end', (function(_this) {
          return function() {
            return _this._from.seal();
          };
        })(this));
        buffer.on('error', (function(_this) {
          return function(err) {
            return _this.writeError(err);
          };
        })(this));
        this._from.on('full', function() {
          return buffer.pause();
        });
        this._from.on('release', function() {
          return buffer.resume();
        });
      } else if (buffer instanceof Array) {
        this._from = new Buffer({
          content: buffer.slice(0),
          sealed: true
        });
      } else {
        throw new Error('Argument must be datapumps.Buffer or stream');
      }
      this._from.on('end', (function(_this) {
        return function() {
          return _this.sourceEnded();
        };
      })(this));
      return this;
    };

    Pump.prototype.writeError = function(err) {
      if (this._errorBuffer.isFull()) {
        return;
      }
      this._errorBuffer.write({
        error: err,
        pump: this._id
      });
      return this;
    };

    Pump.prototype.sourceEnded = function() {
      if (this.currentRead) {
        return this.currentRead.cancel();
      }
    };

    Pump.prototype.buffers = function(buffers) {
      if (buffers == null) {
        buffers = null;
      }
      if (buffers === null) {
        return this._buffers;
      }
      if (this._state === Pump.STARTED) {
        throw new Error('Cannot change output buffers after pumping has been started');
      }
      this._buffers = buffers;
      return this;
    };

    Pump.prototype.buffer = function(name, buffer) {
      if (name == null) {
        name = 'output';
      }
      if (buffer == null) {
        buffer = null;
      }
      if (buffer === null) {
        if (!this._buffers[name]) {
          throw new Error("No such buffer: " + name);
        }
        return this._buffers[name];
      } else {
        if (this._state === Pump.STARTED) {
          throw new Error('Cannot change output buffers after pumping has been started');
        }
        if (!(buffer instanceof Buffer)) {
          throw new Error('buffer must be a datapumps.Buffer');
        }
        this._buffers[name] = buffer;
        return this;
      }
    };

    Pump.prototype.to = function(pump, bufferName) {
      pump.from(this.buffer(bufferName));
      return this;
    };

    Pump.prototype.start = function() {
      var buffer, name, ref, ref1;
      if (!this._from) {
        throw new Error('Source is not configured');
      }
      if (this._state !== Pump.STOPPED) {
        throw new Error('Pump is already started');
      }
      if (this._debug) {
        console.log(((new Date()).toISOString()) + " [" + ((ref = this._id) != null ? ref : '(root)') + "] Pump started");
      }
      this._state = Pump.STARTED;
      this._registerErrorBufferEvents();
      ref1 = this._buffers;
      for (name in ref1) {
        buffer = ref1[name];
        buffer.on('end', this._outputBufferEnded.bind(this));
      }
      this._pump();
      return this;
    };

    Pump.prototype._registerErrorBufferEvents = function() {
      return this._errorBuffer.on('full', (function(_this) {
        return function() {
          if (_this._state === Pump.STARTED) {
            return _this.abort().then(function() {
              return _this.emit('error');
            });
          }
        };
      })(this));
    };

    Pump.prototype.abort = function() {
      var ref;
      if (this._state !== Pump.STARTED) {
        throw new Error('Cannot .abort() a pump that is not running');
      }
      if ((ref = this._processing) != null ? ref.isPending() : void 0) {
        this._processing.cancel();
      }
      return this.pause().then((function(_this) {
        return function() {
          return _this._state = Pump.ABORTED;
        };
      })(this));
    };

    Pump.prototype._outputBufferEnded = function() {
      var allEnded, buffer, name, ref, ref1;
      allEnded = true;
      ref = this._buffers;
      for (name in ref) {
        buffer = ref[name];
        if (!buffer.isEnded()) {
          allEnded = false;
        }
      }
      if (!allEnded) {
        return;
      }
      this._state = Pump.ENDED;
      if (this._debug) {
        console.log(((new Date()).toISOString()) + " [" + ((ref1 = this._id) != null ? ref1 : '(root)') + "] Pump ended");
      }
      return this.emit('end');
    };

    Pump.prototype._pump = function() {
      if (this._from.isEnded()) {
        return this.sealOutputBuffers();
      }
      if (this._state === Pump.PAUSED) {
        return;
      }
      return (this.currentRead = this._from.readAsync()).cancellable().then((function(_this) {
        return function(data) {
          var ref;
          _this.currentRead = null;
          _this._processing = _this._process(data, _this);
          if (!(((ref = _this._processing) != null ? ref.then : void 0) instanceof Function)) {
            _this._processing = void 0;
            throw new Error(".process() did not return a Promise");
          }
          _this._processing = Promise.resolve(_this._processing);
          return _this._processing.cancellable();
        };
      })(this))["catch"](Promise.CancellationError, function() {})["catch"]((function(_this) {
        return function(err) {
          return _this.writeError(err);
        };
      })(this)).done((function(_this) {
        return function() {
          return _this._pump();
        };
      })(this));
    };

    Pump.prototype.sealOutputBuffers = function() {
      var buffer, name, ref, results;
      ref = this._buffers;
      results = [];
      for (name in ref) {
        buffer = ref[name];
        if (!buffer.isSealed()) {
          results.push(buffer.seal());
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Pump.prototype._process = function(data) {
      return this.copy(data);
    };

    Pump.prototype.copy = function(data, buffers) {
      var buffer;
      if (buffers == null) {
        buffers = null;
      }
      if (buffers == null) {
        buffers = ['output'];
      }
      if (typeof buffers === 'string') {
        buffers = [buffers];
      }
      if (!Array.isArray(buffers)) {
        throw new Error('buffers must be an array of buffer names or a single buffers name');
      }
      if (buffers.length === 1) {
        return this.buffer(buffers[0]).writeAsync(data);
      } else {
        return Promise.all((function() {
          var i, len, results;
          results = [];
          for (i = 0, len = buffers.length; i < len; i++) {
            buffer = buffers[i];
            results.push(this.buffer(buffer).writeAsync(data));
          }
          return results;
        }).call(this));
      }
    };

    Pump.prototype.process = function(fn) {
      if (typeof fn !== 'function') {
        throw new Error('.process() argument must be a Promise returning function ');
      }
      this._process = fn;
      return this;
    };

    Pump.prototype.mixin = function(mixins) {
      var i, len, mixin;
      mixins = Array.isArray(mixins) ? mixins : [mixins];
      for (i = 0, len = mixins.length; i < len; i++) {
        mixin = mixins[i];
        mixin(this);
      }
      return this;
    };

    Pump.prototype.isStopped = function() {
      return this._state === Pump.STOPPED;
    };

    Pump.prototype.isStarted = function() {
      return this._state === Pump.STARTED;
    };

    Pump.prototype.isPaused = function() {
      return this._state === Pump.PAUSED;
    };

    Pump.prototype.isEnded = function() {
      return this._state === Pump.ENDED;
    };

    Pump.prototype.createBuffer = function(options) {
      if (options == null) {
        options = {};
      }
      return new Buffer(options);
    };

    Pump.prototype.errorBuffer = function(buffer) {
      if (buffer == null) {
        buffer = null;
      }
      if (buffer === null) {
        return this._errorBuffer;
      }
      this._errorBuffer = buffer;
      return this;
    };

    Pump.prototype.pause = function() {
      var ref;
      if (this._state === Pump.PAUSED) {
        return;
      }
      if (this._state !== Pump.STARTED) {
        throw new Error('Cannot .pause() a pump that is not running');
      }
      if ((ref = this._processing) != null ? ref.isPending() : void 0) {
        return this._processing.then((function(_this) {
          return function() {
            return _this._state = Pump.PAUSED;
          };
        })(this));
      } else {
        this._state = Pump.PAUSED;
        return Promise.resolve();
      }
    };

    Pump.prototype.resume = function() {
      if (this._state !== Pump.PAUSED) {
        throw new Error('Cannot .resume() a pump that is not paused');
      }
      this._state = Pump.STARTED;
      this._pump();
      return this;
    };

    Pump.prototype.whenFinished = function() {
      if (this.isEnded()) {
        return Promise.resolve();
      }
      return new Promise((function(_this) {
        return function(resolve, reject) {
          _this.on('end', function() {
            return resolve();
          });
          return _this.on('error', function() {
            return reject('Pumping failed. See .errorBuffer() contents for error messages');
          });
        };
      })(this));
    };

    Pump.prototype.logErrorsToConsole = function() {
      this.errorBuffer().on('write', (function(_this) {
        return function(errorRecord) {
          var name, ref, ref1;
          name = (ref = errorRecord.pump) != null ? ref : '(root)';
          if (_this._debug) {
            console.log("Error in pump " + name + ":");
            return console.log((ref1 = errorRecord.error.stack) != null ? ref1 : errorRecord.error);
          } else {
            return console.log("Error in pump " + name + ": " + errorRecord.error);
          }
        };
      })(this));
      return this;
    };

    Pump.prototype.debug = function() {
      this.debugMode(true);
      return this;
    };

    Pump.prototype.debugMode = function(_debug) {
      this._debug = _debug;
      if (this._state !== Pump.STOPPED) {
        throw new Error('Cannot change debug mode after pump start');
      }
      if (this._debug) {
        this.mixin(BufferDebugMixin);
      }
      return this;
    };

    Pump.prototype.run = function() {
      return this.start().whenFinished();
    };

    return Pump;

  })(EventEmitter);

}).call(this);
