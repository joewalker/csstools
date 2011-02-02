/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
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
 *   Mihai Șucan <mihai.sucan@gmail.com>
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
 * An object to allow users to dig into the CSS rules for given elements
 */
function StyleLogic()
{
  if (!(this instanceof StyleLogic)) {
    return new StyleLogic();
  }
};

StyleLogic.prototype = {
  /**
   *
   */
  highlight: function() {
  },

  /**
   * Report on the stylesheets attached to the current page.
   */
  getSheets: function()
  {
    return [
      {
        systemSheet: false, index: 0, shortSource: "styles.css", ruleCount: 10,
        href: "http://example.com/page/styles.css"
      },
      {
        systemSheet: false, index: 1, shortSource: "global.css", ruleCount: 15,
        href: "http://example.com/global.css"
      }
    ];
  },

  /**
   * The user is looking at a property (or properties) at a glance; this
   * returns a map (or maps, one for each property) that details the computed
   * value of the property, and the number of CSS rules that 'match'.
   */
  getPropertyInfo: function(aProperty)
  {
    if (Array.isArray(aProperty)) {
      return aProperty.map(function(aProperty) {
        return this.getPropertyInfo(aProperty);
      }, this);
    }

    return {
      property: aProperty,
      value: 'value',
      matchedRuleCount: 1
    };
  },

  /**
   * Return an array of rule objects where we know that the rule selectors
   * either directly affect the highlighted element, or one of it's parents.
   */
  getSelectors: function(aProperty, aMatched) {
    return [
      {
        line: 20,
        href: "http://example.com/page/styles.css",
        shortSource: "styles:20",
        value: "red",
        status: CssLogic.STATUS.MATCH,
        important: false,
        property: aProperty,
        selector: "body a"
      }
    ];
  }
};


if (this.exports) {
  exports.StyleLogic = StyleLogic;
}



/*
 * About the objects defined in this file:
 * - CssLogic contains style information about a view context. It provides
 *   access to 2 sets of objects: Css[Sheet|Rule|Selector] provide access to
 *   information that does not change when the selected element changes while
 *   Css[Property|Selector]Info provide information that is dependent on the
 *   selected element.
 *   Its key methods are highlight(), getPropertyInfo() and forEachSheet(), etc
 *   It also contains a number of static methods for l10n, naming, etc
 *
 * - CssSheet provides a more useful API to a DOM CSSSheet for our purposes,
 *   including shortSource and href.
 * - CssRule a more useful API to a DOM CSSRule including access to the group
 *   of CssSelectors that the rule provides properties for
 * - CssSelector A single selector - i.e. not a selector group. In other words
 *   a CssSelector does not contain ','. This terminology is different from the
 *   standard DOM API, but more inline with the definition in the spec.
 *
 * - CssPropertyInfo contains style information for a single property for the
 *   highlighted element. It divides the CSS rules on the page into matched and
 *   unmatched rules.
 * - CssSelectorInfo is a wrapper around CssSelector, which adds sorting with
 *   reference to the selected element.
 */

var Cc = require("chrome").Cc;
var Ci = require("chrome").Ci;

/**
 * Duplicating DOM constants is nasty, but it's not as though they're going to
 * change and the alternative is:
 * element.ownerDocument.defaultView.CSSRule.BLAH where element is any handy
 * DOM element. This solution doesn't muddy the code.
 */
var CSSRule = {
  UNKNOWN_RULE: 0,
  STYLE_RULE: 1,
  CHARSET_RULE: 2,
  IMPORT_RULE: 3,
  MEDIA_RULE: 4,
  FONT_FACE_RULE: 5,
  PAGE_RULE: 6
};

/**
 * See note above. Move along, nothing to see here.
 */
var Node = {
  ELEMENT_NODE: 1,
  ATTRIBUTE_NODE: 2,
  TEXT_NODE: 3,
  CDATA_SECTION_NODE: 4,
  ENTITY_REFERENCE_NODE: 5,
  ENTITY_NODE: 6,
  PROCESSING_INSTRUCTION_NODE: 7,
  COMMENT_NODE: 8,
  DOCUMENT_NODE: 9,
  DOCUMENT_TYPE_NODE: 10,
  DOCUMENT_FRAGMENT_NODE: 11,
  NOTATION_NODE: 12,
  DOCUMENT_POSITION_DISCONNECTED: 1,
  DOCUMENT_POSITION_PRECEDING: 2,
  DOCUMENT_POSITION_FOLLOWING: 4,
  DOCUMENT_POSITION_CONTAINS: 8,
  DOCUMENT_POSITION_CONTAINED_BY: 16,
  DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: 32
};

/**
 * Provide access to the style information in a page.
 * CssLogic uses the standard DOM API, and the Gecko inIDOMUtils API to access
 * styling information in the page, and present this to the user in a way that
 * helps them understand:
 * - why their expectations may not have been fulfilled
 * - how browsers process CSS
 * @constructor
 */
function CssLogic()
{
  // Both setup by highlight().
  this.viewedElement = null;
  this.viewedDocument = null;

  // The cache of the known sheets.
  this._sheets = null;

  // The cache of examined CSS properties.
  this._propertyInfos = {};
  // The computed styles for the viewedElement.
  this._computedStyle = null;

  this.domUtils = Cc["@mozilla.org/inspector/dom-utils;1"].
      getService(Ci["inIDOMUtils"]);

  // The total number of rules, in all stylesheets, after filtering.
  this._ruleCount = 0;

  // Source filter. Only display properties coming from the given source
  this._sourceFilter = CssLogic.FILTER.ALL;

  // Used for tracking unique CssSheet/CssRule/CssSelector objects, in a run of
  // processMatchedSelectors().
  this._passId = 0;

  // Used for tracking matched CssSelector objects, such that we can skip them
  // in processUnmatchedSelectors().
  this._matchId = 0;

  this._matchedSelectors = null;
  this._unmatchedSelectors = null;
};

