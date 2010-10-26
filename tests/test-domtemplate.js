
var Templater = require('domtemplate').Templater;

exports.ensureAdd = function(test) {
  test.assertEqual(Templater.add(1, 2), 3, "1+2=3");
};

