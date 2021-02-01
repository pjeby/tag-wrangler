# Obsidian Tag Wrangler Plugin

This plugin adds a context menu for tags in the [Obsidian.md](https://obsidian.md) tag pane, with the following actions available:

* [Rename the tag](#renaming-tags) (and all its subtags)
* Start a new search for the tag (similar to a plain click)
* Add the tag as a requirement (`tag:#whatever`) to the current search
* Add an exclusion for the tag (`-tag:#whatever`) to the current search
* Collapse all tags at the same level in the tag pane
* Expand all tags at the same level in the tag pane

Depending on the current state of the search and tag panes, some actions may not be available.  (e.g. expand and collapse are only available when the tag pane is showing tags in a hierarchy.)

**Please note**: renaming a tag is potentially an irreversible operation: you may wish to back up your data before beginning a rename.  See the section on [Renaming tags](#renaming-tags) below for more information.



## Installation

Search for "tag wrangler" in Obsidian's Community Plugins interface, or if it's not there yet, just visit the [Github releases page](https://github.com/pjeby/tag-wrangler/releases), download the plugin .zip from the latest release, and unzip it in your vault's `.obsidian/plugins/` directory.  You can then enable it from the Obsidian "Community Plugins" tab for that vault.



## Renaming Tags

Just like renaming notes, renaming tags involves making substitutions in all the files that reference them.  In order to ensure only actual tags are renamed, Tag Wrangler uses Obsidian's own parse data to identify the tag locations.  That way, if you have a markdown link like `[foo](#bar)`, it won't consider the `#bar` to be an instance of a `#bar` tag.

Because tags exist only in the files that contain them, certain renaming operations are *not reversible*.  For example, if you rename `#foo` to `#bar`, and you already have a `#bar` tag, then afterwards there will be no way to tell which files originally had `#foo` and which had `#bar` any more, without consulting a backup or revision control of some kind.

For this reason, Tag Wrangler checks ahead of time if you are renaming tags in a way that will merge any tags with existing tags, and ask for an additional confirmation, warning about the lack of undo.  (Not that *any* renames are really undoable, it's just that if no merging takes place, you can generally rename the tag back to its old name!)

If you are using some type of background sync (e.g. Dropbox, GDrive, Resilio, etc.), and it causes any files to be changed *while* Tag Wrangler is doing a rename, Tag Wrangler may skip the changed file(s), resulting in a partial rename.  Generally, repeating the same rename option should work to finish the process, but in case of merges you may have to be more careful.  (It's probably best you make sure any sync operations are completed before beginning any rename operations.)

If many files need to be changed, or if renaming proceeds slowly, a progress dialog will be displayed, giving you the option to abort the renaming process.  This will not undo changes made prior to that point, only stop further changes from occurring.

### Tags With Child Tags

Obsidian allows hierarchical tags of the form `#x/y/z`.  When you rename a parent tag (like `#x/y`), all of its child tags will be renamed as well.

So for example, if you rename `#x/y` to `#a/b`, then a tag that was previously named `#x/y/z` will be renamed to `#a/b/z`.  (There is no way to rename only the parent tag, except by individually renaming all its child tags to move them under another parent.)

If you want to refactor your tag hierarchy, note that you can rename a tag and its children to have either more or fewer path parts than it did before.  That is, you can rename `#x/y` to just `#x`, and then your `#x/y/z` tag will become `#x/z`.  Or conversely, you can rename `#x/y` to `#letters/x/y`, which will move `#x/y/z` to `#letters/x/y/z`.

Many possibilities are available for refactoring your tags.  Just be sure to make a backup before you start, keep track of what you're changing, and check on the results before you sync or commit your changes.

### Front Matter

Obsidian allows tags to be specified as part of a note's YAML front matter.  Tag Wrangler will attempt to rename these as well as those found in a note's body.  However, due to limitations of the parser involved, some whitespace in the front matter may be removed or reduced.  In particular, runs of more than one blank line between values are reduced to single blank lines, and spaces between a value and a comment may be similarly reduced in number.  (Most other formatting should remain intact, however, and whitespace that is part of a YAML value will be unaffected.)