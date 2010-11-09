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
 * CssHtmlTree is a panel that manages the display of a table sorted by style.
 * There should be one instance of CssHtmlTree per style display (of which there
 * will generally only be one).
 * @constructor
 */
function CssHtmlTree()
{
  if (!(this instanceof CssHtmlTree)) {
    return new CssHtmlTree();
  }

  this.styleGroups = CssHtmlTree.createStyleGroupViews();

  CssHtmlTree.template("templateInspector", "rootInspector", this);

  CssHtmlTree.styleLogic.getSheets(function(aSheets) {
    this.sheets = [];
    aSheets.forEach(function(aSheet) {
      this.sheets.push(new SheetView(aSheet));
    }, this);
    CssHtmlTree.template("templateDoctor", "rootDoctor", this);
  }.bind(this));
};

proxier.logLevel = proxier.Level.DEBUG;
CssHtmlTree.styleLogic = proxier.require("styleLogic");

/**
 * TODO: what's the best way of extracting constants across e10s?
 */
var CssLogic = {
  STATUS: {
    BEST: 3,
    MATCHED: 2,
    PARENT_MATCH: 1,
    UNMATCHED: 0,
    UNKNOWN: -1,
  }
};

/**
 * The CSS groups as displayed by the UI.
 */
CssHtmlTree.createStyleGroupViews = function CssHtmlTree_createStyleGroupViews()
{
  // These group titles are localized by their ID. See the
  // inspector.properties file.
  return [
    new StyleGroupView("Text_Fonts_and_Color", [
      "color",
      "direction",
      "font-family",
      "font-size",
      "font-size-adjust",
      "font-stretch",
      "font-style",
      "font-variant",
      "font-weight",
      "letter-spacing",
      "line-height",
      "quotes",
      "text-align",
      "text-decoration",
      "text-indent",
      "text-rendering",
      "text-shadow",
      "text-transform",
      "vertical-align",
      "white-space",
      "word-spacing",
      "word-wrap",
      "-moz-column-count",
      "-moz-column-gap",
      "-moz-column-rule-color",
      "-moz-column-rule-style",
      "-moz-column-rule-width",
      "-moz-column-width",
    ]),

    new StyleGroupView("Lists", [
      "list-style-image",
      "list-style-position",
      "list-style-type",
    ]),

    new StyleGroupView("Background", [
      "background-attachment",
      "background-clip",
      "background-color",
      "background-image",
      "background-origin",
      "background-position",
      "background-repeat",
      "background-size",
    ]),

    new StyleGroupView("Dimensions", [
      "width",
      "height",
      "max-width",
      "max-height",
      "min-width",
      "min-height",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "clip",
      "resize",
      "-moz-box-sizing",
    ]),

    new StyleGroupView("Positioning_and_Page_Flow", [
      "top",
      "right",
      "bottom",
      "left",
      "display",
      "float",
      "clear",
      "position",
      "visibility",
      "overflow-x",
      "overflow-y",
      "z-index",
    ]),

    new StyleGroupView("Borders", [
      "border-top-width",
      "border-right-width",
      "border-bottom-width",
      "border-left-width",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
      "border-top-style",
      "border-right-style",
      "border-bottom-style",
      "border-left-style",
      "border-collapse",
      "border-spacing",
      "outline-top-width",
      "outline-right-width",
      "outline-bottom-width",
      "outline-left-width",
      "outline-top-color",
      "outline-right-color",
      "outline-bottom-color",
      "outline-left-color",
      "outline-top-style",
      "outline-right-style",
      "outline-bottom-style",
      "outline-left-style",
      "outline-offset",
      "-moz-border-radius-topleft",
      "-moz-border-radius-topright",
      "-moz-border-radius-bottomright",
      "-moz-border-radius-bottomleft",
      "-moz-outline-radius-topleft",
      "-moz-outline-radius-topright",
      "-moz-outline-radius-bottomright",
      "-moz-outline-radius-bottomleft",
    ]),

    new StyleGroupView("Effects_and_Other", [
      "caption-side",
      "content",
      "counter-increment",
      "counter-reset",
      "cursor",
      "empty-cells",
      "image-rendering",
      "opacity",
      "pointer-events",
      "table-layout",
      "box-shadow",
      "-moz-transform",
      "-moz-transition",
      "-moz-user-focus",
      "-moz-user-input",
      "-moz-user-modify",
      "-moz-user-select",
    ]),
  ];
};

