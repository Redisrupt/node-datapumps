(function() {
  var Buffer, Group, Promise, Pump,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  Promise = require('bluebird');

  Pump = require('./Pump');

  Buffer = require('./Buffer');

  module.exports = Group = (function(superClass) {
    extend(Group, superClass);

    function Group() {
      Group.__super__.constructor.call(this);
      this._pumps = {};
      this._exposedBuffers = {};
    }

    Group.prototype.addPump = function(name, pump) {
      var pumpId;
      if (pump == null) {
        pump = null;
      }
      if (this._pumps[name] != null) {
        throw new Error('Pump already exists');
      }
      this._pumps[name] = pump != null ? pump : new Pump;
      pumpId = this._id != null ? this._id + "/" + name : name;
      this._pumps[name].id(pumpId);
      this._pumps[name].errorBuffer(this._errorBuffer);
      return this._pumps[name];
    };

    Group.prototype.pump = function(name) {
      if (this._pumps[name] == null) {
        throw new Error("Pump " + name + " does not exist");
      }
      return this._pumps[name];
    };

    Group.prototype.pumps = function() {
      return this._pumps;
    };

    Group.prototype.start = function() {
      var name, pump, ref;
      if (this._state !== Group.STOPPED) {
        throw new Error('Group already started');
      }
      this._state = Group.STARTED;
      this._registerErrorBufferEvents();
      ref = this._pumps;
      for (name in ref) {
        pump = ref[name];
        pump.errorBuffer(this._errorBuffer);
        pump.debugMode(this._debug);
      }
      this.run().then((function(_this) {
        return function() {
          return _this._endGroup();
        };
      })(this));
      return this;
    };

    Group.prototype._endGroup = function() {
      this._state = Group.ENDED;
      return this.emit('end');
    };

    Group.prototype.run = function() {
      var result;
      (result = this.runPumps())["catch"](function() {});
      return result;
    };

    Group.prototype.runPumps = function(pumps) {
      var finishPromises, i, len, pumpName;
      if (pumps == null) {
        pumps = null;
      }
      if (pumps == null) {
        pumps = this._getAllStoppedPumps();
      }
      if (typeof pumps === 'string') {
        pumps = [pumps];
      }
      finishPromises = [];
      for (i = 0, len = pumps.length; i < len; i++) {
        pumpName = pumps[i];
        finishPromises.push(this.pump(pumpName).start().whenFinished());
      }
      return Promise.all(finishPromises);
    };

    Group.prototype._getAllStoppedPumps = function() {
      var name, pump, ref, result;
      result = [];
      ref = this._pumps;
      for (name in ref) {
        pump = ref[name];
        if (pump.isStopped()) {
          result.push(name);
        }
      }
      return result;
    };

    Group.prototype.expose = function(exposedName, bufferPath) {
      if (this._exposedBuffers[exposedName] != null) {
        throw new Error("Already exposed a buffer with name " + exposedName);
      }
      return this._exposedBuffers[exposedName] = this._getBufferByPath(bufferPath);
    };

    Group.prototype._getBufferByPath = function(bufferPath) {
      var bufferName, bufferNames, pumpName, ref;
      ref = bufferPath.split('/'), pumpName = ref[0], bufferNames = 2 <= ref.length ? slice.call(ref, 1) : [];
      bufferName = bufferNames.length ? bufferNames.join('/') : 'output';
      return this.pump(pumpName).buffer(bufferName);
    };

    Group.prototype.buffer = function(name) {
      var ref, result;
      if (name == null) {
        name = 'output';
      }
      try {
        result = (ref = this._exposedBuffers[name]) != null ? ref : this._getBufferByPath(name);
      } catch (error) {

      }
      if (!result) {
        throw new Error("No such buffer: " + name);
      }
      return result;
    };

    Group.prototype.inputPump = function(pumpName) {
      if (pumpName == null) {
        pumpName = null;
      }
      if (pumpName == null) {
        return this._inputPump;
      }
      this._inputPump = this.pump(pumpName);
      return this;
    };

    Group.prototype.addInputPump = function(name, pump) {
      var result;
      if (pump == null) {
        pump = null;
      }
      result = this.addPump(name, pump);
      this.inputPump(name);
      return result;
    };

    Group.prototype.from = function(buffer) {
      if (buffer == null) {
        buffer = null;
      }
      if (this._inputPump == null) {
        throw new Error('Input pump is not set, use .inputPump to set it');
      }
      this._inputPump.from(buffer);
      return this;
    };

    Group.prototype.mixin = function(mixins) {
      if (this._inputPump == null) {
        throw new Error('Input pump is not set, use .inputPump to set it');
      }
      this._inputPump.mixin(mixins);
      return this;
    };

    Group.prototype.process = function() {
      throw new Error('Cannot call .process() on a group: data in a group is transformed by its pumps.');
    };

    Group.prototype.pause = function() {
      var name, pausePromises, pump, ref;
      if (this._state === Group.PAUSED) {
        return;
      }
      if (this._state !== Group.STARTED) {
        throw new Error('Cannot .pause() a group that is not pumping');
      }
      pausePromises = [];
      ref = this._pumps;
      for (name in ref) {
        pump = ref[name];
        if (pump.isStarted()) {
          pausePromises.push(pump.pause());
        }
      }
      return Promise.all(pausePromises).then((function(_this) {
        return function() {
          return _this._state = Group.PAUSED;
        };
      })(this));
    };

    Group.prototype.resume = function() {
      var name, pump, ref;
      if (this._state !== Group.PAUSED) {
        throw new Error('Cannot .resume() a group that is not paused');
      }
      this._state = Group.STARTED;
      ref = this._pumps;
      for (name in ref) {
        pump = ref[name];
        pump.resume();
      }
      return this;
    };

    Group.prototype.abort = function() {
      var name, pump;
      if (this._state !== Pump.STARTED) {
        throw new Error('Cannot .abort() a group that is not running');
      }
      return Promise.all((function() {
        var ref, results;
        ref = this._pumps;
        results = [];
        for (name in ref) {
          pump = ref[name];
          if (pump.isStarted()) {
            results.push(pump.abort());
          }
        }
        return results;
      }).call(this)).then((function(_this) {
        return function() {
          return _this._state = Group.ABORTED;
        };
      })(this));
    };

    Group.prototype.id = function(id) {
      var name, pump, ref;
      if (id == null) {
        id = null;
      }
      if (id === null) {
        return this._id;
      }
      this._id = id;
      ref = this._pumps;
      for (name in ref) {
        pump = ref[name];
        pump.id(this._id + "/" + name);
      }
      return this;
    };

    Group.prototype.debugMode = function(_debug) {
      this._debug = _debug;
      if (this._state !== Pump.STOPPED) {
        throw new Error('Cannot change debug mode after pump start');
      }
      return this;
    };

    return Group;

  })(Pump);

}).call(this);
