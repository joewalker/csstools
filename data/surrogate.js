
/**
 * Construct a new Surrogate that passes message to another Surrogate via
 * handler.postMessage(data); and handler.on('message', data);
 */
function Surrogate(handler, options) {
  options = options || {};
  this.logLevel = options.logLevel || Surrogate.LogLevel.SILENT;
  this._name = options.name ? '(' + options.name + ') ' : '';
  this._defaultErrBack = options.defaultErrBack;

  if (handler === "loopback") {
    this._createLoopback();
  }
  else {
    this.handler = handler;
    handler.on('message', this._routeMessage.bind(this));
  }
}
(function() {
  /**
   * Control logging verbosity. The default is SILENT
   */
  Surrogate.LogLevel = {
    SILENT: 0,  // No output at all
    ERROR: 1,   // Output when something is obviously broken
    WARNING: 2, // Output when something might be broken
    DEBUG: 3    // Output to say what's going on
  };

  /**
   * We invent a unique ID for each function call.
   * At some point this is going to overflow, however I suspect that the sun
   * will burn out first. TODO: Compare expected overflow time with sun age.
   */
  var nextCallId = 1;

  /**
   * An array of the outstanding calls.
   * This could be a handy place to do debugging
   */
  var calls = [];

  /**
   * Send the request either to the termination point or the execution point
   */
  Surrogate.prototype._routeMessage = function(data) {
    if (data.request) {
      this._executeCall(data);
    }
    else {
      this._endRemoteCall(data);
    }
  };

  /**
   * If we need to have a in-page Surrogate to allow us to mock a remote
   * boundary, we can use Surrogate.loopback as the handler
   */
  Surrogate.prototype._createLoopback = function() {
    this.handler = {
      postMessage: function(data) {
        this._routeMessage(data);
      }.bind(this)
    };
  };

  /**
   *
   */
  var maxDebugLen = 30;
  function str(data) {
    if (data === null) {
      return "null";
    }
    if (data === undefined) {
      return "undefined";
    }
    var reply = JSON.stringify(data);
    if (reply.length > maxDebugLen) {
      reply = reply.substr(0, maxDebugLen - 3) + "...";
    }
    return reply;
  }

  /* These functions are 'client' side */

  /**
   * A function to be called by the functions in a proxy to do the actual
   * marshalling, and postMessage.
   */
  Surrogate.prototype._beginRemoteCall = function(scopeName, funcName, args) {
    args = Array.prototype.slice.call(args, 0);
    var options = args.pop();
    if (typeof options === "function") {
      options = { callback: options };
    }
    var callId = nextCallId++;
    var call = {
      options: options,
      data: {
        request: true, callId: callId, scopeName: scopeName,
        funcName: funcName, args: args
      }
    };
    calls[callId] = call;

    if (this.logLevel >= Surrogate.LogLevel.DEBUG) {
      var argstr = args.map(function(arg) { return str(arg); }).join(",");
      console.log(this._name + "init " + callId + ": " + scopeName + "." +
          funcName + "(" + argstr + ")");
    }

    this.handler.postMessage(call.data);
  };

  /**
   * Called asynchronously by the remote server as a result of a call to
   * _beginRemoteCall
   */
  Surrogate.prototype._endRemoteCall = function(data) {
    var call = calls[data.callId];
    if (!call) {
      if (this.logLevel >= Surrogate.LogLevel.ERROR) {
        console.error(this._name + "Unknown end callId " + data.callId);
      }
      return;
    }
    delete calls[data.callId];

    // Call the callback if there was send data
    if ("reply" in data) {
      if (this.logLevel >= Surrogate.LogLevel.DEBUG) {
        console.log(this._name + "done " + call.data.callId + ": " +
            call.data.scopeName + "." + call.data.funcName + " -> " +
            str(data.reply));
      }

      if (call.options.callback) {
        call.options.callback.apply(call.options.scope, [ data.reply ]);
      }
      else {
        if (this.logLevel >= Surrogate.LogLevel.WARNING) {
          console.warn(this._name + "Ignored return value. Missing callback.");
        }
      }
    }
    else {
      // Call the errback (error handler) if there was an exception
      if (this.logLevel >= Surrogate.LogLevel.WARNING) {
        console.warn(this._name + "Exception calling " + call.data.funcName +
            " - " + data.exception);
        console.warn(this._name + JSON.stringify(data.exception));
      }

      if (call.options.errback) {
        call.options.errback.apply(call.options.scope, [ data.exception ]);
      }
      else if (this._defaultErrBack) {
        this._defaultErrBack(data.exception);
      }
      else {
        if (this.logLevel >= Surrogate.LogLevel.WARNING) {
          console.warn(this._name + "Ignored exception. Missing errback.");
        }
      }
    }

    // Call a finally whatever to allow clearing up
    if (call.options.finback) {
      call.options.finback.apply(call.options.scope);
    }
  };

  /**
   * Designed to be analogous to the CommonJS require() method.
   * @param scopeName A name for object that has been registered with the
   * proxyServer to which we proxy function calls.
   */
  Surrogate.prototype.require = function(scopeName) {
    var surrogate = this;
    // Maybe we want to check to see if name has been registered?
    return Proxy.create({
      get: function(proxy, funcName) {
        return function() {
          surrogate._beginRemoteCall(scopeName, funcName, arguments);
        };
      }
    });
  };

  /* These functions are 'server' side */

  /**
   * The objects that have been defined via a 'supply*()' method
   */
  var defined = {};

  /**
   * There are many ways to create asynchronous functions.
   */
  var Type = {
    NORMAL: 0,
    LACO: 1 // Last argument callback object
  };

  /**
   * This is the partner to proxier.require(name); in the client API.
   * It allows us to specify a named object to be supplied in proxy form
   * to the client
   */
  Surrogate.prototype.supply = function(scopeName, obj) {
    if (typeof scopeName !== 'string') {
      throw new Error('Expected a string scopeName');
    }
    if (!obj) {
      throw new Error('Missing object to supplyLacoAsync');
    }
    defined[scopeName] = { obj: obj, type: Type.NORMAL };
  };

  /**
   * This is a partner to proxier.require(name); in the client API.
   * It allows us to specify a named object to be supplied in proxy form
   * to the client. This differs from supply (to which we deliver a normal
   * object) in that the object contains asynchronous functions using the
   * 'last argument callback object' method.
   */
  Surrogate.prototype.supplyLacoAsync = function(scopeName, lacoAsyncObj) {
    if (typeof scopeName !== 'string') {
      throw new Error('Expected a string scopeName');
    }
    if (!lacoAsyncObj) {
      throw new Error('Missing object to supplyLacoAsync');
    }
    defined[scopeName] = { obj: lacoAsyncObj, type: Type.LACO };
  };

  /**
   * Hook up to an on('message',...) handler and postMessage() function which
   * should be available on the passed handler.
   */
  Surrogate.prototype._executeCall = function(data) {
    // This is called as a result of postMessage in #beginRemoteCall() above
    var def = defined[data.scopeName];
    if (!def) {
      console.error(this._name + "Unknown scope: " + data.scopeName);
      return;
    }

    if (def.type === Type.NORMAL) {
      var argstr = data.args.map(function(arg) { return str(arg); }).join(",");
      try {
        console.log(this._name + "npre " + data.callId + ": " + data.scopeName +
            "." + data.funcName + "(" + argstr + ")");
        var reply = def.obj[data.funcName].apply(def.obj, data.args);
        console.log(this._name + "npst " + data.callId + ": " + data.scopeName +
            "." + data.funcName + " -> " + str(reply));
        this.handler.postMessage({ callId: data.callId, reply: reply });
      }
      catch (ex) {
        console.log(this._name + "nerr " + data.callId + ": " + data.scopeName +
            "." + data.funcName + " -> " + str(ex));
        this.handler.postMessage({ callId: data.callId, exception: ex });
      }
    }
    else if (def.type === Type.LACO) {
      var args = Array.prototype.slice.call(data.args, 0);
      var argstr = args.map(function(arg) { return str(arg); }).join(",");
      console.log(this._name + "lpre " + data.callId + ": " + data.scopeName +
          "." + data.funcName + "(" + argstr + ")");
      args.unshift({
        callback: function(reply) {
          this.handler.postMessage({ callId: data.callId, reply: reply });
          console.log(this._name + "lpst " + data.callId + ": " + data.scopeName +
              "." + data.funcName + " -> " + str(reply));
        }.bind(this),
        errback: function(ex) {
          this.handler.postMessage({ callId: data.callId, exception: ex });
          console.log(this._name + "lerr " + data.callId + ": " + data.scopeName +
              "." + data.funcName + " -> " + str(ex));
        }.bind(this)
      });
      def.obj[data.funcName].apply(def.obj, args);
    }
  };
})(this);

if (this.exports) {
  this.exports.Surrogate = Surrogate;
}

