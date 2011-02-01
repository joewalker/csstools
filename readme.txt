
Create a basic lite browser backend
Make it work in chrome
Make it work in Firefox
Create a smart gecko backend
Fix up the inspector part
Style review

UI Issues
=========

From doctor.html:

* Make the answerView wider, and overflow from the blank128 borders
  * This should get rid of a thin white line rendering bug
* Re-open to last position
* Animate the open/close action - slide actions
* Re-create blank128 in CSS or at least have higher res image
  * Reduce the top border?
* On open, close the other things at a similar level

The arrow isn't right. Maybe the arrow in blank22-arrow should point down not
diagonally.
The idea is that the icon is the minimized file which expands, so it shouldn't
be 'there' when expanded.
The problem is that having nothing in it's space looks strange because then you
have a title which seems to be inexplicably hanging in space. So we added the
arrow, but that's too much visual noise.

* Try putting icons on right hand side (probably lined up in a table?)

From OverflowPanelHost:

* Can we make the blur background work?
* Add close button to toolbar (unimportant)
* Make all bits of background close the dialog
* Maybe we should emulate FF4's popup dialogs?
