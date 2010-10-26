
/**
 * This function is designed to be added to a click event as a content
 * script using something like this:
 * 
 * contentScript: 'on("click", ' + findClick.onClick.toString() + ');',
 *
 * This function gets (or generates) an id for a clicked node, and calls
 * postMessage() with that id. It is expected that onMessage will call
 * #clickedNode() to get a reference to the clicked node, and to clear up any
 * generated ids.
 * We then toString this function to create a contentScript. Yuck
 */
exports.onClick = function(node) {
  var id = node.id;
  if (id) {
    postMessage(id);
    return;
  }

  var i = 0;
  while (i < 1000) {
    id = "-moz-cssi-" + node.nodeName + i;
    if (!node.ownerDocument.getElementById(id)) {
      node.id = id;
      postMessage(id);
      return;
    }
    i++;
  }
  throw new Error("failed to find temporary id.");
};

/**
 * Get access to a node. Designed to be used in conjection with #onClick()
 * as follows:
 *
 * onMessage: function(data) {
 *   let clicked = findClick.clickedNode(data);
 *   // Use clicked ...
 * }
 */
exports.clickedNode = function(data) {
  let clicked = require("tabs").activeTab.contentDocument.getElementById(data);
  if (data.indexOf("-moz-cssi-") === 0) {
    clicked.removeAttribute("id");
  }
  return clicked;
};

