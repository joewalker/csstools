
(function(global) {
  /**
   * We invent a unique ID for each function call.
   * At some point this is going to overflow, however I suspect that the sun
   * will burn out first. TODO: Compare expected overflow time with sun age.
   */
  let nextCallId = 1;

  /**
   * An array of the outstanding calls.
   * This could be a handy place to do debugging
   */
  let calls = [];

  /**
   * A function to be called by the functions in a proxy to do the actual
   * marshalling, and postMessage.
   */
  let callRemote = function(scopeName, funcName, args) {
    args = Array.prototype.slice.call(args);
    let options = args.pop();
    if (typeof options === "function") {
      options = { callback: options };
    }
    let callId = nextCallId++;
    let call = {
      options: options,
      data: {
        callId: callId, scopeName: scopeName,
        funcName: funcName, args: args
      },
    };
    calls[callId] = call;
    postMessage(call.data);
  };

  /**
   * Hook up to onMessage so we can get replies and act on them
   */
  global.on('message', function(data) {
    let call = calls[data.callId];
    if (!call) {
      console.error("Dropping reply, not callId " + data.callId);
      return;
    }
    delete calls[data.callId];

    // Call the callback if there was send data
    if ("reply" in data && call.options.callback) {
      call.options.callback.apply(call.options.scope, [ data.reply ]);
    }
    // Call the errback (error handler) if there was an exception
    if ("exception" in data && call.options.errback) {
      call.options.errback.apply(call.options.scope, [ data.exception ]);
    }
    // Call a finally whatever to allow clearing up
    if (call.options.finback) {
      call.options.finback.apply(call.options.scope);
    }
  });

  /**
   * This is the object that we are exposing to the outside world
   */
  global.proxier = {
    /**
     * Designed to be analogous to the CommonJS require() method.
     * @param scopeName A name for object that has been registered with the
     * proxyServer to which we proxy function calls.
     */
    require: function(scopeName) {
      // Maybe we want to check to see if name has been registered?
      return Proxy.create({
        get: function(proxy, funcName) {
          return function() {
            callRemote(scopeName, funcName, arguments);
          }
        }
      });
    }
  };
})(this);

