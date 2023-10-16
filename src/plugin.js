import {Component, Keymap, Menu, Notice, parseFrontMatterAliases, Plugin} from "obsidian";
import {renameTag, findTargets} from "./renaming";
import {Tag} from "./Tag";
import {around} from "monkey-around";
import {Confirm} from "@ophidian/core";

const tagHoverMain = "tag-wrangler:tag-pane";

function onElement(el, event, selector, callback, options) {
    el.on(event, selector, callback, options)
    return () => el.off(event, selector, callback, options);
}

export default class TagWrangler extends Plugin {
    pageAliases = new Map();
    tagPages = new Map();

    tagPage(tag) {
        return Array.from(this.tagPages.get(Tag.canonical(tag)) || "")[0]
    }

    openTagPage(file, isNew, newLeaf) {
        const openState = {
            eState: isNew ? {rename: "all"} : {focus: true},  // Rename new page, focus existing
            ...(isNew ? {state: {mode: "source"}} : {})       // and set source mode for new page
        }
        return this.app.workspace.getLeaf(newLeaf).openFile(file, openState);
    }

    async createTagPage(tagName, newLeaf) {
        const tag = new Tag(tagName);
        const tp_evt = { tag: tag.canonical, file: undefined };
        app.workspace.trigger("tag-page:will-create", tp_evt);
        let file = tp_evt.file && await tp_evt.file;
        if (!file) {
            const baseName = new Tag(tagName).name.split("/").join(" ");
            const folder = this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path || "");
            const path = this.app.vault.getAvailablePath(folder.getParentPrefix()+baseName, "md");
            file = await this.app.vault.create(path, [
                "---",
                `Aliases: [ ${JSON.stringify(Tag.toTag(tagName))} ]`,
                "---",
                ""
            ].join("\n"));
        }
        tp_evt.file = file;
        await this.openTagPage(file, true, newLeaf);
        app.workspace.trigger("tag-page:did-create", tp_evt);
    }

    onload(){
        this.registerEvent(
            app.workspace.on("editor-menu", (menu, editor) => {
                const token = editor.getClickableTokenAt(editor.getCursor());
                if (token?.type === "tag") this.setupMenu(menu, token.text);
            })
        )

        this.register(
            onElement(document, "contextmenu", ".tag-pane-tag", this.onMenu.bind(this), {capture: true})
        );

        this.addCommand({
            id: "tag-wrangler-open-or-create-tag-page",
            name: "Open or create tag page",
            editorCallback: (editor, view) => {
                const token = editor.getClickableTokenAt(editor.getCursor());
                if (token?.type === "tag") {
                    const tagName = Tag.toTag(token.text).slice(1);
                    const tagPage = this.tagPage(tagName);
                    tagPage ? this.openTagPage(tagPage, false, false) : this.createTagPage(tagName, false);
                }
            },
        });

        this.app.workspace.registerHoverLinkSource(tagHoverMain, {display: 'Tag pane', defaultMod: true});

        this.addChild(
            // Tags in the tag pane
            new TagPageUIHandler(this, {
                hoverSource: tagHoverMain, selector: ".tag-pane-tag", container: ".tag-container",
                toTag(el) { return el.find(".tag-pane-tag-text, tag-pane-tag-text, .tag-pane-tag .tree-item-inner-text")?.textContent; }
            })
        );

        this.addChild(
            // Reading mode / tag links
            new TagPageUIHandler(this, {
                hoverSource: "preview", selector: 'a.tag[href^="#"]',
                container: ".markdown-preview-view, .markdown-embed, .workspace-leaf-content",
                toTag(el) { return el.getAttribute("href"); }
            })
        );

        this.addChild(
            // Property view
            new TagPageUIHandler(this, {
                hoverSource: "preview", selector: '.metadata-property[data-property-key="tags"] .multi-select-pill-content',
                container: ".metadata-properties",
                toTag(el) { return el.textContent; }
            })
        );

        this.addChild(
            // Edit mode
            new TagPageUIHandler(this, {
                hoverSource: "editor", selector: "span.cm-hashtag",
                container: ".markdown-source-view",
                toTag(el) {
                    // Multiple cm-hashtag elements can be side by side: join them all together:
                    let tagName = el.textContent;
                    if (!el.matches(".cm-formatting")) for (let t=el.previousElementSibling; t?.matches("span.cm-hashtag:not(.cm-formatting)"); t = t.previousElementSibling) {
                        tagName = t.textContent + tagName;
                    }
                    for (let t=el.nextElementSibling; t?.matches("span.cm-hashtag:not(.cm-formatting)"); t = t.nextElementSibling) {
                        tagName += t.textContent;
                    }
                    return tagName;
                }
            })
        );


        // Tag Drag
        this.register(
            onElement(document, "pointerdown", ".tag-pane-tag", (_, targetEl) => {
                targetEl.draggable = "true";
            }, {capture: true})
        );
        this.register(
            onElement(document, "dragstart", ".tag-pane-tag", (event, targetEl) => {
                const tagName = targetEl.find(".tag-pane-tag-text, tag-pane-tag-text, .tag-pane-tag .tree-item-inner-text")?.textContent;
                event.dataTransfer.setData("text/plain", "#"+tagName);
                app.dragManager.onDragStart(event, {
                    source: "tag-wrangler",
                    type: "text",
                    title: tagName,
                    icon: "hashtag",
                })
                window.addEventListener("dragend", release, true);
                window.addEventListener("drop", release, true);
                function release() {
                    app.dragManager.draggable = null;
                    window.removeEventListener("dragend", release, true);
                    window.removeEventListener("drop", release, true);
                }
            }, {capture: false})
        );

        const dropHandler = (e, targetEl, info = app.dragManager.draggable, drop) => {
            if (info?.source !== "tag-wrangler" || e.defaultPrevented ) return;
            const tag = targetEl.find(".tag-pane-tag-text, tag-pane-tag-text, .tag-pane-tag .tree-item-inner-text")?.textContent;
            const dest = tag+"/"+Tag.toName(info.title).split("/").pop();
            if (Tag.canonical(tag) === Tag.canonical(info.title)) return;
            e.dataTransfer.dropEffect = "move";
            e.preventDefault();
            if (drop) {
                this.rename(Tag.toName(info.title), dest);
            } else {
                app.dragManager.updateHover(targetEl, "is-being-dragged-over");
                app.dragManager.setAction(`Rename to ${dest}`);
            }
        }

        this.register(onElement(document.body, "dragover", ".tag-pane-tag.tree-item-self", dropHandler, {capture: true}));
        this.register(onElement(document.body, "dragenter", ".tag-pane-tag.tree-item-self", dropHandler, {capture: true}));
        // This has to be registered on the window so that it will still get the .draggable
        this.registerDomEvent(window, "drop", e => {
            const targetEl = e.target?.matchParent(".tag-pane-tag.tree-item-self", e.currentTarget);
            if (!targetEl) return;
            const info = app.dragManager.draggable;
            if (info && !e.defaultPrevented) dropHandler(e, targetEl, info, true);
        }, {capture: true});

        // Track Tag Pages
        const metaCache = this.app.metadataCache;
        const plugin = this;

        this.register(around(metaCache, {
            getTags(old) {
                return function getTags() {
                    const tags = old.call(this);
                    const names = new Set(Object.keys(tags).map(t => t.toLowerCase()));
                    for (const t of plugin.tagPages.keys()) {
                        if (!names.has(t)) tags[plugin.tagPages.get(t).tag] = 0;
                    }
                    return tags;
                }
            }
        }));

        this.app.workspace.onLayoutReady(() => {
            metaCache.getCachedFiles().forEach(filename => {
                const fm = metaCache.getCache(filename)?.frontmatter;
                if (fm && parseFrontMatterAliases(fm)?.filter(Tag.isTag)) this.updatePage(
                    this.app.vault.getAbstractFileByPath(filename), fm
                );
            });
            this.registerEvent(metaCache.on("changed", (file, data, cache) => this.updatePage(file, cache?.frontmatter)));
            this.registerEvent(this.app.vault.on("delete", file => this.updatePage(file)));
            app.workspace.getLeavesOfType("tag").forEach(leaf => {leaf?.view?.requestUpdateTags?.()});
        });
    }

    updatePage(file, frontmatter) {
        const tags = parseFrontMatterAliases(frontmatter)?.filter(Tag.isTag) || [];
        if (this.pageAliases.has(file)) {
            const oldTags = new Set(tags || []);
            for (const tag of this.pageAliases.get(file)) {
                if (oldTags.has(tag)) continue;  // don't bother deleting what we'll just put back
                const key = Tag.canonical(tag);
                const tp = this.tagPages.get(key);
                if (tp) {
                    tp.delete(file);
                    if (!tp.size) this.tagPages.delete(key);
                }
            }
            if (!tags.length) this.pageAliases.delete(file);
        }
        if (tags.length) {
            this.pageAliases.set(file, tags);
            for (const tag of tags) {
                const key = Tag.canonical(tag);
                if (this.tagPages.has(key)) this.tagPages.get(key).add(file);
                else {
                    const tagSet = new Set([file]);
                    tagSet.tag = Tag.toTag(tag);
                    this.tagPages.set(key, tagSet);
                }
            }
        }
    }

    onMenu(e, tagEl) {
        let menu = e.obsidian_contextmenu;
        if (!menu) {
            menu = e.obsidian_contextmenu = new Menu();
            setTimeout(() => menu.showAtPosition({x: e.pageX, y: e.pageY}), 0);
        }

        const
            tagName = tagEl.find(".tag-pane-tag-text, .tag-pane-tag .tree-item-inner-text").textContent,
            isHierarchy = tagEl.parentElement.parentElement.find(".collapse-icon")
        ;
        this.setupMenu(menu, tagName, isHierarchy);
        if (isHierarchy) {
            const
                tagParent = tagName.split("/").slice(0, -1).join("/"),
                tagView = this.leafView(tagEl.matchParent(".workspace-leaf")),
                tagContainer = tagParent ? tagView.tagDoms["#" + tagParent.toLowerCase()]: tagView.root
            ;
            function toggle(collapse) {
                for(const tag of tagContainer.children ?? tagContainer.vChildren.children) tag.setCollapsed(collapse);
            }
            menu.addItem(item("tag-hierarchy", "vertical-three-dots", "Collapse tags at this level", () => toggle(true )))
                .addItem(item("tag-hierarchy", "expand-vertically"  , "Expand tags at this level"  , () => toggle(false)))
        }
    }

    setupMenu(menu, tagName, isHierarchy=false) {
        tagName = Tag.toTag(tagName).slice(1);
        const
            tagPage = this.tagPage(tagName),
            searchPlugin = this.app.internalPlugins.getPluginById("global-search"),
            search = searchPlugin && searchPlugin.instance,
            query = search && search.getGlobalSearchQuery(),
            random = this.app.plugins.plugins["smart-random-note"]
        ;
        menu.addItem(item("tag-rename", "pencil", "Rename #"+tagName, () => this.rename(tagName)))

        if (tagPage) {
            menu.addItem(
                item("tag-page", "popup-open", "Open tag page", (e) => this.openTagPage(tagPage, false, Keymap.isModEvent(e)))
            )
        } else {
            menu.addItem(
                item("tag-page", "create-new", "Create tag page", (e) => this.createTagPage(tagName, Keymap.isModEvent(e)))
            )
        }

        if (search) {
            menu.addItem(
                item("tag-search", "magnifying-glass", "New search for #"+tagName, () => search.openGlobalSearch("tag:#" + tagName))
            );
            if (query) {
                menu.addItem(
                    item("tag-search", "sheets-in-box", "Require #"+tagName+" in search"  , () => search.openGlobalSearch(query+" tag:#"  + tagName))
                );
            }
            menu.addItem(
                item("tag-search", "crossed-star" , "Exclude #"+tagName+" from search", () => search.openGlobalSearch(query+" -tag:#" + tagName))
            );
        }

        if (random) {
            menu.addItem(
                item("tag-random", "dice", "Open random note", async () => {
                    const targets = await findTargets(this.app, new Tag(tagName));
                    random.openRandomNote(targets.map(f=> this.app.vault.getAbstractFileByPath(f.filename)));
                })
            );
        }

        this.app.workspace.trigger("tag-wrangler:contextmenu", menu, tagName, {search, query, isHierarchy, tagPage});
    }

    leafView(containerEl) {
        let view;
        this.app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.containerEl === containerEl) { view = leaf.view; return true; }
        })
        return view;
    }


    async rename(tagName, toName=tagName) {
        try { await renameTag(this.app, tagName, toName); }
        catch (e) { console.error(e); new Notice("error: " + e); }
    }

}

