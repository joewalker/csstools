
let contextMenu = require("context-menu");

let findClick = require("findClick");
let data = require("self").data;
let panel = require("panel");
let proxier = require("proxier");

// demo

let example = {
  sayHello: function(name) { return "Hello, " + name; },
  add: function(a, b) { return a + b; }
};

let remote = proxier.declareRemote("proxiedExample", example);

/**
 * Add the "Inspect Styles" context menu.
 * TODO: How do we add the menu to links too?
 */
contextMenu.add(contextMenu.Item({

  label: "Inspect Styles",
  contentScript: 'on("click", ' + findClick.onClick.toString() + ');',

  onMessage: function(id) {
    let clicked = findClick.clickedNode(id);

    this.inspector = panel.add(panel.Panel({
      contentURL: data.url("/csshtmltree.html"),
      contentScript: remote,
      contentScriptURL: [
        data.url("csshtmltree.js"),
        data.url("domtemplate.js"),
      ],
      onShow: function() {
        console.log("opened");
      }
    }));

    proxier.setHandler(this.inspector);
    this.inspector.show();
  }
}));

