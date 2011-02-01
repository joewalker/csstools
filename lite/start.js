
/**
 * The start point for CssDoctorLite
 * Setup in the self-exec function below
 */
var startCssDoctorLite = null;
var environment;

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
          css: [ 'data/doctor.css' ]
        });
        panel.show();

        var surrogate = new Surrogate('loopback');
        surrogate.supply('styleLogic', styleLogic);
        styleLogic = surrogate.require('styleLogic');

        doctor(element.tagName.toLowerCase() + '#' + (element.id || 'tempId'));
      });
    }, bal);
  };
})();
