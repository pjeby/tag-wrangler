import {Menu, Notice, Plugin} from "obsidian";
import {renameTag} from "./renaming";

function onElement(el, event, selector, callback, options) {
    el.on(event, selector, callback, options)
    return () => el.off(event, selector, callback, options);
}

export default class TagWrangler extends Plugin {
    onload(){
        this.register(
            onElement(document, "contextmenu", ".tag-pane-tag", this.onMenu.bind(this), {capture: true})
        );
        this.register(
            onElement(document, "mousedown", ".tag-pane-tag", () => {window.lastFocus = document.activeElement;}, {capture: true})
        );
    }

    onMenu(e, tagEl) {
        const
            tagName = tagEl.find(".tag-pane-tag-text").textContent,
            treeParent = tagEl.parentElement.parentElement,
            isHierarchy = treeParent.find(".collapse-icon"),
            searchPlugin = this.app.internalPlugins.getPluginById("global-search"),
            search = searchPlugin && searchPlugin.instance,
            query = search && search.getGlobalSearchQuery(),
            menu = new TagMenu().addItem(item("pencil", "Rename #"+tagName, () => this.rename(tagName)));

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

        if (isHierarchy) {
            function toggle(collapse) {
                for(const el of treeParent.children) {
                    if (!el.hasClass("tree-item")) continue;
                    if (collapse !== el.hasClass("is-collapsed")) {
                        const button = el.find(".collapse-icon");
                        if (button) button.click();
                    }
                }
            }
            menu.addSeparator()
            .addItem(item("vertical-three-dots", "Collapse tags at this level", () => toggle(true )))
            .addItem(item("expand-vertically"  , "Expand tags at this level"  , () => toggle(false)))
        }

        menu.showAtPosition({x: e.pageX, y: e.pageY});
    }

    async rename(tagName) {
        try { await renameTag(this.app, tagName); }
        catch (e) { console.error(e); new Notice("error: " + e); }
    }

}

class TagMenu extends Menu {
    load() {
        super.load();
        this.register(
            onElement(document, "keydown", "*", this.onKeydown.bind(this), {capture: true})
        );
    }
    onKeydown(e) {
        if (e.key=="Escape") {
            e.preventDefault();
            this.hide();
        }
    }
}

function item(icon, title, click) {
    return i => i.setIcon(icon).setTitle(title).onClick(click);
}