CssLogic.prototype = {
  /**
   * Focus on a new element - remove the style caches
   * @param {nsIDOMElement} aViewedElement the element the user has highlighted
   * in the Inspector
   */
  highlight: function CssLogic_highlight(aViewedElement)
  {
    this._matchedSelectors = null;
    this._unmatchedSelectors = null;

    if (!aViewedElement) {
      this.viewedElement = null;
      this.viewedDocument = null;

      this._sheets = null;
      this._propertyInfos = {};

      this._computedStyle = null;

      this._ruleCount = 0;
      return;
    }

    this.viewedElement = aViewedElement;
    this._propertyInfos = {};

    // Rebuild sheet cache if new document.
    if (this.viewedElement.ownerDocument != this.viewedDocument) {
      this.viewedDocument = this.viewedElement.ownerDocument;
      this._cacheSheets();
    }

    var win = this.viewedDocument.defaultView;
    this._computedStyle = win.getComputedStyle(this.viewedElement, "");

  },

  /**
   * Get the source filter.
   * @returns {string} The source filter being used.
   */
  get sourceFilter() {
    return this._sourceFilter;
  },

  /**
   * Source filter. Only display properties coming from the given source (web
   * address).
   * @see CssLogic.FILTER.*
   */
  set sourceFilter(aValue) {
    var oldValue = this._sourceFilter;
    this._sourceFilter = aValue;

    var ruleCount = 0;

    // Update the CssSheet objects.
    this.forEachSheet(function(aSheet) {
      aSheet._sheetAllowed = -1;
      if (!aSheet.systemSheet && aSheet.sheetAllowed) {
        ruleCount += aSheet.ruleCount;
      }
    }, this);

    this._ruleCount = ruleCount;

    // Full update is needed because the this.processMatchedSelectors() method
    // skips UA stylesheets if the filter does not allow such sheets.
    var needFullUpdate = (oldValue == CssLogic.FILTER.UA ||
        aValue == CssLogic.FILTER.UA);

    if (needFullUpdate) {
      this._matchedSelectors = null;
      this._unmatchedSelectors = null;
      this._propertyInfos = {};
    } else {
      // Update the CssPropertyInfo objects.
      for (var property in this._propertyInfos) {
        this._propertyInfos[property].needRefilter = true;
      }
    }
  },

  /**
   * Return a CssPropertyInfo data structure for the currently viewed element
   * and the specified CSS property. If there is no currently viewed element we
   * return an empty object.
   * If an array of strings is passed in, we return an array of CssPropertyInfos
   * @param {string} aProperty The CSS property to look for.
   * @return {CssPropertyInfo} a CssPropertyInfo structure for the given
   * property.
   */
  getPropertyInfo: function CssLogic_getPropertyInfo(aProperty)
  {
    if (Array.isArray(aProperty)) {
      return aProperty.map(function(aProperty) {
        return this.getPropertyInfo(aProperty);
      }, this);
    }

    if (!this.viewedElement) {
      return {};
    }

    var info = this._propertyInfos[aProperty];
    if (!info) {
      info = new CssPropertyInfo(aProperty);
      this._propertyInfos[aProperty] = info;
    }

    return info;
  },

  /**
   * Process the CssSelector objects that match the highlighted element and its
   * parent elements. aScope.aCallback() is executed for each CssSelector
   * object, being passed the CssSelector object and the match status.
   *
   * This method also includes all of the element.style properties, for each
   * highlighted element parent and for the highlighted element itself.
   *
   * Note that the matched selectors are cached, such that next time your
   * callback is invoked for the cached list of CssSelector objects.
   *
   * @param {function} aCallback the function you want to execute for each of
   * the matched selectors.
   * @param {object} aScope the scope you want for the callback function. aScope
   * will be the this object when aCallback executes.
   */
  processMatchedSelectors: function CL_processMatchedSelectors(aCallback, aScope)
  {
    if (this._matchedSelectors) {
      if (aCallback) {
        this._passId++;
        this._matchedSelectors.forEach(function(aValue) {
          aCallback.call(aScope, aValue[0], aValue[1]);
          aValue[0]._cssRule._passId = this._passId;
        }, this);
      }
      return;
    }

    this._matchedSelectors = [];
    this._unmatchedSelectors = null;
    this._passId++;
    this._matchId++;

    var element = this.viewedElement;
    var filter = this.sourceFilter;
    var sheetIndex = 0;
    var domRules = null;
    do {
      try {
        domRules = this.domUtils.getCSSStyleRules(element);
      } catch (ex) {
        console.log("CssLogic_processMatchedSelectors error: " + ex);
        continue;
      }

      var status = (this.viewedElement == element) ?
          CssLogic.STATUS.MATCHED : CssLogic.STATUS.PARENT_MATCH;

      for (var i = 0; i < domRules.Count(); i++) {
        var domRule = domRules.GetElementAt(i);
        if (domRule.type !== CSSRule.STYLE_RULE) {
          continue;
        }

        var domSheet = domRule.parentStyleSheet;
        var systemSheet = CssLogic.isSystemStyleSheet(domSheet);
        if (filter !== CssLogic.FILTER.UA && systemSheet) {
          continue;
        }

        var sheet = this.getSheet(domSheet, systemSheet, sheetIndex);
        var rule = sheet.getRule(domRule);

        rule.selectors.forEach(function (aSelector) {
          if (aSelector._matchId !== this._matchId &&
              element.mozMatchesSelector(aSelector)) {
            aSelector._matchId = this._matchId;
            this._matchedSelectors.push([ aSelector, status ]);
            if (aCallback) {
              aCallback.call(aScope, aSelector, status);
            }
          }
        }, this);

        if (sheet._passId !== this._passId) {
          sheetIndex++;
          sheet._passId = this._passId;
        }

        if (rule._passId !== this._passId) {
          rule._passId = this._passId;
        }
      }

      // Add element.style information.
      if (element.style.length > 0) {
        var rule = new CssRule(null, { style: element.style }, element);
        var selector = rule.selectors[0];
        selector._matchId = this._matchId;

        this._matchedSelectors.push([ selector, status ]);
        if (aCallback) {
          aCallback.call(aScope, selector, status);
        }
        rule._passId = this._passId;
      }

      element = element.parentNode;
    } while (element && element.nodeType === Node.ELEMENT_NODE);
  },

  /**
   * Process the CssSelector object that do not match the highlighted elements,
   * nor its parents. Your callback function is invoked for every such
   * CssSelector object. You receive one argument: the CssSelector object.
   *
   * The list of unmatched selectors is cached.
   *
   * @param {function} aCallback the function you want to execute for each of
   * the unmatched selectors.
   * @param {object} aScope the scope you want for the callback function. aScope
   * will be the this object when aCallback executes.
   */
  processUnmatchedSelectors: function CL_processUnmatchedSelectors(aCallback, aScope) {
    if (!this._matchedSelectors) {
      this.processMatchedSelectors();
    }

    if (this._unmatchedSelectors) {
      if (aCallback) {
        this._unmatchedSelectors.forEach(aCallback, aScope);
      }
      return;
    }

    this._unmatchedSelectors = [];

    this.forEachSheet(function (aSheet) {
      aSheet.forEachRule(function (aRule) {
        aRule.selectors.forEach(function (aSelector) {
          if (aSelector._matchId != this._matchId) {
            this._unmatchedSelectors.push(aSelector);
            if (aCallback) {
              aCallback.call(aScope, aSelector);
            }
          }
        }, this);
      }, this);
    }, this);
  }
};

