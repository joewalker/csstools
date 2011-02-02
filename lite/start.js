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
 * The start point for CssDoctorLite
 * Setup in the self-exec function below
 */
var startCssDoctorLite = null;

(function() {
  /**
   * A browser abstraction layer for CssDoctorLite
   */
  function LiteBal() {
  }

  /**
   * Fetch the named resource, and call the callback with the data when done.
   */
  LiteBal.prototype.requireResource = function(name, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (!xhr.responseText) {
          console.log('Missing data.');
        }
        else {
          callback(xhr.responseText);
        }
      }
    };
    xhr.open('GET', name);
    xhr.send();
  };

  /**
   * Allow us to add a CSS link tag asynchronously.
   * @param href Either a string to use as the href of the new link tag or an
   * array of strings, we'll create one for each.
   */
  LiteBal.prototype.addStyleTag = function(href) {
    if (href == null) {
      return;
    }

    if (Array.isArray(href)) {
      href.forEach(function(href) {
        this.addStyleTag(href);
      }, this);
      return;
    }

    var link = document.createElement('link');
    link.href = href;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    document.head.appendChild(link);
  };

  /**
   * Allow us to add a script tag asynchronously.
   * @param src Either a string to use as the src of the new script tag or an
   * array of strings, we'll create one for each.
   * @param callback A function to be called when the script tag has loaded or
   * in the case of an array, when all script tags have loaded.
   * @param context 'this' for the callback
   */
  LiteBal.prototype.addScriptTag = function(src, callback, context) {
    if (src == null) {
      callback.call(context);
      return;
    }

    if (Array.isArray(src)) {
      var outstanding = src.length;
      src.forEach(function(src) {
        this.addScriptTag(src, function() {
          outstanding--;
          if (outstanding === 0) {
            callback.call(context);
          }
        });
      }, this);

      if (src.length === 0) {
        callback.call(context);
      }
      return;
    }

    var script = document.createElement('script');
    script.onload = function() {
      if (callback) {
        callback.call(context);
      }
    };
    script.onreadystatechange = function() {
      if (script.readyState == 'loaded' || script.readyState == 'complete') {
        script.onload();
      }
    };
    script.type = 'text/javascript';
    script.src = src;
    document.head.appendChild(script);
  };

  /**
   * Resources to help the pickElement function
   */
  var selectingElement = false;
  var selectedElement = null;
  var callback = null;

  function clickHandler(ev) {
    window.removeEventListener('click', clickHandler, true);
    selectedElement = ev.target;
    selectingElement = false;

    console.log('Found element: ', selectedElement);
    callback(selectedElement);

    // TODO: this isn't working. why?
    ev.stopPropagation();
    ev.preventDefault();
    return false;
  };

  /**
   * A helper to allow us to get a handle on an element
   */
  LiteBal.prototype.pickElement = function(aCallback) {
    var selector = window.prompt('Enter a selector that uniquely identifies an element, or leave to select with a click', '<select with mouse>');
    if (!selector) {
      console.log('Aborted element selection');
    }

    if (selector !== '<select with mouse>') {
      var element = document.querySelectorAll(selector);
    }

    if (selectingElement) {
      throw new Error('Already picking element');
    }

    selectingElement = true;
    selectedElement = null;
    callback = aCallback;

    console.log('Element selection started');
    window.addEventListener('click', clickHandler, true);
  };

  /**
   * start point to setup a CssDoctor using a Lite BAL
   */
  startCssDoctorLite = function() {
    var bal = new LiteBal();
    var scripts = [
      'lib/surrogate.js',
      'data/pagemod/testStyleLogic.js',
      'data/doctor.js',
      'data/domtemplate.js',
      'lite/overlay.js'
    ];
    bal.addScriptTag(scripts, function() {
      var host = new OverlayPanelHost(bal);
      bal.pickElement(function(element) {

        console.log('Got element ', element, '. Picking rule ...');

        var panel = host.createPanel({
          title: 'CSS Doctor',
          contents: 'data/doctor.html',
          css: [ 'data/doctor.css' ],
          onload: function() {
            /*
            var surrogate = new Surrogate('loopback', {
              name: 'loopback',
              logLevel: Surrogate.LogLevel.DEBUG,
              defaultErrBack: console.error
            });
            surrogate.supply('styleLogic', styleLogic);
            styleLogic = surrogate.require('styleLogic');
            */
            var addonPipe = Surrogate.createPipe();
            new Surrogate(addonPipe.left, {
              name: 'toAddon  ',
              logLevel: Surrogate.LogLevel.DEBUG,
              defaultErrBack: console.error
            }).supply('styleLogic', window.styleLogic);
            var lacoStyleLogic = new Surrogate(addonPipe.right, {
              name: 'toPageMod',
              logLevel: Surrogate.LogLevel.DEBUG,
              defaultErrBack: console.error
            }).require("styleLogic");

            var panelPipe = Surrogate.createPipe();
            new Surrogate(panelPipe.left, {
              name: "toPanel  ",
              logLevel: Surrogate.LogLevel.DEBUG,
              defaultErrBack: console.error
            }).supplyLacoAsync("styleLogic", lacoStyleLogic);
            var proxyStyleLogic = new Surrogate(panelPipe.right, {
              name: 'doctor.js',
              logLevel: Surrogate.LogLevel.DEBUG,
              defaultErrBack: console.error
            }).require('styleLogic');

            var inspectedCssName = element.tagName.toLowerCase() +
                '#' + (element.id || 'tempId');
            doctor(inspectedCssName, proxyStyleLogic, Templater);
          }
        });
        panel.show();
      });
    }, bal);
  };
})();
