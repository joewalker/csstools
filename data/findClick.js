
/**
 * This function gets (or generates) an id for a clicked node, and calls
 * postMessage() with that id. It is expected that onMessage will call
 * #clickedNode() to get a reference to the clicked node, and to clear up any
 * generated ids.
 * We then toString this function to create a contentScript. Yuck
 */
function onClick(node, data) {
  var id = node.id;

  if (!id) {
    var i = 0;
    while (true) {
      id = "-moz-cssi-" + node.nodeName + i;
      if (!node.ownerDocument.getElementById(id)) {
        node.id = id;
        break;
      }
      i++;
    }
  }

  if (!id) {
    throw new Error("failed to find temporary id.");
  }

  postMessage(id);
};

on("click", onClick);