/**
 * Not all CSS properties cascade their values to child elements, there seem to
 * be more properties that don't than that do
 * @see http://www.w3.org/TR/CSS21/propidx.html
 * @see http://www.w3.org/TR/css3-text
 * @see http://www.w3.org/TR/css3-multicol
 * @see http://www.w3.org/TR/css3-background
 * @see http://www.w3.org/TR/css3-ui
 * @see http://www.w3.org/TR/css3-color
 * @see http://www.w3.org/TR/css3-2d-transforms
 * @see http://www.w3.org/TR/css3-transitions
 * @see http://www.w3.org/TR/2000/WD-css3-userint-20000216
 * @see http://www.w3.org/TR/WD-font
 * @see http://www.w3.org/TR/SVG/painting.html
 * @see http://www.w3.org/TR/SVG11/interact.html
 */
CssLogic._CASCADING_PROPERTIES = [
  "color", "direction", "font-family", "font-size", "font-size-adjust",
  "font-stretch", "font-style", "font-variant", "font-weight",
  "letter-spacing", "line-height", "quotes", "text-align", "text-indent",
  "text-rendering", "text-shadow", "text-transform", "white-space",
  "word-spacing", "word-wrap", "list-style-image", "list-style-position",
  "list-style-type", "visibility", "caption-side", "cursor", "empty-cells",
  "image-rendering", "pointer-events", "-moz-user-focus", "-moz-user-input",
  "-moz-user-modify"
];

/**
 * Check through CssLogic._CASCADING_PROPERTIES to see if the given property
 * cascades.
 * @param aProperty {string} Does this property cascade values?
 * @returns {boolean} true if the property cascades
 */
CssLogic.isCascading = function CssLogic_isCascading(aProperty)
{
  return CssLogic._CASCADING_PROPERTIES.indexOf(aProperty) > -1;
};

/**
 * If the element has an id, return '#id'. Otherwise return 'tagname[n]' where
 * n is the index of this element in its siblings.
 * <p>A technically more 'correct' output from the no-id case might be:
 * 'tagname:nth-of-type(n)' however this is unlikely to be more understood
 * and it is longer.
 *
 * @param {nsIDOMElement} aElement the element for which you want the short name.
 * @return {string} the string to be displayed for aElement.
 */
CssLogic.getShortName = function CssLogic_getShortName(aElement)
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
  return aElement.tagName + "[" + priorSiblings + "]";
};

/**
 * Get an array of short names from the given element to document.body.
 *
 * @param {nsIDOMElement} aElement the element for which you want the array of
 * short names.
 * @return {array} The array of elements.
 * <p>Each element is an object of the form:
 * <ul>
 * <li>{ display: "what to display for the given (parent) element",
 * <li>  element: referenceToTheElement }
 * </ul>
 */
CssLogic.getShortNamePath = function CssLogic_getShortNamePath(aElement)
{
  var doc = aElement.ownerDocument;
  var reply = [];

  if (!aElement) {
    return reply;
  }

  // We want to exclude nodes high up the tree (body/html) unless the user
  // has selected that node, in which case we need to report something.
  do {
    reply.unshift({
      display: CssLogic.getShortName(aElement),
      element: aElement
    });
    aElement = aElement.parentNode;
  } while (aElement && aElement != doc.body && aElement != doc.documentElement)

  return reply;
};


/**
 * Special values for filter, in addition to an href these values can be used
 */
CssLogic.FILTER = {
  ALL: "all", // show properties from all user style sheets.
  UA: "ua"    // ALL, plus user-agent (i.e. browser) style sheets
};

