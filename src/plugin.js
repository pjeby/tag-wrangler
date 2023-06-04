import {
    Component,
    Keymap,
    Menu,
    Notice,
    parseFrontMatterAliases,
    Plugin,
    Scope,
} from "obsidian";
import { renameTag, findTargets } from "./renaming";
import { Tag } from "./Tag";
import { around } from "monkey-around";

const tagHoverMain = "tag-wrangler:tag-pane";

function onElement(el, event, selector, callback, options) {
    el.on(event, selector, callback, options);
    return () => el.off(event, selector, callback, options);
}

export default class TagWrangler extends Plugin {
    pageAliases = new Map();
    tagPages = new Map();

    tagPage(tag) {
        return Array.from(this.tagPages.get(Tag.canonical(tag)) || "")[0];
    }

    openTagPage(file, isNew, newLeaf) {
        const openState = {
            eState: isNew ? { rename: "all" } : { focus: true }, // Rename new page, focus existing
            ...(isNew ? { state: { mode: "source" } } : {}), // and set source mode for new page
        };
        return this.app.workspace.getLeaf(newLeaf).openFile(file, openState);
    }

    async createTagPage(tagName, newLeaf) {
        const baseName = new Tag(tagName).name.split("/").join(" ");
        const folder = this.app.fileManager.getNewFileParent(
            this.app.workspace.getActiveFile()?.path || ""
        );
        const path = this.app.vault.getAvailablePath(
            folder.getParentPrefix() + baseName,
            "md"
        );
        this.openTagPage(
            await this.app.vault.create(
                path,
                [
                    "---",
                    `Aliases: [ ${JSON.stringify(Tag.toTag(tagName))} ]`,
                    "---",
                    "",
                ].join("\n")
            ),
            true,
            newLeaf
        );
    }

    async onload() {
        this.register(
            onElement(
                document,
                "contextmenu",
                ".tag-pane-tag",
                this.onMenu.bind(this),
                { capture: true }
            )
        );

        this.app.workspace.registerHoverLinkSource(tagHoverMain, {
            display: "Tag pane",
            defaultMod: true,
        });

        this.addChild(
            // Tags in the tag pane
            new TagPageUIHandler(this, {
                hoverSource: tagHoverMain,
                selector: ".tag-pane-tag",
                container: ".tag-container",
                toTag(el) {
                    return el.find(
                        ".tag-pane-tag-text, tag-pane-tag-text, .tag-pane-tag .tree-item-inner-text"
                    )?.textContent;
                },
            })
        );

        this.addChild(
            // Reading mode / tag links
            new TagPageUIHandler(this, {
                hoverSource: "preview",
                selector: 'a.tag[href^="#"]',
                container:
                    ".markdown-preview-view, .markdown-embed, .workspace-leaf-content",
                toTag(el) {
                    return el.getAttribute("href");
                },
            })
        );

        this.addChild(
            // Edit mode
            new TagPageUIHandler(this, {
                hoverSource: "editor",
                selector: "span.cm-hashtag",
                container: ".markdown-source-view",
                toTag(el) {
                    // Multiple cm-hashtag elements can be side by side: join them all together:
                    let tagName = el.textContent;
                    if (!el.matches(".cm-formatting"))
                        for (
                            let t = el.previousElementSibling;
                            t?.matches("span.cm-hashtag:not(.cm-formatting)");
                            t = t.previousElementSibling
                        ) {
                            tagName = t.textContent + tagName;
                        }
                    for (
                        let t = el.nextElementSibling;
                        t?.matches("span.cm-hashtag:not(.cm-formatting)");
                        t = t.nextElementSibling
                    ) {
                        tagName += t.textContent;
                    }
                    return tagName;
                },
            })
        );

        // Tag Drag
        this.register(
            onElement(
                document,
                "pointerdown",
                ".tag-pane-tag",
                (_, targetEl) => {
                    targetEl.draggable = "true";
                },
                { capture: true }
            )
        );
        this.register(
            onElement(
                document,
                "dragstart",
                ".tag-pane-tag",
                (event, targetEl) => {
                    const tagName = targetEl.find(
                        ".tag-pane-tag-text, tag-pane-tag-text, .tag-pane-tag .tree-item-inner-text"
                    )?.textContent;
                    event.dataTransfer.setData("text/plain", "#" + tagName);
                    app.dragManager.onDragStart(event, {
                        source: "tag-wrangler",
                        type: "text",
                        title: tagName,
                        icon: "hashtag",
                    });
                },
                { capture: false }
            )
        );

        // Track Tag Pages
        const metaCache = this.app.metadataCache;
        const plugin = this;

        this.register(
            around(metaCache, {
                getTags(old) {
                    return function getTags() {
                        const tags = old.call(this);
                        const names = new Set(
                            Object.keys(tags).map((t) => t.toLowerCase())
                        );
                        for (const t of plugin.tagPages.keys()) {
                            if (!names.has(t))
                                tags[plugin.tagPages.get(t).tag] = 0;
                        }
                        return tags;
                    };
                },
            })
        );

        this.app.workspace.onLayoutReady(() => {
            metaCache.getCachedFiles().forEach((filename) => {
                const fm = metaCache.getCache(filename)?.frontmatter;
                if (fm && parseFrontMatterAliases(fm)?.filter(Tag.isTag))
                    this.updatePage(
                        this.app.vault.getAbstractFileByPath(filename),
                        fm
                    );
            });
            this.registerEvent(
                metaCache.on("changed", (file, data, cache) =>
                    this.updatePage(file, cache?.frontmatter)
                )
            );
            this.registerEvent(
                this.app.vault.on("delete", (file) => this.updatePage(file))
            );
            app.workspace.getLeavesOfType("tag").forEach((leaf) => {
                leaf?.view?.requestUpdateTags?.();
            });
        });
    }

