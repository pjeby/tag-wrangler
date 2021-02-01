

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
        try {
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
        } finally {
            this.progress.remove();
        }
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
        return new obsidian.Notice("Unchanged or empty tag: No changes made.");
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
                new obsidian.Notice(`File ${f.filename} has changed; skipping`);
                console.error(`File ${f.filename} has changed; skipping`);
                console.debug(text.slice(start.offset, end.offset), tag);
                return;
            }
            text = text.slice(0, start.offset) + "#"+newName + text.slice(start.offset + tagName.length + 1);
        }
        if (text !== original) { await app.vault.modify(file, text); updated++; }
    });
    return new obsidian.Notice(`Operation ${progress.aborted ? "cancelled" : "complete"}: ${updated} file(s) updated`);
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

    const progress = new Progress(`Searching for ${prefix}*`, "Matching files...");
    await progress.forEach(
        app.metadataCache.getCachedFiles(),
        n => {
            let { frontmatter, tags } = app.metadataCache.getCache(n);
            tags = tags && tags.filter(t => tagMatches(t.tag || "")).reverse() || []; // last positions first
            tags.filename = n;
            tags.fmtags = (obsidian.parseFrontMatterTags(frontmatter) || []).filter(tagMatches);
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

    async rename(tagName) {
        try { await renameTag(this.app, tagName); }
        catch (e) { console.error(e); new obsidian.Notice("error: " + e); }
    }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLnlhcm4vY2FjaGUvY3VycmlmeS1ucG0tNC4wLjAtYjkyZWUzYTRlYi04MjViNjgxODQxLnppcC9ub2RlX21vZHVsZXMvY3VycmlmeS9saWIvY3VycmlmeS5qcyIsIi55YXJuL2NhY2hlL2Z1bGxzdG9yZS1ucG0tMy4wLjAtYzQ4NTY0NGE2NS02ZDM5OTNjN2JmLnppcC9ub2RlX21vZHVsZXMvZnVsbHN0b3JlL2xpYi9mdWxsc3RvcmUuanMiLCIueWFybi9jYWNoZS9AY2xvdWRjbWQtY3JlYXRlLWVsZW1lbnQtbnBtLTIuMC4yLTE5NzY5NTlhNmMtMTk2ZDA5YjJkMi56aXAvbm9kZV9tb2R1bGVzL0BjbG91ZGNtZC9jcmVhdGUtZWxlbWVudC9saWIvY3JlYXRlLWVsZW1lbnQuanMiLCIueWFybi9jYWNoZS9zbWFsbHRhbGstbnBtLTQuMC43LTgyMzM5ZjY2NzItZDY3MzZmMzI0Yy56aXAvbm9kZV9tb2R1bGVzL3NtYWxsdGFsay9saWIvc21hbGx0YWxrLmpzIiwic3JjL3Byb2dyZXNzLmpzIiwic3JjL3ZhbGlkYXRpb24uanMiLCJzcmMvcmVuYW1pbmcuanMiLCJzcmMvcGx1Z2luLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxuY29uc3QgZiA9IChmbikgPT4gW1xuICAgIC8qZXNsaW50IG5vLXVudXNlZC12YXJzOiAwKi9cbiAgICBmdW5jdGlvbiAoYSkge3JldHVybiBmbiguLi5hcmd1bWVudHMpO30sXG4gICAgZnVuY3Rpb24gKGEsIGIpIHtyZXR1cm4gZm4oLi4uYXJndW1lbnRzKTt9LFxuICAgIGZ1bmN0aW9uIChhLCBiLCBjKSB7cmV0dXJuIGZuKC4uLmFyZ3VtZW50cyk7fSxcbiAgICBmdW5jdGlvbiAoYSwgYiwgYywgZCkge3JldHVybiBmbiguLi5hcmd1bWVudHMpO30sXG4gICAgZnVuY3Rpb24gKGEsIGIsIGMsIGQsIGUpIHtyZXR1cm4gZm4oLi4uYXJndW1lbnRzKTt9LFxuXTtcblxuY29uc3QgY3VycmlmeSA9IChmbiwgLi4uYXJncykgPT4ge1xuICAgIGNoZWNrKGZuKTtcbiAgICBcbiAgICBpZiAoYXJncy5sZW5ndGggPj0gZm4ubGVuZ3RoKVxuICAgICAgICByZXR1cm4gZm4oLi4uYXJncyk7XG4gICAgXG4gICAgY29uc3QgYWdhaW4gPSAoLi4uYXJnczIpID0+IHtcbiAgICAgICAgcmV0dXJuIGN1cnJpZnkoZm4sIC4uLlsuLi5hcmdzLCAuLi5hcmdzMl0pO1xuICAgIH07XG4gICAgXG4gICAgY29uc3QgY291bnQgPSBmbi5sZW5ndGggLSBhcmdzLmxlbmd0aCAtIDE7XG4gICAgY29uc3QgZnVuYyA9IGYoYWdhaW4pW2NvdW50XTtcbiAgICBcbiAgICByZXR1cm4gZnVuYyB8fCBhZ2Fpbjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gY3VycmlmeTtcblxuZnVuY3Rpb24gY2hlY2soZm4pIHtcbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKVxuICAgICAgICB0aHJvdyBFcnJvcignZm4gc2hvdWxkIGJlIGZ1bmN0aW9uIScpO1xufVxuXG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gKHZhbHVlKSA9PiB7XG4gICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgdmFsdWUsXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IGFyZ3M7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWFyZ3MubGVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuIGRhdGEudmFsdWU7XG4gICAgICAgIFxuICAgICAgICBkYXRhLnZhbHVlID0gdmFsdWU7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcbn07XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgY3VycmlmeSA9IHJlcXVpcmUoJ2N1cnJpZnknKTtcbmNvbnN0IHF1ZXJ5ID0gKGEpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYFtkYXRhLW5hbWU9XCIke2F9XCJdYCk7XG5cbmNvbnN0IHNldEF0dHJpYnV0ZSA9IGN1cnJpZnkoKGVsLCBvYmosIG5hbWUpID0+IGVsLnNldEF0dHJpYnV0ZShuYW1lLCBvYmpbbmFtZV0pKTtcbmNvbnN0IHNldCA9IGN1cnJpZnkoKGVsLCBvYmosIG5hbWUpID0+IGVsW25hbWVdID0gb2JqW25hbWVdKTtcbmNvbnN0IG5vdCA9IGN1cnJpZnkoKGYsIGEpID0+ICFmKGEpKTtcbmNvbnN0IGlzQ2FtZWxDYXNlID0gKGEpID0+IGEgIT0gYS50b0xvd2VyQ2FzZSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChuYW1lLCBvcHRpb25zID0ge30pID0+IHtcbiAgICBjb25zdCB7XG4gICAgICAgIGRhdGFOYW1lLFxuICAgICAgICBub3RBcHBlbmQsXG4gICAgICAgIHBhcmVudCA9IGRvY3VtZW50LmJvZHksXG4gICAgICAgIHVuaXEgPSB0cnVlLFxuICAgICAgICAuLi5yZXN0T3B0aW9uc1xuICAgIH0gPSBvcHRpb25zO1xuICAgIFxuICAgIGNvbnN0IGVsRm91bmQgPSBpc0VsZW1lbnRQcmVzZW50KGRhdGFOYW1lKTtcbiAgICBcbiAgICBpZiAodW5pcSAmJiBlbEZvdW5kKVxuICAgICAgICByZXR1cm4gZWxGb3VuZDtcbiAgICBcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobmFtZSk7XG4gICAgXG4gICAgaWYgKGRhdGFOYW1lKVxuICAgICAgICBlbC5kYXRhc2V0Lm5hbWUgPSBkYXRhTmFtZTtcbiAgICBcbiAgICBPYmplY3Qua2V5cyhyZXN0T3B0aW9ucylcbiAgICAgICAgLmZpbHRlcihpc0NhbWVsQ2FzZSlcbiAgICAgICAgLm1hcChzZXQoZWwsIG9wdGlvbnMpKTtcbiAgICBcbiAgICBPYmplY3Qua2V5cyhyZXN0T3B0aW9ucylcbiAgICAgICAgLmZpbHRlcihub3QoaXNDYW1lbENhc2UpKVxuICAgICAgICAubWFwKHNldEF0dHJpYnV0ZShlbCwgb3B0aW9ucykpO1xuICAgIFxuICAgIGlmICghbm90QXBwZW5kKVxuICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQoZWwpO1xuICAgIFxuICAgIHJldHVybiBlbDtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmlzRWxlbWVudFByZXNlbnQgPSBpc0VsZW1lbnRQcmVzZW50O1xuXG5mdW5jdGlvbiBpc0VsZW1lbnRQcmVzZW50KGRhdGFOYW1lKSB7XG4gICAgaWYgKCFkYXRhTmFtZSlcbiAgICAgICAgcmV0dXJuO1xuICAgIFxuICAgIHJldHVybiBxdWVyeShkYXRhTmFtZSk7XG59XG5cbiIsIid1c2Ugc3RyaWN0JztcblxucmVxdWlyZSgnLi4vY3NzL3NtYWxsdGFsay5jc3MnKTtcblxuY29uc3QgY3VycmlmeSA9IHJlcXVpcmUoJ2N1cnJpZnknKTtcbmNvbnN0IHN0b3JlID0gcmVxdWlyZSgnZnVsbHN0b3JlJyk7XG5jb25zdCBjcmVhdGVFbGVtZW50ID0gcmVxdWlyZSgnQGNsb3VkY21kL2NyZWF0ZS1lbGVtZW50Jyk7XG5cbmNvbnN0IGtleURvd24gPSBjdXJyaWZ5KGtleURvd25fKTtcblxuY29uc3QgQlVUVE9OX09LID0ge1xuICAgIG9rOiAnT0snLFxufTtcblxuY29uc3QgQlVUVE9OX09LX0NBTkNFTCA9IHtcbiAgICBvazogJ09LJyxcbiAgICBjYW5jZWw6ICdDYW5jZWwnLFxufTtcblxuY29uc3QgekluZGV4ID0gc3RvcmUoMTAwKTtcblxuZXhwb3J0cy5hbGVydCA9ICh0aXRsZSwgbXNnLCBvcHRpb25zKSA9PiB7XG4gICAgY29uc3QgYnV0dG9ucyA9IGdldEJ1dHRvbnMob3B0aW9ucykgfHwgQlVUVE9OX09LO1xuICAgIHJldHVybiBzaG93RGlhbG9nKHRpdGxlLCBtc2csICcnLCBidXR0b25zLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydHMucHJvbXB0ID0gKHRpdGxlLCBtc2csIHZhbHVlID0gJycsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCB0eXBlID0gZ2V0VHlwZShvcHRpb25zKTtcbiAgICBjb25zdCB2YWwgPSBTdHJpbmcodmFsdWUpXG4gICAgICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG4gICAgXG4gICAgY29uc3QgdmFsdWVTdHIgPSBgPGlucHV0IHR5cGU9XCIkeyB0eXBlIH1cIiB2YWx1ZT1cIiR7IHZhbCB9XCIgZGF0YS1uYW1lPVwianMtaW5wdXRcIj5gO1xuICAgIGNvbnN0IGJ1dHRvbnMgPSBnZXRCdXR0b25zKG9wdGlvbnMpIHx8IEJVVFRPTl9PS19DQU5DRUw7XG4gICAgXG4gICAgcmV0dXJuIHNob3dEaWFsb2codGl0bGUsIG1zZywgdmFsdWVTdHIsIGJ1dHRvbnMsIG9wdGlvbnMpO1xufTtcblxuZXhwb3J0cy5jb25maXJtID0gKHRpdGxlLCBtc2csIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCBidXR0b25zID0gZ2V0QnV0dG9ucyhvcHRpb25zKSB8fCBCVVRUT05fT0tfQ0FOQ0VMO1xuICAgIFxuICAgIHJldHVybiBzaG93RGlhbG9nKHRpdGxlLCBtc2csICcnLCBidXR0b25zLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydHMucHJvZ3Jlc3MgPSAodGl0bGUsIG1lc3NhZ2UsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCB2YWx1ZVN0ciA9IGBcbiAgICAgICAgPHByb2dyZXNzIHZhbHVlPVwiMFwiIGRhdGEtbmFtZT1cImpzLXByb2dyZXNzXCIgY2xhc3M9XCJwcm9ncmVzc1wiIG1heD1cIjEwMFwiPjwvcHJvZ3Jlc3M+XG4gICAgICAgIDxzcGFuIGRhdGEtbmFtZT1cImpzLWNvdW50ZXJcIj4wJTwvc3Bhbj5cbiAgICBgO1xuICAgIFxuICAgIGNvbnN0IGJ1dHRvbnMgPSB7XG4gICAgICAgIGNhbmNlbDogJ0Fib3J0JyxcbiAgICB9O1xuICAgIFxuICAgIGNvbnN0IHByb21pc2UgPSBzaG93RGlhbG9nKHRpdGxlLCBtZXNzYWdlLCB2YWx1ZVN0ciwgYnV0dG9ucywgb3B0aW9ucyk7XG4gICAgY29uc3Qge29rLCBkaWFsb2d9ID0gcHJvbWlzZTtcbiAgICBjb25zdCByZXNvbHZlID0gb2soKTtcbiAgICBcbiAgICBmaW5kKGRpYWxvZywgWydjYW5jZWwnXSkubWFwKChlbCkgPT4ge1xuICAgICAgICBlbC5mb2N1cygpO1xuICAgIH0pO1xuICAgIFxuICAgIE9iamVjdC5hc3NpZ24ocHJvbWlzZSwge1xuICAgICAgICBzZXRQcm9ncmVzcyhjb3VudCkge1xuICAgICAgICAgICAgY29uc3QgW2VsUHJvZ3Jlc3NdID0gZmluZChkaWFsb2csIFsncHJvZ3Jlc3MnXSk7XG4gICAgICAgICAgICBjb25zdCBbZWxDb3VudGVyXSA9IGZpbmQoZGlhbG9nLCBbJ2NvdW50ZXInXSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGVsUHJvZ3Jlc3MudmFsdWUgPSBjb3VudDtcbiAgICAgICAgICAgIGVsQ291bnRlci50ZXh0Q29udGVudCA9IGAke2NvdW50fSVgO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoY291bnQgPT09IDEwMCkge1xuICAgICAgICAgICAgICAgIHJlbW92ZShkaWFsb2cpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgXG4gICAgICAgIHJlbW92ZSgpIHtcbiAgICAgICAgICAgIHJlbW92ZShkaWFsb2cpO1xuICAgICAgICB9LFxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuZnVuY3Rpb24gZ2V0QnV0dG9ucyhvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7YnV0dG9uc30gPSBvcHRpb25zO1xuICAgIFxuICAgIGlmICghYnV0dG9ucylcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgcmV0dXJuIGJ1dHRvbnM7XG59XG5cbmZ1bmN0aW9uIGdldFR5cGUob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qge3R5cGV9ID0gb3B0aW9ucztcbiAgICBcbiAgICBpZiAodHlwZSA9PT0gJ3Bhc3N3b3JkJylcbiAgICAgICAgcmV0dXJuICdwYXNzd29yZCc7XG4gICAgXG4gICAgcmV0dXJuICd0ZXh0Jztcbn1cblxuZnVuY3Rpb24gZ2V0VGVtcGxhdGUodGl0bGUsIG1zZywgdmFsdWUsIGJ1dHRvbnMpIHtcbiAgICBjb25zdCBlbmNvZGVkTXNnID0gbXNnLnJlcGxhY2UoL1xcbi9nLCAnPGJyPicpO1xuICAgIFxuICAgIHJldHVybiBgPGRpdiBjbGFzcz1cInBhZ2VcIj5cbiAgICAgICAgPGRpdiBkYXRhLW5hbWU9XCJqcy1jbG9zZVwiIGNsYXNzPVwiY2xvc2UtYnV0dG9uXCI+PC9kaXY+XG4gICAgICAgIDxoZWFkZXI+JHsgdGl0bGUgfTwvaGVhZGVyPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGVudC1hcmVhXCI+JHsgZW5jb2RlZE1zZyB9JHsgdmFsdWUgfTwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWFyZWFcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJidXR0b24tc3RyaXBcIj5cbiAgICAgICAgICAgICAgICAke3BhcnNlQnV0dG9ucyhidXR0b25zKX1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiBwYXJzZUJ1dHRvbnMoYnV0dG9ucykge1xuICAgIGNvbnN0IG5hbWVzID0gT2JqZWN0LmtleXMoYnV0dG9ucyk7XG4gICAgY29uc3QgcGFyc2UgPSBjdXJyaWZ5KChidXR0b25zLCBuYW1lLCBpKSA9PiBgPGJ1dHRvblxuICAgICAgICAgICAgdGFiaW5kZXg9JHtpfVxuICAgICAgICAgICAgZGF0YS1uYW1lPVwianMtJHtuYW1lLnRvTG93ZXJDYXNlKCl9XCI+XG4gICAgICAgICAgICAke2J1dHRvbnNbbmFtZV19XG4gICAgICAgIDwvYnV0dG9uPmApO1xuICAgIFxuICAgIHJldHVybiBuYW1lc1xuICAgICAgICAubWFwKHBhcnNlKGJ1dHRvbnMpKVxuICAgICAgICAuam9pbignJyk7XG59XG5cbmZ1bmN0aW9uIHNob3dEaWFsb2codGl0bGUsIG1zZywgdmFsdWUsIGJ1dHRvbnMsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBvayA9IHN0b3JlKCk7XG4gICAgY29uc3QgY2FuY2VsID0gc3RvcmUoKTtcbiAgICBcbiAgICBjb25zdCBjbG9zZUJ1dHRvbnMgPSBbXG4gICAgICAgICdjYW5jZWwnLFxuICAgICAgICAnY2xvc2UnLFxuICAgICAgICAnb2snLFxuICAgIF07XG4gICAgXG4gICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3Qgbm9DYW5jZWwgPSBvcHRpb25zICYmIG9wdGlvbnMuY2FuY2VsID09PSBmYWxzZTtcbiAgICAgICAgY29uc3QgZW1wdHkgPSAoKSA9PiB7fTtcbiAgICAgICAgY29uc3QgcmVqZWN0RXJyb3IgPSAoKSA9PiByZWplY3QoRXJyb3IoKSk7XG4gICAgICAgIFxuICAgICAgICBvayhyZXNvbHZlKTtcbiAgICAgICAgY2FuY2VsKG5vQ2FuY2VsID8gZW1wdHkgOiByZWplY3RFcnJvcik7XG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgaW5uZXJIVE1MID0gZ2V0VGVtcGxhdGUodGl0bGUsIG1zZywgdmFsdWUsIGJ1dHRvbnMpO1xuICAgIFxuICAgIGNvbnN0IGRpYWxvZyA9IGNyZWF0ZUVsZW1lbnQoJ2RpdicsIHtcbiAgICAgICAgaW5uZXJIVE1MLFxuICAgICAgICBjbGFzc05hbWU6ICdzbWFsbHRhbGsnLFxuICAgICAgICBzdHlsZTogYHotaW5kZXg6ICR7ekluZGV4KHpJbmRleCgpICsgMSl9YCxcbiAgICB9KTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGVsIG9mIGZpbmQoZGlhbG9nLCBbJ29rJywgJ2lucHV0J10pKVxuICAgICAgICBlbC5mb2N1cygpO1xuICAgIFxuICAgIGZvciAoY29uc3QgZWwgb2YgZmluZChkaWFsb2csIFsnaW5wdXQnXSkpIHtcbiAgICAgICAgZWwuc2V0U2VsZWN0aW9uUmFuZ2UoMCwgdmFsdWUubGVuZ3RoKTtcbiAgICB9XG4gICAgXG4gICAgYWRkTGlzdGVuZXJBbGwoJ2NsaWNrJywgZGlhbG9nLCBjbG9zZUJ1dHRvbnMsIChldmVudCkgPT4ge1xuICAgICAgICBjbG9zZURpYWxvZyhldmVudC50YXJnZXQsIGRpYWxvZywgb2soKSwgY2FuY2VsKCkpO1xuICAgIH0pO1xuICAgIFxuICAgIGZvciAoY29uc3QgZXZlbnQgb2YgWydjbGljaycsICdjb250ZXh0bWVudSddKVxuICAgICAgICBkaWFsb2cuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgKGUpID0+IHtcbiAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGVsIG9mIGZpbmQoZGlhbG9nLCBbJ29rJywgJ2lucHV0J10pKVxuICAgICAgICAgICAgICAgIGVsLmZvY3VzKCk7XG4gICAgICAgIH0pO1xuICAgIFxuICAgIGRpYWxvZy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywga2V5RG93bihkaWFsb2csIG9rKCksIGNhbmNlbCgpKSk7XG4gICAgXG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJvbWlzZSwge1xuICAgICAgICBkaWFsb2csXG4gICAgICAgIG9rLFxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBrZXlEb3duXyhkaWFsb2csIG9rLCBjYW5jZWwsIGV2ZW50KSB7XG4gICAgY29uc3QgS0VZID0ge1xuICAgICAgICBFTlRFUiA6IDEzLFxuICAgICAgICBFU0MgICA6IDI3LFxuICAgICAgICBUQUIgICA6IDksXG4gICAgICAgIExFRlQgIDogMzcsXG4gICAgICAgIFVQICAgIDogMzgsXG4gICAgICAgIFJJR0hUIDogMzksXG4gICAgICAgIERPV04gIDogNDAsXG4gICAgfTtcbiAgICBcbiAgICBjb25zdCB7a2V5Q29kZX0gPSBldmVudDtcbiAgICBjb25zdCBlbCA9IGV2ZW50LnRhcmdldDtcbiAgICBcbiAgICBjb25zdCBuYW1lc0FsbCA9IFsnb2snLCAnY2FuY2VsJywgJ2lucHV0J107XG4gICAgY29uc3QgbmFtZXMgPSBmaW5kKGRpYWxvZywgbmFtZXNBbGwpXG4gICAgICAgIC5tYXAoZ2V0RGF0YU5hbWUpO1xuICAgIFxuICAgIHN3aXRjaChrZXlDb2RlKSB7XG4gICAgY2FzZSBLRVkuRU5URVI6XG4gICAgICAgIGNsb3NlRGlhbG9nKGVsLCBkaWFsb2csIG9rLCBjYW5jZWwpO1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBicmVhaztcbiAgICBcbiAgICBjYXNlIEtFWS5FU0M6XG4gICAgICAgIHJlbW92ZShkaWFsb2cpO1xuICAgICAgICBjYW5jZWwoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgXG4gICAgY2FzZSBLRVkuVEFCOlxuICAgICAgICBpZiAoZXZlbnQuc2hpZnRLZXkpXG4gICAgICAgICAgICB0YWIoZGlhbG9nLCBuYW1lcyk7XG4gICAgICAgIFxuICAgICAgICB0YWIoZGlhbG9nLCBuYW1lcyk7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGJyZWFrO1xuICAgIFxuICAgIGRlZmF1bHQ6XG4gICAgICAgIFsnbGVmdCcsICdyaWdodCcsICd1cCcsICdkb3duJ10uZmlsdGVyKChuYW1lKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4ga2V5Q29kZSA9PT0gS0VZW25hbWUudG9VcHBlckNhc2UoKV07XG4gICAgICAgIH0pLmZvckVhY2goKCkgPT4ge1xuICAgICAgICAgICAgY2hhbmdlQnV0dG9uRm9jdXMoZGlhbG9nLCBuYW1lcyk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIFxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xufVxuXG5mdW5jdGlvbiBnZXREYXRhTmFtZShlbCkge1xuICAgIHJldHVybiBlbFxuICAgICAgICAuZ2V0QXR0cmlidXRlKCdkYXRhLW5hbWUnKVxuICAgICAgICAucmVwbGFjZSgnanMtJywgJycpO1xufVxuXG5jb25zdCBnZXROYW1lID0gKGFjdGl2ZU5hbWUpID0+IHtcbiAgICBpZiAoYWN0aXZlTmFtZSA9PT0gJ2NhbmNlbCcpXG4gICAgICAgIHJldHVybiAnb2snO1xuICAgIFxuICAgIHJldHVybiAnY2FuY2VsJztcbn07XG5cbmZ1bmN0aW9uIGNoYW5nZUJ1dHRvbkZvY3VzKGRpYWxvZywgbmFtZXMpIHtcbiAgICBjb25zdCBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICAgIGNvbnN0IGFjdGl2ZU5hbWUgPSBnZXREYXRhTmFtZShhY3RpdmUpO1xuICAgIGNvbnN0IGlzQnV0dG9uID0gL29rfGNhbmNlbC8udGVzdChhY3RpdmVOYW1lKTtcbiAgICBjb25zdCBjb3VudCA9IG5hbWVzLmxlbmd0aCAtIDE7XG4gICAgXG4gICAgaWYgKGFjdGl2ZU5hbWUgPT09ICdpbnB1dCcgfHwgIWNvdW50IHx8ICFpc0J1dHRvbilcbiAgICAgICAgcmV0dXJuO1xuICAgIFxuICAgIGNvbnN0IG5hbWUgPSBnZXROYW1lKGFjdGl2ZU5hbWUpO1xuICAgIFxuICAgIGZvciAoY29uc3QgZWwgb2YgZmluZChkaWFsb2csIFtuYW1lXSkpIHtcbiAgICAgICAgZWwuZm9jdXMoKTtcbiAgICB9XG59XG5cbmNvbnN0IGdldEluZGV4ID0gKGNvdW50LCBpbmRleCkgPT4ge1xuICAgIGlmIChpbmRleCA9PT0gY291bnQpXG4gICAgICAgIHJldHVybiAwO1xuICAgIFxuICAgIHJldHVybiBpbmRleCArIDE7XG59O1xuXG5mdW5jdGlvbiB0YWIoZGlhbG9nLCBuYW1lcykge1xuICAgIGNvbnN0IGFjdGl2ZSA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gICAgY29uc3QgYWN0aXZlTmFtZSA9IGdldERhdGFOYW1lKGFjdGl2ZSk7XG4gICAgY29uc3QgY291bnQgPSBuYW1lcy5sZW5ndGggLSAxO1xuICAgIFxuICAgIGNvbnN0IGFjdGl2ZUluZGV4ID0gbmFtZXMuaW5kZXhPZihhY3RpdmVOYW1lKTtcbiAgICBjb25zdCBpbmRleCA9IGdldEluZGV4KGNvdW50LCBhY3RpdmVJbmRleCk7XG4gICAgXG4gICAgY29uc3QgbmFtZSA9IG5hbWVzW2luZGV4XTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGVsIG9mIGZpbmQoZGlhbG9nLCBbbmFtZV0pKVxuICAgICAgICBlbC5mb2N1cygpO1xufVxuXG5mdW5jdGlvbiBjbG9zZURpYWxvZyhlbCwgZGlhbG9nLCBvaywgY2FuY2VsKSB7XG4gICAgY29uc3QgbmFtZSA9IGVsXG4gICAgICAgIC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbmFtZScpXG4gICAgICAgIC5yZXBsYWNlKCdqcy0nLCAnJyk7XG4gICAgXG4gICAgaWYgKC9jbG9zZXxjYW5jZWwvLnRlc3QobmFtZSkpIHtcbiAgICAgICAgY2FuY2VsKCk7XG4gICAgICAgIHJlbW92ZShkaWFsb2cpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHZhbHVlID0gZmluZChkaWFsb2csIFsnaW5wdXQnXSlcbiAgICAgICAgLnJlZHVjZSgodmFsdWUsIGVsKSA9PiBlbC52YWx1ZSwgbnVsbCk7XG4gICAgXG4gICAgb2sodmFsdWUpO1xuICAgIHJlbW92ZShkaWFsb2cpO1xufVxuXG5jb25zdCBxdWVyeSA9IGN1cnJpZnkoKGVsZW1lbnQsIG5hbWUpID0+IGVsZW1lbnQucXVlcnlTZWxlY3RvcihgW2RhdGEtbmFtZT1cImpzLSR7IG5hbWUgfVwiXWApKTtcblxuZnVuY3Rpb24gZmluZChlbGVtZW50LCBuYW1lcykge1xuICAgIGNvbnN0IGVsZW1lbnRzID0gbmFtZXNcbiAgICAgICAgLm1hcChxdWVyeShlbGVtZW50KSlcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcbiAgICBcbiAgICByZXR1cm4gZWxlbWVudHM7XG59XG5cbmZ1bmN0aW9uIGFkZExpc3RlbmVyQWxsKGV2ZW50LCBwYXJlbnQsIGVsZW1lbnRzLCBmbikge1xuICAgIGZvciAoY29uc3QgZWwgb2YgZmluZChwYXJlbnQsIGVsZW1lbnRzKSkge1xuICAgICAgICBlbC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBmbik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmUoZGlhbG9nKSB7XG4gICAgY29uc3Qge3BhcmVudEVsZW1lbnR9ID0gZGlhbG9nO1xuICAgIFxuICAgIGlmIChwYXJlbnRFbGVtZW50KVxuICAgICAgICBwYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG59XG5cbiIsImltcG9ydCB7IHByb2dyZXNzIH0gZnJvbSBcInNtYWxsdGFsa1wiO1xuXG5leHBvcnQgY2xhc3MgUHJvZ3Jlc3Mge1xuXG4gICAgY29uc3RydWN0b3IodGl0bGUsIG1lc3NhZ2UpIHtcbiAgICAgICAgdGhpcy5wcm9ncmVzcyA9IHByb2dyZXNzKHRpdGxlLCBtZXNzYWdlKTtcbiAgICAgICAgdGhpcy5wcm9ncmVzcy5jYXRjaCgoKSA9PiB0aGlzLmFib3J0ZWQgPSB0cnVlKTtcbiAgICAgICAgdGhpcy5kaWFsb2cgPSB0aGlzLnByb2dyZXNzLmRpYWxvZztcbiAgICAgICAgdGhpcy5hYm9ydGVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgYXN5bmMgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAodGhpcy5hYm9ydGVkKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGxldCBwcm9jZXNzZWQgPSAwLCByYW5nZSA9IGNvbGxlY3Rpb24ubGVuZ3RoLCBhY2N1bSA9IDAsIHBjdCA9IDA7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIGF3YWl0IGZ1bmMoaXRlbSwgcHJvY2Vzc2VkKyssIGNvbGxlY3Rpb24sIHRoaXMpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmFib3J0ZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICBhY2N1bSArPSAxMDA7XG4gICAgICAgICAgICAgICAgaWYgKGFjY3VtID4gcmFuZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVtYWluZGVyID0gYWNjdW0gJSByYW5nZSwgc3RlcCA9IChhY2N1bSAtIHJlbWFpbmRlcikgLyByYW5nZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9ncmVzcy5zZXRQcm9ncmVzcyhwY3QgKz0gc3RlcCk7XG4gICAgICAgICAgICAgICAgICAgIGFjY3VtID0gcmVtYWluZGVyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwY3QgPCAxMDApXG4gICAgICAgICAgICAgICAgdGhpcy5wcm9ncmVzcy5zZXRQcm9ncmVzcygxMDApO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLnByb2dyZXNzLnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0IHRpdGxlKHRleHQpIHsgdGhpcy5kaWFsb2cucXVlcnlTZWxlY3RvcihcImhlYWRlclwiKS50ZXh0Q29udGVudCA9IHRleHQ7IH1cbiAgICBnZXQgdGl0bGUoKSB7IHJldHVybiB0aGlzLmRpYWxvZy5xdWVyeVNlbGVjdG9yKFwiaGVhZGVyXCIpLnRleHRDb250ZW50OyB9XG5cbiAgICBzZXQgbWVzc2FnZSh0ZXh0KSB7XG4gICAgICAgIGNvbnN0IGFyZWEgPSB0aGlzLmRpYWxvZy5xdWVyeVNlbGVjdG9yKFwiLmNvbnRlbnQtYXJlYVwiKS5jaGlsZE5vZGVzWzBdLnRleHRDb250ZW50ID0gdGV4dDtcbiAgICB9XG5cbiAgICBnZXQgbWVzc2FnZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGlhbG9nLnF1ZXJ5U2VsZWN0b3IoXCIuY29udGVudC1hcmVhXCIpLmNoaWxkTm9kZXNbMF0udGV4dENvbnRlbnQ7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBwcm9tcHQgfSBmcm9tIFwic21hbGx0YWxrXCI7XG5cbmltcG9ydCBcIi4vdmFsaWRhdGlvbi5zY3NzXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2YWxpZGF0ZWRJbnB1dCh0aXRsZSwgbWVzc2FnZSwgdmFsdWUgPSBcIlwiLCByZWdleCA9IFwiLipcIiwgd2hhdCA9IFwiZW50cnlcIikge1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGNvbnN0IGlucHV0ID0gcHJvbXB0KHRpdGxlLCBtZXNzYWdlLCB2YWx1ZSk7XG4gICAgICAgIGNvbnN0IGlucHV0RmllbGQgPSBpbnB1dC5kaWFsb2cuZmluZChcImlucHV0XCIpO1xuICAgICAgICBjb25zdCBpc1ZhbGlkID0gKHQpID0+IG5ldyBSZWdFeHAoYF4ke3JlZ2V4fSRgKS50ZXN0KHQpO1xuXG4gICAgICAgIGlucHV0RmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UodmFsdWUubGVuZ3RoLCB2YWx1ZS5sZW5ndGgpO1xuICAgICAgICBpbnB1dEZpZWxkLnBhdHRlcm4gPSByZWdleDtcbiAgICAgICAgaW5wdXRGaWVsZC5vbmlucHV0ID0gKCkgPT4gaW5wdXRGaWVsZC5zZXRBdHRyaWJ1dGUoXCJhcmlhLWludmFsaWRcIiwgIWlzVmFsaWQoaW5wdXRGaWVsZC52YWx1ZSkpO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGlucHV0O1xuICAgICAgICBpZiAoaXNWYWxpZChyZXN1bHQpKSByZXR1cm4gcmVzdWx0O1xuXG4gICAgICAgIG5ldyBOb3RpY2UoYFwiJHtyZXN1bHR9XCIgaXMgbm90IGEgdmFsaWQgJHt3aGF0fWApO1xuICAgIH1cbn1cbiIsImltcG9ydCB7Y29uZmlybX0gZnJvbSBcInNtYWxsdGFsa1wiO1xuaW1wb3J0IHtQcm9ncmVzc30gZnJvbSBcIi4vcHJvZ3Jlc3NcIjtcbmltcG9ydCB7dmFsaWRhdGVkSW5wdXR9IGZyb20gXCIuL3ZhbGlkYXRpb25cIjtcbmltcG9ydCB7Tm90aWNlLCBwYXJzZUZyb250TWF0dGVyVGFnc30gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZW5hbWVUYWcoYXBwLCB0YWdOYW1lKSB7XG4gICAgdmFyIG5ld05hbWU7XG4gICAgdHJ5IHtcbiAgICAgICAgbmV3TmFtZSA9IGF3YWl0IHZhbGlkYXRlZElucHV0KFxuICAgICAgICAgICAgYFJlbmFtaW5nICMke3RhZ05hbWV9IChhbmQgYW55IHN1Yi10YWdzKWAsIFwiRW50ZXIgbmV3IG5hbWUgKG11c3QgYmUgYSB2YWxpZCBPYnNpZGlhbiB0YWcpOlxcblwiLCB0YWdOYW1lLFxuICAgICAgICAgICAgXCJbXlxcdTIwMDAtXFx1MjA2RlxcdTJFMDAtXFx1MkU3RichXFxcIiMkJSYoKSorLC46Ozw9Pj9AXmB7fH1+XFxcXFtcXFxcXVxcXFxcXFxcXFxcXHNdK1wiLFxuICAgICAgICAgICAgXCJPYnNpZGlhbiB0YWcgbmFtZVwiXG4gICAgICAgICk7XG4gICAgfVxuICAgIGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoIW5ld05hbWUgfHwgbmV3TmFtZSA9PT0gdGFnTmFtZSkge1xuICAgICAgICByZXR1cm4gbmV3IE5vdGljZShcIlVuY2hhbmdlZCBvciBlbXB0eSB0YWc6IE5vIGNoYW5nZXMgbWFkZS5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgY2xhc2ggPSB0YWdDbGFzaGVzKGFwcCwgXCIjXCIrdGFnTmFtZSwgXCIjXCIrbmV3TmFtZSk7XG4gICAgaWYgKGNsYXNoKSB7XG4gICAgICAgIHRyeSB7IGF3YWl0IGNvbmZpcm0oXG4gICAgICAgICAgICBcIldBUk5JTkc6IE5vIFVuZG8hXCIsXG4gICAgICAgICAgICBgUmVuYW1pbmcgIyR7dGFnTmFtZX0gdG8gIyR7bmV3TmFtZX0gd2lsbCBtZXJnZSBzb21lIHRhZ3NcbmludG8gZXhpc3RpbmcgdGFncyAoc3VjaCBhcyAke2NsYXNofSkuXG5cblRoaXMgPGI+Y2Fubm90PC9iPiBiZSB1bmRvbmUuICBEbyB5b3Ugd2lzaCB0byBwcm9jZWVkP2ApOyB9XG4gICAgICAgIGNhdGNoKGUpIHsgcmV0dXJuOyB9XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZXNUb1JlbmFtZSA9IGF3YWl0IHRhZ1Bvc2l0aW9ucyhhcHAsIFwiI1wiK3RhZ05hbWUpO1xuICAgIGlmICghZmlsZXNUb1JlbmFtZSkgcmV0dXJuO1xuXG4gICAgY29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MoYFJlbmFtaW5nIHRvICR7bmV3TmFtZX0vKmAsIFwiUHJvY2Vzc2luZyBmaWxlcy4uLlwiKTtcbiAgICBsZXQgdXBkYXRlZCA9IDA7XG4gICAgYXdhaXQgcHJvZ3Jlc3MuZm9yRWFjaChmaWxlc1RvUmVuYW1lLCBhc3luYyAoZikgPT4ge1xuICAgICAgICBwcm9ncmVzcy5tZXNzYWdlID0gXCJQcm9jZXNzaW5nIFwiICsgZi5maWxlbmFtZS5zcGxpdChcIi9cIikucG9wKCk7XG4gICAgICAgIGNvbnN0IGZpbGUgPSBhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGYuZmlsZW5hbWUpO1xuICAgICAgICBjb25zdCBvcmlnaW5hbCA9IGF3YWl0IGFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgICBpZiAocHJvZ3Jlc3MuYWJvcnRlZCkgcmV0dXJuO1xuICAgICAgICBsZXQgdGV4dCA9IG9yaWdpbmFsO1xuICAgICAgICBmb3IoY29uc3QgeyBwb3NpdGlvbjoge3N0YXJ0LCBlbmR9LCB0YWd9IG9mIGYpIHtcbiAgICAgICAgICAgIGlmICh0ZXh0LnNsaWNlKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkgIT09IHRhZykge1xuICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoYEZpbGUgJHtmLmZpbGVuYW1lfSBoYXMgY2hhbmdlZDsgc2tpcHBpbmdgKVxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEZpbGUgJHtmLmZpbGVuYW1lfSBoYXMgY2hhbmdlZDsgc2tpcHBpbmdgKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmRlYnVnKHRleHQuc2xpY2Uoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSwgdGFnKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRleHQgPSB0ZXh0LnNsaWNlKDAsIHN0YXJ0Lm9mZnNldCkgKyBcIiNcIituZXdOYW1lICsgdGV4dC5zbGljZShzdGFydC5vZmZzZXQgKyB0YWdOYW1lLmxlbmd0aCArIDEpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRleHQgIT09IG9yaWdpbmFsKSB7IGF3YWl0IGFwcC52YXVsdC5tb2RpZnkoZmlsZSwgdGV4dCk7IHVwZGF0ZWQrKzsgfVxuICAgIH0pXG4gICAgcmV0dXJuIG5ldyBOb3RpY2UoYE9wZXJhdGlvbiAke3Byb2dyZXNzLmFib3J0ZWQgPyBcImNhbmNlbGxlZFwiIDogXCJjb21wbGV0ZVwifTogJHt1cGRhdGVkfSBmaWxlKHMpIHVwZGF0ZWRgKTtcbn1cblxuZnVuY3Rpb24gdGFnQ2xhc2hlcyhhcHAsIG9sZFRhZywgbmV3VGFnKSB7XG4gICAgY29uc3QgcHJlZml4ID0gb2xkVGFnICsgXCIvXCI7XG4gICAgY29uc3QgdGFncyA9IG5ldyBTZXQoT2JqZWN0LmtleXMoYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0VGFncygpKSk7XG4gICAgZm9yIChjb25zdCB0YWcgb2YgdGFncykge1xuICAgICAgICBpZiAodGFnID09PSBvbGRUYWcgfHwgdGFnLnN0YXJ0c1dpdGgocHJlZml4KSkge1xuICAgICAgICAgICAgY29uc3QgY2hhbmdlZCA9IG5ld1RhZyArIHRhZy5zbGljZShvbGRUYWcubGVuZ3RoKTtcbiAgICAgICAgICAgIGlmICh0YWdzLmhhcyhjaGFuZ2VkKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hhbmdlZDtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gdGFnUG9zaXRpb25zKGFwcCwgdGFnTmFtZSkge1xuICAgIGNvbnN0IHByZWZpeCA9IHRhZ05hbWUgKyBcIi9cIiwgcmVzdWx0ID0gW107XG4gICAgZnVuY3Rpb24gdGFnTWF0Y2hlcyh0YWcpIHtcbiAgICAgICAgcmV0dXJuIHRhZyA9PSB0YWdOYW1lIHx8IHRhZy5zdGFydHNXaXRoKHByZWZpeCk7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MoYFNlYXJjaGluZyBmb3IgJHtwcmVmaXh9KmAsIFwiTWF0Y2hpbmcgZmlsZXMuLi5cIik7XG4gICAgYXdhaXQgcHJvZ3Jlc3MuZm9yRWFjaChcbiAgICAgICAgYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Q2FjaGVkRmlsZXMoKSxcbiAgICAgICAgbiA9PiB7XG4gICAgICAgICAgICBsZXQgeyBmcm9udG1hdHRlciwgdGFncyB9ID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Q2FjaGUobik7XG4gICAgICAgICAgICB0YWdzID0gdGFncyAmJiB0YWdzLmZpbHRlcih0ID0+IHRhZ01hdGNoZXModC50YWcgfHwgXCJcIikpLnJldmVyc2UoKSB8fCBbXTsgLy8gbGFzdCBwb3NpdGlvbnMgZmlyc3RcbiAgICAgICAgICAgIHRhZ3MuZmlsZW5hbWUgPSBuO1xuICAgICAgICAgICAgdGFncy5mbXRhZ3MgPSAocGFyc2VGcm9udE1hdHRlclRhZ3MoZnJvbnRtYXR0ZXIpIHx8IFtdKS5maWx0ZXIodGFnTWF0Y2hlcyk7XG4gICAgICAgICAgICB0YWdzLmZyb250bWF0dGVyID0gZnJvbnRtYXR0ZXI7XG4gICAgICAgICAgICBpZiAodGFncy5sZW5ndGggfHwgdGFncy5mbXRhZ3MubGVuZ3RoKVxuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHRhZ3MpO1xuICAgICAgICB9XG4gICAgKTtcbiAgICBpZiAoIXByb2dyZXNzLmFib3J0ZWQpXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG59XG4iLCJpbXBvcnQge01lbnUsIE5vdGljZSwgUGx1Z2lufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7cmVuYW1lVGFnfSBmcm9tIFwiLi9yZW5hbWluZ1wiO1xuXG5mdW5jdGlvbiBvbkVsZW1lbnQoZWwsIGV2ZW50LCBzZWxlY3RvciwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBlbC5vbihldmVudCwgc2VsZWN0b3IsIGNhbGxiYWNrLCBvcHRpb25zKVxuICAgIHJldHVybiAoKSA9PiBlbC5vZmYoZXZlbnQsIHNlbGVjdG9yLCBjYWxsYmFjaywgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRhZ1dyYW5nbGVyIGV4dGVuZHMgUGx1Z2luIHtcbiAgICBvbmxvYWQoKXtcbiAgICAgICAgdGhpcy5yZWdpc3RlcihcbiAgICAgICAgICAgIG9uRWxlbWVudChkb2N1bWVudCwgXCJjb250ZXh0bWVudVwiLCBcIi50YWctcGFuZS10YWdcIiwgdGhpcy5vbk1lbnUuYmluZCh0aGlzKSwge2NhcHR1cmU6IHRydWV9KVxuICAgICAgICApO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyKFxuICAgICAgICAgICAgb25FbGVtZW50KGRvY3VtZW50LCBcIm1vdXNlZG93blwiLCBcIi50YWctcGFuZS10YWdcIiwgKCkgPT4ge3dpbmRvdy5sYXN0Rm9jdXMgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O30sIHtjYXB0dXJlOiB0cnVlfSlcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBvbk1lbnUoZSwgdGFnRWwpIHtcbiAgICAgICAgY29uc3RcbiAgICAgICAgICAgIHRhZ05hbWUgPSB0YWdFbC5maW5kKFwiLnRhZy1wYW5lLXRhZy10ZXh0XCIpLnRleHRDb250ZW50LFxuICAgICAgICAgICAgdHJlZVBhcmVudCA9IHRhZ0VsLnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudCxcbiAgICAgICAgICAgIGlzSGllcmFyY2h5ID0gdHJlZVBhcmVudC5maW5kKFwiLmNvbGxhcHNlLWljb25cIiksXG4gICAgICAgICAgICBzZWFyY2hQbHVnaW4gPSB0aGlzLmFwcC5pbnRlcm5hbFBsdWdpbnMuZ2V0UGx1Z2luQnlJZChcImdsb2JhbC1zZWFyY2hcIiksXG4gICAgICAgICAgICBzZWFyY2ggPSBzZWFyY2hQbHVnaW4gJiYgc2VhcmNoUGx1Z2luLmluc3RhbmNlLFxuICAgICAgICAgICAgcXVlcnkgPSBzZWFyY2ggJiYgc2VhcmNoLmdldEdsb2JhbFNlYXJjaFF1ZXJ5KCksXG4gICAgICAgICAgICBtZW51ID0gbmV3IFRhZ01lbnUoKS5hZGRJdGVtKGl0ZW0oXCJwZW5jaWxcIiwgXCJSZW5hbWUgI1wiK3RhZ05hbWUsICgpID0+IHRoaXMucmVuYW1lKHRhZ05hbWUpKSk7XG5cbiAgICAgICAgaWYgKHNlYXJjaCkge1xuICAgICAgICAgICAgbWVudS5hZGRTZXBhcmF0b3IoKS5hZGRJdGVtKFxuICAgICAgICAgICAgICAgIGl0ZW0oXCJtYWduaWZ5aW5nLWdsYXNzXCIsIFwiTmV3IHNlYXJjaCBmb3IgI1wiK3RhZ05hbWUsICgpID0+IHNlYXJjaC5vcGVuR2xvYmFsU2VhcmNoKFwidGFnOlwiICsgdGFnTmFtZSkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgbWVudS5hZGRJdGVtKFxuICAgICAgICAgICAgICAgICAgICBpdGVtKFwic2hlZXRzLWluLWJveFwiLCBcIlJlcXVpcmUgI1wiK3RhZ05hbWUrXCIgaW4gc2VhcmNoXCIgICwgKCkgPT4gc2VhcmNoLm9wZW5HbG9iYWxTZWFyY2gocXVlcnkrXCIgdGFnOlwiICArIHRhZ05hbWUpKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtZW51LmFkZEl0ZW0oXG4gICAgICAgICAgICAgICAgaXRlbShcImNyb3NzZWQtc3RhclwiICwgXCJFeGNsdWRlICNcIit0YWdOYW1lK1wiIGZyb20gc2VhcmNoXCIsICgpID0+IHNlYXJjaC5vcGVuR2xvYmFsU2VhcmNoKHF1ZXJ5K1wiIC10YWc6XCIgKyB0YWdOYW1lKSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNIaWVyYXJjaHkpIHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIHRvZ2dsZShjb2xsYXBzZSkge1xuICAgICAgICAgICAgICAgIGZvcihjb25zdCBlbCBvZiB0cmVlUGFyZW50LmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZWwuaGFzQ2xhc3MoXCJ0cmVlLWl0ZW1cIikpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29sbGFwc2UgIT09IGVsLmhhc0NsYXNzKFwiaXMtY29sbGFwc2VkXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidXR0b24gPSBlbC5maW5kKFwiLmNvbGxhcHNlLWljb25cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnV0dG9uKSBidXR0b24uY2xpY2soKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1lbnUuYWRkU2VwYXJhdG9yKClcbiAgICAgICAgICAgIC5hZGRJdGVtKGl0ZW0oXCJ2ZXJ0aWNhbC10aHJlZS1kb3RzXCIsIFwiQ29sbGFwc2UgdGFncyBhdCB0aGlzIGxldmVsXCIsICgpID0+IHRvZ2dsZSh0cnVlICkpKVxuICAgICAgICAgICAgLmFkZEl0ZW0oaXRlbShcImV4cGFuZC12ZXJ0aWNhbGx5XCIgICwgXCJFeHBhbmQgdGFncyBhdCB0aGlzIGxldmVsXCIgICwgKCkgPT4gdG9nZ2xlKGZhbHNlKSkpXG4gICAgICAgIH1cblxuICAgICAgICBtZW51LnNob3dBdFBvc2l0aW9uKHt4OiBlLnBhZ2VYLCB5OiBlLnBhZ2VZfSk7XG4gICAgfVxuXG4gICAgYXN5bmMgcmVuYW1lKHRhZ05hbWUpIHtcbiAgICAgICAgdHJ5IHsgYXdhaXQgcmVuYW1lVGFnKHRoaXMuYXBwLCB0YWdOYW1lKTsgfVxuICAgICAgICBjYXRjaCAoZSkgeyBjb25zb2xlLmVycm9yKGUpOyBuZXcgTm90aWNlKFwiZXJyb3I6IFwiICsgZSk7IH1cbiAgICB9XG5cbn1cblxuY2xhc3MgVGFnTWVudSBleHRlbmRzIE1lbnUge1xuICAgIGxvYWQoKSB7XG4gICAgICAgIHN1cGVyLmxvYWQoKTtcbiAgICAgICAgdGhpcy5yZWdpc3RlcihcbiAgICAgICAgICAgIG9uRWxlbWVudChkb2N1bWVudCwgXCJrZXlkb3duXCIsIFwiKlwiLCB0aGlzLm9uS2V5ZG93bi5iaW5kKHRoaXMpLCB7Y2FwdHVyZTogdHJ1ZX0pXG4gICAgICAgICk7XG4gICAgfVxuICAgIG9uS2V5ZG93bihlKSB7XG4gICAgICAgIGlmIChlLmtleT09XCJFc2NhcGVcIikge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5oaWRlKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGl0ZW0oaWNvbiwgdGl0bGUsIGNsaWNrKSB7XG4gICAgcmV0dXJuIGkgPT4gaS5zZXRJY29uKGljb24pLnNldFRpdGxlKHRpdGxlKS5vbkNsaWNrKGNsaWNrKTtcbn1cblxuIl0sIm5hbWVzIjpbImN1cnJpZnkiLCJzdG9yZSIsInF1ZXJ5IiwiTm90aWNlIiwicGFyc2VGcm9udE1hdHRlclRhZ3MiLCJQbHVnaW4iLCJNZW51Il0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUVBLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFLO0FBQ2xCO0FBQ0EsSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUMzQyxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUM5QyxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDakQsSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQUcsU0FB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