/**
 * Each rule has a status, the bigger the number, the better placed it is to
 * provide styling information.
 *
 * These statuses are localized inside the inspector.properties string bundle.
 * @see csshtmltree.js RuleView._cacheStatusNames()
 */
CssLogic.STATUS = {
  BEST: 3,
  MATCHED: 2,
  PARENT_MATCH: 1,
  UNMATCHED: 0,
  UNKNOWN: -1
};


/**
 * We're not sure now we're going to do l10n yet, so this is a cut an paste from
 * inspector.properties, with light tweakage so it will work here.
 */
var l10nLookup = {
  // LOCALIZATION NOTE (style.rule.sourceElement, style.rule.sourceInline):
  // These strings are used inside the Style panel of the Inspector tool. Each
  // style property the panel shows the rules which hold that specific property.
  // For every rule, the rule source is also displayed: a rule can come from a
  // file, from the same page (inline), or from the element itself (element).
  "style.rule.sourceElement": "element",
};

/**
 * Memonized lookup of a l10n string from a string bundle.
 * @param {string} aName The key to lookup.
 * @returns A localized version of the given key.
 */
CssLogic.l10n = function CssLogic_l10n(aName)
{
  return l10nLookup[aName];
  /*
  // Alternative to using XPCOMUtils.defineLazyGetter - this keeps the l10n
  // code localized, is less code, and had less dependencies
  if (!CssLogic._strings) {
    CssLogic._strings = Services.strings.createBundle(
        "chrome://browser/locale/inspector.properties");
  }
  return CssLogic._strings.GetStringFromName(aName);
  */
};


//##############################################################################

/**
 * A safe way to access cached bits of information about a stylesheet.
 * @param {CssLogic} aCssLogic pointer to the CssLogic instance working with
 * this CssSheet object
 * @param {CSSStyleSheet} aDomSheet reference to a DOM CSSStyleSheet object
 * @param {boolean} aSystemSheet tells if the stylesheet is system-provided
 * @param {number} aIndex tells the index/position of the stylesheet within the
 * main document
 * @constructor
 */
function CssSheet(aDomSheet, aSystemSheet, aIndex)
{
  this.domSheet = aDomSheet;
  this.systemSheet = aSystemSheet;
  this.index = this.systemSheet ? -100 * aIndex : aIndex;

  // Our href is that of the sheet or the html if we are inline
  this.href = this.domSheet.href;
  if (!this.href) {
    this.href = this.domSheet.ownerNode.ownerDocument.location;
  }

  // null for uncached.
  this._sheetAllowed = null;

  // Cached CssRules from the given stylesheet.
  this._rules = {};

  this._ruleCount = -1;
};

CssSheet.prototype = {
  /**
   * Tells if the sheet is allowed or not by the current CssLogic.sourceFilter.
   *
   * @return {boolean} true if the stylesheet is allowed by the sourceFilter, or
   * false otherwise.
   */
  get sheetAllowed()
  {
    if (this._sheetAllowed !== null) {
      return this._sheetAllowed;
    }

    this._sheetAllowed = true;

    var filter = cssLogic.sourceFilter;
    if (filter === CssLogic.FILTER.ALL && this.systemSheet) {
      this._sheetAllowed = false;
    }
    if (filter !== CssLogic.FILTER.ALL && filter !== CssLogic.FILTER.UA) {
      this._sheetAllowed = (filter === this.href);
    }

    return this._sheetAllowed;
  },

  /**
   * Retrieve the number of rules in this stylesheet.
   *
   * @return {number} the number of CSSRule objects in this stylesheet.
   */
  get ruleCount()
  {
    return this._ruleCount > -1 ?
        this._ruleCount :
        this.domSheet.cssRules.length;
  },

  /**
   * Retrieve a CssRule object for the given CSSStyleRule. The CssRule object is
   * cached, such that subsequent retrievals return the same CssRule object for
   * the same CSSStyleRule object.
   *
   * @param {CSSStyleRule} aDomRule the CSSStyleRule object for which you want a
   * CssRule object.
   * @return {CssRule} the cached CssRule object for the given CSSStyleRule
   * object.
   */
  getRule: function CssSheet_getRule(aDomRule)
  {
    var cacheId = aDomRule.type + aDomRule.selectorText;

    var rule = null;
    var ruleFound = false;

    if (cacheId in this._rules) {
      for (var i = 0, n = this._rules[cacheId].length; i < n; i++) {
        rule = this._rules[cacheId][i];
        if (rule._domRule == aDomRule) {
          ruleFound = true;
          break;
        }
      }
    }

    if (!ruleFound) {
      if (!(cacheId in this._rules)) {
        this._rules[cacheId] = [];
      }

      rule = new CssRule(this, aDomRule);
      this._rules[cacheId].push(rule);
    }

    return rule;
  },

  /**
   * Process each rule in this stylesheet using your callback function. Your
   * function receives one argument: the CssRule object for each CSSStyleRule
   * inside the stylesheet.
   *
   * Note that this method also iterates through @media rules inside the
   * stylesheet.
   *
   * @param {function} aCallback the function you want to execute for each of
   * the style rules.
   * @param {object} aScope the scope you want for the callback function. aScope
   * will be the this object when aCallback executes.
   */
  forEachRule: function CssSheet_forEachRule(aCallback, aScope)
  {
    var ruleCount = 0;
    var domRules = this.domSheet.cssRules;

    function _iterator(aDomRule) {
      if (aDomRule.type == CSSRule.STYLE_RULE) {
        aCallback.call(aScope, this.getRule(aDomRule));
        ruleCount++;
      } else if (aDomRule.type == CSSRule.MEDIA_RULE && aDomRule.cssRules &&
          CssLogic.sheetMediaAllowed(aDomRule)) {
        Array.prototype.forEach.call(aDomRule.cssRules, _iterator, this);
      }
    };

    Array.prototype.forEach.call(domRules, _iterator, this);

    this._ruleCount = ruleCount;
  },

  toString: function CssSheet_toString()
  {
    return "CssSheet[" + this.shortSource + "]";
  }
};


