
/**
 * A function to be called by the functions in a proxy to do the actual
 * marshalling, and postMessage.
 * WARNING: This function is NOT for use in this scope. It will be
 * toString()ed as part of a remote content script.
 * To understand how this function is used, it is probably best to skip down
 * to #declareRemote(), and work your way back to here.
 */
let callRemote = function(scope, funcName, args) {
  args = Array.prototype.slice.call(args);
  callback = args.pop();
  let callId = nextCallId++;
  let call = {
    callback: callback, scope: scope,
    data: {
      callId: callId, scopeId: scope.__id,
      funcName: funcName, args: args
    },
  };
  calls[callId] = call;
  postMessage(call.data);
};

/**
 * The rest of the content script prefix.
 * For usable, see #declareRemote()
 */
let contentPrefix = [
  "let nextCallId = 1;",
  "let calls = [];",
  "let callRemote = " + callRemote + ";",
  "this.on('message', function(data) {",
  "  let call = calls[data.callId];",
  "  if (!call) return;",
  "  delete calls[data.callId];",
  "  call.callback.apply(call.scope, [ data.reply ]);",
  "});",
];

/**
 * Return a string to be used as a content string on the 'other-side' of
 * an e10s boundary. The string will define an object with a <tt>name</tt>
 * and the function properties defined on <tt>options.dest</tt>
 */
let declareRemote = function(name, obj) {
  let scopeId = nextScopeId++;
  scopes[scopeId] = obj;

  let declaration = [
    "window." + name + " = {",
    "  __id: " + scopeId + ","
  ];

  for (let name in obj) {
    if (obj.hasOwnProperty(name)) {
      let value = obj[name];
      if (typeof value === "function") {
        let def = "  " + name + ": function(name, callback) {" +
                  "    callRemote(this, '" + name + "', arguments);" +
                  "  },";
        declaration.push(def);
      }
    }
  }

  declaration.push("  destroy: function() { callRemote(this, 'destroy', []); }");
  declaration.push("};");

  return contentPrefix.join("\n") + declaration.join("\n");
};

let nextScopeId = 1;
let scopes = [];

/**
 * Hook up to an on('message',...) handler and postMessage() function which
 * should be available on the passed handler.
 */
let setHandler = function(handler) {
  handler.on("message", function(data) {
    // This is called as a result of postMessage in #callRemote() above
    let scope = scopes[data.scopeId];
    if (!scope) {
      // TODO: how often are we likely to get a message that is malformed or
      // not aimed at us?
      return;
    }

    if (data.funcName === "destroy") {
      delete scopes[data.scopeId];
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
};

// Export using CommonJS
if (this.exports) {
  exports.declareRemote = declareRemote;
  exports.setHandler = setHandler;
}

