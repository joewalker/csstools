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
  CssHtmlTree.template("templateRoot", "root", this);
};

proxier.logLevel = proxier.Level.DEBUG;
CssHtmlTree.cssLogic = proxier.require("cssLogic");

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
  let duplicated = aTemplate.cloneNode(true);
  new Templater().processNode(duplicated, aData);
  while (duplicated.firstChild) {
    aDestination.appendChild(duplicated.firstChild);
  }
};


//#############################################################################

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
      CssHtmlTree.cssLogic.getPropertyInfos(this.propertyNames, function(aPropertyInfos) {
        this.propertyViews = [];
        for (let i = 0; i < this.propertyNames.length; i++) {
          let propertyView = new PropertyView(this,
                    this.propertyNames[i],
                    aPropertyInfos[i]);
          this.propertyViews.push(propertyView);
        }

        CssHtmlTree.template("templateProperties", this.properties, this);
        this.populated = true;
        this.populating = false;
      }.bind(this));
    }

    this.element.setAttribute("open", "true");
  }
};

/**
 * A container to give easy access to property data from the template engine
 * @param {StyleGroupView} aGroup the StyleGroupView instance we are working
 * with.
 * @param {string} aName the CSS property name for which this PropertyView
 * instance will render the rules.
 * @constructor
 */
function PropertyView(aGroup, aName, aPropertyInfo)
{
  this.group = aGroup;
  this.name = aName;
  this.propertyInfo = aPropertyInfo;
  this.value = this.propertyInfo.value;

  this.populated = false;
  this.showUnmatched = false;

  this.link = "https://developer.mozilla.org/en/CSS/" + aName;

  // Populated by Templater:  
  this.element = null; // The parent element which contains the open attribute
  this.rules = null;   // Destination for templateRules.

  this.str = {};
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

    if (!this.populated) {
      CssHtmlTree.template("templateRules", this.rules, this);
      this.populated = true;
    }

    this.element.setAttribute("open", "true");
  },

  /**
   * Compute the title of the property view.
   * The title includes the number of rules that hold the current property.
   * @param {nsIDOMElement} aElement reference to the DOM element where the rule
   * title needs to be displayed.
   * @return {string} The rule title.
   */
  ruleTitle: function PropertyView_ruleTitle(aElement)
  {
    let result = "";
    let ruleCount = this.propertyInfo.matchedRuleCount;

    if (ruleCount > 0) {
      aElement.classList.add("rule-count");

      let str = CssHtmlTree.l10n("style.property.numberOfRules");
      result = CssHtmlTree.pluralFormGetReplace(str, ruleCount);
    }

    return result;
  },

  /**
   * Provide access to the SelectorViews that we are currently displaying
   */
  get selectorViews()
  {
    var all = [];

    function convert(aSelectorInfo) {
      all.push(new SelectorView(aSelectorInfo));
    }

    this.propertyInfo.matchedSelectors.forEach(convert);
    if (this.showUnmatched) {
      this.propertyInfo.unmatchedSelectors.forEach(convert);
    }

    return all;
  },

  /**
   * Should we display a 'X unmatched rules' link?
   * @return {boolean} false if we are already showing the unmatched links or
   * if there are none to display, true otherwise.
   */
  get showUnmatchedLink()
  {
    return !this.showUnmatched && this.propertyInfo.unmatchedRuleCount > 0;
  },

  /**
   * The UI has a link to allow the user to display unmatched selectors.
   * This provides localized link text.
   */
  get showUnmatchedLinkText()
  {
    let smur = CssHtmlTree.l10n("style.rule.showUnmatchedLink");
    return CssHtmlTree.pluralFormGetReplace(smur, this.propertyInfo.unmatchedRuleCount)
  },

  /**
   * The action when a user clicks the 'show unmatched' link.
   */
  showUnmatchedLinkClick: function(aEvent)
  {
    this.showUnmatched = true;
    CssHtmlTree.template("templateRules", this.rules, this);

    aEvent.preventDefault();
  },
};

/**
 * A container to view us easy access to display data from a CssRule
 */
function SelectorView(aSelectorInfo)
{
  this.selectorInfo = aSelectorInfo;

  this._cacheStatusNames();
}

/**
 * Decode for cssInfo.rule.status
 * @see SelectorView.prototype._cacheStatusNames
 * @see CssLogic.STATUS
 */
SelectorView.STATUS_NAMES = [
  // "Unmatched", "Parent Match", "Matched", "Best Match"
];

SelectorView.prototype = {
  /**
   * Cache localized status names.
   *
   * These statuses are localized inside the inspector.properties string bundle.
   * @see csslogic.js - the CssLogic.STATUS array.
   *
   * @param {nsIStringBundle} aStrings The string bundle from where to get the
   * localized status names.
   * @return {void}
   */
  _cacheStatusNames: function SelectorView_cacheStatusNames()
  {
    if (SelectorView.STATUS_NAMES.length) {
      return;
    }

    for (let status in CssLogic.STATUS) {
      let i = CssLogic.STATUS[status];
      if (i > -1) {
        let value = CssHtmlTree.l10n("style.rule.status." + status);
        // Replace normal spaces with non-breaking spaces
        SelectorView.STATUS_NAMES[i] = value.replace(/ /g, '\u00A0');
      }
    }
  },

  /**
   * A localized version of cssRule.status
   */
  get statusText()
  {
    return SelectorView.STATUS_NAMES[this.selectorInfo.status];
  },

  text: function(aElement) {
    let result = this.selectorInfo.selector.text;
    if (this.selectorInfo.elementStyle) {
      if (this.selectorInfo.sourceElement == InspectorUI.selection) {
        result = "this";
      } else {
        result = CssLogic.getShortName(this.selectorInfo.sourceElement);
        aElement.parentNode.querySelector(".rule-link > a").
          addEventListener("click", function(aEvent) {
            InspectorUI.inspectNode(this.selectorInfo.sourceElement);
            aEvent.preventDefault();
          }, false);
      }

      result += ".style";
    }
    return result;
  }
};

if (this.exports) {
  exports.CssHtmlTree = CssHtmlTree;
  exports.StyleGroupView = StyleGroupView;
  exports.PropertyView = PropertyView;
  exports.SelectorView = SelectorView;
}

/**
 * We're not sure now we're going to do l10n yet, so this is a cut an paste from
 * inspector.properties, with light tweakage so it will work here.
 */
let l10nLookup = {
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
  
  // LOCALIZATION NOTE (style.rule.showUnmatchedLink): Semi-colon list of plural
  // forms. See http://developer.mozilla.org/en/docs/Localization_and_Plurals
  // This is used inside the Style panel of the Inspector tool. Each style property
  // is inside a rule. A rule is a selector that can match (or not) the highlighted
  // element in the web page. The property view shows only a few of the unmatched
  // rules. If the user wants to see all of the unmatched rules, he/she must click
  // the link displayed at the bottom of the rules table. That link shows how many
  // rules are not displayed. This is the string used when the link is generated.
  "style.rule.showUnmatchedLink": "One unmatched rule...;#1 unmatched rules...",
  
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

/**
 * This is effectively the main()
 */
window.onload = function() {
  try {
    new CssHtmlTree();
  }
  catch (ex) {
    console.error(ex);
  }
};