//##############################################################################

/**
 * Information about a single CSSStyleRule.
 *
 * @param {CSSSheet|null} aCssSheet the CssSheet object of the stylesheet that
 * holds the CSSStyleRule. If the rule comes from element.style, set this
 * argument to null.
 * @param {CSSStyleRule|object} aDomRule the DOM CSSStyleRule for which you want
 * to cache data. If the rule comes from element.style, then provide
 * an object of the form: {style: element.style}.
 * @param {Element} [aElement] If the rule comes from element.style, then this
 * argument must point to the element.
 * @constructor
 */
function CssRule(aCssSheet, aDomRule, aElement)
{
  this._cssSheet = aCssSheet;
  this._domRule = aDomRule;

  if (this._cssSheet) {
    // parse _domRule.selectorText on call to this.selectors
    this._selectors = null;
    this.line = cssLogic.domUtils.getRuleLine(this._domRule);
    this.source = this._cssSheet.shortSource + ":" + this.line;
    this.href = this._cssSheet.href;
    this.systemRule = this._cssSheet.systemSheet;
  } else if (aElement) {
    this._selectors = [ new CssSelector(this, "@element.style") ];
    this.line = -1;
    this.source = CssLogic.l10n("style.rule.sourceElement");
    this.href = "#";
    this.systemRule = false;
    this.sourceElement = aElement;
  }
};

CssRule.prototype = {
  /**
   * Check if the parent stylesheet is allowed by the CssLogic.sourceFilter.
   *
   * @return {boolean} true if the parent stylesheet is allowed by the current
   * sourceFilter, or false otherwise.
   */
  get sheetAllowed()
  {
    return this._cssSheet ? this._cssSheet.sheetAllowed : true;
  },

  /**
   * Retrieve the parent stylesheet index/position in the viewed document.
   *
   * @return {number} the parent stylesheet index/position in the viewed
   * document.
   */
  get sheetIndex()
  {
    return this._cssSheet ? this._cssSheet.index : 0;
  },

  /**
   * Retrieve the style property value from the current CSSStyleRule.
   *
   * @param {string} aProperty the CSS property name for which you want the
   * value.
   * @return {string} the property value.
   */
  getPropertyValue: function(aProperty)
  {
    return this._domRule.style.getPropertyValue(aProperty);
  },

  /**
   * Retrieve the style property priority from the current CSSStyleRule.
   *
   * @param {string} aProperty the CSS property name for which you want the
   * priority.
   * @return {string} the property priority.
   */
  getPropertyPriority: function(aProperty)
  {
    return this._domRule.style.getPropertyPriority(aProperty);
  },

  /**
   * Retrieve the list of CssSelector objects for each of the parsed selectors
   * of the current CSSStyleRule.
   *
   * @return {array} the array hold the CssSelector objects.
   */
  get selectors()
  {
    if (this._selectors) {
      return this._selectors;
    }

    // Parse the CSSStyleRule.selectorText string.
    this._selectors = [];

    if (!this._domRule.selectorText) {
      return this._selectors;
    }

    var selector = this._domRule.selectorText.trim();
    if (!selector) {
      return this._selectors;
    }

    var nesting = 0;
    var currentSelector = [];

    // Parse a selector group into selectors. Normally we could just .split(',')
    // however Gecko allows -moz-any(a, b, c) as a selector so we ignore commas
    // inside brackets.
    for (var i = 0; i < selector.length; i++) {
      var c = selector.charAt(i);
      switch (c) {
        case ",":
          if (nesting == 0 && currentSelector.length > 0) {
            var selectorStr = currentSelector.join("").trim();
            if (selectorStr) {
              this._selectors.push(new CssSelector(this, selectorStr));
            }
            currentSelector = [];
          } else {
            currentSelector.push(c);
          }
          break;

        case "(":
          nesting++;
          currentSelector.push(c);
          break;

        case ")":
          nesting--;
          currentSelector.push(c);
          break;

        default:
          currentSelector.push(c);
          break;
      }
    }

    // Add the last selector.
    if (nesting == 0 && currentSelector.length > 0) {
      var selectorStr = currentSelector.join("").trim();
      if (selectorStr) {
        this._selectors.push(new CssSelector(this, selectorStr));
      }
    }

    return this._selectors;
  },

  toString: function CssRule_toString()
  {
    return "[CssRule " + this._domRule.selectorText + "]";
  }
};


//##############################################################################

/**
 * The CSS selector class allows us to document the ranking of various CSS
 * selectors.
 *
 * @constructor
 * @param {CssRule} aCssRule the CssRule instance from where the selector comes.
 * @param {string} aSelector The selector that we wish to investigate.
 */
function CssSelector(aCssRule, aSelector)
{
  this._cssRule = aCssRule;
  this.text = aSelector;
  this.elementStyle = this.text == "@element.style";
  this._specificity = null;
};