    updatePage(file, frontmatter) {
        const tags =
            parseFrontMatterAliases(frontmatter)?.filter(Tag.isTag) || [];
        if (this.pageAliases.has(file)) {
            const oldTags = new Set(tags || []);
            for (const tag of this.pageAliases.get(file)) {
                if (oldTags.has(tag)) continue; // don't bother deleting what we'll just put back
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
        if (!e.obsidian_contextmenu) {
            e.obsidian_contextmenu = new Menu(this.app);
            setTimeout(
                () => menu.showAtPosition({ x: e.pageX, y: e.pageY }),
                0
            );
        }

        const tagName = tagEl.find(
                ".tag-pane-tag-text, .tag-pane-tag .tree-item-inner-text"
            ).textContent,
            tagPage = this.tagPage(tagName),
            isHierarchy =
                tagEl.parentElement.parentElement.find(".collapse-icon"),
            searchPlugin =
                this.app.internalPlugins.getPluginById("global-search"),
            search = searchPlugin && searchPlugin.instance,
            query = search && search.getGlobalSearchQuery(),
            random = this.app.plugins.plugins["smart-random-note"],
            menu = e.obsidian_contextmenu.addItem(
                item("pencil", "Rename #" + tagName, () => this.rename(tagName))
            );

        menu.addSeparator();
        if (tagPage) {
            menu.addItem(
                item("popup-open", "Open tag page", (e) =>
                    this.openTagPage(tagPage, false, Keymap.isModEvent(e))
                )
            );
        } else {
            menu.addItem(
                item("create-new", "Create tag page", (e) =>
                    this.createTagPage(tagName, Keymap.isModEvent(e))
                )
            );
        }

        if (search) {
            menu.addSeparator().addItem(
                item("magnifying-glass", "New search for #" + tagName, () =>
                    search.openGlobalSearch("tag:" + tagName)
                )
            );
            if (query) {
                menu.addItem(
                    item(
                        "sheets-in-box",
                        "Require #" + tagName + " in search",
                        () => search.openGlobalSearch(query + " tag:" + tagName)
                    )
                );
            }
            menu.addItem(
                item(
                    "crossed-star",
                    "Exclude #" + tagName + " from search",
                    () => search.openGlobalSearch(query + " -tag:" + tagName)
                )
            );
        }

        if (random) {
            menu.addSeparator().addItem(
                item("dice", "Open random note", async () => {
                    const targets = await findTargets(
                        this.app,
                        new Tag(tagName)
                    );
                    random.openRandomNote(
                        targets.map((f) =>
                            this.app.vault.getAbstractFileByPath(f.filename)
                        )
                    );
                })
            );
        }

        this.app.workspace.trigger("tag-wrangler:contextmenu", menu, tagName, {
            search,
            query,
            isHierarchy,
            tagPage,
        });

        if (isHierarchy) {
            const tagParent = tagName.split("/").slice(0, -1).join("/"),
                tagView = this.leafView(tagEl.matchParent(".workspace-leaf")),
                tagContainer = tagParent
                    ? tagView.tagDoms["#" + tagParent.toLowerCase()]
                    : tagView.root;
            function toggle(collapse) {
                for (const tag of tagContainer.children ??
                    tagContainer.vChildren.children)
                    tag.setCollapsed(collapse);
            }
            menu.addSeparator()
                .addItem(
                    item(
                        "vertical-three-dots",
                        "Collapse tags at this level",
                        () => toggle(true)
                    )
                )
                .addItem(
                    item("expand-vertically", "Expand tags at this level", () =>
                        toggle(false)
                    )
                );
        }
    }

    leafView(containerEl) {
        let view;
        this.app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.containerEl === containerEl) {
                view = leaf.view;
                return true;
            }
        });
        return view;
    }

    async rename(tagName) {
        const scope = new Scope();
        this.app.keymap.pushScope(scope);
        try {
            await renameTag(this.app, tagName);
        } catch (e) {
            console.error(e);
            new Notice("error: " + e);
        }
        this.app.keymap.popScope(scope);
    }
}

function item(icon, title, click) {
    return (i) => i.setIcon(icon).setTitle(title).onClick(click);
}

class TagPageUIHandler extends Component {
    // Handle hovering and clicks-to-open for tag pages

    constructor(plugin, opts) {
        super();
        this.opts = opts;
        this.plugin = plugin;
    }

    onload() {
        const { selector, container, hoverSource, toTag } = this.opts;
        this.register(
            // Show tag page on hover
            onElement(
                document,
                "mouseover",
                selector,
                (event, targetEl) => {
                    const tagName = toTag(targetEl),
                        tp = tagName && this.plugin.tagPage(tagName);
                    if (tp)
                        this.plugin.app.workspace.trigger("hover-link", {
                            event,
                            source: hoverSource,
                            targetEl,
                            linktext: tp.path,
                            hoverParent: targetEl.matchParent(container),
                        });
                },
                { capture: false }
            )
        );
        this.register(
            // Open tag page w/alt click (current pane) or ctrl/cmd/middle click (new pane)
            onElement(
                document,
                "click",
                selector,
                (event, targetEl) => {
                    const { altKey } = event;
                    if (!Keymap.isModEvent(event) && !altKey) return;
                    const tagName = toTag(targetEl),
                        tp = tagName && this.plugin.tagPage(tagName);
                    if (tp) {
                        this.plugin.openTagPage(tp, false, !altKey);
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    }
                },
                { capture: true }
            )
        );
    }
}
