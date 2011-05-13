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
  /*
   * Navigating this file:
   * First section:  Utilities: isSystemStyleSheet, getShortSource,
   *                 getShortName, getShortNamePath, etc
   * Second section: Sheet class (encapsulating a CSSStyleSheet)
   * Third section:  Rule class (encapsulating a )
   * Fourth section: Setting class (encapsulating a )
   * Fifth section:  Answer Rules ()
   * Sixth section: Implementation of StyleLogic (The remotable API)
   */

  //----------------------------------------------------------------------------

  /**
   * Is the given property sheet a system (user agent) stylesheet?
   *
   * @param {CSSStyleSheet} aUrl
   *        The href of a stylesheet
   * @return {boolean}
   *         true iff the given stylesheet is a system stylesheet
   */
  function isSystemStyleSheet(aUrl)
  {
    if (!aUrl) return false;
    if (aUrl.length === 0) return true;
    if (aUrl[0] === 'h') return false;
    if (aUrl.substr(0, 9) === "resource:") return true;
    if (aUrl.substr(0, 7) === "chrome:") return true;
    if (aUrl === "XPCSafeJSObjectWrapper.cpp") return true;
    if (aUrl.substr(0, 6) === "about:") return true;
    return false;
  }

  /**
   * Get a shorter version of a href; something that is more helpful than the
   * URL in identifying, to the user, which sheet is which.
   *
   * @param {CSSStyleSheet} aDomSheet
   *        The stylesheet DOM node to get a string for
   * @return A user visible string representing the sheet
   * @bug 656863 - getShortSource() in CSS Doctor should guarantee uniqueness
   */
  function getShortSource(aDomSheet)
  {
    // Short version of href for use in select boxes etc.
    if (!aDomSheet.href) {
      // Use a string like "inline" if there is no source href
      return aDomSheet.ownerNode.id ?
          "sheet#" + aDomSheet.ownerNode.id : "inline style element";
    }
    else {
      return aDomSheet.href.split("/").slice(-1);
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
   * If the element has an id, return '#id', otherwise return 'tagname[n]'
   * where n is the index of this element in its siblings.
   *
   * <p>A technically more 'correct' output from the no-id case might be:
   * 'tagname:nth-of-type(n)' however this is unlikely to be more understood
   * and it is longer.
   *
   * <p>We might consider using 'tagName.classNames' before resorting to the [n]
   * case, however this could be length in some cases.
   *
   * @param {DOMElement} aElement
   *        the element for which you want the short name.
   * @return {string}
   *         the string to be displayed for aElement.
   */
  function getShortName(aElement)
  {
    if (!aElement) {
      return "null";
    }
    if (aElement.id) {
      return "#" + aElement.id;
    }

    var priorSiblings = 0;
    var temp = aElement;
    while (temp = temp.previousElementSibling) {
      priorSiblings++;
    }
    return aElement.tagName.toLowerCase() + "[" + priorSiblings + "]";
  };

  /**
   * Get an array of short names from the given element to document.body.
   * It will be common to use this as getShortNamePath(e).join(", ");
   *
   * @param {nsIDOMElement} aElement
   *        the element for which you want the array of short names.
   * @return {array} The array of shortNames (as defined by getShortName()) from
   *         (and including) the given element to (but not including)
   *         document.body.
   */
  function getShortNamePath(aElement)
  {
    var doc = aElement.ownerDocument;
    var reply = [];

    if (!aElement) {
      return reply;
    }

    // We want to exclude nodes high up the tree (body/html) unless the user
    // has selected that node, in which case we need to report something.
    while (true) {
      reply.unshift(getShortName(aElement));
      aElement = aElement.parentNode;

      if (!aElement) break;
      if (aElement == doc.body) break;
      if (aElement == doc.documentElement) break;
    }

    return reply;
  };

  //----------------------------------------------------------------------------

  /**
   * A Sheet represents a view of a DOM style sheet (i.e. a CSSStyleSheet) it
   * gives us a good way to encapsulate a more convenient view of the data than
   * CSSStyleSheet.
   *
   * @param {CSSStyleSheet} aDomSheet
   *        The stylesheet that we encapsulate
   */
  function Sheet(aDomSheet) {
    // populateRules() will populate this with map of id->rule
    this.rules = null;
    this.domSheet = aDomSheet;

    var ruleCount = 0; // Default for system stylesheets
    try {
      ruleCount = aDomSheet.cssRules.length;
    }
    catch (ex) {
      // For system stylesheets
    }

    if (aDomSheet.ownerNode.id) {
      this.id = "s" + aDomSheet.ownerNode.id;
    }
    else {
      this.id = "s" + (Sheet._sheetCount++);
    }

    this.href = aDomSheet.href || aDomSheet.ownerNode.ownerDocument.location;
    this.shortSource = getShortSource(aDomSheet);
    this.systemSheet = isSystemStyleSheet(aDomSheet.href);

    this._initImportedSheets();
  }

  /**
   * Accessor for the remote versions of all the sheets.
   *
   * @return {jsonObject[]}
   *         Array of JSON objects for the remote versions of all known sheets
   */
  Sheet.getAllSheetRemotes = function Sheet_getAllSheetRemotes() {
    Sheet._checkPopulated();
    return Object.keys(Sheet._sheets).map(function(sheet) {
      return Sheet._sheets[sheet].getRemote();
    }.bind(this));
  };

  /**
   * Accessor for a sheet specified by sheet id
   *
   * @param {string} aId
   *        The ID of a known sheet
   * @return A Sheet such that sheet.id = aId
   * @throws {Error}
   *        If aId does not match a known sheet.
   */
  Sheet.getSheet = function Sheet_getSheet(aId) {
    // Normally Sheet._sheets will have been setup by a call to getSheets() but
    // we might be coming in directly from the test page
    Sheet._checkPopulated();
    var sheet = Sheet._sheets[aId];
    if (!sheet) {
      throw new Error("Sheet " + aId + " not found.");
    }
    return sheet;
  };

  /**
   * Handy function to check that the list of sheets has been created, and
   * create it if not.
   */
  Sheet._checkPopulated = function Sheet_checkPopulated() {
    if (!Sheet._sheets) {
      Sheet._sheets = {};
      Array.prototype.forEach.call(document.styleSheets, function(domSheet) {
        Sheet._addSheet(domSheet);
      });
    }
  };

  /**
   * Add one sheet object into the collection for the given domSheet, and for
   * each sheet imported using CSS import rules.
   *
   * @param {object} aSheets
   *        An array of objects representing the stylesheets in the document
   * @param {CSSStyleSheet} aDomSheet
   *        DOM node representing the stylesheet to inspect
   */
  Sheet._addSheet = function Sheet_addSheet(aDomSheet)
  {
    var sheet = new Sheet(aDomSheet);
    Sheet._sheets[sheet.id] = sheet;
  };

  /**
   * How many sheets have we created so far?
   * TODO: Use Object.keys(Sheet._sheets).length?
   */
  Sheet._sheetCount = 0;

  /**
   * The cache of all the sheets that we've created so far
   */
  Sheet._sheets = null;

  /**
   * Find the imported stylesheets in this stylesheet, and setup Sheets for
   * them.
   * Important: This should only be called from the Sheet constructor.
   */
  Sheet.prototype._initImportedSheets = function Sheet_initImportedSheet() {
    try {
      Array.prototype.forEach.call(this.domSheet.cssRules, function(domRule) {
        if (domRule.type == CSSRule.IMPORT_RULE && domRule.styleSheet) {
          Sheet._addSheet(domRule.styleSheet);
        }
      }, this);
    }
    catch (ex) {
      // For system stylesheets
    }
  };

  /**
   * Get a JSON object (i.e. nothing recursive or not representable in JSON)
   * for passing over remote interfaces.
   *
   * @return {jsonObject}
   *         A version of this sheet for remote use
   */
  Sheet.prototype.getRemote = function Sheet_getRemote() {
    return {
      id: this.id,
      href: this.href,
      shortSource: this.shortSource,
      systemSheet: this.systemSheet,
      ruleCount: this.ruleCount
    };
  };

  //----------------------------------------------------------------------------

  /**
   * Dig through the rules in domSheet.cssRules and expose to the CssDoctor UI.
   */
  function populateRules(sheet, ruleList, idPrefix, medias) {
    ruleList = ruleList || sheet.domSheet.cssRules;
    medias = medias || Array.prototype.slice.call(sheet.domSheet.media, 0);
    idPrefix = idPrefix || "";
    sheet.rules = {};

    var mediaIndex = 0;
    Array.prototype.forEach.call(ruleList, function(domRule) {
      if (domRule.type == CSSRule.STYLE_RULE) {
        var id = sheet.id + "-" + idPrefix + "r" + Object.keys(sheet.rules).length;
        sheet.rules[id] = {
          settings: null, // populateSettings() populates to map of id->setting
          domRule: domRule,
          medias: medias, // die grammar nazis, die
          exposed: {
            id: id,
            selectorGroup: domRule.selectorText.split(","),
            propertyCount: domRule.length
          }
        };
      }
      else if (domRule.type == CSSRule.MEDIA_RULE) {
        var newIdPrefix = idPrefix + "m" + mediaIndex;
        medias.push.apply(medias, Array.prototype.slice.call(domRule.media, 0));
        populateRules(sheet, domRule.cssRules, newIdPrefix, medias);
        mediaIndex++;
      }
    }, this);
  }

  //----------------------------------------------------------------------------

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

  //----------------------------------------------------------------------------

  /**
   * An array on functions each of which returns a string if it know why the
   * specified CSS property/value doesn't apply to the given element.
   */
  var answerRules = [
    /**
     * Disabled stylesheet
     */
    function isDisabledStylesheet(element, sheet, rule, setting) {
      if (sheet.domSheet.disabled) {
        return "This rule does not work because it is in a stylesheet that" +
            " has been marked as disabled using JavaScript.";
      }
    },

    /**
     * Wrong media type
     */
    function isWrongMediaType(element, sheet, rule, setting) {
      // TODO: What if we're running this somewhere where the media type is
      // not screen? Is there an API to get this?
      var currentMediaType = "screen";
      if (rule.medias.length > 0 &&
          rule.medias.indexOf("all") == -1 &&
          rule.medias.indexOf(currentMediaType) == -1) {
        return "This rule does not work because it has the following media " +
        		" applied to it '" + rule.medias.join(", ") + "', which does not" +
            " include either 'all' or '" + currentMediaType + "' (the current" +
            " media type).";
      }
    },

    /**
     * Unmatched Selector
     */
    function isUnmatchedSelector(element, sheet, rule, setting) {
      var matches = document.querySelectorAll(rule.domRule.selectorText);
      // hierarchy is element and all it's parents
      // TODO: we should only take notice of hierarchy when we know that
      // setting.exposed.property is an inheriting property
      var hierarchy = [];
      var node = element;
      while (node) {
        hierarchy.push(node);
        node = node.parentNode;
      }
      var hierarchyMatch = Array.prototype.some.call(matches, function(match) {
        return hierarchy.some(function(elementOrParent) {
          return match == elementOrParent;
        });
      });

      if (!hierarchyMatch) {
        return "This rule does not work because the selector '" +
            rule.domRule.selectorText + "' does not match the inspected" +
            " element, which has the following path: '" +
            getShortNamePath(element).join(" > ") + "'";
      }
    },

    /**
     * Dimensioned Inline element
     */
    function isDimensionedInline(element, sheet, rule, setting) {
      var dimensions = [ "top", "bottom", "left", "right", "width", "height" ];
      var dimensioned = dimensions.indexOf(setting.exposed.property) != -1;
      var inlined = window.getComputedStyle(element, null)
                          .getPropertyValue("display") == "inline";

      if (dimensioned && inlined) {
        return "Inline elements (i.e. those that have display:inline or that" +
            " are inherently inline like span, em, etc) can't have dimensions" +
            " like top, bottom, left, right, width, height";
      }
    },

    /**
     * Working Rule!
     */
    function isWorking(element, sheet, rule, setting) {
      var actual = window.getComputedStyle(element, null)
                         .getPropertyValue(setting.exposed.property);

      // TODO: getComputedStyle gives you top:30 even when that value is ignored
      // due to display:inline. why?

      if (setting.exposed.value == actual) {
        return "The computed value of " + setting.exposed.property + " is" +
        		" the same as value in the given rule (" + actual + ").";
      }
    }
  ];

  /**
   * Look through the rules specified in answerRules for a match.
   */
  function findAnswer(element, name, sheet, rule, setting, options) {
    options = options || {};
    var answers = [];

    answerRules.forEach(function(answerRule) {
      var answer = answerRule(element, sheet, rule, setting);
      if (answer) {
        answers.push(answer);
      }
    });

    if (answers.length === 0) {
      answers.push("We have no clue why this doesn't work.");
    }

    if (!options.skipIntro) {
      answers.unshift("You've asked why " + setting.exposed.property + "=" +
          setting.exposed.value + " has not applied to " + name + ".");
    }

    return answers;
  }

  //----------------------------------------------------------------------------

  /**
   * Implementation of the StyleLogic interface
   */
  function StyleLogic() {
  };

  /**
   * Exported function to list the sheets on the current page. Sheets are
   * included even if they are disabled, or if their media type is disallowed.
   * However, system sheets are marked and excluded from the doctor UI.
   */
  StyleLogic.prototype.getSheets = function getSheets() {
    return Sheet.getAllSheetRemotes();
  };

  /**
   * Exported function to list the rules in a stylesheet.
   */
  StyleLogic.prototype.getRules = function(aId) {
    var sheet = Sheet.getSheet(aId);

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
    var sheet = Sheet._sheets[sheetId];
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
  StyleLogic.prototype.getAnswer = function(selectorOrElement, settingId, options) {
    var element, name;
    if (typeof selectorOrElement == "string") {
      name = selectorOrElement;
      element = document.querySelector(selectorOrElement);
      if (!element) {
        throw new Error("Element " + selectorOrElement + " not found");
      }
    }
    else {
      element = selectorOrElement;
      name = element.id ?
          element.nodeName + "#" + element.id :
          "Selected Element";
    }

    var sheetId = settingId.split("-")[0];
    var sheet = Sheet.getSheet(sheetId);
    var ruleId = settingId.split("-").slice(0, 2).join("-");
    // See above on Sheet._sheets/getSheets()
    if (!sheet.rules) {
      populateRules(sheet);
    }
    var rule = sheet.rules[ruleId];
    if (!rule) {
      throw new Error("Rule " + ruleId + " not found.");
    }
    // See above on Sheet._sheets/getSheets()
    if (!rule.settings) {
      populateSettings(rule);
    }
    var setting = rule.settings[settingId];
    if (!setting) {
      throw new Error("Setting " + settingId + " not found.");
    }

    var answers = findAnswer(element, name, sheet, rule, setting, options);

    return {
      answers: answers,
      html: "<p>" + answers.join("</p><p>") + "</p>"
    };
  };

  window.styleLogic = new StyleLogic();
})();
