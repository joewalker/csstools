
(function(global) {
  /**
   * Control output verboseness. The default is SILENT
   */
  var Level = {
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
   * By default we console.log on error
   */
  var logLevel = Level.SILENT;

  /**
   * A function to be called by the functions in a proxy to do the actual
   * marshalling, and postMessage.
   */
  var callRemote = function(scopeName, funcName, args) {
    args = Array.prototype.slice.call(args, 0);
    var options = args.pop();
    if (typeof options === "function") {
      options = { callback: options };
    }
    var callId = nextCallId++;
    var call = {
      options: options,
      data: {
        callId: callId, scopeName: scopeName,
        funcName: funcName, args: args
      },
    };
    calls[callId] = call;

    if (logLevel >= Level.DEBUG) {
      console.log("Call " + callId + ": " + scopeName + "." + funcName +
          "(" + args.join(",") + ")");
    }

    postMessage(call.data);
  };

  /**
   * Hook up to onMessage so we can get replies and act on them
   */
  if (typeof global.on === "function") {
    global.on('message', function(data) {
      var call = calls[data.callId];
      if (!call) {
        if (logLevel >= Level.ERROR) {
          console.error("Dropping reply, invalid callId " + data.callId);
        }
        return;
      }
      delete calls[data.callId];
  
      // Call the callback if there was send data
      if ("reply" in data) {
        if (logLevel >= Level.DEBUG) {
          console.log("Reply " + call.data.callId + ": " + call.data.scopeName +
              "." + call.data.funcName + "(" + data.reply + ")");
        }
  
        if (call.options.callback) {
          call.options.callback.apply(call.options.scope, [ data.reply ]);
        }
        else {
          if (logLevel >= Level.WARNING) {
            console.warn("Ignored return value. Missing callback.");
          }
        }
      }
      else {
        // Call the errback (error handler) if there was an exception
        if (logLevel >= Level.WARNING) {
          console.warn("Exception calling " + call.data.funcName + " - " +
              data.exception);
          console.warn(JSON.stringify(data.exception));
        }
  
        if (call.options.errback) {
          call.options.errback.apply(call.options.scope, [ data.exception ]);
        }
        else {
          if (logLevel >= Level.WARNING) {
            console.warn("Ignored exception. Missing errback.");
          }
        }
      }
  
      // Call a finally whatever to allow clearing up
      if (call.options.finback) {
        call.options.finback.apply(call.options.scope);
      }
    });
  }
  else {
    console.log("missing 'on' method, going inactive");
  }

  /**
   * This is the object that we are exposing to the outside world
   */
  global.proxier = {
    /**
     * Allow others to detect if we are connected
     */
    active: (typeof global.on === "function"),

    /**
     * Designed to be analogous to the CommonJS require() method.
     * @param scopeName A name for object that has been registered with the
     * proxyServer to which we proxy function calls.
     */
    require: function(scopeName) {
      if (!this.active) {
        return this._requireWhenInactive(scopeName);
      }

      // Maybe we want to check to see if name has been registered?
      return Proxy.create({
        get: function(proxy, funcName) {
          return function() {
            callRemote(scopeName, funcName, arguments);
          }
        }
      });
    },

    set logLevel(aLogLevel) {
      logLevel = aLogLevel;
    },

    _requireWhenInactive: function(scopeName) {
      console.error("Can't find Jetpack environment. Ignoring: " + scopeName);
      return {};
    },

    Level: Level
  };
})(this);
