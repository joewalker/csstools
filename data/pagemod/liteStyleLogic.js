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

(function() {
  /**
   * Check if the given DOM CSS object holds an allowed media.
   * Currently we only allow media screen or all.
   * @param {CSSStyleSheet|CSSImportRule|CSSMediaRule} domObject the
   * DOM object you want checked
   * @return {boolean} true iff the media description is allowed
   */
  function sheetMediaAllowed(domObject) {
    var result = false;
    var media = domObject.media;

    if (media.length > 0) {
      var mediaItem = null;
      for (var m = 0; m < media.length; m++) {
        mediaItem = media.item(m).toLowerCase();
        if (mediaItem === sheetMediaAllowed.Media.SCREEN ||
            mediaItem === sheetMediaAllowed.Media.ALL) {
          result = true;
          break;
        }
      }
    } else {
      result = true;
    }

    return result;
  };
  /**
   * Known media values.
   * The full list includes braille, embossed, handheld, print, projection,
   * speech, tty, and tv, but this is only a hack because these are not defined
   * in the DOM at all.
   * @see http://www.w3.org/TR/CSS21/media.html#media-types
   */
  sheetMediaAllowed.Media = {
    ALL: "all",
    SCREEN: "screen"
  };

  /**
   * Is the given property sheet a system (user agent) stylesheet?
   * @param {CSSStyleSheet} url The href of a stylesheet
   * @return {boolean} true iff the given stylesheet is a system stylesheet
   */
  function isSystemStyleSheet(url) {
    if (!url) return false;
    if (url.length === 0) return true;
    if (url[0] === 'h') return false;
    if (url.substr(0, 9) === "resource:") return true;
    if (url.substr(0, 7) === "chrome:") return true;
    if (url === "XPCSafeJSObjectWrapper.cpp") return true;
    if (url.substr(0, 6) === "about:") return true;
    return false;
  }

  /**
   * Get a shorter version of a href.
   * TODO: Make this guarantee uniqueness
   */
  function getShortSource(domSheet) {
    // Short version of href for use in select boxes etc.
    if (!domSheet.href) {
      // Use a string like "inline" if there is no source href
      console.log(domSheet);
      return "inline <style>";
    }
    else {
      return domSheet.href.split("/").slice(-1);
      /*
      // We try, in turn, the filename, filePath, query string, whole thing
      var url = Cc["@mozilla.org/network/io-service;1"].
          getService(Ci["nsIIOService2"]).
          newURI(this.domSheet.href, null, null);
      url = url.QueryInterface(Ci.nsIURL);

      if (url.fileName) {
        return url.fileName;
      }
      else {
        if (url.filePath) {
          return url.filePath;
        }
        else {
          if (url.query) {
            return url.query;
          }
          else {
            return this.domSheet.href;
          }
        }
      }
      */
    }
  }

  /**
   * Exported function to list the sheets on the current page. Sheets are only
   * included even if they are disabled, or if their media type is allowed.
   * System sheets are marked and excluded from the doctor UI.
   */
  function getSheets() {
    var sheets = [];
    Array.prototype.forEach.call(document.styleSheets, function(domSheet) {
      addSheet(sheets, domSheet);
    });
    return sheets;
  }

  /**
   * Add one sheet object into the collection for the given domSheet, and for
   * each sheet imported using CSS import rules.
   */
  function addSheet(sheets, domSheet) {
    var sheet = {
      index: sheets.length,
      href: domSheet.href,
      shortSource: getShortSource(domSheet),
      systemSheet: isSystemStyleSheet(domSheet.href)
    };

    if (!sheet.href) {
      sheet.href = domSheet.ownerNode.ownerDocument.location;
    }

    try {
      sheet.ruleCount = domSheet.cssRules.length;
    }
    catch (ex) {
      // For system stylesheets
      sheet.ruleCount = 0;
    }

    sheets.push(sheet);

    // Find import rules.
    try {
      Array.prototype.forEach.call(domSheet.cssRules, function(domRule) {
        if (domRule.type == CSSRule.IMPORT_RULE && domRule.styleSheet) {
          addSheet(sheets, domRule.styleSheet);
        }
      }, this);
    }
    catch (ex) {
      // For system stylesheets.
    }
  }

  var styleLogic = {
    _impl: 'liteStyleLogic',
    getSheets: getSheets,

    getRules: function(sheetHref) {
      return [
        { selectorId: 1, selectorGroup: [ ".group h1", ".sheet h1" ], propertyCount: 3 },
        { selectorId: 2, selectorGroup: [ "#error" ], propertyCount: 1 },
        { selectorId: 3, selectorGroup: [ "p.content" ], propertyCount: 5 }
      ];
    },

    getSettings: function(sheetHref, selectorId) {
      return [
        { settingId: 1, property: "color", value: "red" },
        { settingId: 2, property: "background-color", value: "blue" },
      ];
    },

    getAnswer: function(sheetHref, settingId) {
      return {
        text: "<p>(Example) This rule clashes with the rule at style.css:34 " +
            "because both rules have the same number of IDs, classes and tags, " +
            "but the other rule was specified later in the page.</p>" +
            "<p>To fix it, <a href='#'>make this rule more specific</a>.</p>" +
            "<p><strong>Note</strong>: Changing rules can <a href='#'>affect " +
            "many elements</a>.</p>" +
            "<p><strong>Note</strong>: For detail, see <a href='#'>how CSS " +
            "specificity works</a>.</p>"
        };
    }
  };

  window.styleLogic = styleLogic;
})();
