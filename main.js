'use strict';

var obsidian = require('obsidian');

const f = (fn) => [
    /*eslint no-unused-vars: 0*/
    function (a) {return fn(...arguments);},
    function (a, b) {return fn(...arguments);},
    function (a, b, c) {return fn(...arguments);},
    function (a, b, c, d) {return fn(...arguments);},
    function (a, b, c, d, e) {return fn(...arguments);},
];

const currify = (fn, ...args) => {
    check(fn);
    
    if (args.length >= fn.length)
        return fn(...args);
    
    const again = (...args2) => {
        return currify(fn, ...[...args, ...args2]);
    };
    
    const count = fn.length - args.length - 1;
    const func = f(again)[count];
    
    return func || again;
};

var currify_1 = currify;

function check(fn) {
    if (typeof fn !== 'function')
        throw Error('fn should be function!');
}

var fullstore = (value) => {
    const data = {
        value,
    };
    
    return (...args) => {
        const [value] = args;
        
        if (!args.length)
            return data.value;
        
        data.value = value;
        
        return value;
    };
};

const query = (a) => document.querySelector(`[data-name="${a}"]`);

const setAttribute = currify_1((el, obj, name) => el.setAttribute(name, obj[name]));
const set = currify_1((el, obj, name) => el[name] = obj[name]);
const not = currify_1((f, a) => !f(a));
const isCamelCase = (a) => a != a.toLowerCase();

var createElement = (name, options = {}) => {
    const {
        dataName,
        notAppend,
        parent = document.body,
        uniq = true,
        ...restOptions
    } = options;
    
    const elFound = isElementPresent(dataName);
    
    if (uniq && elFound)
        return elFound;
    
    const el = document.createElement(name);
    
    if (dataName)
        el.dataset.name = dataName;
    
    Object.keys(restOptions)
        .filter(isCamelCase)
        .map(set(el, options));
    
    Object.keys(restOptions)
        .filter(not(isCamelCase))
        .map(setAttribute(el, options));
    
    if (!notAppend)
        parent.appendChild(el);
    
    return el;
};

var isElementPresent_1 = isElementPresent;

function isElementPresent(dataName) {
    if (!dataName)
        return;
    
    return query(dataName);
}
createElement.isElementPresent = isElementPresent_1;

const keyDown = currify_1(keyDown_);

const BUTTON_OK_CANCEL = {
    ok: 'OK',
    cancel: 'Cancel',
};

const zIndex = fullstore(100);