function item(section, icon, title, click) {
    return i => { i.setIcon(icon).setTitle(title).onClick(click); if (section) i.setSection(section); }
}


class TagPageUIHandler extends Component {
    // Handle hovering and clicks-to-open for tag pages

    constructor(plugin, opts) {
        super();
        this.opts = opts
        this.plugin = plugin;
    }

    onload() {
        const {selector, container, hoverSource, toTag} = this.opts;
        this.register(
            // Show tag page on hover
            onElement(document, "mouseover", selector, (event, targetEl) => {
                const tagName = toTag(targetEl), tp = tagName && this.plugin.tagPage(tagName);
                if (tp) this.plugin.app.workspace.trigger('hover-link', {
                    event, source: hoverSource, targetEl, linktext: tp.path,
                    hoverParent: targetEl.matchParent(container)
                });
            }, {capture: false})
        );

        if (hoverSource === "preview") {
            this.register(
                onElement(document, "contextmenu", selector, (e, targetEl) => {
                    let menu = e.obsidian_contextmenu;
                    if (!menu) {
                        menu = e.obsidian_contextmenu = new Menu();
                        setTimeout(() => menu.showAtPosition({x: e.pageX, y: e.pageY}), 0);
                    }
                    this.plugin.setupMenu(menu, toTag(targetEl));
                })
            );
            this.register(
                onElement(document, "dragstart", selector, (event, targetEl) => {
                    const tagName = toTag(targetEl);
                    event.dataTransfer.setData("text/plain", Tag.toTag(tagName));
                    app.dragManager.onDragStart(event, {
                        source: "tag-wrangler",
                        type: "text",
                        title: tagName,
                        icon: "hashtag",
                    })
                }, {capture: false})
            );
        }

        this.register(
            // Open tag page w/alt click (current pane) or ctrl/cmd/middle click (new pane)
            onElement(document, hoverSource === "editor" ? "mousedown" : "click", selector, (event, targetEl) => {
                const {altKey} = event;
                if (!Keymap.isModEvent(event) && !altKey) return;
                const tagName = toTag(targetEl), tp = tagName && this.plugin.tagPage(tagName);
                if (tp) {
                    this.plugin.openTagPage(tp, false, Keymap.isModEvent(event));
                } else {
                    new Confirm()
                        .setTitle("Create Tag Page")
                        .setContent(`A tag page for ${tagName} does not exist.  Create it?`)
                        .confirm()
                        .then(v => {
                            if (v) return this.plugin.createTagPage(tagName, Keymap.isModEvent(event));
                            const search = app.internalPlugins.getPluginById("global-search")?.instance;
                            search?.openGlobalSearch("tag:#" + tagName)
                        })
                    ;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                return false;
            }, {capture: true})
        );
    }
}
