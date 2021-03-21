import {Menu, Notice, Plugin} from "obsidian";
import {renameTag, findTargets} from "./renaming";
import {Tag} from "./Tag";

function onElement(el, event, selector, callback, options) {
    el.on(event, selector, callback, options)
    return () => el.off(event, selector, callback, options);
}

export default class TagWrangler extends Plugin {
    onload(){
        this.register(
            onElement(document, "contextmenu", ".tag-pane-tag", this.onMenu.bind(this), {capture: true})
        );
    }

    onMenu(e, tagEl) {
        if (!e.obsidian_contextmenu) {
            e.obsidian_contextmenu = new Menu(this.app);
            setImmediate(() => menu.showAtPosition({x: e.pageX, y: e.pageY}));
        }

        const
            tagName = tagEl.find(".tag-pane-tag-text").textContent,
            isHierarchy = tagEl.parentElement.parentElement.find(".collapse-icon"),
            searchPlugin = this.app.internalPlugins.getPluginById("global-search"),
            search = searchPlugin && searchPlugin.instance,
            query = search && search.getGlobalSearchQuery(),
            random = this.app.plugins.plugins["smart-random-note"],
            menu = e.obsidian_contextmenu.addItem(item("pencil", "Rename #"+tagName, () => this.rename(tagName)));

        menu.register(
            onElement(document, "keydown", "*", e => {
                if (e.key==="Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    menu.hide();
                }
            }, {capture: true})
        );

        if (search) {
            menu.addSeparator().addItem(
                item("magnifying-glass", "New search for #"+tagName, () => search.openGlobalSearch("tag:" + tagName))
            );
            if (query) {
                menu.addItem(
                    item("sheets-in-box", "Require #"+tagName+" in search"  , () => search.openGlobalSearch(query+" tag:"  + tagName))
                );
            }
            menu.addItem(
                item("crossed-star" , "Exclude #"+tagName+" from search", () => search.openGlobalSearch(query+" -tag:" + tagName))
            );
        }

        if (random) {
            menu.addSeparator().addItem(
                item("dice", "Open random note", async () => {
                    const targets = await findTargets(this.app, new Tag(tagName));
                    random.openRandomNote(targets.map(f=>f.filename));
                })
            );
        }

        this.app.workspace.trigger("tag-wrangler:contextmenu", menu, tagName, {search, query, isHierarchy});

        if (isHierarchy) {
            const
                tagParent = tagName.split("/").slice(0, -1).join("/"),
                tagView = this.leafView(tagEl.matchParent(".workspace-leaf")),
                tagContainer = tagParent ? tagView.tagDoms["#" + tagParent.toLowerCase()]: tagView.root
            ;
            function toggle(collapse) {
                for(const tag of tagContainer.children) tag.setCollapsed(collapse);
            }
            menu.addSeparator()
            .addItem(item("vertical-three-dots", "Collapse tags at this level", () => toggle(true )))
            .addItem(item("expand-vertically"  , "Expand tags at this level"  , () => toggle(false)))
        }
    }

    leafView(containerEl) {
        let view;
        this.app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.containerEl === containerEl) { view = leaf.view; return true; }
        })
        return view;
    }


    async rename(tagName) {
        try { await renameTag(this.app, tagName); }
        catch (e) { console.error(e); new Notice("error: " + e); }
    }

}

function item(icon, title, click) {
    return i => i.setIcon(icon).setTitle(title).onClick(click);
}

