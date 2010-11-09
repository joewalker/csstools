
Where Next?
===========

In a browser, load file:///Users/joe/Projects/mozilla/jetpack-sdk/packages/style-inspector/data/csshtmltree.html
- The Inspector tab functions with the debug data.
- The Doctor tab fails, we need to match up the parts of templateRules
  - (i.e. rule.*) with the parts of SelectorView. There are some obvious naming
    issues here as a result of cut and paste.
  - When we've got the selectorGroups in a sheet displaying, we need to have
    a click on a selectorGroup display the properties and values within, and
    have them display the messages in ignore/rule-status-logic.txt

In 'live', the templates are silently failing to load. Probably a result of the
  hacks to allow 'off-line' working. Put console.logs in the path, (or maybe
  there is a debug option to the proxier?)


Outstanding tasks
-----------------
jQuery is massive overkill for just tabs. Use HTML5 :target instead
  See http://playground.deaxon.com/css/tabs/#home

Go through the CSS and prefix the doctor parts with doc, and so on

Make a single file proxier?
