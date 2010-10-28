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
 *   Joe Walker (jwalker@mozilla.com) (original author)
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

var cssHtmlTree = new CssHtmlTree();

/**
 * CssHtmlTree is a panel that manages the display of a table sorted by style.
 * There should be one instance of CssHtmlTree per style display (of which there
 * will generally only be one).
 * @constructor
 */
function CssHtmlTree()
{
  console.log("hi");

  let example = proxier.require("example");
  example.sayHello("joe", function(reply) {
    console.log("Demo: example.sayHello('joe')=" + reply);
  });
  example.add(1, 2, function(reply) {
    console.log("Demo: example.add(1, 2)=" + reply);
  });

  this.cssLogic = proxier.require("cssLogic");

  // The element that we're inspecting, and the document that it comes from.
  this.viewedElement = null;
  this.viewedDocument = null;

  // The "Show rule scores" input element. Populated by template process.
  this.specificityInput = null;
};

CssHtmlTree.prototype = {
  /**
   * Focus the output display on a specific element.
   * @param {nsIDOMElement} aElement The highlighted node to get styles for.
   */
  highlight: function CssHtmlTree_highlight(aElement)
  {
    this.viewedElement = aElement;
    this.cssLogic.highlight(aElement);

    // ============

    this.styleWin = window;

    // The document in which we display the results (csshtmltree.xhtml).
    this.styleDocument = this.styleWin.contentWindow.document;

    // Nodes used in templating
    this.root = this.styleDocument.getElementById("root");
    this.templateRoot = this.styleDocument.getElementById("templateRoot");

    // Keep track of the "Show rule score" option. Does the user want to see the
    // rule specificity or not?
    this.showSpecificity = this.root.classList.contains("show-specificity");

    this.createStyleGroupViews();

    // Reset the style groups.
    /*
    for (let i = 0; i < this.styleGroups.length; i++) {
      this.styleGroups[i].reset(aElement ? false : true);
    }
    */

    if (this.viewedElement) {
      this.viewedDocument = this.viewedElement.ownerDocument;
      CssHtmlTree.template(this.templateRoot, this.root, this);

      this.specificityInput.checked = this.showSpecificity;

      // Update the web page to display the selected source filter.
      let sheetList = this.styleDocument.getElementById("sheetList");
      let sheetItem = null;
      let sourceFilter = this.cssLogic.sourceFilter;
      for (let i = 0; i < sheetList.itemCount; i++) {
        sheetItem = sheetList.getItemAtIndex(i);
        if (sheetItem && sheetItem.value === sourceFilter) {
          sheetList.selectedIndex = i;
          break;
        }
      }
    } else {
      this.viewedDocument = null;
      this.root.innerHTML = "";
    }

  },

  /**
   * Toggle the display of specificity (rule scoring).
   * Called by a click on the checkbox in the style panel
   */
  toggleSpecificity: function CssHtmlTree_toggleSpecificity()
  {
    this.root.classList.toggle("show-specificity");
    this.showSpecificity = !this.showSpecificity;
  },

  /**
   * Called when the user clicks on a parent element in the "current element"
   * path.
   *
   * @param {Event} aEvent the DOM Event object.
   */
  pathClick: function CssHtmlTree_pathClick(aEvent)
  {
    aEvent.preventDefault();
    if (aEvent.target && aEvent.target.pathElement &&
        aEvent.target.pathElement != InspectorUI.selection) {
      InspectorUI.inspectNode(aEvent.target.pathElement);
    }
  },

  /**
   * The oncommand event handler for the sheets menulist.
   * @param {Event} aEvent the DOM event.
   */
  sheetChange: function CssHtmlTree_sheetChange(aEvent) {
    let target = aEvent.target;
    if (target.value === this.cssLogic.sourceFilter) {
      return;
    }

    this.cssLogic.sourceFilter = target.value;

    this.highlight(this.viewedElement);
  },

  /**
   * Provide access to the path to get from document.body to the selected
   * element.
   *
   * @return {array} the array holding the path from document.body to the
   * selected element.
   */
  get pathElements()
  {
    return CssLogic.getShortNamePath(this.viewedElement);
  },

  /**
   * The CSS groups as displayed by the UI.
   */
  createStyleGroupViews: function CssHtmlTree_createStyleGroupViews()
  {
    // These group titles are localized by their ID. See the
    // inspector.properties file.
    this.styleGroups = [
      new StyleGroupView(this, "Text_Fonts_and_Color", [
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

      new StyleGroupView(this, "Lists", [
        "list-style-image",
        "list-style-position",
        "list-style-type",
      ]),

      new StyleGroupView(this, "Background", [
        "background-attachment",
        "background-clip",
        "background-color",
        "background-image",
        "background-origin",
        "background-position",
        "background-repeat",
        "background-size",
      ]),

      new StyleGroupView(this, "Dimensions", [
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

      new StyleGroupView(this, "Positioning_and_Page_Flow", [
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

      new StyleGroupView(this, "Borders", [
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

      new StyleGroupView(this, "Effects_and_Other", [
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
  },
};

/**
 * Memonized lookup of a l10n string from a string bundle.
 * @param {string} aName The key to lookup.
 * @returns A localized version of the given key.
 */
CssHtmlTree.l10n = function CssHtmlTree_l10n(aName)
{
  if (!CssHtmlTree._strings) {
    CssHtmlTree._strings = Services.strings.createBundle(
        "chrome://browser/locale/inspector.properties");
  }
  try {
    return CssHtmlTree._strings.GetStringFromName(aName);
  } catch (ex) {
    console.log("Error reading '" + aName + "'");
    throw new Error("l10n error with " + aName);
  }
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
 * A container to give easy access to style group data from the template engine.
 *
 * @constructor
 * @param {CssHtmlTree} aTree the instance of the CssHtmlTree object that we are
 * working with.
 * @param {string} aId the style group ID.
 * @param {array} aPropertyNames the list of property names associated to this
 * style group view.
 */
function StyleGroupView(aTree, aId, aPropertyNames)
{
  this.tree = aTree;
  this.id = aId;
  this.localName = CssHtmlTree.l10n("style.group." + this.id);

  this.propertyViews = [];
  aPropertyNames.forEach(function(aPropertyName) {
    this.propertyViews.push(new PropertyView(this.tree, this, aPropertyName));
  }, this);

  this.populated = false;

  this.templateProperties = this.tree.styleDocument.getElementById("templateProperties");

  // Populated by templater: parent element containing the open attribute
  this.element = null;
  // Destination for templateProperties.
  this.properties = null;
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
      CssHtmlTree.template(this.templateProperties, this.properties, this);
      this.populated = true;
    }

    this.element.setAttribute("open", "true");
  },

  /**
   * Close the style group view.
   */
  close: function StyleGroupView_close()
  {
    this.element.setAttribute("open", "false");
  },

  /**
   * Reset the style group view and its property views.
   *
   * @param {boolean} aClosePanel tells if the style panel is closing or not.
   */
  reset: function StyleGroupView_reset(aClosePanel)
  {
    this.close();
    this.populated = false;
    for (let i = 0, n = this.propertyViews.length; i < n; i++) {
      this.propertyViews[i].reset();
    }

    if (this.properties) {
      if (aClosePanel) {
        this.element.removeChild(this.properties);
        this.properties = null;
      } else {
        while (this.properties.hasChildNodes()) {
          this.properties.removeChild(this.properties.firstChild);
        }
      }
    }
  },
};

/**
 * A container to give easy access to property data from the template engine.
 *
 * @constructor
 * @param {CssHtmlTree} aTree the CssHtmlTree instance we are working with.
 * @param {StyleGroupView} aGroup the StyleGroupView instance we are working
 * with.
 * @param {string} aName the CSS property name for which this PropertyView
 * instance will render the rules.
 */
function PropertyView(aTree, aGroup, aName)
{
  this.tree = aTree;
  this.group = aGroup;
  this.name = aName;

  this.populated = false;
  this.showUnmatched = false;

  this.link = "https://developer.mozilla.org/en/CSS/" + aName;

  this.templateRules = this.tree.styleDocument.getElementById("templateRules");

  // The parent element which contains the open attribute
  this.element = null;
  // Destination for templateRules.
  this.rules = null;

  this.str = {};
};

PropertyView.prototype = {
  /**
   * The click event handler for the property name of the property view
   *
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
      CssHtmlTree.template(this.templateRules, this.rules, this);
      this.populated = true;
    }

    this.element.setAttribute("open", "true");
  },

  /**
   * Get the computed style for the current property.
   *
   * @return {string} the computed style for the current property of the
   * currently highlighted element.
   */
  get value()
  {
    return this.propertyInfo.value;
  },

  /**
   * An easy way to access the CssPropertyInfo behind this PropertyView
   */
  get propertyInfo()
  {
    return this.tree.cssLogic.getPropertyInfo(this.name);
  },

  /**
   * Compute the title of the property view. The title includes the number of
   * rules that hold the current property.
   *
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
      result = PluralForm.get(ruleCount, str).replace("#1", ruleCount);
    }

    return result;
  },

  /**
   * Close the property view.
   */
  close: function PropertyView_close()
  {
    if (this.rules) {
      this.element.setAttribute("open", "false");
    }
  },

  /**
   * Reset the property view.
   */
  reset: function PropertyView_reset()
  {
    this.close();
    this.populated = false;
    this.element = false;
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
    let plural = PluralForm.get(this.propertyInfo.unmatchedRuleCount, smur)
    return plural.replace("#1", this.propertyInfo.unmatchedRuleCount);
  },

  /**
   * The action when a user clicks the 'show unmatched' link.
   */
  showUnmatchedLinkClick: function(aEvent)
  {
    this.showUnmatched = true;
    CssHtmlTree.template(this.templateRules, this.rules, this);

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
  },

  get specificityTitle() {
    let specificity = this.selectorInfo.specificity;

    let important = "";
    if (this.selectorInfo.important) {
      important += CssHtmlTree.l10n("style.property.important");
    }

    let result = "";
    if (this.selectorInfo.elementStyle) {
      result = important;
    } else {
      let ids = CssHtmlTree.l10n("style.rule.specificity.ids");
      let classes = CssHtmlTree.l10n("style.rule.specificity.classes");
      let tags = CssHtmlTree.l10n("style.rule.specificity.tags");

      ids = PluralForm.get(specificity.ids, ids).
          replace("#1", specificity.ids);
      classes = PluralForm.get(specificity.classes, classes).
          replace("#1", specificity.classes);
      tags = PluralForm.get(specificity.tags, tags).
          replace("#1", specificity.tags);

      result = CssHtmlTree._strings.formatStringFromName(
          "style.rule.specificity",
          [ [important, ids, classes, tags].join(" ") ],
          1);
    }

    return result;
  },
};

if (this.exports) {
  exports.CssHtmlTree = CssHtmlTree;
  exports.StyleGroupView = StyleGroupView;
  exports.PropertyView = PropertyView;
  exports.SelectorView = SelectorView;
}

