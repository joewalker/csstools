
/**
 * Assumes:
 * var Templater = domtemplate.js:Templater;
 * var styleLogic;
 * or
 * function Surrogate();
 *
 * doctor('element#id');
 */

if (!this.styleLogic) {
  this.styleLogic = new Surrogate(this).require('styleLogic');
}

/**
 * This is the main function.
 */
function doctor(inspectedCssName) {
  styleLogic.getSheets(function(sheets) {
    var data = {
      inspected: inspectedCssName,
      sheetViews: sheets.map(function(sheet) {
        return new SheetView(sheet);
      }, this)
    };

    Templater.template('docTemplateSheets', 'docRoot', data);
  }.bind(this));
}

/**
 * A container to view us easy access to display data from a CssRule
 */
function SheetView(aSheet) {
  var props = [ 'systemSheet', 'index', 'shortSource', 'ruleCount', 'href' ];
  props.forEach(function(prop) {
    this[prop] = aSheet[prop];
  }, this);

  this.populated = false;
  this.populating = false;
  this.size = this.ruleCount > 8 ? 'docCount8' : 'docCount' + this.ruleCount;

  // Populated by Templater:
  this.element = null;  // Element which contains the 'open' class
  this.rulesEle = null; // Destination for templateRules.
}
SheetView.prototype = {
  /**
   * What we do when someone clicks to expand to see the rules in the sheet
   */
  click: function(ev) {
    if (this.element.classList.contains('docSheetOpen')) {
      this.element.classList.remove('docSheetOpen');
      return;
    }

    if (!this.populated) {
      if (this.populating) {
        return;
      }

      this.populating = true;
      styleLogic.getRules(this.href, function(aRules) {
        this.ruleViews = [];
        this.ruleViews = aRules.map(function(aRule) {
          return new RuleView(aRule);
        }, this);

        Templater.template('docTemplateRules', this.rulesEle, this);
        this.populated = true;
        this.populating = false;
      }.bind(this));
    }

    this.element.classList.add('docSheetOpen');
  }
};

/**
 * A RuleView represents a rule (selector group and set of property/values)
 */
function RuleView(data) {
  this.id = data.selectorId;
  this.selectorGroup = data.selectorGroup;
  this.selectors = this.selectorGroup.join(', ');
  this.propertyCount = data.propertyCount;
  this.propertiesTitle = '(' + this.propertyCount + ' properties)';
  // Injected by template in SheetView.click
  this.settingsEle = null;
}
RuleView.prototype = {
  click: function(ev) {
    if (this.element.classList.contains('docRuleOpen')) {
      this.element.classList.remove('docRuleOpen');
      return;
    }

    if (!this.populated) {
      if (this.populating) {
        return;
      }

      this.populating = true;
      styleLogic.getSettings(this.href, this.id, function(aRules) {
        this.settingViews = [];
        this.settingViews = aRules.map(function(aRule) {
          return new SettingView(aRule);
        }, this);

        Templater.template('docTemplateSettings', this.settingsEle, this);
        this.populated = true;
        this.populating = false;
      }.bind(this));
    }

    this.element.classList.add('docRuleOpen');
  }
};

/**
 * A SettingView represents a property/value pair
 */
function SettingView(data) {
  this.id = data.id;
  this.property = data.property;
  this.value = data.value;
  // Injected by template in RuleView.click
  this.answerEle = null;
}
SettingView.prototype = {
  click: function(ev) {
    if (this.element.classList.contains('docSettingOpen')) {
      this.element.classList.remove('docSettingOpen');
      return;
    }

    if (!this.populated) {
      if (this.populating) {
        return;
      }

      this.populating = true;
      styleLogic.getAnswer('element', this.id, function(aAnswer) {
        this.answerView = new AnswerView(aAnswer);

        Templater.template('docTemplateAnswer', this.answerEle, this);
        this.populated = true;
        this.populating = false;
      }.bind(this));
    }

    this.element.classList.add('docSettingOpen');
  }
};

/**
 * An AnswerView is a holder for the logic behind the non display of a
 * setting
 */
function AnswerView(data) {
  this.text = document.createElement('div');
  this.text.innerHTML = data.text;
}