CssSelector.prototype = {
  /**
   * Retrieve the CssSelector source, which is the source of the CssSheet owning
   * the selector.
   *
   * @return {string} the selector source.
   */
  get source()
  {
    return this._cssRule.source;
  },

  /**
   * Retrieve the CssSelector source element, which is the source of the CssRule
   * owning the selector. This is only available when the CssSelector comes from
   * an element.style.
   *
   * @return {string} the source element selector.
   */
  get sourceElement()
  {
    return this._cssRule.sourceElement;
  },

  /**
   * Retrieve the address of the CssSelector. This points to the address of the
   * CssSheet owning this selector.
   *
   * @return {string} the address of the CssSelector.
   */
  get href()
  {
    return this._cssRule.href;
  },

  /**
   * Check if the selector comes from a browser-provided stylesheet.
   *
   * @return {boolean} true if the selector comes from a browser-provided
   * stylesheet, or false otherwise.
   */
  get systemRule()
  {
    return this._cssRule.systemRule;
  },

  /**
   * Check if the parent stylesheet is allowed by the CssLogic.sourceFilter.
   *
   * @return {boolean} true if the parent stylesheet is allowed by the current
   * sourceFilter, or false otherwise.
   */
  get sheetAllowed()
  {
    return this._cssRule.sheetAllowed;
  },

  /**
   * Retrieve the parent stylesheet index/position in the viewed document.
   *
   * @return {number} the parent stylesheet index/position in the viewed
   * document.
   */
  get sheetIndex()
  {
    return this._cssRule.sheetIndex;
  },

  /**
   * Retrieve the line of the parent CSSStyleRule in the parent CSSStyleSheet.
   *
   * @return {number} the line of the parent CSSStyleRule in the parent
   * stylesheet.
   */
  get ruleLine()
  {
    return this._cssRule.line;
  },

  /**
   * Retrieve specificity information for the current selector.
   *
   * @see http://www.w3.org/TR/css3-selectors/#specificity
   * @see http://www.w3.org/TR/CSS2/selector.html
   *
   * @return {object} an object holding specificity information for the current
   * selector.
   */
  get specificity()
  {
    if (this._specificity) {
      return this._specificity;
    }

    var specificity = {};

    specificity.ids = 0;
    specificity.classes = 0;
    specificity.tags = 0;

    // Split on CSS combinators (section 5.2).
    // TODO: We need to properly parse the selector. See bug 590090.
    if (!this.elementStyle) {
      this.text.split(/[ >+]/).forEach(function(aSimple) {
        // The regex leaves empty nodes combinators like ' > '
        if (!aSimple) {
          return;
        }
        // See http://www.w3.org/TR/css3-selectors/#specificity
        // We can count the IDs by counting the '#' marks.
        specificity.ids += (aSimple.match(/#/g) || []).length;
        // Similar with class names and attribute matchers
        specificity.classes += (aSimple.match(/\./g) || []).length;
        specificity.classes += (aSimple.match(/\[/g) || []).length;
        // Pseudo elements count as elements.
        specificity.tags += (aSimple.match(/:/g) || []).length;
        // If we have anything of substance before we get into ids/classes/etc
        // then it must be a tag if it isn't '*'.
        var tag = aSimple.split(/[#.[:]/)[0];
        if (tag && tag != "*") {
          specificity.tags++;
        }
      }, this);
    }

    this._specificity = specificity;

    return this._specificity;
  },

  toString: function CssSelector_toString()
  {
    return this.text;
  }
};


//##############################################################################

/**
 * A cache of information about the matched rules, selectors and values attached
 * to a CSS property, for the highlighted element.
 *
 * The heart of the CssPropertyInfo object is the _findMatchedSelectors() and
 * _findUnmatchedSelectors() methods. These are invoked when the PropertyView
 * tries to access the .matchedSelectors and .unmatchedSelectors arrays.
 * Results are cached, for later reuse.
 *
 * @param {string} aProperty The CSS property we are gathering information for
 * @constructor
 */
function CssPropertyInfo(aProperty)
{
  this.property = aProperty;

  if (cssLogic._computedStyle) {
    try {
      this.value = cssLogic._computedStyle.getPropertyValue(this.property);
    } catch (ex) {
      this.value = "";
      console.log('Error reading computed style for ' + this.property);
      console.log(ex);
    }
  } else {
    this.value = "";
  }

  // The number of matched rules holding the this.property style property.
  // Additionally, only rules that come from allowed stylesheets are counted.
  // TODO: Isn't this always == matchedSelectors.length?
  this.matchedRuleCount = 0;

  // An array holding CssSelectorInfo objects for each of the matched selectors
  // that are inside a CSS rule. Only rules that hold the this.property are
  // counted. This includes rules that come from filtered stylesheets (those
  // that have sheetAllowed = false).
  this.matchedSelectors = null;
  // Retrieve the number of matched rules holding the this.property style
  // property. Only rules that come from allowed stylesheets are counted.
  this._findMatchedSelectors();
};

CssPropertyInfo.prototype = {
  /**
   * Find the selectors that match the highlighted element and its parents.
   * Uses CssLogic.processMatchedSelectors() to find the matched selectors,
   * passing in a reference to CssPropertyInfo._processMatchedSelector() to
   * create CssSelectorInfo objects, which we then sort
   * @private
   */
  _findMatchedSelectors: function CssPropertyInfo_findMatchedSelectors()
  {
    this.matchedSelectors = [];
    this.matchedRuleCount = 0;

    cssLogic.processMatchedSelectors(this._processMatchedSelector, this);

    // Sort the selectors by how well they match the given element.
    this.matchedSelectors.sort(function(aSelectorInfo1, aSelectorInfo2) {
      if (aSelectorInfo1.status > aSelectorInfo2.status) {
        return -1;
      } else if (aSelectorInfo2.status > aSelectorInfo1.status) {
        return 1;
      } else {
        return aSelectorInfo1.compareTo(aSelectorInfo2);
      }
    });

    // Now we know which of the matches is best, we can mark it BEST_MATCH.
    if (this.matchedSelectors.length > 0 &&
        this.matchedSelectors[0].status > CssLogic.STATUS.UNMATCHED) {
      this.matchedSelectors[0].status = CssLogic.STATUS.BEST;
    }
  },

  /**
   * Process a matched CssSelector object
   * @param {CssSelector} aSelector the matched CssSelector object.
   * @param {CssLogic.STATUS} aStatus the CssSelector match status.
   * @private
   */
  _processMatchedSelector: function CPI_processMatchedSelector(aSelector, aStatus)
  {
    var cssRule = aSelector._cssRule;

    var cascading = CssLogic.isCascading(this.property);
    if (!cascading && aStatus === CssLogic.STATUS.PARENT_MATCH) {
      return;
    }

    var value = cssRule.getPropertyValue(this.property);
    if (!value) {
      return;
    }

    var selectorInfo = new CssSelectorInfo(aSelector, this.property, value,
        aStatus);
    this.matchedSelectors.push(selectorInfo);
    if (cssLogic._passId !== cssRule._passId && cssRule.sheetAllowed) {
      this.matchedRuleCount++;
    }
  },

  /**
   * Retrieve the number of unmatched rules
   * @return {number} the number of rules that do not match the highlighted
   * element or its parents
   */
  get unmatchedRuleCount()
  {
    if (!this._unmatchedSelectors) {
      this._findUnmatchedSelectors();
    } else if (this.needRefilter) {
      this._refilterSelectors();
    }

    return this._unmatchedRuleCount;
  },

  /**
   * Retrieve the array holding CssSelectorInfo objects for each of the matched
   * selectors, from each of the matched rules. Only selectors coming from
   * allowed stylesheets are included in the array.
   *
   * @return {array} the list of CssSelectorInfo objects of selectors that match
   * the highlighted element and its parents.
   */
  get matchedSelectors()
  {
    if (!this.matchedSelectors) {
      this._findMatchedSelectors();
    } else if (this.needRefilter) {
      this._refilterSelectors();
    }

    return this.matchedSelectors;
  },

  /**
   * Retrieve the array holding CssSelectorInfo objects for each of the
   * unmatched selectors, from each of the unmatched rules. Only selectors
   * coming from allowed stylesheets are included in the array.
   *
   * @return {array} the list of CssSelectorInfo objects of selectors that do
   * not match the highlighted element or its parents.
   */
  get unmatchedSelectors()
  {
    if (!this._unmatchedSelectors) {
      this._findUnmatchedSelectors();
    } else if (this.needRefilter) {
      this._refilterSelectors();
    }

    return this._unmatchedSelectors;
  },

  /**
   * Find the selectors that do not match the highlighted element and its
   * parents.
   * @private
   */
  _findUnmatchedSelectors: function CssPropertyInfo_findUnmatchedSelectors()
  {
    this._unmatchedSelectors = [];
    this._unmatchedRuleCount = 0;
    this.needRefilter = false;
    cssLogic._passId++;

    cssLogic.processUnmatchedSelectors(this._processUnmatchedSelector, this);

    // Sort the selectors by specificity.
    this._unmatchedSelectors.sort(function(aSelectorInfo1, aSelectorInfo2) {
      return aSelectorInfo1.compareTo(aSelectorInfo2);
    });
  },

  /**
   * Process an unmatched CssSelector object.
   *
   * @private
   * @param {CssSelector} aSelector the unmatched CssSelector object.
   */
  _processUnmatchedSelector: function CPI_processUnmatchedSelector(aSelector)
  {
    var cssRule = aSelector._cssRule;
    if (cssRule.systemRule) {
      return;
    }

    var value = cssRule.getPropertyValue(this.property);
    if (value) {
      var selectorInfo = new CssSelectorInfo(aSelector, this.property, value,
          CssLogic.STATUS.UNMATCHED);
      this._unmatchedSelectors.push(selectorInfo);
      if (cssLogic._passId != cssRule._passId) {
        if (cssRule.sheetAllowed) {
          this._unmatchedRuleCount++;
        }
        cssRule._passId = cssLogic._passId;
      }
    }
  },

  /**
   * Refilter the matched and unmatched selectors arrays when the
   * CssLogic.sourceFilter changes. This allows for quick filter changes.
   * @private
   */
  _refilterSelectors: function CssPropertyInfo_refilterSelectors()
  {
    var passId = ++cssLogic._passId;

    var ruleCount = 0;
    var loopFn = function(aSelectorInfo) {
      var cssRule = aSelectorInfo.selector._cssRule;
      if (cssRule._passId != passId) {
        if (cssRule.sheetAllowed) {
          ruleCount++;
        }
        cssRule._passId = passId;
      }
    };

    if (this.matchedSelectors) {
      this.matchedSelectors.forEach(function(aSelectorInfo) {
        var cssRule = aSelectorInfo.selector._cssRule;
        if (cssRule._passId != passId) {
          if (cssRule.sheetAllowed) {
            ruleCount++;
          }
          cssRule._passId = passId;
        }
      });
      this.matchedRuleCount = ruleCount;
    }

    if (this._unmatchedSelectors) {
      ruleCount = 0;
      this._unmatchedSelectors.forEach(function(aSelectorInfo) {
        var cssRule = aSelectorInfo.selector._cssRule;
        if (!cssRule.systemRule && cssRule._passId != passId) {
          if (cssRule.sheetAllowed) {
            ruleCount++;
          }
          cssRule._passId = passId;
        }
      });
      this._unmatchedRuleCount = ruleCount;
    }

    this.needRefilter = false;
  },

  toString: function CssPropertyInfo_toString()
  {
    return "CssPropertyInfo[" + this.property + "]";
  }
};


//##############################################################################

/**
 * A class that holds information about a given CssSelector object.
 *
 * Instances of this class are given to CssHtmlTree in the arrays of matched and
 * unmatched selectors. Each such object represents a displayable row in the
 * PropertyView objects. The information given by this object blends data coming
 * from the CssSheet, CssRule and from the CssSelector that own this object.
 *
 * @param {CssSelector} the CssSelector object for which to present information.
 * @param {string} the property for which information should be retrieved.
 * @param {string} the property value from the CssRule that owns the selector.
 * @param {CssLogic.STATUS} the selector match status.
 * @constructor
 */
function CssSelectorInfo(aSelector, aProperty, aValue, aStatus)
{
  this.selector = aSelector;
  this.property = aProperty;
  this.value = aValue;
  this.status = aStatus;

  var priority = this.selector._cssRule.getPropertyPriority(this.property);
  this.important = (priority === "important");

  /* Score prefix:
  0 UA normal property
  1 UA important property
  2 normal property
  3 inline (element.style)
  4 important
  5 inline important
  */
  var scorePrefix = this.systemRule ? 0 : 2;
  if (this.elementStyle) {
    scorePrefix++;
  }
  if (this.important) {
    scorePrefix += this.systemRule ? 1 : 2;
  }

  // TODO: This isn't used anywhere any more, we can safely delete it.
  // Maybe we can go further and clean lots of bits up?
  this.specificityScore = "" + scorePrefix + this.specificity.ids +
      this.specificity.classes + this.specificity.tags;
};

CssSelectorInfo.prototype = {
  /**
   * Retrieve the CssSelector source, which is the source of the CssSheet owning
   * the selector.
   *
   * @return {string} the selector source.
   */
  get source()
  {
    return this.selector.source;
  },

  /**
   * Retrieve the CssSelector source element, which is the source of the CssRule
   * owning the selector. This is only available when the CssSelector comes from
   * an element.style.
   *
   * @return {string} the source element selector.
   */
  get sourceElement()
  {
    return this.selector.sourceElement;
  },

  /**
   * Retrieve the address of the CssSelector. This points to the address of the
   * CssSheet owning this selector.
   *
   * @return {string} the address of the CssSelector.
   */
  get href()
  {
    return this.selector.href;
  },

  /**
   * Check if the CssSelector comes from element.style or not.
   *
   * @return {boolean} true if the CssSelector comes from element.style, or
   * false otherwise.
   */
  get elementStyle()
  {
    return this.selector.elementStyle;
  },

  /**
   * Retrieve specificity information for the current selector.
   *
   * @return {object} an object holding specificity information for the current
   * selector.
   */
  get specificity()
  {
    return this.selector.specificity;
  },

  /**
   * Retrieve the parent stylesheet index/position in the viewed document.
   *
   * @return {number} the parent stylesheet index/position in the viewed
   * document.
   */
  get sheetIndex()
  {
    return this.selector.sheetIndex;
  },

  /**
   * Check if the parent stylesheet is allowed by the CssLogic.sourceFilter.
   *
   * @return {boolean} true if the parent stylesheet is allowed by the current
   * sourceFilter, or false otherwise.
   */
  get sheetAllowed()
  {
    return this.selector.sheetAllowed;
  },

  /**
   * Retrieve the line of the parent CSSStyleRule in the parent CSSStyleSheet.
   *
   * @return {number} the line of the parent CSSStyleRule in the parent
   * stylesheet.
   */
  get ruleLine()
  {
    return this.selector.ruleLine;
  },

  /**
   * Check if the selector comes from a browser-provided stylesheet.
   *
   * @return {boolean} true if the selector comes from a browser-provided
   * stylesheet, or false otherwise.
   */
  get systemRule()
  {
    return this.selector.systemRule;
  },

  /**
   * Compare the current CssSelectorInfo instance to another instance, based on
   * specificity information.
   *
   * @param {CssSelectorInfo} aThat The instance to compare ourselves against.
   * @return number -1, 0, 1 depending on how aThat compares with this.
   */
  compareTo: function CssSelectorInfo_compareTo(aThat)
  {
    if (this.systemRule && !aThat.systemRule) return 1;
    if (!this.systemRule && aThat.systemRule) return -1;

    if (this.elementStyle && !aThat.elementStyle) {
      if (!this.important && aThat.important) return 1;
      else return -1;
    }

    if (!this.elementStyle && aThat.elementStyle) {
      if (this.important && !aThat.important) return -1;
      else return 1;
    }

    if (this.important && !aThat.important) return -1;
    if (aThat.important && !this.important) return 1;

    if (this.specificity.ids > aThat.specificity.ids) return -1;
    if (aThat.specificity.ids > this.specificity.ids) return 1;

    if (this.specificity.classes > aThat.specificity.classes) return -1;
    if (aThat.specificity.classes > this.specificity.classes) return 1;

    if (this.specificity.tags > aThat.specificity.tags) return -1;
    if (aThat.specificity.tags > this.specificity.tags) return 1;

    if (this.sheetIndex > aThat.sheetIndex) return -1;
    if (aThat.sheetIndex > this.sheetIndex) return 1;

    if (this.ruleLine > aThat.ruleLine) return -1;
    if (aThat.ruleLine > this.ruleLine) return 1;

    return 0;
  },

  toString: function CssSelectorInfo_toString()
  {
    return this.selector + " -> " + this.value;
  }
};

//##############################################################################

/**
 * TODO: Allow this to be created outside so we don't have a singleton issue
 */
var cssLogic = new CssLogic();

exports.cssLogic = cssLogic;

/*
exports.CssSheet = CssSheet;
exports.CssRule = CssRule;
exports.CssSelector = CssSelector;
exports.CssPropertyInfo = CssPropertyInfo;
exports.CssSelectorInfo = CssSelectorInfo;
*/
