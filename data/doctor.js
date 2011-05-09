
/**
 * Assumes:
 * var Templater = domtemplate.js:Templater;
 * var styleLogic;
 * doctor('element#id');
 */

/**
 * This is the main function.
 */
function doctor(inspectedCssName, styleLogic, Templater) {
  doctor.styleLogic = styleLogic;
  doctor.Templater = Templater;

  doctor.styleLogic.getSheets(function(sheets) {
    console.log(sheets);
    var data = {
      inspected: inspectedCssName,
      sheetViews: sheets.map(function(sheet) {
        return new SheetView(sheet);
      }, this)
    };

    doctor.Templater.template('docTemplateSheets', 'docRoot', data);
  }.bind(this));
}

/**
 * A container to view us easy access to display data from a CssRule
 */
function SheetView(aSheet) {
  var props = [ 'systemSheet', 'id', 'shortSource', 'ruleCount', 'href' ];
  props.forEach(function(prop) {
    this[prop] = aSheet[prop];
  }, this);

  this.populated = false;
  this.populating = false;
  this.size = 'docCount' + Math.min(8, Math.max(0, this.ruleCount));

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
      doctor.styleLogic.getRules(this.id, function(aRules) {
        this.ruleViews = [];
        this.ruleViews = aRules.map(function(rule) {
          return new RuleView(this, rule);
        }, this);

        doctor.Templater.template('docTemplateRules', this.rulesEle, this);
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
function RuleView(sheet, data) {
  this.sheet = sheet;
  this.id = data.id;
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
      doctor.styleLogic.getSettings(this.id, function(settings) {
        this.settingViews = [];
        this.settingViews = settings.map(function(setting) {
          return new SettingView(this, setting);
        }, this);

        doctor.Templater.template('docTemplateSettings', this.settingsEle, this);
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
function SettingView(rule, data) {
  this.rule = rule;
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
      doctor.styleLogic.getAnswer(this.id, function(answer) {
        this.answerView = new AnswerView(answer);

        doctor.Templater.template('docTemplateAnswer', this.answerEle, this);
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
