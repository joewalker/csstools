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

var styleLogic = {
  _impl: 'testStyleLogic',

  getSheets: function() {
    return [
      {
        systemSheet: false,
        index: 0,
        shortSource: "styles.css",
        ruleCount: 3,
        href: "http://example.com/page/styles.css"
      },
      {
        systemSheet: false,
        index: 1,
        shortSource: "global.css",
        ruleCount: 15,
        href: "http://example.com/global.css"
      }
    ];
  },

  getRules: function(sheetHref, callback) {
    if (sheetHref == null) {
      throw new Error("Missing sheetHref");
    }
    return [
      { selectorId: 1, selectorGroup: [ ".group h1", ".sheet h1" ], propertyCount: 3 },
      { selectorId: 2, selectorGroup: [ "#error" ], propertyCount: 1 },
      { selectorId: 3, selectorGroup: [ "p.content" ], propertyCount: 5 }
    ];
  },

  getSettings: function(sheetHref, selectorId, callback) {
    if (sheetHref == null) {
      throw new Error("Missing sheetHref");
    }
    if (selectorId == null) {
      throw new Error("Missing selectorId");
    }
    return [
      { settingId: 1, property: "color", value: "red" },
      { settingId: 2, property: "background-color", value: "blue" },
    ];
  },

  getAnswer: function(sheetHref, settingId, callback) {
    if (sheetHref == null) {
      throw new Error("Missing sheetHref");
    }
    if (settingId == null) {
      throw new Error("Missing settingId");
    }
    return {
      text: "<p>This rule clashes with another rule because both rules have " +
          "the same number of IDs, classes and tags, but the other rule was " +
          "specified later in the page.</p>" +
          "<p><strong>Note</strong>: Changing rules can <a href='#'>affect " +
          "many elements</a>.</p>" +
          "<p><strong>Note</strong>: For detail, see <a href='#'>how CSS " +
          "specificity works</a>.</p>"
          /*
           * To promote this rule either add IDs, " +
          "classes or tags to this rule, or remove them from the other, or " +
          "move this rule down the page, past the other rule.
           */
      };
  }
};

if (this.exports) {
  exports.styleLogic = styleLogic;
}
