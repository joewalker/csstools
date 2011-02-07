
The main.js module is insignificant. It simply registers a context menu to
allow an easy way to select elements for inspection, and a page-mod to allow
DOM inspection.

About CSSTools
==============

There are 2 major parts to the CSS Tools project, which have separate overview
documentation:

- [CSS Inspector](inspector/index.md) is a merged `Styles` view and
  `Computed Styles` view (in Firebug terms).
- [CSS Doctor](doctor/index.md) is an easy way to work out why a CSS rule isn't
  working as expected.


Other Significant Code
----------------------

- [DOM Template](domtemplate.md) is a simple templating engine for working with
  live DOM elements.
- [Surrogate](surrogate.md) is a method for proxying calls between 2 sides of
  a process boundary.
