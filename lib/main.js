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

define('main', function(require, exports, module) {

});

var contextMenu = require("context-menu");

var data = require("self").data;
var panel = require("panel");
var Surrogate = require("surrogate").Surrogate;
var pageMod = require("page-mod");

/**
 * TODO: This is the last page to load, which we're assuming is the one we're
 * inspecting. This is of course a huge assumption. The correct thing to do is
 * to inject the page-mod when asked, but the API for that isn't public yet.
 */
var styleLogic;

/**
 * Add the "Inspect Styles" context menu.
 * TODO: How do we add the menu to links too?
 */
var inspectMenu = contextMenu.Item({
  label: "CSS Doctor",
  contentScriptFile: data.url("findClick.js"),
  context: contextMenu.PageContext(),
  onMessage: function(id) {
    var doctorPanel = panel.Panel({
      contentURL: data.url("doctor.html"),
      contentScriptFile: [
        data.url("surrogate.js"),
        data.url("domtemplate.js"),
        data.url("doctor.js")
      ],
      contentScript:
          "var styleLogic = new Surrogate(this, {" +
          "  name: 'doctor.js'," +
          "  logLevel: Surrogate.LogLevel.WARNING," +
          "  defaultErrback: Surrogate.simpleErrback" +
          "}).require('styleLogic');" +
          "" +
          "doctor('#" + id + "', styleLogic, Templater);",
      contentScriptWhen: "ready"
    });

    var surrogate = new Surrogate(doctorPanel, {
      name: "toPanel  ",
      logLevel: Surrogate.LogLevel.WARNING,
      defaultErrback: Surrogate.simpleErrback
    });
    surrogate.supplyLacoAsync("styleLogic", styleLogic);

    doctorPanel.show();
  }
});

/**
 * A way for the page to respond to requests for info about the structure
 */
var styleLogicMod = pageMod.PageMod({
  include: [ "*" ],
  contentScriptFile: [
    data.url("pagemod/liteStyleLogic.js"),
    data.url("surrogate.js")
  ],
  contentScriptWhen: "ready",
  contentScript:
      "new Surrogate(this, { " +
      "  name: 'toAddon  ', " +
      "  logLevel: Surrogate.LogLevel.WARNING, " +
      "  defaultErrback: Surrogate.simpleErrback " +
      "}).supply('styleLogic', window.styleLogic);",
  onAttach: function(worker) {
    var surrogate = new Surrogate(worker, {
      name: 'toPageMod',
      logLevel: Surrogate.LogLevel.WARNING,
      defaultErrback: Surrogate.simpleErrback
    });
    styleLogic = surrogate.require("styleLogic");
  }
});

/**
 * There has to be a way to get shared resources?
 */
function getSurrogateUrl() {
  let callerInfo = require("traceback").get().slice(-4)[0];
  return callerInfo.filename.replace(/main\.js/, "surrogate.js");
}
