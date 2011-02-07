
CSS Tools
=========

CSS Tools is an experiment into how we can improve the CSS telemetry in a
browser. The core thinking is that currently browsers do little more than
tell you what you have given them. They should be telling you how they
understand what you've told them, and more importantly how to do it better.

2 tools are planned:

CSS Inspector
-------------

This is a merged 'Computed Style View' and 'Style View' (as presented in
Firebug and WebKit Inspector. It represents the idea that you nearly always
know what property you want to look at (so that should come at the top of
the tree) and how it is affected by the stylesheets should be organized under
that. [More about CSS Inspector](docs/doctor/index.md)

CSS Doctor
----------

The idea behind the doctor is to take the web developer from 'Ga! Why does
my element look like that?' to an explanation in as little time as possible.
We select an element that looks wrong, and a rule that should make it look
right, and explain why the rule isn't affecting the element properly.
[More about CSS Inspector](docs/doctor/index.md)