/**
 * Memonized lookup of a l10n string from a string bundle.
 * @param {string} aName The key to lookup.
 * @returns A localized version of the given key.
 */
CssHtmlTree.l10n = function CssHtmlTree_l10n(aName)
{
  return l10nLookup[aName];
};

CssHtmlTree.pluralFormGetReplace = function CssHtmlTree_pfGR(aStr, aCount)
{
  return aStr.split(";")[0].replace("#1", aCount);
  // return PluralForm.get(aCount, aStr).replace("#1", aCount);
};

/**
 * Clone the given template node, and process it by resolving ${} references
 * in the template.
 *
 * @param {nsIDOMElement} aTemplate the template note to use.
 * @param {nsIDOMElement} aDestination the destination node where the
 * processed nodes will be displayed.
 * @param {object} aData the data to pass to the template.
 */
CssHtmlTree.template = function CssHtmlTree_template(aTemplate, aDestination, aData)
{
  if (typeof aDestination === 'string') {
    aDestination = document.getElementById(aDestination);
  }
  if (typeof aTemplate === 'string') {
    aTemplate = document.getElementById(aTemplate);
  }

  aDestination.innerHTML = "";

  // All the templater does is to populate a given DOM tree with the given
  // values, so we need to clone the template first.
  var duplicated = aTemplate.cloneNode(true);
  new Templater().processNode(duplicated, aData);
  while (duplicated.firstChild) {
    aDestination.appendChild(duplicated.firstChild);
  }
};


//##############################################################################

/**
 * A container to give easy access to style group data from the template engine
 * @param {string} aId the style group ID
 * @param {array} aPropertyNames the list of property names associated to this
 * style group view
 * @constructor
 */
function StyleGroupView(aId, aPropertyNames)
{
  this.id = aId;
  this.propertyNames = aPropertyNames;
  this.localName = CssHtmlTree.l10n("style.group." + this.id);

  this.populated = false;
  this.populating = false;

  // Populated by Templater:
  this.element = null;    // parent element containing the open attribute
  this.properties = null; // destination for templateProperties
}

StyleGroupView.prototype = {
  /**
   * The click event handler for the title of the style group view.
   */
  click: function StyleGroupView_click()
  {
    // TODO: Animate opening/closing. See bug 587752.
    if (this.element.getAttribute("open") == "true") {
      this.element.setAttribute("open", "false");
      return;
    }

    if (!this.populated) {
      if (this.populating) {
        return;
      }

      this.populating = true;
      CssHtmlTree.styleLogic.getPropertyInfo(this.propertyNames, function(aPropertyInfos) {
        this.propertyViews = [];
        for (var i = 0; i < this.propertyNames.length; i++) {
          var name = this.propertyNames[i];
          var info = aPropertyInfos[i];
          this.propertyViews.push(new PropertyView(name, info));
        }

        CssHtmlTree.template("templateProperties", this.properties, this);
        this.populated = true;
        this.populating = false;
      }.bind(this));
    }

    this.element.setAttribute("open", "true");
  }
};


//##############################################################################

/**
 * A container to give easy access to property data from the template engine
 * @param {string} aName the CSS property name for which this PropertyView
 * instance will render the rules.
 * @constructor
 */
function PropertyView(aName, aPropertyInfo)
{
  this.name = aName;
  this.propertyInfo = aPropertyInfo;
  this.value = this.propertyInfo.value;

  this.populatedMatched = false;
  this.populatedUnmatched = false;
  this.populating = false;
  this.showUnmatched = false;

  this.link = "https://developer.mozilla.org/en/CSS/" + aName;

  this.matchesTitle = (this.propertyInfo.matchedRuleCount === 0) ?
      "" :
      CssHtmlTree.pluralFormGetReplace(
          CssHtmlTree.l10n("style.property.numberOfRules"),
          this.propertyInfo.matchedRuleCount);

  // Populated by Templater:  
  this.element = null;      // Element which contains the 'open' attribute
  this.selectorsEle = null; // Destination for templateSelectors.
};