var prompt = (title, msg, value = '', options) => {
    const type = getType(options);
    const val = String(value)
        .replace(/"/g, '&quot;');
    
    const valueStr = `<input type="${ type }" value="${ val }" data-name="js-input">`;
    const buttons = getButtons(options) || BUTTON_OK_CANCEL;
    
    return showDialog(title, msg, valueStr, buttons, options);
};

var confirm = (title, msg, options) => {
    const buttons = getButtons(options) || BUTTON_OK_CANCEL;
    
    return showDialog(title, msg, '', buttons, options);
};

var progress = (title, message, options) => {
    const valueStr = `
        <progress value="0" data-name="js-progress" class="progress" max="100"></progress>
        <span data-name="js-counter">0%</span>
    `;
    
    const buttons = {
        cancel: 'Abort',
    };
    
    const promise = showDialog(title, message, valueStr, buttons, options);
    const {ok, dialog} = promise;
    const resolve = ok();
    
    find(dialog, ['cancel']).map((el) => {
        el.focus();
    });
    
    Object.assign(promise, {
        setProgress(count) {
            const [elProgress] = find(dialog, ['progress']);
            const [elCounter] = find(dialog, ['counter']);
            
            elProgress.value = count;
            elCounter.textContent = `${count}%`;
            
            if (count === 100) {
                remove(dialog);
                resolve();
            }
        },
        
        remove() {
            remove(dialog);
        },
    });
    
    return promise;
};

function getButtons(options = {}) {
    const {buttons} = options;
    
    if (!buttons)
        return null;
    
    return buttons;
}

function getType(options = {}) {
    const {type} = options;
    
    if (type === 'password')
        return 'password';
    
    return 'text';
}

function getTemplate(title, msg, value, buttons) {
    const encodedMsg = msg.replace(/\n/g, '<br>');
    
    return `<div class="page">
        <div data-name="js-close" class="close-button"></div>
        <header>${ title }</header>
        <div class="content-area">${ encodedMsg }${ value }</div>
        <div class="action-area">
            <div class="button-strip">
                ${parseButtons(buttons)}
            </div>
        </div>
    </div>`;
}

function parseButtons(buttons) {
    const names = Object.keys(buttons);
    const parse = currify_1((buttons, name, i) => `<button
            tabindex=${i}
            data-name="js-${name.toLowerCase()}">
            ${buttons[name]}
        </button>`);
    
    return names
        .map(parse(buttons))
        .join('');
}

function showDialog(title, msg, value, buttons, options) {
    const ok = fullstore();
    const cancel = fullstore();
    
    const closeButtons = [
        'cancel',
        'close',
        'ok',
    ];
    
    const promise = new Promise((resolve, reject) => {
        const noCancel = options && options.cancel === false;
        const empty = () => {};
        const rejectError = () => reject(Error());
        
        ok(resolve);
        cancel(noCancel ? empty : rejectError);
    });
    
    const innerHTML = getTemplate(title, msg, value, buttons);
    
    const dialog = createElement('div', {
        innerHTML,
        className: 'smalltalk',
        style: `z-index: ${zIndex(zIndex() + 1)}`,
    });
    
    for (const el of find(dialog, ['ok', 'input']))
        el.focus();
    
    for (const el of find(dialog, ['input'])) {
        el.setSelectionRange(0, value.length);
    }
    
    addListenerAll('click', dialog, closeButtons, (event) => {
        closeDialog(event.target, dialog, ok(), cancel());
    });
    
    for (const event of ['click', 'contextmenu'])
        dialog.addEventListener(event, (e) => {
            e.stopPropagation();
            for (const el of find(dialog, ['ok', 'input']))
                el.focus();
        });
    
    dialog.addEventListener('keydown', keyDown(dialog, ok(), cancel()));
    
    return Object.assign(promise, {
        dialog,
        ok,
    });
}

function keyDown_(dialog, ok, cancel, event) {
    const KEY = {
        ENTER : 13,
        ESC   : 27,
        TAB   : 9,
        LEFT  : 37,
        UP    : 38,
        RIGHT : 39,
        DOWN  : 40,
    };
    
    const {keyCode} = event;
    const el = event.target;
    
    const namesAll = ['ok', 'cancel', 'input'];
    const names = find(dialog, namesAll)
        .map(getDataName);
    
    switch(keyCode) {
    case KEY.ENTER:
        closeDialog(el, dialog, ok, cancel);
        event.preventDefault();
        break;
    
    case KEY.ESC:
        remove(dialog);
        cancel();
        break;
    
    case KEY.TAB:
        if (event.shiftKey)
            tab(dialog, names);
        
        tab(dialog, names);
        event.preventDefault();
        break;
    
    default:
        ['left', 'right', 'up', 'down'].filter((name) => {
            return keyCode === KEY[name.toUpperCase()];
        }).forEach(() => {
            changeButtonFocus(dialog, names);
        });
        
        break;
    }
    
    event.stopPropagation();
}

function getDataName(el) {
    return el
        .getAttribute('data-name')
        .replace('js-', '');
}

const getName = (activeName) => {
    if (activeName === 'cancel')
        return 'ok';
    
    return 'cancel';
};

function changeButtonFocus(dialog, names) {
    const active = document.activeElement;
    const activeName = getDataName(active);
    const isButton = /ok|cancel/.test(activeName);
    const count = names.length - 1;
    
    if (activeName === 'input' || !count || !isButton)
        return;
    
    const name = getName(activeName);
    
    for (const el of find(dialog, [name])) {
        el.focus();
    }
}

const getIndex = (count, index) => {
    if (index === count)
        return 0;
    
    return index + 1;
};

function tab(dialog, names) {
    const active = document.activeElement;
    const activeName = getDataName(active);
    const count = names.length - 1;
    
    const activeIndex = names.indexOf(activeName);
    const index = getIndex(count, activeIndex);
    
    const name = names[index];
    
    for (const el of find(dialog, [name]))
        el.focus();
}

function closeDialog(el, dialog, ok, cancel) {
    const name = el
        .getAttribute('data-name')
        .replace('js-', '');
    
    if (/close|cancel/.test(name)) {
        cancel();
        remove(dialog);
        return;
    }
    
    const value = find(dialog, ['input'])
        .reduce((value, el) => el.value, null);
    
    ok(value);
    remove(dialog);
}

const query$1 = currify_1((element, name) => element.querySelector(`[data-name="js-${ name }"]`));

function find(element, names) {
    const elements = names
        .map(query$1(element))
        .filter(Boolean);
    
    return elements;
}

function addListenerAll(event, parent, elements, fn) {
    for (const el of find(parent, elements)) {
        el.addEventListener(event, fn);
    }
}

function remove(dialog) {
    const {parentElement} = dialog;
    
    if (parentElement)
        parentElement.removeChild(dialog);
}

class Progress {

    constructor(title, message) {
        this.progress = progress(title, message);
        this.progress.catch(() => this.aborted = true);
        this.dialog = this.progress.dialog;
        this.aborted = false;
    }

    async forEach(collection, func) {
        if (this.aborted)
            return;
        let processed = 0, range = collection.length, accum = 0, pct = 0;
        for (const item of collection) {
            await func(item, processed++, collection, this);
            if (this.aborted)
                return;
            accum += 100;
            if (accum > range) {
                const remainder = accum % range, step = (accum - remainder) / range;
                this.progress.setProgress(pct += step);
                accum = remainder;
            }
        }
        if (pct < 100)
            this.progress.setProgress(100);
        return this;
    }

    set title(text) { this.dialog.querySelector("header").textContent = text; }
    get title() { return this.dialog.querySelector("header").textContent; }

    set message(text) {
        this.dialog.querySelector(".content-area").childNodes[0].textContent = text;
    }

    get message() {
        return this.dialog.querySelector(".content-area").childNodes[0].textContent;
    }
}

async function validatedInput(title, message, value = "", regex = ".*", what = "entry") {
    while (true) {
        const input = prompt(title, message, value);
        const inputField = input.dialog.find("input");
        const isValid = (t) => new RegExp(`^${regex}$`).test(t);

        inputField.setSelectionRange(value.length, value.length);
        inputField.pattern = regex;
        inputField.oninput = () => inputField.setAttribute("aria-invalid", !isValid(inputField.value));

        const result = await input;
        if (isValid(result)) return result;

        new obsidian.Notice(`"${result}" is not a valid ${what}`);
    }
}

async function renameTag(app, tagName) {
    var newName;
    try {
        newName = await validatedInput(
            `Renaming #${tagName} (and any sub-tags)`, "Enter new name (must be a valid Obsidian tag):\n", tagName,
            "[^\u2000-\u206F\u2E00-\u2E7F'!\"#$%&()*+,.:;<=>?@^`{|}~\\[\\]\\\\\\s]+",
            "Obsidian tag name"
        );
    }
    catch(e) {
        return;
    }
    if (!newName || newName === tagName) {
        return new Notice("Unchanged or empty tag: No changes made.");
    }

    const clash = tagClashes(app, "#"+tagName, "#"+newName);
    if (clash) {
        try { await confirm(
            "WARNING: No Undo!",
            `Renaming #${tagName} to #${newName} will merge some tags
into existing tags (such as ${clash}).

This <b>cannot</b> be undone.  Do you wish to proceed?`); }
        catch(e) { return; }
    }

    const filesToRename = await tagPositions(app, "#"+tagName);
    if (!filesToRename) return;

    const progress = new Progress(`Renaming to ${newName}/*`, "Processing files...");
    let updated = 0;
    await progress.forEach(filesToRename, async (f) => {
        progress.message = "Processing " + f.filename.split("/").pop();
        const file = app.vault.getAbstractFileByPath(f.filename);
        const original = await app.vault.read(file);
        if (progress.aborted) return;
        let text = original;
        for(const { position: {start, end}, tag} of f) {
            if (text.slice(start.offset, end.offset) !== tag) {
                new Notice(`File ${f.filename} has changed; skipping`);
                console.error(`File ${f.filename} has changed; skipping`);
                console.debug(text.slice(start.offset, end.offset), tag);
                return;
            }
            text = text.slice(0, start.offset) + "#"+newName + text.slice(start.offset + tagName.length + 1);
        }
        if (text !== original) { await app.vault.modify(file, text); updated++; }
    });
    return new Notice(`Operation ${progress.aborted ? "cancelled" : "complete"}: ${updated} file(s) updated`);
}

function tagClashes(app, oldTag, newTag) {
    const prefix = oldTag + "/";
    const tags = new Set(Object.keys(app.metadataCache.getTags()));
    for (const tag of tags) {
        if (tag === oldTag || tag.startsWith(prefix)) {
            const changed = newTag + tag.slice(oldTag.length);
            if (tags.has(changed))
                return changed;
        }
    }
}

async function tagPositions(app, tagName) {
    const prefix = tagName + "/", result = [];
    function tagMatches(tag) {
        return tag == tagName || tag.startsWith(prefix);
    }
    function frontMatterTags(fm) {
        if (!fm || !fm.tags)
            return [];
        if (Array.isArray(fm.tags))
            return fm.tags;
        if (typeof fm.tags === "string")
            return [fm.tags];
        return [];
    }

    const progress = new Progress(`Searching for ${prefix}*`, "Matching files...");
    await progress.forEach(
        app.metadataCache.getCachedFiles(),
        n => {
            let { frontmatter, tags } = app.metadataCache.getCache(n);
            tags = tags && tags.filter(t => tagMatches(t.tag)).reverse() || []; // last positions first
            tags.filename = n;
            tags.fmtags = frontMatterTags(frontmatter).filter(tagMatches); // XXXX parseFrontMatterTags?
            tags.frontmatter = frontmatter;
            if (tags.length || tags.fmtags.length)
                result.push(tags);
        }
    );
    if (!progress.aborted)
        return result;
}

function onElement(el, event, selector, callback, options) {
    el.on(event, selector, callback, options);
    return () => el.off(event, selector, callback, options);
}

class TagWrangler extends obsidian.Plugin {
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
            .addItem(item("expand-vertically"  , "Expand tags at this level"  , () => toggle(false)));
        }

        menu.showAtPosition({x: e.pageX, y: e.pageY});
    }

    rename(tagName) { return renameTag(this.app, tagName); }

}

class TagMenu extends obsidian.Menu {
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

module.exports = TagWrangler;
