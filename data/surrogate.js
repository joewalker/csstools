/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Mozilla Inspector Module.
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Joe Walker <jwalker@mozilla.com> (original author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Construct a new Surrogate that passes message to another Surrogate via
 * handler.postMessage(data); and handler.on('message', data);
 */
function Surrogate(handler, options) {
  options = options || {};

  // Debugging aids
  this._name = options.name ? '(' + options.name + ') ' : '';
  this.logLevel = options.logLevel || Surrogate.LogLevel.SILENT;

  // Used if there is no errback specified in the callback object
  this._defaultErrback = options.defaultErrback;

  if (handler === "loopback") {
    this._createLoopback();
  }
  else {
    this.handler = handler;
    handler.on('message', this._routeMessage.bind(this));
  }

  // The objects that have been defined via a 'supply*()' method
  this._defined = {};
  // An array of the outstanding calls. Could be a handy place to do debugging
  this.calls = [];
  // We invent a unique ID for each function call.
  // TODO: At some point this is going to overflow, however I suspect that the
  // sun will burn out first. Compare expected overflow time with sun age.
  this.nextCallId = 1;
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
   * A really simple implementation of an errback that just sends to
   * console.error
   */
  Surrogate.simpleErrback = function(ex) {
    console.error(JSON.stringify(ex));
  };

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
        // We make this async so people don't rely on it being sync
        setTimeout(function() {
          this._routeMessage(data);
        }.bind(this), 10);
      }.bind(this)
    };
  };

  function Endpoint(side) {
    this.side = side;
  }
  Endpoint.prototype = {
    postMessage: function(message) {
      var clone = JSON.parse(JSON.stringify(message));
      this.other._handler(clone);
    },
    on: function(name, handler) {
      if (name === 'message') {
        this._handler = handler;
      }
    }
  };
  function Pipe() {
    this.left = new Endpoint('left');
    this.right = new Endpoint('right');
    this.left.other = this.right;
    this.right.other = this.left;
  }
  Surrogate.createPipe = function() {
    return new Pipe();
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
    var callId = this.nextCallId++;
    var call = {
      options: options,
      data: {
        request: true, callId: callId, scopeName: scopeName,
        funcName: funcName, args: args
      }
    };
    this.calls[callId] = call;

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
    var call = this.calls[data.callId];
    if (!call) {
      if (this.logLevel >= Surrogate.LogLevel.ERROR) {
        console.error(this._name + "Unknown end callId " + data.callId);
      }
      return;
    }
    delete this.calls[data.callId];

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
      else if (this._defaultErrback) {
        this._defaultErrback(data.exception);
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
        if (funcName === 'toString') {
          return '[Proxy ' + scopeName + '.toString]';
        }
        if (funcName === 'toSource') {
          return '[Proxy ' + scopeName + '.toSource]';
        }
        return function() {
          surrogate._beginRemoteCall(scopeName, funcName, arguments);
        };
      }
    });
  };

  /* These functions are 'server' side */

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
      throw new Error('Missing object to supply');
    }
    this._defined[scopeName] = { obj: obj, type: Type.NORMAL };
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
    this._defined[scopeName] = { obj: lacoAsyncObj, type: Type.LACO };
  };

  /**
   * Hook up to an on('message',...) handler and postMessage() function which
   * should be available on the passed handler.
   */
  Surrogate.prototype._executeCall = function(data) {
    // This is called as a result of postMessage in #beginRemoteCall() above
    var def = this._defined[data.scopeName];
    if (!def) {
      console.error(this._name + "Unknown scope: " + data.scopeName);
      return;
    }

    if (def.type === Type.NORMAL) {
      var argstr = data.args.map(function(arg) { return str(arg); }).join(",");
      try {
        if (this.logLevel >= Surrogate.LogLevel.DEBUG) {
          console.log(this._name + "npre " + data.callId + ": " +
               data.scopeName + "." + data.funcName + "(" + argstr + ")");
        }

        var reply = def.obj[data.funcName].apply(def.obj, data.args);

        if (this.logLevel >= Surrogate.LogLevel.DEBUG) {
          console.log(this._name + "npst " + data.callId + ": " +
              data.scopeName + "." + data.funcName + " -> " + str(reply));
        }

        this.handler.postMessage({ callId: data.callId, reply: reply });
      }
      catch (ex) {
        if (this.logLevel >= Surrogate.LogLevel.WARNING) {
          console.log(this._name + "fail " + data.callId + ": " +
              data.scopeName + "." + data.funcName + " -> " + str(ex));
        }

        this.handler.postMessage({ callId: data.callId, exception: ex });
      }
    }
    else if (def.type === Type.LACO) {
      var args = Array.prototype.slice.call(data.args, 0);
      var argstr = args.map(function(arg) { return str(arg); }).join(",");

      if (this.logLevel >= Surrogate.LogLevel.DEBUG) {
        console.log(this._name + "lpre " + data.callId + ": " + data.scopeName +
            "." + data.funcName + "(" + argstr + ")");
      }

      args.push({
        callback: function(reply) {
          this.handler.postMessage({ callId: data.callId, reply: reply });

          if (this.logLevel >= Surrogate.LogLevel.DEBUG) {
            console.log(this._name + "lpst " + data.callId + ": " +
                data.scopeName + "." + data.funcName + " -> " + str(reply));
          }
        }.bind(this),
        errback: function(ex) {
          this.handler.postMessage({ callId: data.callId, exception: ex });

          if (this.logLevel >= Surrogate.LogLevel.DEBUG) {
            console.log(this._name + "lerr " + data.callId + ": " +
                data.scopeName + "." + data.funcName + " -> " + str(ex));
          }
        }.bind(this)
      });

      def.obj[data.funcName].apply(def.obj, args);
    }
  };
})(this);

if (this.exports) {
  this.exports.Surrogate = Surrogate;
}