PropertyView.prototype = {
  /**
   * The click event handler for the property name of the property view
   * @param {Event} aEvent the DOM event
   */
  click: function PropertyView_click(aEvent)
  {
    // Clicking on the property link itself is already handled
    if (aEvent.target.tagName.toLowerCase() === "a") {
      return;
    }

    // TODO: Animate opening/closing. See bug 587752.
    if (this.element.getAttribute("open") === "true") {
      this.element.setAttribute("open", "false");
      return;
    }

    if (!this.populatedMatched) {
      if (this.populating) {
        return;
      }

      this.populating = true;
      CssHtmlTree.styleLogic.getSelectors(this.name, true, function(aSelectors) {
        this.matchedSelectors = aSelectors;
        CssHtmlTree.template("templateSelectors", this.selectorsEle, this);

        this.populatedMatched = true;
        this.populating = false;
      }.bind(this));
    }

    this.element.setAttribute("open", "true");
  },

  /**
   * Provide access to the SelectorViews that we are currently displaying.
   * A getter because it will not be displayed until the user opens the toggle.
   */
  get selectorViews()
  {
    var reply = [];

    function convert(aSelectorInfo) {
      reply.push(new SelectorView(aSelectorInfo));
    }

    this.matchedSelectors.forEach(convert);
    if (this.showUnmatched) {
      this.unmatchedSelectors.forEach(convert);
    }

    return reply;
  },

  /**
   * The UI has a link to allow the user to display unmatched selectors.
   * This provides localized link text.
   * A getter because it will not be displayed until the user opens the toggle.
   */
  get showUnmatchedLinkText()
  {
    return CssHtmlTree.l10n("style.rule.showUnmatchedLink");
  },

  /**
   * The action when a user clicks the 'show unmatched' link.
   * A getter because it will not be displayed until the user opens the toggle.
   */
  showUnmatchedLinkClick: function(aEvent)
  {
    if (!this.populatedUnmatched) {
      if (this.populating) {
        return;
      }

      this.populating = true;
      CssHtmlTree.styleLogic.getSelectors(this.name, false, function(aSelectors) {
        this.unmatchedSelectors = aSelectors;
        this.showUnmatched = true;
        CssHtmlTree.template("templateSelectors", this.selectorsEle, this);

        this.populatedUnmatched = true;
        this.populating = false;
      }.bind(this));
    }

    aEvent.preventDefault();
  },
};


//##############################################################################

/**
 * A container to view us easy access to display data from a CssRule
 */
function SelectorView(aSelectorInfo)
{
  var props = [ "value", "status", "selector", "href", "shortSource", "selector" ];
  props.forEach(function(prop) {
    this[prop] = aSelectorInfo[prop];
  }, this);

  this._cacheStatusNames();

  // A localized version of cssRule.status.
  // TODO: This isn't currently used
  this.statusText = SelectorView.STATUS_NAMES[this.status];
}

SelectorView.prototype = {
  /**
   * Cache localized status names.
   * These statuses are localized inside the inspector.properties string bundle.
   * @see csslogic.js - the CssLogic.STATUS array.
   * @param {nsIStringBundle} aStrings The string bundle from where to get the
   * localized status names.
   * @return {void}
   */
  _cacheStatusNames: function SelectorView_cacheStatusNames()
  {
    if (SelectorView.STATUS_NAMES.length) {
      return;
    }

    for (var status in CssLogic.STATUS) {
      var i = CssLogic.STATUS[status];
      if (i > -1) {
        var value = CssHtmlTree.l10n("style.rule.status." + status);
        // Replace normal spaces with non-breaking spaces
        SelectorView.STATUS_NAMES[i] = value.replace(/ /g, '\u00A0');
      }
    }
  }
};

/**
 * Decode for cssInfo.rule.status
 * @see SelectorView.prototype._cacheStatusNames
 * @see CssLogic.STATUS
 */
SelectorView.STATUS_NAMES = [
  // "Unmatched", "Parent Match", "Matched", "Best Match"
];


//##############################################################################

/**
 * A container to view us easy access to display data from a CssRule
 */
function SheetView(aSheet)
{
  var props = [ "systemSheet", "index", "shortSource", "ruleCount", "href" ];
  props.forEach(function(prop) {
    this[prop] = aSheet[prop];
  }, this);

  var str = CssHtmlTree.l10n("style.property.numberOfRules");
  this.ruleTitle = CssHtmlTree.pluralFormGetReplace(str, this.ruleCount);

  this.populated = false;
  this.populating = false;

  // Populated by Templater:
  this.element = null; // Element which contains the 'open' attribute
  this.rulesEle = null;   // Destination for templateRules.
}

