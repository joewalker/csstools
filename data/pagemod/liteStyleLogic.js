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
      return "inline style element";
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
   * Add one sheet object into the collection for the given domSheet, and for
   * each sheet imported using CSS import rules.
   */
  function addSheet(sheets, domSheet) {
    var href = domSheet.href || domSheet.ownerNode.ownerDocument.location;
    var ruleCount = 0; // Default for system stylesheets
    try {
      ruleCount = domSheet.cssRules.length;
    }
    catch (ex) { }
    var id = "s" + Object.keys(sheets).length;

    sheets[id] = {
      rules: null, // populateRules() will populate with map of id->rule
      domSheet: domSheet,
      exposed: {
        id: id,
        href: href,
        shortSource: getShortSource(domSheet),
        systemSheet: isSystemStyleSheet(domSheet.href),
        ruleCount: ruleCount
      }
    };

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

  /**
   * Dig through the rules in domSheet.cssRules and expose to the CssDoctor UI.
   */
  function populateRules(sheet) {
    sheet.rules = {};
    Array.prototype.forEach.call(sheet.domSheet.cssRules, function(domRule) {
      if (domRule.type == CSSRule.STYLE_RULE) {
        var id = sheet.exposed.id + "-r" + Object.keys(sheet.rules).length;
        sheet.rules[id] = {
          settings: null, // populateSettings() populates to map of id->setting
          domRule: domRule,
          exposed: {
            id: id,
            selectorGroup: domRule.selectorText.split(","),
            propertyCount: domRule.length
          }
        };
      }
    }, this);
  }

  /**
   * Dig through the property/value pairs (i.e. settings) in a CSSRule to
   * expose to the CssDoctor UI.
   */
  function populateSettings(rule) {
    rule.settings = {};
    var style = rule.domRule.style;
    for (var i = 0; i < style.length; i++) {
      var propertyName = style.item(i);
      var id = rule.exposed.id + "-p" + Object.keys(rule.settings).length;
      rule.settings[id] = {
        exposed: {
          id: id,
          property: propertyName,
          value: style.getPropertyValue(propertyName)
        }
      };
    }
  }

  /**
   *
   */
  var answerRules = [
    /**
     * Disabled stylesheet
     */
    function(element, sheet, rule, setting) {
      if (sheet.domSheet.disabled) {
        return "<p>This rule does not work because it is in a stylesheet that" +
            " is marked as disabled. Note this could have happened either in" +
            " original HTML or using JavaScript.</p>";
      }
    },
    /**
     * Wrong media type
     */
    function(element, sheet, rule, setting) {
      // TODO: What if we're running this somewhere where the media type is
      // not screen? Is there an API to get this?
      var currentMediaType = "screen";
      var mediaList = sheet.domSheet.media;
      if (mediaList.length > 0 &&
          Array.prototype.indexOf(mediaList, "all") == -1 &&
          Array.prototype.indexOf(mediaList, currentMediaType) == -1) {
        return "<p>This rule does not work because it is in a stylesheet with" +
            " a media type of '" + mediaList.mediaText + "', which does not" +
            " include either 'all' or '" + currentMediaType + "' (the current" +
            " media type).</p>";
      }
    }
  ];

  /**
   *
   */
  function findAnswer(inspectedCssName, sheet, rule, setting, options) {
    var element = document.querySelector(inspectedCssName);
    var actual = window.getComputedStyle(element, null)
        .getPropertyValue(setting.exposed.property);

    var intro = "<p>You've asked why " + setting.exposed.property + "=" +
        setting.exposed.value + " has not applied to " + inspectedCssName +
        ", which has an actual value of " + setting.exposed.property + "=" +
        actual + "</p>";

    var answers = [];
    answerRules.forEach(function(answerRule) {
      var answer = answerRule(element, sheet, rule, setting);
      if (answer) {
        answers.push(answer);
      }
    });

    if (answers.length === 0) {
      answers.push("<p>We have no clue why this doesn't work.</p>");
    }

    return intro + answers.join("");
  }

  /**
   * Implementation of the StyleLogic interface
   */
  function StyleLogic() {
    // Object<sheetId, sheet>, populated by getSheets()
    this.sheets = null;
  };

  /**
   * Exported function to list the sheets on the current page. Sheets are
   * included even if they are disabled, or if their media type is disallowed.
   * However, system sheets are marked and excluded from the doctor UI.
   */
  StyleLogic.prototype.getSheets = function getSheets() {
    if (!this.sheets) {
      this.sheets = {};
      Array.prototype.forEach.call(document.styleSheets, function(domSheet) {
        addSheet(this.sheets, domSheet);
      }.bind(this));
    }

    return Object.keys(this.sheets).map(function(sheet) {
      return this.sheets[sheet].exposed;
    }.bind(this));
  };

  /**
   * Exported function to list the rules in a stylesheet.
   */
  StyleLogic.prototype.getRules = function(sheetId) {
    var sheet = this.sheets[sheetId];
    if (!sheet) {
      throw new Error("Sheet " + sheetId + " not found.");
    }

    if (!sheet.rules) {
      populateRules(sheet);
    }

    return Object.keys(sheet.rules).map(function(rule) {
      return sheet.rules[rule].exposed;
    }.bind(this));
  };

  /**
   * Exported function to list the property/value pairs (i.e. settings) in a
   * stylesheet.
   */
  StyleLogic.prototype.getSettings = function(ruleId) {
    var sheetId = ruleId.split("-")[0];
    var sheet = this.sheets[sheetId];
    if (!sheet) {
      throw new Error("Sheet " + sheetId + " not found.");
    }
    var rule = sheet.rules[ruleId];
    if (!rule) {
      throw new Error("Rule " + ruleId + " not found.");
    }

    if (!rule.settings) {
      populateSettings(rule);
    }

    return Object.keys(rule.settings).map(function(setting) {
      return rule.settings[setting].exposed;
    }.bind(this));
  };

  /**
   * Exported function to explain the reason why a setting was not properly
   * applied to an element.
   */
  StyleLogic.prototype.getAnswer = function(inspectedCssName, settingId) {
    var element = document.querySelector(inspectedCssName);
    if (!element) {
      throw new Error("Element " + inspectedCssName + " not found");
    }
    var sheetId = settingId.split("-")[0];
    var sheet = this.sheets[sheetId];
    if (!sheet) {
      throw new Error("Sheet " + sheetId + " not found.");
    }
    var ruleId = settingId.split("-").slice(0, 2).join("-");
    var rule = sheet.rules[ruleId];
    if (!rule) {
      throw new Error("Rule " + ruleId + " not found.");
    }
    var setting = rule.settings[settingId];
    if (!setting) {
      throw new Error("Setting " + settingId + " not found.");
    }

    return { text: findAnswer(inspectedCssName, sheet, rule, setting) };
  };

  window.styleLogic = new StyleLogic();
})();
