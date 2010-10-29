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

var { Cc, Ci } = require("chrome");

// Introduced in DOM Level 2:
var CSSRule = {
  UNKNOWN_RULE: 0,
  STYLE_RULE: 1,
  CHARSET_RULE: 2,
  IMPORT_RULE: 3,
  MEDIA_RULE: 4,
  FONT_FACE_RULE: 5,
  PAGE_RULE: 6,
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
function CssLogic(options)
{
  if (!(this instanceof CssLogic)) {
    return new CssLogic(options);
  }

  // Both setup by highlight().
  this.viewedElement = null;
  this.viewedDocument = null;

  // The cache of the known sheets.
  this._sheets = null;

  // The total number of rules, in all stylesheets, after filtering.
  this._ruleCount = 0;

  // The cache of examined CSS properties.
  this._propertyInfos = {};
  // The computed styles for the viewedElement.
  this._computedStyle = null;

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

  this.domUtils = Cc["@mozilla.org/inspector/dom-utils;1"].
      getService(Ci["inIDOMUtils"]);
};

/**
 * Special values for filter, in addition to an href these values can be used
 */
CssLogic.FILTER = {
  ALL: "all", // show properties from all user style sheets.
  UA: "ua",   // ALL, plus user-agent (i.e. browser) style sheets
};

/**
 * Known media values. To distinguish "all" stylesheets (above) from "all" media
 * The full list includes braille, embossed, handheld, print, projection,
 * speech, tty, and tv, but this is only a hack because these are not defined
 * in the DOM at all.
 * @see http://www.w3.org/TR/CSS21/media.html#media-types
 */
CssLogic.MEDIA = {
  ALL: "all",
  SCREEN: "screen",
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
  UNKNOWN: -1,
};

CssLogic.prototype = {
  /**
   * Focus on a new element - remove the style caches.
   *
   * @param {nsIDOMElement} aViewedElement the element the user has highlighted
   * in the Inspector.
   */
  highlight: function CssLogic_highlight(aViewedElement)
  {
    if (!aViewedElement) {
      this.viewedElement = null;
      this.viewedDocument = null;

      this._sheets = null;
      this._propertyInfos = {};
      this._ruleCount = 0;

      this._computedStyle = null;
      this._matchedSelectors = null;
      this._unmatchedSelectors = null;
      return;
    }

    this.viewedElement = aViewedElement;

    let doc = this.viewedElement.ownerDocument;
    if (doc != this.viewedDocument) {
      // New document: clear/rebuild the cache.
      this.viewedDocument = doc;

      // Hunt down top level stylesheets, and cache them.
      this._cacheSheets();
    } else {
      // Clear cached data in the CssPropertyInfo objects.
      this._propertyInfos = {};
    }

    this._matchedSelectors = null;
    this._unmatchedSelectors = null;
    let win = this.viewedDocument.defaultView;
    this._computedStyle = win.getComputedStyle(this.viewedElement, "");
  },

  /**
   * Get the source filter.
   * @returns {string} The source filter being used.
   */
  getSourceFilter: function() {
    return this._sourceFilter;
  },

  /**
   * Source filter. Only display properties coming from the given source (web
   * address).
   * @see CssLogic.FILTER.*
   */
  setSourceFilter: function(aValue) {
    let oldValue = this._sourceFilter;
    this._sourceFilter = aValue;

    let ruleCount = 0;

    // Update the CssSheet objects.
    this.forEachSheet(function(aSheet) {
      aSheet._sheetAllowed = -1;
      if (!aSheet.systemSheet && aSheet.getSheetAllowed()) {
        ruleCount += aSheet.ruleCount;
      }
    }, this);

    this._ruleCount = ruleCount;

    // Full update is needed because the this.processMatchedSelectors() method
    // skips UA stylesheets if the filter does not allow such sheets.
    let needFullUpdate = (oldValue == CssLogic.FILTER.UA ||
        aValue == CssLogic.FILTER.UA);

    if (needFullUpdate) {
      this._matchedSelectors = null;
      this._unmatchedSelectors = null;
      this._propertyInfos = {};
    } else {
      // Update the CssPropertyInfo objects.
      for (let property in this._propertyInfos) {
        this._propertyInfos[property].needRefilter = true;
      }
    }
  },

  /**
   * Return a CssPropertyInfo data structure for the currently viewed element
   * and the specified CSS property. If there is no currently viewed element we
   * return an empty object.
   * 
   * @param {string} aProperty The CSS property to look for.
   * @return {CssPropertyInfo} a CssPropertyInfo structure for the given
   * property.
   */
  getPropertyInfo: function CssLogic_getPropertyInfo(aProperty)
  {
    if (!this.viewedElement) {
      return {};
    }

    let info = this._propertyInfos[aProperty];
    if (!info) {
      info = new CssPropertyInfo(this, aProperty);
      this._propertyInfos[aProperty] = info;
    }

    return info;
  },

  /**
   * Cache all the stylesheets in the inspected document
   * @private
   */
  _cacheSheets: function CssLogic_cacheSheets()
  {
    this._sheets = {};
    this._propertyInfos = {};
    this._matchedSelectors = null;
    this._unmatchedSelectors = null;
    this._ruleCount = 0;
    this._passId++;
    this._sheetIndex = 0;

    // styleSheets isn't an array, but forEach can work on it anyway
    Array.prototype.forEach.call(this.viewedDocument.styleSheets,
        this._cacheSheet, this);
  },

  /**
   * Cache a stylesheet if it falls within the requirements: if it's enabled,
   * and if the @media is allowed. This method also walks through the stylesheet
   * cssRules to find @imported rules, to cache the stylesheets of those rules
   * as well.
   *
   * @private
   * @param {CSSStyleSheet} aDomSheet the CSSStyleSheet object to cache.
   */
  _cacheSheet: function CssLogic_cacheSheet(aDomSheet)
  {
    if (aDomSheet.disabled) {
      return;
    }

    // Only work with stylesheets that have their media allowed.
    if (!CssLogic.sheetMediaAllowed(aDomSheet)) {
      return;
    }

    // Cache the sheet.
    let cssSheet = this.getSheet(aDomSheet, false, this._sheetIndex++);
    if (cssSheet._passId != this._passId) {
      cssSheet._passId = this._passId;

      // Find import rules.
      Array.prototype.forEach.call(aDomSheet.cssRules, function(aDomRule) {
        if (aDomRule.type == CSSRule.IMPORT_RULE && aDomRule.styleSheet &&
            CssLogic.sheetMediaAllowed(aDomRule)) {
          this._cacheSheet(aDomRule.styleSheet);
        }
      }, this);
    }
  },

  /**
   * Retrieve the list of stylesheets in the document.
   *
   * @return {array} the list of stylesheets in the document.
   */
  getSheets: function()
  {
    if (!this._sheets) {
      this._cacheSheets();
    }

    let sheets = [];
    this.forEachSheet(function (aSheet) {
      if (!aSheet.systemSheet) {
        sheets.push(aSheet);
      }
    }, this);

    return sheets;
  },

  /**
   * Retrieve a CssSheet object for a given a CSSStyleSheet object. If the
   * stylesheet is already cached, you get the existing CssSheet object,
   * otherwise the new CSSStyleSheet object is cached.
   *
   * @param {CSSStyleSheet} aDomSheet the CSSStyleSheet object you want.
   * @param {boolean} aSystemSheet tells if the stylesheet is a browser-provided
   * sheet or not.
   * @param {number} aIndex the index, within the document, of the stylesheet.
   *
   * @return {CssSheet} the CssSheet object for the given CSSStyleSheet object.
   */
  getSheet: function CL_getSheet(aDomSheet, aSystemSheet, aIndex)
  {
    let cacheId = aSystemSheet ? "1" : "0";

    if (aDomSheet.href) {
      cacheId += aDomSheet.href;
    } else if (aDomSheet.ownerNode && aDomSheet.ownerNode.ownerDocument) {
      cacheId += aDomSheet.ownerNode.ownerDocument.location;
    }

    let sheet = null;
    let sheetFound = false;

    if (cacheId in this._sheets) {
      for (let i = 0, n = this._sheets[cacheId].length; i < n; i++) {
        sheet = this._sheets[cacheId][i];
        if (sheet.domSheet == aDomSheet) {
          sheet.index = aIndex;
          sheetFound = true;
          break;
        }
      }
    }

    if (!sheetFound) {
      if (!(cacheId in this._sheets)) {
        this._sheets[cacheId] = [];
      }

      sheet = new CssSheet(this, aDomSheet, aSystemSheet, aIndex);
      if (sheet.getSheetAllowed() && !aSystemSheet) {
        this._ruleCount += sheet.getRuleCount();
      }

      this._sheets[cacheId].push(sheet);
    }

    return sheet;
  },

  /**
   * Process each cached stylesheet in the document using your callback.
   *
   * @param {function} aCallback the function you want executed for each of the
   * CssSheet objects cached.
   * @param {object} aScope the scope you want for the callback function. aScope
   * will be the this object when aCallback executes.
   */
  forEachSheet: function CssLogic_forEachSheet(aCallback, aScope)
  {
    for (let cacheId in this._sheets) {
      this._sheets[cacheId].forEach(aCallback, aScope);
    }
  },

  /**
   * Get the number CSSRule objects in the document, counted from all of the
   * stylesheets. System sheets are excluded. If a filter is active, this tells
   * only the number of CSSRule objects inside the selected CSSStyleSheet.
   *
   * WARNING: This only provides an estimate of the rule count, and the results
   * could change at a later date. Todo remove this
   *
   * @return {number} the number of CSSRules (all rules, or from the filtered
   * stylesheet).
   */
  getRuleCount: function()
  {
    if (!this._sheets) {
      this._cacheSheets();
    }

    return this._ruleCount;
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

    let element = this.viewedElement;
    let filter = this.getSourceFilter();
    let sheetIndex = 0;
    let domRules = null;
    do {
      try {
        domRules = this.domUtils.getCSSStyleRules(element);
      } catch (ex) {
        console.log("CssLogic_processMatchedSelectors error: " + ex);
        continue;
      }

      let status = (this.viewedElement == element) ?
          CssLogic.STATUS.MATCHED : CssLogic.STATUS.PARENT_MATCH;

      for (let i = 0; i < domRules.Count(); i++) {
        let domRule = domRules.GetElementAt(i);
        if (domRule.type !== CSSRule.STYLE_RULE) {
          continue;
        }

        let domSheet = domRule.parentStyleSheet;
        let systemSheet = CssLogic.isSystemStyleSheet(domSheet);
        if (filter !== CssLogic.FILTER.UA && systemSheet) {
          continue;
        }

        let sheet = this.getSheet(domSheet, systemSheet, sheetIndex);
        let rule = sheet.getRule(domRule);

        rule.getSelectors().forEach(function (aSelector) {
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
        let rule = new CssRule(null, { style: element.style }, element);
        let selector = rule.getSelectors()[0];
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
  processUnmatchedSelectors: function CL_processUnmatchedSelectors(aCallback, aScope)
  {
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
        aRule.getSelectors().forEach(function (aSelector) {
          if (aSelector._matchId != this._matchId) {
            this._unmatchedSelectors.push(aSelector);
            if (aCallback) {
              aCallback.call(aScope, aSelector);
            }
          }
        }, this);
      }, this);
    }, this);
  },
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
  let priorSiblings = 0;
  let temp = aElement;
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
  let doc = aElement.ownerDocument;
  let reply = [];

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
 * Memonized lookup of a l10n string from a string bundle.
 * @param {string} aName The key to lookup.
 * @returns A localized version of the given key.
 */
CssLogic.l10n = function CssLogic_l10n(aName)
{
  // Alternative to using XPCOMUtils.defineLazyGetter - this keeps the l10n
  // code localized, is less code, and had less dependencies
  if (!CssLogic._strings) {
    CssLogic._strings = Services.strings.createBundle(
        "chrome://browser/locale/inspector.properties");
  }
  return CssLogic._strings.GetStringFromName(aName);
};

/**
 * Is the given property sheet a system (user agent) stylesheet?
 *
 * @param {CSSStyleSheet} aSheet a stylesheet
 * @return {boolean} true if the given stylesheet is a system stylesheet or 
 * false otherwise.
 */
CssLogic.isSystemStyleSheet = function CssLogic_isSystemStyleSheet(aSheet)
{
  if (!aSheet) {
    return true;
  }

  let url = aSheet.getHref();

  if (!url) return false;
  if (url.length === 0) return true;
  if (url[0] === 'h') return false;
  if (url.substr(0, 9) === "resource:") return true;
  if (url.substr(0, 7) === "chrome:") return true;
  if (url === "XPCSafeJSObjectWrapper.cpp") return true;
  if (url.substr(0, 6) === "about:") return true;

  return false;
};

/**
 * Check if the given DOM CSS object holds an allowed media. Currently we only
 * allow media screen or all.
 *
 * @param {CSSStyleSheet|CSSImportRule|CSSMediaRule} aDomObject the
 * DOM object you want checked.
 * @return {boolean} true if the media description is allowed, or false
 * otherwise.
 */
CssLogic.sheetMediaAllowed = function CssLogic_sheetMediaAllowed(aDomObject)
{
  let result = false;
  let media = aDomObject.media;

  if (media.length > 0) {
    let mediaItem = null;
    for (let m = 0; m < media.length; m++) {
      mediaItem = media.item(m).toLowerCase();
      if (mediaItem === CssLogic.MEDIA.SCREEN ||
          mediaItem === CssLogic.MEDIA.ALL) {
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
 * A safe way to access cached bits of information about a stylesheet.
 *
 * @constructor
 * @param {CssLogic} aCssLogic pointer to the CssLogic instance working with
 * this CssSheet object.
 * @param {CSSStyleSheet} aDomSheet reference to a DOM CSSStyleSheet object.
 * @param {boolean} aSystemSheet tells if the stylesheet is system-provided.
 * @param {number} aIndex tells the index/position of the stylesheet within the
 * main document.
 */
function CssSheet(aCssLogic, aDomSheet, aSystemSheet, aIndex)
{
  this._cssLogic = aCssLogic;
  this.domSheet = aDomSheet;
  this.systemSheet = aSystemSheet;
  this.index = this.systemSheet ? -100 * aIndex : aIndex;

  // Cache of the sheets href. Cached by the getter.
  this._href = null;
  // Short version of href for use in select boxes etc. Cached by getter.
  this._shortSource = null;

  // null for uncached.
  this._sheetAllowed = null;

  // Cached CssRules from the given stylesheet.
  this._rules = {};

  this._ruleCount = -1;
};

CssSheet.prototype = {
  /**
   * Get a source for a stylesheet, taking into account embedded stylesheets
   * for which we need to use document.defaultView.location.href rather than
   * sheet.href
   * @return {string} the address of the stylesheet.
   */
  getHref: function()
  {
    if (!this._href) {
      this._href = this.domSheet.getHref();
      if (!this._href) {
        this._href = this.domSheet.ownerNode.ownerDocument.location;
      }
    }

    return this._href;
  },

  /**
   * Create a shorthand version of the href of a stylesheet
   * @return {string} the shorthand source of the stylesheet.
   */
  getShortSource: function()
  {
    if (this._shortSource) {
      return this._shortSource;
    }

    // Use a string like "inline" if there is no source href
    if (!this.domSheet.getHref()) {
      this._shortSource = CssLogic.l10n("style.rule.sourceInline");
      return this._shortSource;
    }

    // We try, in turn, the filename, filePath, query string, whole thing
    let url = Services.io.newURI(this.domSheet.getHref(), null, null);
    url = url.QueryInterface(Ci.nsIURL);
    if (url.fileName) {
      this._shortSource = url.fileName;
      return this._shortSource;
    }

    if (url.filePath) {
      this._shortSource = url.filePath;
      return this._shortSource;
    }

    if (url.query) {
      this._shortSource = url.query;
      return this._shortSource;
    }

    this._shortSource = this.domSheet.getHref();
    return this._shortSource;
  },

  /**
   * Tells if the sheet is allowed or not by the current sourceFilter
   * @return {boolean} true if the stylesheet is allowed by the sourceFilter
   */
  getSheetAllowed: function()
  {
    if (this._sheetAllowed !== null) {
      return this._sheetAllowed;
    }

    this._sheetAllowed = true;

    let filter = this._cssLogic.getSourceFilter();
    if (filter === CssLogic.FILTER.ALL && this.systemSheet) {
      this._sheetAllowed = false;
    }
    if (filter !== CssLogic.FILTER.ALL && filter !== CssLogic.FILTER.UA) {
      this._sheetAllowed = (filter === this.getHref());
    }

    return this._sheetAllowed;
  },

  /**
   * Retrieve the number of rules in this stylesheet
   * @return {number} the number of CSSRule objects in this stylesheet
   */
  getRuleCount: function()
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
    let cacheId = aDomRule.type + aDomRule.selectorText;

    let rule = null;
    let ruleFound = false;

    if (cacheId in this._rules) {
      for (let i = 0, n = this._rules[cacheId].length; i < n; i++) {
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
    let ruleCount = 0;
    let domRules = this.domSheet.cssRules;

    function iterator(aDomRule) {
      if (aDomRule.type == CSSRule.STYLE_RULE) {
        aCallback.call(aScope, this.getRule(aDomRule));
        ruleCount++;
      } else if (aDomRule.type == CSSRule.MEDIA_RULE && aDomRule.cssRules &&
          CssLogic.sheetMediaAllowed(aDomRule)) {
        Array.prototype.forEach.call(aDomRule.cssRules, iterator, this);
      }
    };

    Array.prototype.forEach.call(domRules, iterator, this);

    this._ruleCount = ruleCount;
  },

  toString: function CssSheet_toString()
  {
    return "CssSheet[" + this.getShortSource() + "]";
  },
};

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
    this.line = this._cssSheet._cssLogic.domUtils.getRuleLine(this._domRule);
    this.source = this._cssSheet.getShortSource() + ":" + this.line;
    this._href = this._cssSheet.getHref();
    this.systemRule = this._cssSheet.systemSheet;
  } else if (aElement) {
    this._selectors = [ new CssSelector(this, "@element.style") ];
    this.line = -1;
    this.source = CssLogic.l10n("style.rule.sourceElement");
    this._href = "#";
    this.systemRule = false;
    this.sourceElement = aElement;
  }
};

CssRule.prototype = {
  /**
   * Accessor for the source of the rule
   */
  getHref: function()
  {
    return this._href;
  },

  /**
   * Check if the parent stylesheet is allowed by the CssLogic.sourceFilter
   * @return {boolean} true if the parent stylesheet is allowed by the current
   * sourceFilter, or false otherwise
   */
  getSheetAllowed: function()
  {
    return this._cssSheet ? this._cssSheet.getSheetAllowed() : true;
  },

  /**
   * Retrieve the parent stylesheet index/position in the viewed document
   * @return {number} the parent stylesheet index/position in the viewed
   * document.
   */
  getSheetIndex: function()
  {
    return this._cssSheet ? this._cssSheet.index : 0;
  },

  /**
   * Retrieve the style property value from the current CSSStyleRule
   * @param {string} aProperty the CSS property name for which you want the
   * value
   * @return {string} the property value.
   */
  getPropertyValue: function(aProperty)
  {
    return this._domRule.style.getPropertyValue(aProperty);
  },

  /**
   * Retrieve the style property priority from the current CSSStyleRule
   * @param {string} aProperty the CSS property name for which you want the
   * priority
   * @return {string} the property priority.
   */
  getPropertyPriority: function(aProperty)
  {
    return this._domRule.style.getPropertyPriority(aProperty);
  },

  /**
   * Retrieve the list of CssSelector objects for each of the parsed selectors
   * of the current CSSStyleRule.
   * @return {array} the array hold the CssSelector objects.
   */
  getSelectors()
  {
    if (this._selectors) {
      return this._selectors;
    }

    // Parse the CSSStyleRule.selectorText string.
    this._selectors = [];

    if (!this._domRule.selectorText) {
      return this._selectors;
    }

    let selector = this._domRule.selectorText.trim();
    if (!selector) {
      return this._selectors;
    }

    let nesting = 0;
    let currentSelector = [];

    // Parse a selector group into selectors. Normally we could just .split(',')
    // however Gecko allows -moz-any(a, b, c) as a selector so we ignore commas
    // inside brackets.
    for (let i = 0; i < selector.length; i++) {
      let c = selector.charAt(i);
      switch (c) {
        case ",":
          if (nesting == 0 && currentSelector.length > 0) {
            let selectorStr = currentSelector.join("").trim();
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
      let selectorStr = currentSelector.join("").trim();
      if (selectorStr) {
        this._selectors.push(new CssSelector(this, selectorStr));
      }
    }

    return this._selectors;
  },

  toString: function CssRule_toString()
  {
    return "[CssRule " + this._domRule.selectorText + "]";
  },
};

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
  getHref: function()
  {
    return this._cssRule.getHref();
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
   * Check if the parent stylesheet is allowed by the CssLogic.sourceFilter
   * @return {boolean} true if the parent stylesheet is allowed by the current
   * sourceFilter, or false otherwise
   */
  getSheetAllowed: function()
  {
    return this._cssRule.getSheetAllowed();
  },

  /**
   * Retrieve the parent stylesheet index/position in the viewed document
   * @return {number} the parent stylesheet index/position in the viewed
   * document
   */
  getSheetIndex: function()
  {
    return this._cssRule.getSheetIndex();
  },

  /**
   * Retrieve the line of the parent CSSStyleRule in the parent CSSStyleSheet
   * @return {number} the line of the parent CSSStyleRule in the parent
   * stylesheet.
   */
  get ruleLine()
  {
    return this._cssRule.line;
  },

  /**
   * Retrieve specificity information for the current selector
   * @see http://www.w3.org/TR/css3-selectors/#specificity
   * @see http://www.w3.org/TR/CSS2/selector.html
   * @return {object} an object holding specificity information for the current
   * selector.
   */
  get specificity()
  {
    if (this._specificity) {
      return this._specificity;
    }

    let specificity = {};

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
        let tag = aSimple.split(/[#.[:]/)[0];
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
  },
};

/**
 * A cache of information about the matched rules, selectors and values attached
 * to a CSS property, for the highlighted element.
 *
 * The heart of the CssPropertyInfo object is the _findMatchedSelectors() and
 * _findUnmatchedSelectors() methods. These are invoked when the PropertyView
 * tries to access the .matchedSelectors and .unmatchedSelectors arrays.
 * Results are cached, for later reuse.
 *
 * @param {CssLogic} aCssLogic Reference to the parent CssLogic instance
 * @param {string} aProperty The CSS property we are gathering information for
 * @constructor
 */
function CssPropertyInfo(aCssLogic, aProperty)
{
  this._cssLogic = aCssLogic;
  this.property = aProperty;
  this._value = "";

  // The number of matched rules holding the this.property style property.
  // Additionally, only rules that come from allowed stylesheets are counted.
  this._matchedRuleCount = 0;

  // An array holding CssSelectorInfo objects for each of the matched selectors
  // that are inside a CSS rule. Only rules that hold the this.property are
  // counted. This includes rules that come from filtered stylesheets (those
  // that have sheetAllowed = false).
  this._matchedSelectors = null;
};

CssPropertyInfo.prototype = {
  /**
   * Retrieve the computed style value for the current property, for the
   * highlighted element.
   * @return {string} the computed style value for the current property, for the
   * highlighted element.
   */
  get value()
  {
    if (!this._value && this._cssLogic._computedStyle) {
      try {
        this._value = this._cssLogic._computedStyle.
            getPropertyValue(this.property);
      } catch (ex) {
        console.log('Error reading computed style for ' + this.property);
        console.log(ex);
      }
    }

    return this._value;
  },

  /**
   * Retrieve the number of matched rules holding the this.property style
   * property. Only rules that come from allowed stylesheets are counted.
   * @return {number} the number of matched rules.
   */
  get matchedRuleCount()
  {
    if (!this._matchedSelectors) {
      this._findMatchedSelectors();
    } else if (this.needRefilter) {
      this._refilterSelectors();
    }

    return this._matchedRuleCount;
  },

  /**
   * Retrieve the number of unmatched rules.
   * @return {number} the number of rules that do not match the highlighted
   * element or its parents.
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
   * @return {array} the list of CssSelectorInfo objects of selectors that match
   * the highlighted element and its parents.
   */
  get matchedSelectors()
  {
    if (!this._matchedSelectors) {
      this._findMatchedSelectors();
    } else if (this.needRefilter) {
      this._refilterSelectors();
    }

    return this._matchedSelectors;
  },

  /**
   * Retrieve the array holding CssSelectorInfo objects for each of the
   * unmatched selectors, from each of the unmatched rules. Only selectors
   * coming from allowed stylesheets are included in the array.
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
   * Find the selectors that match the highlighted element and its parents.
   * Uses CssLogic.processMatchedSelectors() to find the matched selectors,
   * passing in a reference to CssPropertyInfo._processMatchedSelector() to
   * create CssSelectorInfo objects, which we then sort
   * @private
   */
  _findMatchedSelectors: function CssPropertyInfo_findMatchedSelectors()
  {
    this._matchedSelectors = [];
    this._matchedRuleCount = 0;
    this.needRefilter = false;

    this._cssLogic.processMatchedSelectors(this._processMatchedSelector, this);

    // Sort the selectors by how well they match the given element.
    this._matchedSelectors.sort(function(aSelectorInfo1, aSelectorInfo2) {
      if (aSelectorInfo1.status > aSelectorInfo2.status) {
        return -1;
      } else if (aSelectorInfo2.status > aSelectorInfo1.status) {
        return 1;
      } else {
        return aSelectorInfo1.compareTo(aSelectorInfo2);
      }
    });

    // Now we know which of the matches is best, we can mark it BEST_MATCH.
    if (this._matchedSelectors.length > 0 &&
        this._matchedSelectors[0].status > CssLogic.STATUS.UNMATCHED) {
      this._matchedSelectors[0].status = CssLogic.STATUS.BEST;
    }
  },

  /**
   * Process a matched CssSelector object
   * @private
   * @param {CssSelector} aSelector the matched CssSelector object.
   * @param {CssLogic.STATUS} aStatus the CssSelector match status.
   */
  _processMatchedSelector: function CPI_processMatchedSelector(aSelector, aStatus)
  {
    let cssRule = aSelector._cssRule;

    let cascading = CssLogic.isCascading(this.property);
    if (!cascading && aStatus === CssLogic.STATUS.PARENT_MATCH) {
      return;
    }

    let value = cssRule.getPropertyValue(this.property);
    if (!value) {
      return;
    }

    let selectorInfo = new CssSelectorInfo(aSelector, this.property, value,
        aStatus);
    this._matchedSelectors.push(selectorInfo);
    if (this._cssLogic._passId !== cssRule._passId &&
        cssRule.getSheetAllowed()) {
      this._matchedRuleCount++;
    }
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
    this._cssLogic._passId++;

    this._cssLogic.processUnmatchedSelectors(this._processUnmatchedSelector,
        this);

    // Sort the selectors by specificity.
    this._unmatchedSelectors.sort(function(aSelectorInfo1, aSelectorInfo2) {
      return aSelectorInfo1.compareTo(aSelectorInfo2);
    });
  },

  /**
   * Process an unmatched CssSelector object
   * @private
   * @param {CssSelector} aSelector the unmatched CssSelector object.
   */
  _processUnmatchedSelector: function CPI_processUnmatchedSelector(aSelector)
  {
    let cssRule = aSelector._cssRule;
    if (cssRule.systemRule) {
      return;
    }

    let value = cssRule.getPropertyValue(this.property);
    if (value) {
      let selectorInfo = new CssSelectorInfo(aSelector, this.property, value,
          CssLogic.STATUS.UNMATCHED);
      this._unmatchedSelectors.push(selectorInfo);
      if (this._cssLogic._passId != cssRule._passId) {
        if (cssRule.getSheetAllowed()) {
          this._unmatchedRuleCount++;
        }
        cssRule._passId = this._cssLogic._passId;
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
    let passId = ++this._cssLogic._passId;

    let ruleCount = 0;
    let loopFn = function(aSelectorInfo) {
      let cssRule = aSelectorInfo.selector._cssRule;
      if (cssRule._passId != passId) {
        if (cssRule.getSheetAllowed()) {
          ruleCount++;
        }
        cssRule._passId = passId;
      }
    };

    if (this._matchedSelectors) {
      this._matchedSelectors.forEach(function(aSelectorInfo) {
        let cssRule = aSelectorInfo.selector._cssRule;
        if (cssRule._passId != passId) {
          if (cssRule.getSheetAllowed()) {
            ruleCount++;
          }
          cssRule._passId = passId;
        }
      });
      this._matchedRuleCount = ruleCount;
    }

    if (this._unmatchedSelectors) {
      ruleCount = 0;
      this._unmatchedSelectors.forEach(function(aSelectorInfo) {
        let cssRule = aSelectorInfo.selector._cssRule;
        if (!cssRule.systemRule && cssRule._passId != passId) {
          if (cssRule.getSheetAllowed()) {
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
  },
};

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

  let priority = this.selector._cssRule.getPropertyPriority(this.property);
  this.important = (priority === "important");

  /* Score prefix:
  0 UA normal property
  1 UA important property
  2 normal property
  3 inline (element.style)
  4 important
  5 inline important
  */
  let scorePrefix = this.systemRule ? 0 : 2;
  if (this.elementStyle) {
    scorePrefix++;
  }
  if (this.important) {
    scorePrefix += this.systemRule ? 1 : 2;
  }

  this.specificityScore = "" + scorePrefix + this.specificity.ids +
      this.specificity.classes + this.specificity.tags;
};

CssSelectorInfo.prototype = {
  /**
   * Retrieve the CssSelector source, which is the source of the CssSheet owning
   * the selector
   * @return {string} the selector source
   */
  get source()
  {
    return this.selector.source;
  },

  /**
   * Retrieve the CssSelector source element, which is the source of the CssRule
   * owning the selector. This is only available when the CssSelector comes from
   * an element.style.
   * @return {string} the source element selector
   */
  get sourceElement()
  {
    return this.selector.sourceElement;
  },

  /**
   * Retrieve the address of the CssSelector. This points to the address of the
   * CssSheet owning this selector
   * @return {string} the address of the CssSelector
   */
  getHref: function()
  {
    return this.selector.getHref();
  },

  /**
   * Check if the CssSelector comes from element.style or not
   * @return {boolean} true if the CssSelector comes from element.style, or
   * false otherwise
   */
  get elementStyle()
  {
    return this.selector.elementStyle;
  },

  /**
   * Retrieve specificity information for the current selector
   * @return {object} an object holding specificity information for the current
   * selector
   */
  get specificity()
  {
    return this.selector.specificity;
  },

  /**
   * Retrieve the parent stylesheet index/position in the viewed document
   * @return {number} the parent stylesheet index/position in the viewed
   * document
   */
  getSheetIndex: funciton()
  {
    return this.selector.getSheetIndex();
  },

  /**
   * Check if the parent stylesheet is allowed by the CssLogic.sourceFilter
   * @return {boolean} true if the parent stylesheet is allowed by the current
   * sourceFilter, or false otherwise
   */
  getSheetAllowed: function()
  {
    return this.selector.getSheetAllowed();
  },

  /**
   * Retrieve the line of the parent CSSStyleRule in the parent CSSStyleSheet
   * @return {number} the line of the parent CSSStyleRule in the parent
   * stylesheet
   */
  get ruleLine()
  {
    return this.selector.ruleLine;
  },

  /**
   * Check if the selector comes from a browser-provided stylesheet
   * @return {boolean} true if the selector comes from a browser-provided
   * stylesheet, or false otherwise
   */
  get systemRule()
  {
    return this.selector.systemRule;
  },

  /**
   * Compare the current CssSelectorInfo instance to another instance, based on
   * specificity information
   * @param {CssSelectorInfo} aThat The instance to compare ourselves against
   * @return number -1, 0, 1 depending on how aThat compares with this
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

    if (this.getSheetIndex() > aThat.getSheetIndex()) return -1;
    if (aThat.getSheetIndex() > this.getSheetIndex()) return 1;

    if (this.ruleLine > aThat.ruleLine) return -1;
    if (aThat.ruleLine > this.ruleLine) return 1;

    return 0;
  },

  toString: function CssSelectorInfo_toString()
  {
    return this.selector + " -> " + this.value;
  },
};

exports.CssLogic = CssLogic;
exports.CssSheet = CssSheet;
exports.CssRule = CssRule;
exports.CssSelector = CssSelector;
exports.CssPropertyInfo = CssPropertyInfo;
exports.CssSelectorInfo = CssSelectorInfo;