SheetView.prototype = {
  /**
   * What we do when someone clicks to expand to see the rules in the sheet
   */
  click: function(ev)
  {
    // TODO: Animate opening/closing. See bug 587752.
    if (this.element.getAttribute("open") == "true") {
      this.element.setAttribute("open", "false");
      return;
    }

    if (!this.populated) {
      if (this.populating) {
        return;
      }

      this.populating = true;
      CssHtmlTree.styleLogic.getRules(this.href, function(aRules) {
        this.rules = [];
        this.rules = aRules.map(function(aRule) {
          return new RuleView(aRule);
        }, this);

        CssHtmlTree.template("templateRules", this.rulesEle, this);
        this.populated = true;
        this.populating = false;
      }.bind(this));
    }

    this.element.setAttribute("open", "true");
  },
};


//##############################################################################

function RuleView(data)
{
  this.selectorGroup = data.selectorGroup;
  this.selectors = this.selectorGroup.join(", ");
  this.propertyCount = data.propertyCount;
}

//##############################################################################

/**
 * We're not sure now we're going to do l10n yet, so this is a cut an paste from
 * inspector.properties, with light tweakage so it will work here.
 */
var l10nLookup = {
  // LOCALIZATION NOTE (style.property.numberOfRules): Semi-colon list of plural 
  // forms. See http://developer.mozilla.org/en/docs/Localization_and_Plurals
  // This is used inside the Style panel of the Inspector tool. For each style
  // property the panel shows the number of rules which hold that specific
  // property, counted from all of the stylesheet in the web page inspected.
  "style.property.numberOfRules": "#1 rule;#1 rules",
  
  // LOCALIZATION NOTE (style.property.important): This is used inside
  // the Style panel of the Inspector tool. For each style property the developer
  // can mark it as important, or not. This string is displayed in the hover tool
  // tip when the user is on top of a rule within a property view, if the CSS
  // property is marked as important in that rule. Also note that this string is
  // prepended to the style.rule.specificity string *if* the property is important.
  "style.property.important": "!important,",
  
  // LOCALIZATION NOTE (style.rule.status): These strings are used inside the Style
  // panel of the Inspector tool. For each style property the panel shows the rules
  // which hold that specific property. For every rule, the rule status is also
  // displayed: a rule can be the best match, a match, a parent match, or a rule
  // did not match the element the user has highlighted.
  "style.rule.status.BEST": "Best Match",
  "style.rule.status.MATCHED": "Matched",
  "style.rule.status.PARENT_MATCH": "Parent Match",
  "style.rule.status.UNMATCHED": "Unmatched",
  
  // LOCALIZATION NOTE (style.rule.showUnmatchedLink):
  // This is used inside the Style panel of the Inspector tool. Each style property
  // is inside a rule. A rule is a selector that can match (or not) the highlighted
  // element in the web page. The property view shows only a few of the unmatched
  // rules. If the user wants to see all of the unmatched rules, he/she must click
  // the link displayed at the bottom of the rules table. That link shows how many
  // rules are not displayed. This is the string used when the link is generated.
  "style.rule.showUnmatchedLink": "Find unmatched rules ...",
  
  // LOCALIZATION NOTE (style.elementSelector): This is used inside the Style panel
  // of the Inspector tool. For each property the panel shows the rule with its
  // selector. Rules can come from element.style. In this case, one can translate
  // element.style to the local language.
  "style.elementSelector": "element.style",
  
  // LOCALIZATION NOTE (style.group): These strings are used inside the Style panel
  // of the Inspector tool. Style properties are displayed in groups and these are
  // the group names.
  "style.group.Text_Fonts_and_Color": "Text, Fonts & Color",
  "style.group.Background": "Background",
  "style.group.Dimensions": "Dimensions",
  "style.group.Positioning_and_Page_Flow": "Positioning and Page Flow",
  "style.group.Borders": "Borders",
  "style.group.Lists": "Lists",
  "style.group.Effects_and_Other": "Effects and Other"
};

if (this.exports) {
  exports.CssHtmlTree = CssHtmlTree;
  exports.StyleGroupView = StyleGroupView;
  exports.PropertyView = PropertyView;
  exports.SelectorView = SelectorView;
}

/**
 * This is effectively the main()
 */
window.onload = function() {
  try {
    new CssHtmlTree();

    // Without body.live, the templates are visible, so they show up in an
    // HTML editor, but not in live.
    document.body.classList.add("live");
  }
  catch (ex) {
    console.error(ex);
  }
};
