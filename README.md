# Obsidian Tag Wrangler Plugin

This plugin adds a context menu for tags in the [Obsidian.md](https://obsidian.md) tag pane, with the following actions available:

![Image of tag wrangler's context menu](https://raw.githubusercontent.com/pjeby/tag-wrangler/master/contextmenu.png)

* Open or create a [Tag Page](#tag-pages) (**NEW in 0.5.0**)
* [Rename the tag](#renaming-tags) (and all its subtags)
* Start a new search for the tag (similar to a plain click)
* Add the tag as a requirement (`tag:#whatever`) to the current search
* Add an exclusion for the tag (`-tag:#whatever`) to the current search
* Open a random note with that tag (if you have the [Smart Random Note](https://github.com/erichalldev/obsidian-smart-random-note/) plugin installed and enabled)
* Collapse all tags at the same level in the tag pane
* Expand all tags at the same level in the tag pane

Depending on the current state of the search and tag panes, some actions may not be available.  (e.g. expand and collapse are only available when the tag pane is showing tags in a hierarchy.)

**Please note**: renaming a tag is potentially an irreversible operation: you may wish to back up your data before beginning a rename.  See the section on [Renaming tags](#renaming-tags) below for more information.



## Installation

Search for "tag wrangler" in Obsidian's Community Plugins interface, or [click here](https://obsidian-plugins.peak-dev.org/show/tag-wrangler) to open it in your most-recently-used vault.  (Then select "Install" and "Enable".)

Also, make sure that you have enabled the "Tag Pane" plugin, in the "Core Plugins" section of your vault's configuration.  This plugin adds a context menu to the pane provided by that plugin, and does not have any UI of its own.



## Tag Pages

People often debate the merits of using tags vs. page links to organize your notes.  With tag pages, you can combine the best of both worlds: the visibility and fluid entry of tags, plus the centralized content and outbound linking of a page.

To create a tag page, just right click any tag in the tag pane, then select "Create Tag Page".  A new note will be created with an alias of the selected tag.  You can rename the note or move it anywhere you like in the vault, as long as it retains the alias linking it to the tag.  (Renaming a tag associated with a tag page (see "Renaming Tags", below) will automatically update the alias.)

To open an *existing* tag page, you can Alt-click any tag in the tag pane or any note, whether in editing or reading view.  Ctrl/Cmd-click or middle click will open the tag page in a new pane.  (Note: if no tag page exists, the normal click behavior of globally searching for the tag will apply.)

Or, you can enter the tag's name in the Obsidian "quick switcher" (default hotkey: Ctrl/Cmd-O) to open the page from the keyboard.  You can also hover-preview any tag in the tag pane or any markdown views to pop up a preview of the tag page.

(If you're not familiar with hover-previewing, the basic idea is that by holding the Ctrl/Cmd key while moving the mouse pointer over an item in Obsidian, a popup will often appear with a small version of the relevant page.  You can also go into the settings for the built-in "Page Preview" plugin and selectively disable the need for using the Ctrl/Cmd key, if you prefer to just hover without it.  Tag Wrangler respects your existing settings for hovering links in Editor and Preview views, and adds an extra setting for "Tag Pane" that controls whether it will require the Ctrl/Cmd key when hovering tags in the tag pane.)

Tag Wrangler does not (yet) support automatic conversion of tag references to page links or vice versa, though it may in a future version.  In the meantime, however, you can use Obsidian's backlinks to find and change such references from the tag page.  Specifically, viewing a tag page's "unlinked mentions" will show you all the locations where the tag was used and "link" buttons you can use to convert them to page links.  (Converting page links to tags requires hand editing.)



### Manually Creating and Managing Tag Pages

You do not have to use the "Create Tag Page" menu command to create a tag page: any page (even Kanban boards or Excalidraw drawings!) can be a tag page as long as it has a tag as **a valid Obsidian alias**.  You can validate whether a particular page has a valid alias in one of two ways:

- Open the Obsidian Quick Switcher (Ctrl/Cmd-O by default) and type `#` followed by the tag name: the page should show up with the tag as an alias
- Switch the note to preview, and see if the "Aliases" in the metadata box at the top of the note has a shape containing the tag (with an arrow and a `#` at the front)

If it does not show up in either of the above places, it's likely that your note's metadata is syntactically incorrect in some way.  Obsidian recognizes the first field named `Alias` or `Aliases` (case-insensitive) and expects it to be either a YAML list of strings or a single string of aliases separated by commas.  To be recognized as a tag alias, the string or strings *must* be quoted.  Here are some valid examples of an alias or aliases field that contains a tag, each of which would cause the note to be considered the tag page for `#some/tag`:

```yaml
---
Alias: "#some/tag"
---
Aliases: [ "#some/tag", "another alias" ]
---
alias:
  - some alias
  - "#some/tag"
  - another alias
---
aliases: "some alias, #some/tag, another alias"
---
```

Notice that either each item must be quoted and be in a valid YAML list (`[ ]` or lines with `-`), or else the *entire* alias collection should be quoted and comma-separated.  A tag alias must also not contain any whitespace or other text.

When a tag is renamed, Tag Wrangler will automatically update the alias.  You can also manually edit or remove the aliases to disconnect a tag page, add additional tags (in case you want more than one tag sharing the same page), or change what tag the page is for.

Finally, note that nothing prevents you from adding the same alias to more than one note, but in such a case Tag Wrangler will select the tag page at random from the available options.  To fix this, use the quick switcher to search for notes with that alias (i.e., by typing `#` and the tag name), then remove the alias(es) from the note(s) you don't want to use as tag pages.



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

### Metadata / Front Matter

Obsidian allows tags to be specified as part of a note's metadata via YAML front matter.  Tag Wrangler will attempt to rename these as well as those found in a note's body.

In most cases, this will not cause any issues.  However, you are using advanced YAML features to specify your tags (YAML aliases or block scalars), there are two points you should be aware of.

First, if you are using YAML block scalars  (`<` or `|`) to specify your tags, a renamed tag [may affect the indentation, spacing, or wrapping](https://github.com/eemeli/yaml/issues/349)  of the tags field.  Second, if you are using YAML aliases (`*`) in your tag list, renaming an aliased tag will [expand the alias in place, rather than changing the anchor that defined it](https://github.com/pjeby/tag-wrangler/issues/13#issuecomment-826264213).

The indentation issue has been reported to the upstream library, and hopefully there will be some sort of solution in the future.  For aliases, the current behavior is a deliberate choice to avoid changing non-tag values in your metadata.  So if you are using either of these more-advanced YAML features, you should probably experiment with some fake tags in a scratch note before doing any vault-wide renames.

### Case Insensitivity

Tag Wrangler uses the same case-insensitive comparison as Obsidian when matching tags to change, and checking for clashes.  Please note, however, that because Obsidian uses the *first* occurrence of a tag to determine how it is displayed in the tag pane, renaming tags without consistent upper/lowercase usage may result in *apparent* changes to the names of "other" tags in the tag pane.

Let's say you have a tag named `#foo/bar` and you rename `#foo` to `#Bar/baz`.  But in the meantime, you already *had* a tag called `#bar/bell`.  This *might* cause you to now see that tag displayed in the tag pane as `#Bar/bell`, even though Tag Wrangler did not actually replace any existing `#bar/bell` tags in your text!  (As you will see if you search for them.)

Rather, this kind of thing will happen if the `#Bar/baz` tag is the first tag beginning with some variant of `bar` that Obsidian encounters when generating the tag pane.  Obsidian just uses the first-encountered string of a particular case as the "display name" for the tag, and then counts all subsequent occurrences as the same tag.

This is just how Obsidian tags work, and not something that Tag Wrangler can work around.  But you can easily fix the problem by renaming anything that's in the "wrong" case to the "right" case.  It just means that (as is already the case in Obsidian) you can't have more than one casing of the same tag name displayed in the tag pane, and that now you can easily rename tags to a consistent casing, if desired.