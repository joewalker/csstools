
let contextMenu = require("context-menu");

let findClick = require("findClick");
let data = require("self").data;
let panel = require("panel");
let proxier = require("proxierServer");

let styleLogic = require("csslogic").StyleLogic();
proxier.supply("styleLogic", styleLogic);

/**
 * Add the "Inspect Styles" context menu.
 * TODO: How do we add the menu to links too?
 */
contextMenu.add(contextMenu.Item({

  label: "Inspect Styles",
  contentScript: 'on("click", ' + findClick.onClick.toString() + ');',

  onMessage: function(id) {
    let clicked = findClick.clickedNode(id);
    styleLogic.highlight(clicked);

    this.inspector = panel.add(panel.Panel({
      contentURL: data.url("/csshtmltree.html"),
      contentScriptURL: [
        data.url("proxierClient.js"),
        data.url("domtemplate.js"),
        data.url("csshtmltree.js")
      ]
    }));

    proxier.addHandler(this.inspector);
    this.inspector.show();
  }
}));

