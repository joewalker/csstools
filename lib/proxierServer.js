
let proxier = (function() {
  let scopes = {};

  return {
    /**
     * This is the partner to proxier.require(name); in the client API.
     * It allows us to specify a named object to be supplied in proxy form
     * to the client
     */
    supply: function(scopeName, scope) {
      scopes[scopeName] = scope;
    },

    /**
     * Hook up to an on('message',...) handler and postMessage() function which
     * should be available on the passed handler.
     */
    addHandler: function(handler) {
      handler.on("message", function(data) {
        // This is called as a result of postMessage in #callRemote() above
        let scope = scopes[data.scopeName];
        if (!scope) {
          console.error("Dropping call, no scope called " + data.scopeName);
          return;
        }

        try {
          let reply = scope[data.funcName].apply(scope, data.args);
          handler.postMessage({ callId: data.callId, reply: reply });
        }
        catch (ex) {
          handler.postMessage({ callId: data.callId, exception: ex });
        }
      });
    }
  };
})();

if (this.exports) {
  this.exports.supply = proxier.supply;
  this.exports.addHandler = proxier.addHandler;
}

