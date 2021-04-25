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
        this.progress.catch(e => {
            this.aborted = true;
            if (e && (e.constructor !== Error || e.message !== "")) console.error(e);
        });
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

class Tag {
    constructor(name) {
        while (name.startsWith("#")) name = name.slice(1);
        this.name = name;
        const
            hashed = this.tag = "#" + name,
            canonical = this.canonical = hashed.toLowerCase(),
            canonical_prefix = this.canonical_prefix = canonical + "/";
        this.matches = function (text) {
            text = text.toLowerCase();
            return text == canonical || text.startsWith(canonical_prefix);
        };
    }
    toString() { return this.tag; }
}

class Replacement {

    constructor(fromTag, toTag) {
        const cache =  Object.assign(
            Object.create(null), {
                [fromTag.tag]:  toTag.tag,
                [fromTag.name]: toTag.name,
            }
        );

        this.inString = function(text, pos = 0) {
            return text.slice(0, pos) + toTag.tag + text.slice(pos + fromTag.tag.length);
        };

        this.inArray = (tags, skipOdd) => {
            return tags.map((t, i) => {
                if (skipOdd && (i & 1)) return t;   // leave odd entries (separators) alone
                if (cache[t]) return cache[t];
                if (!t) return t;
                const lc = t.toLowerCase();
                if (cache[lc]) {
                    return cache[t] = cache[lc];
                } else if (lc.startsWith(fromTag.canonical_prefix)) {
                    return cache[t] = cache[lc] = this.inString(t);
                } else if (("#" + lc).startsWith(fromTag.canonical_prefix)) {
                    return cache[t] = cache[lc] = this.inString("#" + t).slice(1);
                }
                return cache[t] = cache[lc] = t;
            });
        };

        this.willMergeTags = function (tagNames) {
            // Renaming to change case doesn't lose info, so ignore it
            if (fromTag.canonical === toTag.canonical) return;

            const existing = new Set(tagNames.map(s => s.toLowerCase()));

            for (const tagName of tagNames.filter(fromTag.matches)) {
                const changed = this.inString(tagName);
                if (existing.has(changed.toLowerCase()))
                    return [new Tag(tagName), new Tag(changed)];
            }

        };
    }
}

const Char = {
  ANCHOR: '&',
  COMMENT: '#',
  TAG: '!',
  DIRECTIVES_END: '-',
  DOCUMENT_END: '.'
};
const LogLevel = Object.assign(['silent', 'error', 'warn', 'debug'], {
  SILENT: 0,
  ERROR: 1,
  WARN: 2,
  DEBUG: 3
});
const Type = {
  ALIAS: 'ALIAS',
  BLANK_LINE: 'BLANK_LINE',
  BLOCK_FOLDED: 'BLOCK_FOLDED',
  BLOCK_LITERAL: 'BLOCK_LITERAL',
  COMMENT: 'COMMENT',
  DIRECTIVE: 'DIRECTIVE',
  DOCUMENT: 'DOCUMENT',
  FLOW_MAP: 'FLOW_MAP',
  FLOW_SEQ: 'FLOW_SEQ',
  MAP: 'MAP',
  MAP_KEY: 'MAP_KEY',
  MAP_VALUE: 'MAP_VALUE',
  PLAIN: 'PLAIN',
  QUOTE_DOUBLE: 'QUOTE_DOUBLE',
  QUOTE_SINGLE: 'QUOTE_SINGLE',
  SEQ: 'SEQ',
  SEQ_ITEM: 'SEQ_ITEM'
};
const defaultTagPrefix = 'tag:yaml.org,2002:';
const defaultTags = {
  MAP: 'tag:yaml.org,2002:map',
  SEQ: 'tag:yaml.org,2002:seq',
  STR: 'tag:yaml.org,2002:str'
};

function findLineStarts(src) {
  const ls = [0];
  let offset = src.indexOf('\n');

  while (offset !== -1) {
    offset += 1;
    ls.push(offset);
    offset = src.indexOf('\n', offset);
  }

  return ls;
}

function getSrcInfo(cst) {
  let lineStarts, src;

  if (typeof cst === 'string') {
    lineStarts = findLineStarts(cst);
    src = cst;
  } else {
    if (Array.isArray(cst)) cst = cst[0];

    if (cst && cst.context) {
      if (!cst.lineStarts) cst.lineStarts = findLineStarts(cst.context.src);
      lineStarts = cst.lineStarts;
      src = cst.context.src;
    }
  }

  return {
    lineStarts,
    src
  };
}
/**
 * @typedef {Object} LinePos - One-indexed position in the source
 * @property {number} line
 * @property {number} col
 */

/**
 * Determine the line/col position matching a character offset.
 *
 * Accepts a source string or a CST document as the second parameter. With
 * the latter, starting indices for lines are cached in the document as
 * `lineStarts: number[]`.
 *
 * Returns a one-indexed `{ line, col }` location if found, or
 * `undefined` otherwise.
 *
 * @param {number} offset
 * @param {string|Document|Document[]} cst
 * @returns {?LinePos}
 */


function getLinePos(offset, cst) {
  if (typeof offset !== 'number' || offset < 0) return null;
  const {
    lineStarts,
    src
  } = getSrcInfo(cst);
  if (!lineStarts || !src || offset > src.length) return null;

  for (let i = 0; i < lineStarts.length; ++i) {
    const start = lineStarts[i];

    if (offset < start) {
      return {
        line: i,
        col: offset - lineStarts[i - 1] + 1
      };
    }

    if (offset === start) return {
      line: i + 1,
      col: 1
    };
  }

  const line = lineStarts.length;
  return {
    line,
    col: offset - lineStarts[line - 1] + 1
  };
}
/**
 * Get a specified line from the source.
 *
 * Accepts a source string or a CST document as the second parameter. With
 * the latter, starting indices for lines are cached in the document as
 * `lineStarts: number[]`.
 *
 * Returns the line as a string if found, or `null` otherwise.
 *
 * @param {number} line One-indexed line number
 * @param {string|Document|Document[]} cst
 * @returns {?string}
 */

function getLine(line, cst) {
  const {
    lineStarts,
    src
  } = getSrcInfo(cst);
  if (!lineStarts || !(line >= 1) || line > lineStarts.length) return null;
  const start = lineStarts[line - 1];
  let end = lineStarts[line]; // undefined for last line; that's ok for slice()

  while (end && end > start && src[end - 1] === '\n') --end;

  return src.slice(start, end);
}
/**
 * Pretty-print the starting line from the source indicated by the range `pos`
 *
 * Trims output to `maxWidth` chars while keeping the starting column visible,
 * using `…` at either end to indicate dropped characters.
 *
 * Returns a two-line string (or `null`) with `\n` as separator; the second line
 * will hold appropriately indented `^` marks indicating the column range.
 *
 * @param {Object} pos
 * @param {LinePos} pos.start
 * @param {LinePos} [pos.end]
 * @param {string|Document|Document[]*} cst
 * @param {number} [maxWidth=80]
 * @returns {?string}
 */

function getPrettyContext({
  start,
  end
}, cst, maxWidth = 80) {
  let src = getLine(start.line, cst);
  if (!src) return null;
  let {
    col
  } = start;

  if (src.length > maxWidth) {
    if (col <= maxWidth - 10) {
      src = src.substr(0, maxWidth - 1) + '…';
    } else {
      const halfWidth = Math.round(maxWidth / 2);
      if (src.length > col + halfWidth) src = src.substr(0, col + halfWidth - 1) + '…';
      col -= src.length - maxWidth;
      src = '…' + src.substr(1 - maxWidth);
    }
  }

  let errLen = 1;
  let errEnd = '';

  if (end) {
    if (end.line === start.line && col + (end.col - start.col) <= maxWidth + 1) {
      errLen = end.col - start.col;
    } else {
      errLen = Math.min(src.length + 1, maxWidth) - col;
      errEnd = '…';
    }
  }

  const offset = col > 1 ? ' '.repeat(col - 1) : '';
  const err = '^'.repeat(errLen);
  return "".concat(src, "\n").concat(offset).concat(err).concat(errEnd);
}

class Range {
  static copy(orig) {
    return new Range(orig.start, orig.end);
  }

  constructor(start, end) {
    this.start = start;
    this.end = end || start;
  }

  isEmpty() {
    return typeof this.start !== 'number' || !this.end || this.end <= this.start;
  }
  /**
   * Set `origStart` and `origEnd` to point to the original source range for
   * this node, which may differ due to dropped CR characters.
   *
   * @param {number[]} cr - Positions of dropped CR characters
   * @param {number} offset - Starting index of `cr` from the last call
   * @returns {number} - The next offset, matching the one found for `origStart`
   */


  setOrigRange(cr, offset) {
    const {
      start,
      end
    } = this;

    if (cr.length === 0 || end <= cr[0]) {
      this.origStart = start;
      this.origEnd = end;
      return offset;
    }

    let i = offset;

    while (i < cr.length) {
      if (cr[i] > start) break;else ++i;
    }

    this.origStart = start + i;
    const nextOffset = i;

    while (i < cr.length) {
      // if end was at \n, it should now be at \r
      if (cr[i] >= end) break;else ++i;
    }

    this.origEnd = end + i;
    return nextOffset;
  }

}

/** Root class of all nodes */

class Node {
  static addStringTerminator(src, offset, str) {
    if (str[str.length - 1] === '\n') return str;
    const next = Node.endOfWhiteSpace(src, offset);
    return next >= src.length || src[next] === '\n' ? str + '\n' : str;
  } // ^(---|...)


  static atDocumentBoundary(src, offset, sep) {
    const ch0 = src[offset];
    if (!ch0) return true;
    const prev = src[offset - 1];
    if (prev && prev !== '\n') return false;

    if (sep) {
      if (ch0 !== sep) return false;
    } else {
      if (ch0 !== Char.DIRECTIVES_END && ch0 !== Char.DOCUMENT_END) return false;
    }

    const ch1 = src[offset + 1];
    const ch2 = src[offset + 2];
    if (ch1 !== ch0 || ch2 !== ch0) return false;
    const ch3 = src[offset + 3];
    return !ch3 || ch3 === '\n' || ch3 === '\t' || ch3 === ' ';
  }

  static endOfIdentifier(src, offset) {
    let ch = src[offset];
    const isVerbatim = ch === '<';
    const notOk = isVerbatim ? ['\n', '\t', ' ', '>'] : ['\n', '\t', ' ', '[', ']', '{', '}', ','];

    while (ch && notOk.indexOf(ch) === -1) ch = src[offset += 1];

    if (isVerbatim && ch === '>') offset += 1;
    return offset;
  }

  static endOfIndent(src, offset) {
    let ch = src[offset];

    while (ch === ' ') ch = src[offset += 1];

    return offset;
  }

  static endOfLine(src, offset) {
    let ch = src[offset];

    while (ch && ch !== '\n') ch = src[offset += 1];

    return offset;
  }

  static endOfWhiteSpace(src, offset) {
    let ch = src[offset];

    while (ch === '\t' || ch === ' ') ch = src[offset += 1];

    return offset;
  }

  static startOfLine(src, offset) {
    let ch = src[offset - 1];
    if (ch === '\n') return offset;

    while (ch && ch !== '\n') ch = src[offset -= 1];

    return offset + 1;
  }
  /**
   * End of indentation, or null if the line's indent level is not more
   * than `indent`
   *
   * @param {string} src
   * @param {number} indent
   * @param {number} lineStart
   * @returns {?number}
   */


  static endOfBlockIndent(src, indent, lineStart) {
    const inEnd = Node.endOfIndent(src, lineStart);

    if (inEnd > lineStart + indent) {
      return inEnd;
    } else {
      const wsEnd = Node.endOfWhiteSpace(src, inEnd);
      const ch = src[wsEnd];
      if (!ch || ch === '\n') return wsEnd;
    }

    return null;
  }

  static atBlank(src, offset, endAsBlank) {
    const ch = src[offset];
    return ch === '\n' || ch === '\t' || ch === ' ' || endAsBlank && !ch;
  }

  static nextNodeIsIndented(ch, indentDiff, indicatorAsIndent) {
    if (!ch || indentDiff < 0) return false;
    if (indentDiff > 0) return true;
    return indicatorAsIndent && ch === '-';
  } // should be at line or string end, or at next non-whitespace char


  static normalizeOffset(src, offset) {
    const ch = src[offset];
    return !ch ? offset : ch !== '\n' && src[offset - 1] === '\n' ? offset - 1 : Node.endOfWhiteSpace(src, offset);
  } // fold single newline into space, multiple newlines to N - 1 newlines
  // presumes src[offset] === '\n'


  static foldNewline(src, offset, indent) {
    let inCount = 0;
    let error = false;
    let fold = '';
    let ch = src[offset + 1];

    while (ch === ' ' || ch === '\t' || ch === '\n') {
      switch (ch) {
        case '\n':
          inCount = 0;
          offset += 1;
          fold += '\n';
          break;

        case '\t':
          if (inCount <= indent) error = true;
          offset = Node.endOfWhiteSpace(src, offset + 2) - 1;
          break;

        case ' ':
          inCount += 1;
          offset += 1;
          break;
      }

      ch = src[offset + 1];
    }

    if (!fold) fold = ' ';
    if (ch && inCount <= indent) error = true;
    return {
      fold,
      offset,
      error
    };
  }

  constructor(type, props, context) {
    Object.defineProperty(this, 'context', {
      value: context || null,
      writable: true
    });
    this.error = null;
    this.range = null;
    this.valueRange = null;
    this.props = props || [];
    this.type = type;
    this.value = null;
  }

  getPropValue(idx, key, skipKey) {
    if (!this.context) return null;
    const {
      src
    } = this.context;
    const prop = this.props[idx];
    return prop && src[prop.start] === key ? src.slice(prop.start + (skipKey ? 1 : 0), prop.end) : null;
  }

  get anchor() {
    for (let i = 0; i < this.props.length; ++i) {
      const anchor = this.getPropValue(i, Char.ANCHOR, true);
      if (anchor != null) return anchor;
    }

    return null;
  }

  get comment() {
    const comments = [];

    for (let i = 0; i < this.props.length; ++i) {
      const comment = this.getPropValue(i, Char.COMMENT, true);
      if (comment != null) comments.push(comment);
    }

    return comments.length > 0 ? comments.join('\n') : null;
  }

  commentHasRequiredWhitespace(start) {
    const {
      src
    } = this.context;
    if (this.header && start === this.header.end) return false;
    if (!this.valueRange) return false;
    const {
      end
    } = this.valueRange;
    return start !== end || Node.atBlank(src, end - 1);
  }

  get hasComment() {
    if (this.context) {
      const {
        src
      } = this.context;

      for (let i = 0; i < this.props.length; ++i) {
        if (src[this.props[i].start] === Char.COMMENT) return true;
      }
    }

    return false;
  }

  get hasProps() {
    if (this.context) {
      const {
        src
      } = this.context;

      for (let i = 0; i < this.props.length; ++i) {
        if (src[this.props[i].start] !== Char.COMMENT) return true;
      }
    }

    return false;
  }

  get includesTrailingLines() {
    return false;
  }

  get jsonLike() {
    const jsonLikeTypes = [Type.FLOW_MAP, Type.FLOW_SEQ, Type.QUOTE_DOUBLE, Type.QUOTE_SINGLE];
    return jsonLikeTypes.indexOf(this.type) !== -1;
  }

  get rangeAsLinePos() {
    if (!this.range || !this.context) return undefined;
    const start = getLinePos(this.range.start, this.context.root);
    if (!start) return undefined;
    const end = getLinePos(this.range.end, this.context.root);
    return {
      start,
      end
    };
  }

  get rawValue() {
    if (!this.valueRange || !this.context) return null;
    const {
      start,
      end
    } = this.valueRange;
    return this.context.src.slice(start, end);
  }

  get tag() {
    for (let i = 0; i < this.props.length; ++i) {
      const tag = this.getPropValue(i, Char.TAG, false);

      if (tag != null) {
        if (tag[1] === '<') {
          return {
            verbatim: tag.slice(2, -1)
          };
        } else {
          // eslint-disable-next-line no-unused-vars
          const [_, handle, suffix] = tag.match(/^(.*!)([^!]*)$/);
          return {
            handle,
            suffix
          };
        }
      }
    }

    return null;
  }

  get valueRangeContainsNewline() {
    if (!this.valueRange || !this.context) return false;
    const {
      start,
      end
    } = this.valueRange;
    const {
      src
    } = this.context;

    for (let i = start; i < end; ++i) {
      if (src[i] === '\n') return true;
    }

    return false;
  }

  parseComment(start) {
    const {
      src
    } = this.context;

    if (src[start] === Char.COMMENT) {
      const end = Node.endOfLine(src, start + 1);
      const commentRange = new Range(start, end);
      this.props.push(commentRange);
      return end;
    }

    return start;
  }
  /**
   * Populates the `origStart` and `origEnd` values of all ranges for this
   * node. Extended by child classes to handle descendant nodes.
   *
   * @param {number[]} cr - Positions of dropped CR characters
   * @param {number} offset - Starting index of `cr` from the last call
   * @returns {number} - The next offset, matching the one found for `origStart`
   */


  setOrigRanges(cr, offset) {
    if (this.range) offset = this.range.setOrigRange(cr, offset);
    if (this.valueRange) this.valueRange.setOrigRange(cr, offset);
    this.props.forEach(prop => prop.setOrigRange(cr, offset));
    return offset;
  }

  toString() {
    const {
      context: {
        src
      },
      range,
      value
    } = this;
    if (value != null) return value;
    const str = src.slice(range.start, range.end);
    return Node.addStringTerminator(src, range.end, str);
  }

}

class YAMLError extends Error {
  constructor(name, source, message) {
    if (!message || !(source instanceof Node)) throw new Error("Invalid arguments for new ".concat(name));
    super();
    this.name = name;
    this.message = message;
    this.source = source;
  }

  makePretty() {
    if (!this.source) return;
    this.nodeType = this.source.type;
    const cst = this.source.context && this.source.context.root;

    if (typeof this.offset === 'number') {
      this.range = new Range(this.offset, this.offset + 1);
      const start = cst && getLinePos(this.offset, cst);

      if (start) {
        const end = {
          line: start.line,
          col: start.col + 1
        };
        this.linePos = {
          start,
          end
        };
      }

      delete this.offset;
    } else {
      this.range = this.source.range;
      this.linePos = this.source.rangeAsLinePos;
    }

    if (this.linePos) {
      const {
        line,
        col
      } = this.linePos.start;
      this.message += " at line ".concat(line, ", column ").concat(col);
      const ctx = cst && getPrettyContext(this.linePos, cst);
      if (ctx) this.message += ":\n\n".concat(ctx, "\n");
    }

    delete this.source;
  }

}
class YAMLReferenceError extends YAMLError {
  constructor(source, message) {
    super('YAMLReferenceError', source, message);
  }

}
class YAMLSemanticError extends YAMLError {
  constructor(source, message) {
    super('YAMLSemanticError', source, message);
  }

}
class YAMLSyntaxError extends YAMLError {
  constructor(source, message) {
    super('YAMLSyntaxError', source, message);
  }

}
class YAMLWarning extends YAMLError {
  constructor(source, message) {
    super('YAMLWarning', source, message);
  }

}

class BlankLine extends Node {
  constructor() {
    super(Type.BLANK_LINE);
  }
  /* istanbul ignore next */


  get includesTrailingLines() {
    // This is never called from anywhere, but if it were,
    // this is the value it should return.
    return true;
  }
  /**
   * Parses a blank line from the source
   *
   * @param {ParseContext} context
   * @param {number} start - Index of first \n character
   * @returns {number} - Index of the character after this
   */


  parse(context, start) {
    this.context = context;
    this.range = new Range(start, start + 1);
    return start + 1;
  }

}

class CollectionItem extends Node {
  constructor(type, props) {
    super(type, props);
    this.node = null;
  }

  get includesTrailingLines() {
    return !!this.node && this.node.includesTrailingLines;
  }
  /**
   * @param {ParseContext} context
   * @param {number} start - Index of first character
   * @returns {number} - Index of the character after this
   */


  parse(context, start) {
    this.context = context;
    const {
      parseNode,
      src
    } = context;
    let {
      atLineStart,
      lineStart
    } = context;
    if (!atLineStart && this.type === Type.SEQ_ITEM) this.error = new YAMLSemanticError(this, 'Sequence items must not have preceding content on the same line');
    const indent = atLineStart ? start - lineStart : context.indent;
    let offset = Node.endOfWhiteSpace(src, start + 1);
    let ch = src[offset];
    const inlineComment = ch === '#';
    const comments = [];
    let blankLine = null;

    while (ch === '\n' || ch === '#') {
      if (ch === '#') {
        const end = Node.endOfLine(src, offset + 1);
        comments.push(new Range(offset, end));
        offset = end;
      } else {
        atLineStart = true;
        lineStart = offset + 1;
        const wsEnd = Node.endOfWhiteSpace(src, lineStart);

        if (src[wsEnd] === '\n' && comments.length === 0) {
          blankLine = new BlankLine();
          lineStart = blankLine.parse({
            src
          }, lineStart);
        }

        offset = Node.endOfIndent(src, lineStart);
      }

      ch = src[offset];
    }

    if (Node.nextNodeIsIndented(ch, offset - (lineStart + indent), this.type !== Type.SEQ_ITEM)) {
      this.node = parseNode({
        atLineStart,
        inCollection: false,
        indent,
        lineStart,
        parent: this
      }, offset);
    } else if (ch && lineStart > start + 1) {
      offset = lineStart - 1;
    }

    if (this.node) {
      if (blankLine) {
        // Only blank lines preceding non-empty nodes are captured. Note that
        // this means that collection item range start indices do not always
        // increase monotonically. -- eemeli/yaml#126
        const items = context.parent.items || context.parent.contents;
        if (items) items.push(blankLine);
      }

      if (comments.length) Array.prototype.push.apply(this.props, comments);
      offset = this.node.range.end;
    } else {
      if (inlineComment) {
        const c = comments[0];
        this.props.push(c);
        offset = c.end;
      } else {
        offset = Node.endOfLine(src, start + 1);
      }
    }

    const end = this.node ? this.node.valueRange.end : offset;
    this.valueRange = new Range(start, end);
    return offset;
  }

  setOrigRanges(cr, offset) {
    offset = super.setOrigRanges(cr, offset);
    return this.node ? this.node.setOrigRanges(cr, offset) : offset;
  }

  toString() {
    const {
      context: {
        src
      },
      node,
      range,
      value
    } = this;
    if (value != null) return value;
    const str = node ? src.slice(range.start, node.range.start) + String(node) : src.slice(range.start, range.end);
    return Node.addStringTerminator(src, range.end, str);
  }

}

class Comment extends Node {
  constructor() {
    super(Type.COMMENT);
  }
  /**
   * Parses a comment line from the source
   *
   * @param {ParseContext} context
   * @param {number} start - Index of first character
   * @returns {number} - Index of the character after this scalar
   */


  parse(context, start) {
    this.context = context;
    const offset = this.parseComment(start);
    this.range = new Range(start, offset);
    return offset;
  }

}

function grabCollectionEndComments(node) {
  let cnode = node;

  while (cnode instanceof CollectionItem) cnode = cnode.node;

  if (!(cnode instanceof Collection)) return null;
  const len = cnode.items.length;
  let ci = -1;

  for (let i = len - 1; i >= 0; --i) {
    const n = cnode.items[i];

    if (n.type === Type.COMMENT) {
      // Keep sufficiently indented comments with preceding node
      const {
        indent,
        lineStart
      } = n.context;
      if (indent > 0 && n.range.start >= lineStart + indent) break;
      ci = i;
    } else if (n.type === Type.BLANK_LINE) ci = i;else break;
  }

  if (ci === -1) return null;
  const ca = cnode.items.splice(ci, len - ci);
  const prevEnd = ca[0].range.start;

  while (true) {
    cnode.range.end = prevEnd;
    if (cnode.valueRange && cnode.valueRange.end > prevEnd) cnode.valueRange.end = prevEnd;
    if (cnode === node) break;
    cnode = cnode.context.parent;
  }

  return ca;
}
class Collection extends Node {
  static nextContentHasIndent(src, offset, indent) {
    const lineStart = Node.endOfLine(src, offset) + 1;
    offset = Node.endOfWhiteSpace(src, lineStart);
    const ch = src[offset];
    if (!ch) return false;
    if (offset >= lineStart + indent) return true;
    if (ch !== '#' && ch !== '\n') return false;
    return Collection.nextContentHasIndent(src, offset, indent);
  }

  constructor(firstItem) {
    super(firstItem.type === Type.SEQ_ITEM ? Type.SEQ : Type.MAP);

    for (let i = firstItem.props.length - 1; i >= 0; --i) {
      if (firstItem.props[i].start < firstItem.context.lineStart) {
        // props on previous line are assumed by the collection
        this.props = firstItem.props.slice(0, i + 1);
        firstItem.props = firstItem.props.slice(i + 1);
        const itemRange = firstItem.props[0] || firstItem.valueRange;
        firstItem.range.start = itemRange.start;
        break;
      }
    }

    this.items = [firstItem];
    const ec = grabCollectionEndComments(firstItem);
    if (ec) Array.prototype.push.apply(this.items, ec);
  }

  get includesTrailingLines() {
    return this.items.length > 0;
  }
  /**
   * @param {ParseContext} context
   * @param {number} start - Index of first character
   * @returns {number} - Index of the character after this
   */


  parse(context, start) {
    this.context = context;
    const {
      parseNode,
      src
    } = context; // It's easier to recalculate lineStart here rather than tracking down the
    // last context from which to read it -- eemeli/yaml#2

    let lineStart = Node.startOfLine(src, start);
    const firstItem = this.items[0]; // First-item context needs to be correct for later comment handling
    // -- eemeli/yaml#17

    firstItem.context.parent = this;
    this.valueRange = Range.copy(firstItem.valueRange);
    const indent = firstItem.range.start - firstItem.context.lineStart;
    let offset = start;
    offset = Node.normalizeOffset(src, offset);
    let ch = src[offset];
    let atLineStart = Node.endOfWhiteSpace(src, lineStart) === offset;
    let prevIncludesTrailingLines = false;

    while (ch) {
      while (ch === '\n' || ch === '#') {
        if (atLineStart && ch === '\n' && !prevIncludesTrailingLines) {
          const blankLine = new BlankLine();
          offset = blankLine.parse({
            src
          }, offset);
          this.valueRange.end = offset;

          if (offset >= src.length) {
            ch = null;
            break;
          }

          this.items.push(blankLine);
          offset -= 1; // blankLine.parse() consumes terminal newline
        } else if (ch === '#') {
          if (offset < lineStart + indent && !Collection.nextContentHasIndent(src, offset, indent)) {
            return offset;
          }

          const comment = new Comment();
          offset = comment.parse({
            indent,
            lineStart,
            src
          }, offset);
          this.items.push(comment);
          this.valueRange.end = offset;

          if (offset >= src.length) {
            ch = null;
            break;
          }
        }

        lineStart = offset + 1;
        offset = Node.endOfIndent(src, lineStart);

        if (Node.atBlank(src, offset)) {
          const wsEnd = Node.endOfWhiteSpace(src, offset);
          const next = src[wsEnd];

          if (!next || next === '\n' || next === '#') {
            offset = wsEnd;
          }
        }

        ch = src[offset];
        atLineStart = true;
      }

      if (!ch) {
        break;
      }

      if (offset !== lineStart + indent && (atLineStart || ch !== ':')) {
        if (offset < lineStart + indent) {
          if (lineStart > start) offset = lineStart;
          break;
        } else if (!this.error) {
          const msg = 'All collection items must start at the same column';
          this.error = new YAMLSyntaxError(this, msg);
        }
      }

      if (firstItem.type === Type.SEQ_ITEM) {
        if (ch !== '-') {
          if (lineStart > start) offset = lineStart;
          break;
        }
      } else if (ch === '-' && !this.error) {
        // map key may start with -, as long as it's followed by a non-whitespace char
        const next = src[offset + 1];

        if (!next || next === '\n' || next === '\t' || next === ' ') {
          const msg = 'A collection cannot be both a mapping and a sequence';
          this.error = new YAMLSyntaxError(this, msg);
        }
      }

      const node = parseNode({
        atLineStart,
        inCollection: true,
        indent,
        lineStart,
        parent: this
      }, offset);
      if (!node) return offset; // at next document start

      this.items.push(node);
      this.valueRange.end = node.valueRange.end;
      offset = Node.normalizeOffset(src, node.range.end);
      ch = src[offset];
      atLineStart = false;
      prevIncludesTrailingLines = node.includesTrailingLines; // Need to reset lineStart and atLineStart here if preceding node's range
      // has advanced to check the current line's indentation level
      // -- eemeli/yaml#10 & eemeli/yaml#38

      if (ch) {
        let ls = offset - 1;
        let prev = src[ls];

        while (prev === ' ' || prev === '\t') prev = src[--ls];

        if (prev === '\n') {
          lineStart = ls + 1;
          atLineStart = true;
        }
      }

      const ec = grabCollectionEndComments(node);
      if (ec) Array.prototype.push.apply(this.items, ec);
    }

    return offset;
  }

  setOrigRanges(cr, offset) {
    offset = super.setOrigRanges(cr, offset);
    this.items.forEach(node => {
      offset = node.setOrigRanges(cr, offset);
    });
    return offset;
  }

  toString() {
    const {
      context: {
        src
      },
      items,
      range,
      value
    } = this;
    if (value != null) return value;
    let str = src.slice(range.start, items[0].range.start) + String(items[0]);

    for (let i = 1; i < items.length; ++i) {
      const item = items[i];
      const {
        atLineStart,
        indent
      } = item.context;
      if (atLineStart) for (let i = 0; i < indent; ++i) str += ' ';
      str += String(item);
    }

    return Node.addStringTerminator(src, range.end, str);
  }

}

class Directive extends Node {
  constructor() {
    super(Type.DIRECTIVE);
    this.name = null;
  }

  get parameters() {
    const raw = this.rawValue;
    return raw ? raw.trim().split(/[ \t]+/) : [];
  }

  parseName(start) {
    const {
      src
    } = this.context;
    let offset = start;
    let ch = src[offset];

    while (ch && ch !== '\n' && ch !== '\t' && ch !== ' ') ch = src[offset += 1];

    this.name = src.slice(start, offset);
    return offset;
  }

  parseParameters(start) {
    const {
      src
    } = this.context;
    let offset = start;
    let ch = src[offset];

    while (ch && ch !== '\n' && ch !== '#') ch = src[offset += 1];

    this.valueRange = new Range(start, offset);
    return offset;
  }

  parse(context, start) {
    this.context = context;
    let offset = this.parseName(start + 1);
    offset = this.parseParameters(offset);
    offset = this.parseComment(offset);
    this.range = new Range(start, offset);
    return offset;
  }

}

class Document extends Node {
  static startCommentOrEndBlankLine(src, start) {
    const offset = Node.endOfWhiteSpace(src, start);
    const ch = src[offset];
    return ch === '#' || ch === '\n' ? offset : start;
  }

  constructor() {
    super(Type.DOCUMENT);
    this.directives = null;
    this.contents = null;
    this.directivesEndMarker = null;
    this.documentEndMarker = null;
  }

  parseDirectives(start) {
    const {
      src
    } = this.context;
    this.directives = [];
    let atLineStart = true;
    let hasDirectives = false;
    let offset = start;

    while (!Node.atDocumentBoundary(src, offset, Char.DIRECTIVES_END)) {
      offset = Document.startCommentOrEndBlankLine(src, offset);

      switch (src[offset]) {
        case '\n':
          if (atLineStart) {
            const blankLine = new BlankLine();
            offset = blankLine.parse({
              src
            }, offset);

            if (offset < src.length) {
              this.directives.push(blankLine);
            }
          } else {
            offset += 1;
            atLineStart = true;
          }

          break;

        case '#':
          {
            const comment = new Comment();
            offset = comment.parse({
              src
            }, offset);
            this.directives.push(comment);
            atLineStart = false;
          }
          break;

        case '%':
          {
            const directive = new Directive();
            offset = directive.parse({
              parent: this,
              src
            }, offset);
            this.directives.push(directive);
            hasDirectives = true;
            atLineStart = false;
          }
          break;

        default:
          if (hasDirectives) {
            this.error = new YAMLSemanticError(this, 'Missing directives-end indicator line');
          } else if (this.directives.length > 0) {
            this.contents = this.directives;
            this.directives = [];
          }

          return offset;
      }
    }

    if (src[offset]) {
      this.directivesEndMarker = new Range(offset, offset + 3);
      return offset + 3;
    }

    if (hasDirectives) {
      this.error = new YAMLSemanticError(this, 'Missing directives-end indicator line');
    } else if (this.directives.length > 0) {
      this.contents = this.directives;
      this.directives = [];
    }

    return offset;
  }

  parseContents(start) {
    const {
      parseNode,
      src
    } = this.context;
    if (!this.contents) this.contents = [];
    let lineStart = start;

    while (src[lineStart - 1] === '-') lineStart -= 1;

    let offset = Node.endOfWhiteSpace(src, start);
    let atLineStart = lineStart === start;
    this.valueRange = new Range(offset);

    while (!Node.atDocumentBoundary(src, offset, Char.DOCUMENT_END)) {
      switch (src[offset]) {
        case '\n':
          if (atLineStart) {
            const blankLine = new BlankLine();
            offset = blankLine.parse({
              src
            }, offset);

            if (offset < src.length) {
              this.contents.push(blankLine);
            }
          } else {
            offset += 1;
            atLineStart = true;
          }

          lineStart = offset;
          break;

        case '#':
          {
            const comment = new Comment();
            offset = comment.parse({
              src
            }, offset);
            this.contents.push(comment);
            atLineStart = false;
          }
          break;

        default:
          {
            const iEnd = Node.endOfIndent(src, offset);
            const context = {
              atLineStart,
              indent: -1,
              inFlow: false,
              inCollection: false,
              lineStart,
              parent: this
            };
            const node = parseNode(context, iEnd);
            if (!node) return this.valueRange.end = iEnd; // at next document start

            this.contents.push(node);
            offset = node.range.end;
            atLineStart = false;
            const ec = grabCollectionEndComments(node);
            if (ec) Array.prototype.push.apply(this.contents, ec);
          }
      }

      offset = Document.startCommentOrEndBlankLine(src, offset);
    }

    this.valueRange.end = offset;

    if (src[offset]) {
      this.documentEndMarker = new Range(offset, offset + 3);
      offset += 3;

      if (src[offset]) {
        offset = Node.endOfWhiteSpace(src, offset);

        if (src[offset] === '#') {
          const comment = new Comment();
          offset = comment.parse({
            src
          }, offset);
          this.contents.push(comment);
        }

        switch (src[offset]) {
          case '\n':
            offset += 1;
            break;

          case undefined:
            break;

          default:
            this.error = new YAMLSyntaxError(this, 'Document end marker line cannot have a non-comment suffix');
        }
      }
    }

    return offset;
  }
  /**
   * @param {ParseContext} context
   * @param {number} start - Index of first character
   * @returns {number} - Index of the character after this
   */


  parse(context, start) {
    context.root = this;
    this.context = context;
    const {
      src
    } = context;
    let offset = src.charCodeAt(start) === 0xfeff ? start + 1 : start; // skip BOM

    offset = this.parseDirectives(offset);
    offset = this.parseContents(offset);
    return offset;
  }

  setOrigRanges(cr, offset) {
    offset = super.setOrigRanges(cr, offset);
    this.directives.forEach(node => {
      offset = node.setOrigRanges(cr, offset);
    });
    if (this.directivesEndMarker) offset = this.directivesEndMarker.setOrigRange(cr, offset);
    this.contents.forEach(node => {
      offset = node.setOrigRanges(cr, offset);
    });
    if (this.documentEndMarker) offset = this.documentEndMarker.setOrigRange(cr, offset);
    return offset;
  }

  toString() {
    const {
      contents,
      directives,
      value
    } = this;
    if (value != null) return value;
    let str = directives.join('');

    if (contents.length > 0) {
      if (directives.length > 0 || contents[0].type === Type.COMMENT) str += '---\n';
      str += contents.join('');
    }

    if (str[str.length - 1] !== '\n') str += '\n';
    return str;
  }

}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

class Alias extends Node {
  /**
   * Parses an *alias from the source
   *
   * @param {ParseContext} context
   * @param {number} start - Index of first character
   * @returns {number} - Index of the character after this scalar
   */
  parse(context, start) {
    this.context = context;
    const {
      src
    } = context;
    let offset = Node.endOfIdentifier(src, start + 1);
    this.valueRange = new Range(start + 1, offset);
    offset = Node.endOfWhiteSpace(src, offset);
    offset = this.parseComment(offset);
    return offset;
  }

}

const Chomp = {
  CLIP: 'CLIP',
  KEEP: 'KEEP',
  STRIP: 'STRIP'
};
class BlockValue extends Node {
  constructor(type, props) {
    super(type, props);
    this.blockIndent = null;
    this.chomping = Chomp.CLIP;
    this.header = null;
  }

  get includesTrailingLines() {
    return this.chomping === Chomp.KEEP;
  }

  get strValue() {
    if (!this.valueRange || !this.context) return null;
    let {
      start,
      end
    } = this.valueRange;
    const {
      indent,
      src
    } = this.context;
    if (this.valueRange.isEmpty()) return '';
    let lastNewLine = null;
    let ch = src[end - 1];

    while (ch === '\n' || ch === '\t' || ch === ' ') {
      end -= 1;

      if (end <= start) {
        if (this.chomping === Chomp.KEEP) break;else return ''; // probably never happens
      }

      if (ch === '\n') lastNewLine = end;
      ch = src[end - 1];
    }

    let keepStart = end + 1;

    if (lastNewLine) {
      if (this.chomping === Chomp.KEEP) {
        keepStart = lastNewLine;
        end = this.valueRange.end;
      } else {
        end = lastNewLine;
      }
    }

    const bi = indent + this.blockIndent;
    const folded = this.type === Type.BLOCK_FOLDED;
    let atStart = true;
    let str = '';
    let sep = '';
    let prevMoreIndented = false;

    for (let i = start; i < end; ++i) {
      for (let j = 0; j < bi; ++j) {
        if (src[i] !== ' ') break;
        i += 1;
      }

      const ch = src[i];

      if (ch === '\n') {
        if (sep === '\n') str += '\n';else sep = '\n';
      } else {
        const lineEnd = Node.endOfLine(src, i);
        const line = src.slice(i, lineEnd);
        i = lineEnd;

        if (folded && (ch === ' ' || ch === '\t') && i < keepStart) {
          if (sep === ' ') sep = '\n';else if (!prevMoreIndented && !atStart && sep === '\n') sep = '\n\n';
          str += sep + line; //+ ((lineEnd < end && src[lineEnd]) || '')

          sep = lineEnd < end && src[lineEnd] || '';
          prevMoreIndented = true;
        } else {
          str += sep + line;
          sep = folded && i < keepStart ? ' ' : '\n';
          prevMoreIndented = false;
        }

        if (atStart && line !== '') atStart = false;
      }
    }

    return this.chomping === Chomp.STRIP ? str : str + '\n';
  }

  parseBlockHeader(start) {
    const {
      src
    } = this.context;
    let offset = start + 1;
    let bi = '';

    while (true) {
      const ch = src[offset];

      switch (ch) {
        case '-':
          this.chomping = Chomp.STRIP;
          break;

        case '+':
          this.chomping = Chomp.KEEP;
          break;

        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          bi += ch;
          break;

        default:
          this.blockIndent = Number(bi) || null;
          this.header = new Range(start, offset);
          return offset;
      }

      offset += 1;
    }
  }

  parseBlockValue(start) {
    const {
      indent,
      src
    } = this.context;
    const explicit = !!this.blockIndent;
    let offset = start;
    let valueEnd = start;
    let minBlockIndent = 1;

    for (let ch = src[offset]; ch === '\n'; ch = src[offset]) {
      offset += 1;
      if (Node.atDocumentBoundary(src, offset)) break;
      const end = Node.endOfBlockIndent(src, indent, offset); // should not include tab?

      if (end === null) break;
      const ch = src[end];
      const lineIndent = end - (offset + indent);

      if (!this.blockIndent) {
        // no explicit block indent, none yet detected
        if (src[end] !== '\n') {
          // first line with non-whitespace content
          if (lineIndent < minBlockIndent) {
            const msg = 'Block scalars with more-indented leading empty lines must use an explicit indentation indicator';
            this.error = new YAMLSemanticError(this, msg);
          }

          this.blockIndent = lineIndent;
        } else if (lineIndent > minBlockIndent) {
          // empty line with more whitespace
          minBlockIndent = lineIndent;
        }
      } else if (ch && ch !== '\n' && lineIndent < this.blockIndent) {
        if (src[end] === '#') break;

        if (!this.error) {
          const src = explicit ? 'explicit indentation indicator' : 'first line';
          const msg = "Block scalars must not be less indented than their ".concat(src);
          this.error = new YAMLSemanticError(this, msg);
        }
      }

      if (src[end] === '\n') {
        offset = end;
      } else {
        offset = valueEnd = Node.endOfLine(src, end);
      }
    }

    if (this.chomping !== Chomp.KEEP) {
      offset = src[valueEnd] ? valueEnd + 1 : valueEnd;
    }

    this.valueRange = new Range(start + 1, offset);
    return offset;
  }
  /**
   * Parses a block value from the source
   *
   * Accepted forms are:
   * ```
   * BS
   * block
   * lines
   *
   * BS #comment
   * block
   * lines
   * ```
   * where the block style BS matches the regexp `[|>][-+1-9]*` and block lines
   * are empty or have an indent level greater than `indent`.
   *
   * @param {ParseContext} context
   * @param {number} start - Index of first character
   * @returns {number} - Index of the character after this block
   */


  parse(context, start) {
    this.context = context;
    const {
      src
    } = context;
    let offset = this.parseBlockHeader(start);
    offset = Node.endOfWhiteSpace(src, offset);
    offset = this.parseComment(offset);
    offset = this.parseBlockValue(offset);
    return offset;
  }

  setOrigRanges(cr, offset) {
    offset = super.setOrigRanges(cr, offset);
    return this.header ? this.header.setOrigRange(cr, offset) : offset;
  }

}

class FlowCollection extends Node {
  constructor(type, props) {
    super(type, props);
    this.items = null;
  }

  prevNodeIsJsonLike(idx = this.items.length) {
    const node = this.items[idx - 1];
    return !!node && (node.jsonLike || node.type === Type.COMMENT && this.prevNodeIsJsonLike(idx - 1));
  }
  /**
   * @param {ParseContext} context
   * @param {number} start - Index of first character
   * @returns {number} - Index of the character after this
   */


  parse(context, start) {
    this.context = context;
    const {
      parseNode,
      src
    } = context;
    let {
      indent,
      lineStart
    } = context;
    let char = src[start]; // { or [

    this.items = [{
      char,
      offset: start
    }];
    let offset = Node.endOfWhiteSpace(src, start + 1);
    char = src[offset];

    while (char && char !== ']' && char !== '}') {
      switch (char) {
        case '\n':
          {
            lineStart = offset + 1;
            const wsEnd = Node.endOfWhiteSpace(src, lineStart);

            if (src[wsEnd] === '\n') {
              const blankLine = new BlankLine();
              lineStart = blankLine.parse({
                src
              }, lineStart);
              this.items.push(blankLine);
            }

            offset = Node.endOfIndent(src, lineStart);

            if (offset <= lineStart + indent) {
              char = src[offset];

              if (offset < lineStart + indent || char !== ']' && char !== '}') {
                const msg = 'Insufficient indentation in flow collection';
                this.error = new YAMLSemanticError(this, msg);
              }
            }
          }
          break;

        case ',':
          {
            this.items.push({
              char,
              offset
            });
            offset += 1;
          }
          break;

        case '#':
          {
            const comment = new Comment();
            offset = comment.parse({
              src
            }, offset);
            this.items.push(comment);
          }
          break;

        case '?':
        case ':':
          {
            const next = src[offset + 1];

            if (next === '\n' || next === '\t' || next === ' ' || next === ',' || // in-flow : after JSON-like key does not need to be followed by whitespace
            char === ':' && this.prevNodeIsJsonLike()) {
              this.items.push({
                char,
                offset
              });
              offset += 1;
              break;
            }
          }
        // fallthrough

        default:
          {
            const node = parseNode({
              atLineStart: false,
              inCollection: false,
              inFlow: true,
              indent: -1,
              lineStart,
              parent: this
            }, offset);

            if (!node) {
              // at next document start
              this.valueRange = new Range(start, offset);
              return offset;
            }

            this.items.push(node);
            offset = Node.normalizeOffset(src, node.range.end);
          }
      }

      offset = Node.endOfWhiteSpace(src, offset);
      char = src[offset];
    }

    this.valueRange = new Range(start, offset + 1);

    if (char) {
      this.items.push({
        char,
        offset
      });
      offset = Node.endOfWhiteSpace(src, offset + 1);
      offset = this.parseComment(offset);
    }

    return offset;
  }

  setOrigRanges(cr, offset) {
    offset = super.setOrigRanges(cr, offset);
    this.items.forEach(node => {
      if (node instanceof Node) {
        offset = node.setOrigRanges(cr, offset);
      } else if (cr.length === 0) {
        node.origOffset = node.offset;
      } else {
        let i = offset;

        while (i < cr.length) {
          if (cr[i] > node.offset) break;else ++i;
        }

        node.origOffset = node.offset + i;
        offset = i;
      }
    });
    return offset;
  }

  toString() {
    const {
      context: {
        src
      },
      items,
      range,
      value
    } = this;
    if (value != null) return value;
    const nodes = items.filter(item => item instanceof Node);
    let str = '';
    let prevEnd = range.start;
    nodes.forEach(node => {
      const prefix = src.slice(prevEnd, node.range.start);
      prevEnd = node.range.end;
      str += prefix + String(node);

      if (str[str.length - 1] === '\n' && src[prevEnd - 1] !== '\n' && src[prevEnd] === '\n') {
        // Comment range does not include the terminal newline, but its
        // stringified value does. Without this fix, newlines at comment ends
        // get duplicated.
        prevEnd += 1;
      }
    });
    str += src.slice(prevEnd, range.end);
    return Node.addStringTerminator(src, range.end, str);
  }

}

class PlainValue extends Node {
  static endOfLine(src, start, inFlow) {
    let ch = src[start];
    let offset = start;

    while (ch && ch !== '\n') {
      if (inFlow && (ch === '[' || ch === ']' || ch === '{' || ch === '}' || ch === ',')) break;
      const next = src[offset + 1];
      if (ch === ':' && (!next || next === '\n' || next === '\t' || next === ' ' || inFlow && next === ',')) break;
      if ((ch === ' ' || ch === '\t') && next === '#') break;
      offset += 1;
      ch = next;
    }

    return offset;
  }

  get strValue() {
    if (!this.valueRange || !this.context) return null;
    let {
      start,
      end
    } = this.valueRange;
    const {
      src
    } = this.context;
    let ch = src[end - 1];

    while (start < end && (ch === '\n' || ch === '\t' || ch === ' ')) ch = src[--end - 1];

    let str = '';

    for (let i = start; i < end; ++i) {
      const ch = src[i];

      if (ch === '\n') {
        const {
          fold,
          offset
        } = Node.foldNewline(src, i, -1);
        str += fold;
        i = offset;
      } else if (ch === ' ' || ch === '\t') {
        // trim trailing whitespace
        const wsStart = i;
        let next = src[i + 1];

        while (i < end && (next === ' ' || next === '\t')) {
          i += 1;
          next = src[i + 1];
        }

        if (next !== '\n') str += i > wsStart ? src.slice(wsStart, i + 1) : ch;
      } else {
        str += ch;
      }
    }

    const ch0 = src[start];

    switch (ch0) {
      case '\t':
        {
          const msg = 'Plain value cannot start with a tab character';
          const errors = [new YAMLSemanticError(this, msg)];
          return {
            errors,
            str
          };
        }

      case '@':
      case '`':
        {
          const msg = "Plain value cannot start with reserved character ".concat(ch0);
          const errors = [new YAMLSemanticError(this, msg)];
          return {
            errors,
            str
          };
        }

      default:
        return str;
    }
  }

  parseBlockValue(start) {
    const {
      indent,
      inFlow,
      src
    } = this.context;
    let offset = start;
    let valueEnd = start;

    for (let ch = src[offset]; ch === '\n'; ch = src[offset]) {
      if (Node.atDocumentBoundary(src, offset + 1)) break;
      const end = Node.endOfBlockIndent(src, indent, offset + 1);
      if (end === null || src[end] === '#') break;

      if (src[end] === '\n') {
        offset = end;
      } else {
        valueEnd = PlainValue.endOfLine(src, end, inFlow);
        offset = valueEnd;
      }
    }

    if (this.valueRange.isEmpty()) this.valueRange.start = start;
    this.valueRange.end = valueEnd;
    return valueEnd;
  }
  /**
   * Parses a plain value from the source
   *
   * Accepted forms are:
   * ```
   * #comment
   *
   * first line
   *
   * first line #comment
   *
   * first line
   * block
   * lines
   *
   * #comment
   * block
   * lines
   * ```
   * where block lines are empty or have an indent level greater than `indent`.
   *
   * @param {ParseContext} context
   * @param {number} start - Index of first character
   * @returns {number} - Index of the character after this scalar, may be `\n`
   */


  parse(context, start) {
    this.context = context;
    const {
      inFlow,
      src
    } = context;
    let offset = start;
    const ch = src[offset];

    if (ch && ch !== '#' && ch !== '\n') {
      offset = PlainValue.endOfLine(src, start, inFlow);
    }

    this.valueRange = new Range(start, offset);
    offset = Node.endOfWhiteSpace(src, offset);
    offset = this.parseComment(offset);

    if (!this.hasComment || this.valueRange.isEmpty()) {
      offset = this.parseBlockValue(offset);
    }

    return offset;
  }

}

class QuoteDouble extends Node {
  static endOfQuote(src, offset) {
    let ch = src[offset];

    while (ch && ch !== '"') {
      offset += ch === '\\' ? 2 : 1;
      ch = src[offset];
    }

    return offset + 1;
  }
  /**
   * @returns {string | { str: string, errors: YAMLSyntaxError[] }}
   */


  get strValue() {
    if (!this.valueRange || !this.context) return null;
    const errors = [];
    const {
      start,
      end
    } = this.valueRange;
    const {
      indent,
      src
    } = this.context;
    if (src[end - 1] !== '"') errors.push(new YAMLSyntaxError(this, 'Missing closing "quote')); // Using String#replace is too painful with escaped newlines preceded by
    // escaped backslashes; also, this should be faster.

    let str = '';

    for (let i = start + 1; i < end - 1; ++i) {
      const ch = src[i];

      if (ch === '\n') {
        if (Node.atDocumentBoundary(src, i + 1)) errors.push(new YAMLSemanticError(this, 'Document boundary indicators are not allowed within string values'));
        const {
          fold,
          offset,
          error
        } = Node.foldNewline(src, i, indent);
        str += fold;
        i = offset;
        if (error) errors.push(new YAMLSemanticError(this, 'Multi-line double-quoted string needs to be sufficiently indented'));
      } else if (ch === '\\') {
        i += 1;

        switch (src[i]) {
          case '0':
            str += '\0';
            break;
          // null character

          case 'a':
            str += '\x07';
            break;
          // bell character

          case 'b':
            str += '\b';
            break;
          // backspace

          case 'e':
            str += '\x1b';
            break;
          // escape character

          case 'f':
            str += '\f';
            break;
          // form feed

          case 'n':
            str += '\n';
            break;
          // line feed

          case 'r':
            str += '\r';
            break;
          // carriage return

          case 't':
            str += '\t';
            break;
          // horizontal tab

          case 'v':
            str += '\v';
            break;
          // vertical tab

          case 'N':
            str += '\u0085';
            break;
          // Unicode next line

          case '_':
            str += '\u00a0';
            break;
          // Unicode non-breaking space

          case 'L':
            str += '\u2028';
            break;
          // Unicode line separator

          case 'P':
            str += '\u2029';
            break;
          // Unicode paragraph separator

          case ' ':
            str += ' ';
            break;

          case '"':
            str += '"';
            break;

          case '/':
            str += '/';
            break;

          case '\\':
            str += '\\';
            break;

          case '\t':
            str += '\t';
            break;

          case 'x':
            str += this.parseCharCode(i + 1, 2, errors);
            i += 2;
            break;

          case 'u':
            str += this.parseCharCode(i + 1, 4, errors);
            i += 4;
            break;

          case 'U':
            str += this.parseCharCode(i + 1, 8, errors);
            i += 8;
            break;

          case '\n':
            // skip escaped newlines, but still trim the following line
            while (src[i + 1] === ' ' || src[i + 1] === '\t') i += 1;

            break;

          default:
            errors.push(new YAMLSyntaxError(this, "Invalid escape sequence ".concat(src.substr(i - 1, 2))));
            str += '\\' + src[i];
        }
      } else if (ch === ' ' || ch === '\t') {
        // trim trailing whitespace
        const wsStart = i;
        let next = src[i + 1];

        while (next === ' ' || next === '\t') {
          i += 1;
          next = src[i + 1];
        }

        if (next !== '\n') str += i > wsStart ? src.slice(wsStart, i + 1) : ch;
      } else {
        str += ch;
      }
    }

    return errors.length > 0 ? {
      errors,
      str
    } : str;
  }

  parseCharCode(offset, length, errors) {
    const {
      src
    } = this.context;
    const cc = src.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;

    if (isNaN(code)) {
      errors.push(new YAMLSyntaxError(this, "Invalid escape sequence ".concat(src.substr(offset - 2, length + 2))));
      return src.substr(offset - 2, length + 2);
    }

    return String.fromCodePoint(code);
  }
  /**
   * Parses a "double quoted" value from the source
   *
   * @param {ParseContext} context
   * @param {number} start - Index of first character
   * @returns {number} - Index of the character after this scalar
   */


  parse(context, start) {
    this.context = context;
    const {
      src
    } = context;
    let offset = QuoteDouble.endOfQuote(src, start + 1);
    this.valueRange = new Range(start, offset);
    offset = Node.endOfWhiteSpace(src, offset);
    offset = this.parseComment(offset);
    return offset;
  }

}

class QuoteSingle extends Node {
  static endOfQuote(src, offset) {
    let ch = src[offset];

    while (ch) {
      if (ch === "'") {
        if (src[offset + 1] !== "'") break;
        ch = src[offset += 2];
      } else {
        ch = src[offset += 1];
      }
    }

    return offset + 1;
  }
  /**
   * @returns {string | { str: string, errors: YAMLSyntaxError[] }}
   */


  get strValue() {
    if (!this.valueRange || !this.context) return null;
    const errors = [];
    const {
      start,
      end
    } = this.valueRange;
    const {
      indent,
      src
    } = this.context;
    if (src[end - 1] !== "'") errors.push(new YAMLSyntaxError(this, "Missing closing 'quote"));
    let str = '';

    for (let i = start + 1; i < end - 1; ++i) {
      const ch = src[i];

      if (ch === '\n') {
        if (Node.atDocumentBoundary(src, i + 1)) errors.push(new YAMLSemanticError(this, 'Document boundary indicators are not allowed within string values'));
        const {
          fold,
          offset,
          error
        } = Node.foldNewline(src, i, indent);
        str += fold;
        i = offset;
        if (error) errors.push(new YAMLSemanticError(this, 'Multi-line single-quoted string needs to be sufficiently indented'));
      } else if (ch === "'") {
        str += ch;
        i += 1;
        if (src[i] !== "'") errors.push(new YAMLSyntaxError(this, 'Unescaped single quote? This should not happen.'));
      } else if (ch === ' ' || ch === '\t') {
        // trim trailing whitespace
        const wsStart = i;
        let next = src[i + 1];

        while (next === ' ' || next === '\t') {
          i += 1;
          next = src[i + 1];
        }

        if (next !== '\n') str += i > wsStart ? src.slice(wsStart, i + 1) : ch;
      } else {
        str += ch;
      }
    }

    return errors.length > 0 ? {
      errors,
      str
    } : str;
  }
  /**
   * Parses a 'single quoted' value from the source
   *
   * @param {ParseContext} context
   * @param {number} start - Index of first character
   * @returns {number} - Index of the character after this scalar
   */


  parse(context, start) {
    this.context = context;
    const {
      src
    } = context;
    let offset = QuoteSingle.endOfQuote(src, start + 1);
    this.valueRange = new Range(start, offset);
    offset = Node.endOfWhiteSpace(src, offset);
    offset = this.parseComment(offset);
    return offset;
  }

}

function createNewNode(type, props) {
  switch (type) {
    case Type.ALIAS:
      return new Alias(type, props);

    case Type.BLOCK_FOLDED:
    case Type.BLOCK_LITERAL:
      return new BlockValue(type, props);

    case Type.FLOW_MAP:
    case Type.FLOW_SEQ:
      return new FlowCollection(type, props);

    case Type.MAP_KEY:
    case Type.MAP_VALUE:
    case Type.SEQ_ITEM:
      return new CollectionItem(type, props);

    case Type.COMMENT:
    case Type.PLAIN:
      return new PlainValue(type, props);

    case Type.QUOTE_DOUBLE:
      return new QuoteDouble(type, props);

    case Type.QUOTE_SINGLE:
      return new QuoteSingle(type, props);

    /* istanbul ignore next */

    default:
      return null;
    // should never happen
  }
}
/**
 * @param {boolean} atLineStart - Node starts at beginning of line
 * @param {boolean} inFlow - true if currently in a flow context
 * @param {boolean} inCollection - true if currently in a collection context
 * @param {number} indent - Current level of indentation
 * @param {number} lineStart - Start of the current line
 * @param {Node} parent - The parent of the node
 * @param {string} src - Source of the YAML document
 */


class ParseContext {
  static parseType(src, offset, inFlow) {
    switch (src[offset]) {
      case '*':
        return Type.ALIAS;

      case '>':
        return Type.BLOCK_FOLDED;

      case '|':
        return Type.BLOCK_LITERAL;

      case '{':
        return Type.FLOW_MAP;

      case '[':
        return Type.FLOW_SEQ;

      case '?':
        return !inFlow && Node.atBlank(src, offset + 1, true) ? Type.MAP_KEY : Type.PLAIN;

      case ':':
        return !inFlow && Node.atBlank(src, offset + 1, true) ? Type.MAP_VALUE : Type.PLAIN;

      case '-':
        return !inFlow && Node.atBlank(src, offset + 1, true) ? Type.SEQ_ITEM : Type.PLAIN;

      case '"':
        return Type.QUOTE_DOUBLE;

      case "'":
        return Type.QUOTE_SINGLE;

      default:
        return Type.PLAIN;
    }
  }

  constructor(orig = {}, {
    atLineStart,
    inCollection,
    inFlow,
    indent,
    lineStart,
    parent
  } = {}) {
    _defineProperty(this, "parseNode", (overlay, start) => {
      if (Node.atDocumentBoundary(this.src, start)) return null;
      const context = new ParseContext(this, overlay);
      const {
        props,
        type,
        valueStart
      } = context.parseProps(start);
      const node = createNewNode(type, props);
      let offset = node.parse(context, valueStart);
      node.range = new Range(start, offset);
      /* istanbul ignore if */

      if (offset <= start) {
        // This should never happen, but if it does, let's make sure to at least
        // step one character forward to avoid a busy loop.
        node.error = new Error("Node#parse consumed no characters");
        node.error.parseEnd = offset;
        node.error.source = node;
        node.range.end = start + 1;
      }

      if (context.nodeStartsCollection(node)) {
        if (!node.error && !context.atLineStart && context.parent.type === Type.DOCUMENT) {
          node.error = new YAMLSyntaxError(node, 'Block collection must not have preceding content here (e.g. directives-end indicator)');
        }

        const collection = new Collection(node);
        offset = collection.parse(new ParseContext(context), offset);
        collection.range = new Range(start, offset);
        return collection;
      }

      return node;
    });

    this.atLineStart = atLineStart != null ? atLineStart : orig.atLineStart || false;
    this.inCollection = inCollection != null ? inCollection : orig.inCollection || false;
    this.inFlow = inFlow != null ? inFlow : orig.inFlow || false;
    this.indent = indent != null ? indent : orig.indent;
    this.lineStart = lineStart != null ? lineStart : orig.lineStart;
    this.parent = parent != null ? parent : orig.parent || {};
    this.root = orig.root;
    this.src = orig.src;
  }

  nodeStartsCollection(node) {
    const {
      inCollection,
      inFlow,
      src
    } = this;
    if (inCollection || inFlow) return false;
    if (node instanceof CollectionItem) return true; // check for implicit key

    let offset = node.range.end;
    if (src[offset] === '\n' || src[offset - 1] === '\n') return false;
    offset = Node.endOfWhiteSpace(src, offset);
    return src[offset] === ':';
  } // Anchor and tag are before type, which determines the node implementation
  // class; hence this intermediate step.


  parseProps(offset) {
    const {
      inFlow,
      parent,
      src
    } = this;
    const props = [];
    let lineHasProps = false;
    offset = this.atLineStart ? Node.endOfIndent(src, offset) : Node.endOfWhiteSpace(src, offset);
    let ch = src[offset];

    while (ch === Char.ANCHOR || ch === Char.COMMENT || ch === Char.TAG || ch === '\n') {
      if (ch === '\n') {
        const lineStart = offset + 1;
        const inEnd = Node.endOfIndent(src, lineStart);
        const indentDiff = inEnd - (lineStart + this.indent);
        const noIndicatorAsIndent = parent.type === Type.SEQ_ITEM && parent.context.atLineStart;
        if (!Node.nextNodeIsIndented(src[inEnd], indentDiff, !noIndicatorAsIndent)) break;
        this.atLineStart = true;
        this.lineStart = lineStart;
        lineHasProps = false;
        offset = inEnd;
      } else if (ch === Char.COMMENT) {
        const end = Node.endOfLine(src, offset + 1);
        props.push(new Range(offset, end));
        offset = end;
      } else {
        let end = Node.endOfIdentifier(src, offset + 1);

        if (ch === Char.TAG && src[end] === ',' && /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+,\d\d\d\d(-\d\d){0,2}\/\S/.test(src.slice(offset + 1, end + 13))) {
          // Let's presume we're dealing with a YAML 1.0 domain tag here, rather
          // than an empty but 'foo.bar' private-tagged node in a flow collection
          // followed without whitespace by a plain string starting with a year
          // or date divided by something.
          end = Node.endOfIdentifier(src, end + 5);
        }

        props.push(new Range(offset, end));
        lineHasProps = true;
        offset = Node.endOfWhiteSpace(src, end);
      }

      ch = src[offset];
    } // '- &a : b' has an anchor on an empty node


    if (lineHasProps && ch === ':' && Node.atBlank(src, offset + 1, true)) offset -= 1;
    const type = ParseContext.parseType(src, offset, inFlow);
    return {
      props,
      type,
      valueStart: offset
    };
  }
  /**
   * Parses a node from the source
   * @param {ParseContext} overlay
   * @param {number} start - Index of first non-whitespace character for the node
   * @returns {?Node} - null if at a document boundary
   */


}

function parse(src) {
  const cr = [];

  if (src.indexOf('\r') !== -1) {
    src = src.replace(/\r\n?/g, (match, offset) => {
      if (match.length > 1) cr.push(offset);
      return '\n';
    });
  }

  const documents = [];
  let offset = 0;

  do {
    const doc = new Document();
    const context = new ParseContext({
      src
    });
    offset = doc.parse(context, offset);
    documents.push(doc);
  } while (offset < src.length);

  documents.setOrigRanges = () => {
    if (cr.length === 0) return false;

    for (let i = 1; i < cr.length; ++i) cr[i] -= i;

    let crOffset = 0;

    for (let i = 0; i < documents.length; ++i) {
      crOffset = documents[i].setOrigRanges(cr, crOffset);
    }

    cr.splice(0, cr.length);
    return true;
  };

  documents.toString = () => documents.join('...\n');

  return documents;
}

const binaryOptions = {
  defaultType: Type.BLOCK_LITERAL,
  lineWidth: 76
};
const boolOptions = {
  trueStr: 'true',
  falseStr: 'false'
};
const intOptions = {
  asBigInt: false
};
const nullOptions = {
  nullStr: 'null'
};
const strOptions = {
  defaultType: Type.PLAIN,
  defaultKeyType: Type.PLAIN,
  defaultQuoteSingle: false,
  doubleQuoted: {
    jsonEncoding: false,
    minMultiLineLength: 40
  },
  fold: {
    lineWidth: 80,
    minContentWidth: 20
  }
};

const defaultOptions = {
  anchorPrefix: 'a',
  customTags: null,
  indent: 2,
  indentSeq: true,
  keepCstNodes: false,
  keepNodeTypes: true,
  keepUndefined: false,
  logLevel: 'warn',
  mapAsMap: false,
  maxAliasCount: 100,
  prettyErrors: true,
  simpleKeys: false,
  version: '1.2'
};
const documentOptions = {
  '1.0': {
    schema: 'yaml-1.1',
    merge: true,
    tagPrefixes: [{
      handle: '!',
      prefix: defaultTagPrefix
    }, {
      handle: '!!',
      prefix: 'tag:private.yaml.org,2002:'
    }]
  },
  1.1: {
    schema: 'yaml-1.1',
    merge: true,
    tagPrefixes: [{
      handle: '!',
      prefix: '!'
    }, {
      handle: '!!',
      prefix: defaultTagPrefix
    }]
  },
  1.2: {
    schema: 'core',
    merge: false,
    resolveKnownTags: true,
    tagPrefixes: [{
      handle: '!',
      prefix: '!'
    }, {
      handle: '!!',
      prefix: defaultTagPrefix
    }]
  }
};

function addCommentBefore(str, indent, comment) {
  if (!comment) return str;
  const cc = comment.replace(/[\s\S]^/gm, "$&".concat(indent, "#"));
  return "#".concat(cc, "\n").concat(indent).concat(str);
}
function addComment(str, indent, comment) {
  return !comment ? str : comment.indexOf('\n') === -1 ? "".concat(str, " #").concat(comment) : "".concat(str, "\n") + comment.replace(/^/gm, "".concat(indent || '', "#"));
}

class Node$1 {}

/**
 * Recursively convert any node or its contents to native JavaScript
 *
 * @param value - The input value
 * @param {string|null} arg - If `value` defines a `toJSON()` method, use this
 *   as its first argument
 * @param ctx - Conversion context, originally set in Document#toJS(). If
 *   `{ keep: true }` is not set, output should be suitable for JSON
 *   stringification.
 */
function toJS(value, arg, ctx) {
  if (Array.isArray(value)) return value.map((v, i) => toJS(v, String(i), ctx));

  if (value && typeof value.toJSON === 'function') {
    const anchor = ctx && ctx.anchors && ctx.anchors.get(value);
    if (anchor) ctx.onCreate = res => {
      anchor.res = res;
      delete ctx.onCreate;
    };
    const res = value.toJSON(arg, ctx);
    if (anchor && ctx.onCreate) ctx.onCreate(res);
    return res;
  }

  if (!(ctx && ctx.keep) && typeof value === 'bigint') return Number(value);
  return value;
}

const isScalarValue = value => !value || typeof value !== 'function' && typeof value !== 'object';
class Scalar extends Node$1 {
  constructor(value) {
    super();
    this.value = value;
  }

  toJSON(arg, ctx) {
    return ctx && ctx.keep ? this.value : toJS(this.value, arg, ctx);
  }

  toString() {
    return String(this.value);
  }

}

function findTagObject(value, tagName, tags) {
  if (tagName) {
    const match = tags.filter(t => t.tag === tagName);
    const tagObj = match.find(t => !t.format) || match[0];
    if (!tagObj) throw new Error("Tag ".concat(tagName, " not found"));
    return tagObj;
  }

  return tags.find(t => t.identify && t.identify(value) && !t.format);
}

function createNode(value, tagName, ctx) {
  if (value instanceof Node$1) return value;
  const {
    onAlias,
    onTagObj,
    prevObjects,
    wrapScalars
  } = ctx;
  const {
    map,
    seq,
    tags
  } = ctx.schema;
  if (tagName && tagName.startsWith('!!')) tagName = defaultTagPrefix + tagName.slice(2);
  let tagObj = findTagObject(value, tagName, tags);

  if (!tagObj) {
    if (typeof value.toJSON === 'function') value = value.toJSON();
    if (!value || typeof value !== 'object') return wrapScalars ? new Scalar(value) : value;
    tagObj = value instanceof Map ? map : value[Symbol.iterator] ? seq : map;
  }

  if (onTagObj) {
    onTagObj(tagObj);
    delete ctx.onTagObj;
  } // Detect duplicate references to the same object & use Alias nodes for all
  // after first. The `obj` wrapper allows for circular references to resolve.


  const obj = {
    value: undefined,
    node: undefined
  };

  if (value && typeof value === 'object') {
    const prev = prevObjects.get(value);
    if (prev) return onAlias(prev);
    obj.value = value;
    prevObjects.set(value, obj);
  }

  obj.node = tagObj.createNode ? tagObj.createNode(ctx.schema, value, ctx) : wrapScalars ? new Scalar(value) : value;
  if (tagName && obj.node instanceof Node$1) obj.node.tag = tagName;
  return obj.node;
}

function collectionFromPath(schema, path, value) {
  let v = value;

  for (let i = path.length - 1; i >= 0; --i) {
    const k = path[i];

    if (Number.isInteger(k) && k >= 0) {
      const a = [];
      a[k] = v;
      v = a;
    } else {
      const o = {};
      Object.defineProperty(o, k, {
        value: v,
        writable: true,
        enumerable: true,
        configurable: true
      });
      v = o;
    }
  }

  return createNode(v, null, {
    onAlias() {
      throw new Error('Repeated objects are not supported here');
    },

    prevObjects: new Map(),
    schema,
    wrapScalars: false
  });
} // null, undefined, or an empty non-string iterable (e.g. [])

const isEmptyPath = path => path == null || typeof path === 'object' && path[Symbol.iterator]().next().done;
class Collection$1 extends Node$1 {
  constructor(schema) {
    super();

    _defineProperty(this, "items", []);

    this.schema = schema;
  }

  addIn(path, value) {
    if (isEmptyPath(path)) this.add(value);else {
      const [key, ...rest] = path;
      const node = this.get(key, true);
      if (node instanceof Collection$1) node.addIn(rest, value);else if (node === undefined && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));else throw new Error("Expected YAML collection at ".concat(key, ". Remaining path: ").concat(rest));
    }
  }

  deleteIn([key, ...rest]) {
    if (rest.length === 0) return this.delete(key);
    const node = this.get(key, true);
    if (node instanceof Collection$1) return node.deleteIn(rest);else throw new Error("Expected YAML collection at ".concat(key, ". Remaining path: ").concat(rest));
  }

  getIn([key, ...rest], keepScalar) {
    const node = this.get(key, true);
    if (rest.length === 0) return !keepScalar && node instanceof Scalar ? node.value : node;else return node instanceof Collection$1 ? node.getIn(rest, keepScalar) : undefined;
  }

  hasAllNullValues() {
    return this.items.every(node => {
      if (!node || node.type !== 'PAIR') return false;
      const n = node.value;
      return n == null || n instanceof Scalar && n.value == null && !n.commentBefore && !n.comment && !n.tag;
    });
  }

  hasIn([key, ...rest]) {
    if (rest.length === 0) return this.has(key);
    const node = this.get(key, true);
    return node instanceof Collection$1 ? node.hasIn(rest) : false;
  }

  setIn([key, ...rest], value) {
    if (rest.length === 0) {
      this.set(key, value);
    } else {
      const node = this.get(key, true);
      if (node instanceof Collection$1) node.setIn(rest, value);else if (node === undefined && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));else throw new Error("Expected YAML collection at ".concat(key, ". Remaining path: ").concat(rest));
    }
  }
  /* istanbul ignore next: overridden in implementations */


  toJSON() {
    return null;
  }

  toString(ctx, {
    blockItem,
    flowChars,
    isMap,
    itemIndent
  }, onComment, onChompKeep) {
    const {
      indent,
      indentStep,
      stringify
    } = ctx;
    const inFlow = this.type === Type.FLOW_MAP || this.type === Type.FLOW_SEQ || ctx.inFlow;
    if (inFlow) itemIndent += indentStep;
    const allNullValues = isMap && this.hasAllNullValues();
    ctx = Object.assign({}, ctx, {
      allNullValues,
      indent: itemIndent,
      inFlow,
      type: null
    });
    let chompKeep = false;
    let hasItemWithNewLine = false;
    const nodes = this.items.reduce((nodes, item, i) => {
      let comment;

      if (item) {
        if (!chompKeep && item.spaceBefore) nodes.push({
          type: 'comment',
          str: ''
        });
        if (item.commentBefore) item.commentBefore.match(/^.*$/gm).forEach(line => {
          nodes.push({
            type: 'comment',
            str: "#".concat(line)
          });
        });
        if (item.comment) comment = item.comment;
        if (inFlow && (!chompKeep && item.spaceBefore || item.commentBefore || item.comment || item.key && (item.key.commentBefore || item.key.comment) || item.value && (item.value.commentBefore || item.value.comment))) hasItemWithNewLine = true;
      }

      chompKeep = false;
      let str = stringify(item, ctx, () => comment = null, () => chompKeep = true);
      if (inFlow && !hasItemWithNewLine && str.includes('\n')) hasItemWithNewLine = true;
      if (inFlow && i < this.items.length - 1) str += ',';
      str = addComment(str, itemIndent, comment);
      if (chompKeep && (comment || inFlow)) chompKeep = false;
      nodes.push({
        type: 'item',
        str
      });
      return nodes;
    }, []);
    let str;

    if (nodes.length === 0) {
      str = flowChars.start + flowChars.end;
    } else if (inFlow) {
      const {
        start,
        end
      } = flowChars;
      const strings = nodes.map(n => n.str);

      if (hasItemWithNewLine || strings.reduce((sum, str) => sum + str.length + 2, 2) > Collection$1.maxFlowStringSingleLineLength) {
        str = start;

        for (const s of strings) {
          str += s ? "\n".concat(indentStep).concat(indent).concat(s) : '\n';
        }

        str += "\n".concat(indent).concat(end);
      } else {
        str = "".concat(start, " ").concat(strings.join(' '), " ").concat(end);
      }
    } else {
      const strings = nodes.map(blockItem);
      str = strings.shift();

      for (const s of strings) str += s ? "\n".concat(indent).concat(s) : '\n';
    }

    if (this.comment) {
      str += '\n' + this.comment.replace(/^/gm, "".concat(indent, "#"));
      if (onComment) onComment();
    } else if (chompKeep && onChompKeep) onChompKeep();

    return str;
  }

}

_defineProperty(Collection$1, "maxFlowStringSingleLineLength", 60);

/* global console, process */
function warn(logLevel, warning) {
  if (LogLevel.indexOf(logLevel) >= LogLevel.WARN) {
    if (typeof process !== 'undefined' && process.emitWarning) process.emitWarning(warning);else console.warn(warning);
  }
}

function asItemIndex(key) {
  let idx = key instanceof Scalar ? key.value : key;
  if (idx && typeof idx === 'string') idx = Number(idx);
  return Number.isInteger(idx) && idx >= 0 ? idx : null;
}

class YAMLSeq extends Collection$1 {
  add(value) {
    this.items.push(value);
  }

  delete(key) {
    const idx = asItemIndex(key);
    if (typeof idx !== 'number') return false;
    const del = this.items.splice(idx, 1);
    return del.length > 0;
  }

  get(key, keepScalar) {
    const idx = asItemIndex(key);
    if (typeof idx !== 'number') return undefined;
    const it = this.items[idx];
    return !keepScalar && it instanceof Scalar ? it.value : it;
  }

  has(key) {
    const idx = asItemIndex(key);
    return typeof idx === 'number' && idx < this.items.length;
  }

  set(key, value) {
    const idx = asItemIndex(key);
    if (typeof idx !== 'number') throw new Error("Expected a valid index, not ".concat(key, "."));
    const prev = this.items[idx];
    if (prev instanceof Scalar && isScalarValue(value)) prev.value = value;else this.items[idx] = value;
  }

  toJSON(_, ctx) {
    const seq = [];
    if (ctx && ctx.onCreate) ctx.onCreate(seq);
    let i = 0;

    for (const item of this.items) seq.push(toJS(item, String(i++), ctx));

    return seq;
  }

  toString(ctx, onComment, onChompKeep) {
    if (!ctx) return JSON.stringify(this);
    return super.toString(ctx, {
      blockItem: n => n.type === 'comment' ? n.str : "- ".concat(n.str),
      flowChars: {
        start: '[',
        end: ']'
      },
      isMap: false,
      itemIndent: (ctx.indent || '') + '  '
    }, onComment, onChompKeep);
  }

}

function stringifyKey(key, jsKey, ctx) {
  if (jsKey === null) return '';
  if (typeof jsKey !== 'object') return String(jsKey);

  if (key instanceof Node$1 && ctx && ctx.doc) {
    const strKey = key.toString({
      anchors: Object.create(null),
      doc: ctx.doc,
      indent: '',
      indentStep: ctx.indentStep,
      inFlow: true,
      inStringifyKey: true,
      stringify: ctx.stringify
    });

    if (!ctx.mapKeyWarned) {
      let jsonStr = JSON.stringify(strKey);
      if (jsonStr.length > 40) jsonStr = jsonStr.split('').splice(36, '..."').join('');
      warn(ctx.doc.options.logLevel, "Keys with collection values will be stringified due to JS Object restrictions: ".concat(jsonStr, ". Set mapAsMap: true to use object keys."));
      ctx.mapKeyWarned = true;
    }

    return strKey;
  }

  return JSON.stringify(jsKey);
}

function createPair(key, value, ctx) {
  const k = createNode(key, null, ctx);
  const v = createNode(value, null, ctx);
  return new Pair(k, v);
}
class Pair extends Node$1 {
  constructor(key, value = null) {
    super();
    this.key = key;
    this.value = value;
    this.type = Pair.Type.PAIR;
  }

  get commentBefore() {
    return this.key instanceof Node$1 ? this.key.commentBefore : undefined;
  }

  set commentBefore(cb) {
    if (this.key == null) this.key = new Scalar(null);
    if (this.key instanceof Node$1) this.key.commentBefore = cb;else {
      const msg = 'Pair.commentBefore is an alias for Pair.key.commentBefore. To set it, the key must be a Node.';
      throw new Error(msg);
    }
  }

  addToJSMap(ctx, map) {
    const key = toJS(this.key, '', ctx);

    if (map instanceof Map) {
      const value = toJS(this.value, key, ctx);
      map.set(key, value);
    } else if (map instanceof Set) {
      map.add(key);
    } else {
      const stringKey = stringifyKey(this.key, key, ctx);
      const value = toJS(this.value, stringKey, ctx);
      if (stringKey in map) Object.defineProperty(map, stringKey, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });else map[stringKey] = value;
    }

    return map;
  }

  toJSON(_, ctx) {
    const pair = ctx && ctx.mapAsMap ? new Map() : {};
    return this.addToJSMap(ctx, pair);
  }

  toString(ctx, onComment, onChompKeep) {
    if (!ctx || !ctx.doc) return JSON.stringify(this);
    const {
      indent: indentSize,
      indentSeq,
      simpleKeys
    } = ctx.doc.options;
    let {
      key,
      value
    } = this;
    let keyComment = key instanceof Node$1 && key.comment;

    if (simpleKeys) {
      if (keyComment) {
        throw new Error('With simple keys, key nodes cannot have comments');
      }

      if (key instanceof Collection$1) {
        const msg = 'With simple keys, collection cannot be used as a key value';
        throw new Error(msg);
      }
    }

    let explicitKey = !simpleKeys && (!key || keyComment || (key instanceof Node$1 ? key instanceof Collection$1 || key.type === Type.BLOCK_FOLDED || key.type === Type.BLOCK_LITERAL : typeof key === 'object'));
    const {
      allNullValues,
      doc,
      indent,
      indentStep,
      stringify
    } = ctx;
    ctx = Object.assign({}, ctx, {
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    });
    let chompKeep = false;
    let str = stringify(key, ctx, () => keyComment = null, () => chompKeep = true);
    str = addComment(str, ctx.indent, keyComment);

    if (!explicitKey && str.length > 1024) {
      if (simpleKeys) throw new Error('With simple keys, single line scalar must not span more than 1024 characters');
      explicitKey = true;
    }

    if (allNullValues && !simpleKeys) {
      if (this.comment) {
        str = addComment(str, ctx.indent, this.comment);
        if (onComment) onComment();
      } else if (chompKeep && !keyComment && onChompKeep) onChompKeep();

      return ctx.inFlow && !explicitKey ? str : "? ".concat(str);
    }

    str = explicitKey ? "? ".concat(str, "\n").concat(indent, ":") : "".concat(str, ":");

    if (this.comment) {
      // expected (but not strictly required) to be a single-line comment
      str = addComment(str, ctx.indent, this.comment);
      if (onComment) onComment();
    }

    let vcb = '';
    let valueComment = null;

    if (value instanceof Node$1) {
      if (value.spaceBefore) vcb = '\n';

      if (value.commentBefore) {
        const cs = value.commentBefore.replace(/^/gm, "".concat(ctx.indent, "#"));
        vcb += "\n".concat(cs);
      }

      valueComment = value.comment;
    } else if (value && typeof value === 'object') {
      value = doc.createNode(value);
    }

    ctx.implicitKey = false;
    if (!explicitKey && !this.comment && value instanceof Scalar) ctx.indentAtStart = str.length + 1;
    chompKeep = false;

    if (!indentSeq && indentSize >= 2 && !ctx.inFlow && !explicitKey && value instanceof YAMLSeq && value.type !== Type.FLOW_SEQ && !value.tag && !doc.anchors.getName(value)) {
      // If indentSeq === false, consider '- ' as part of indentation where possible
      ctx.indent = ctx.indent.substr(2);
    }

    const valueStr = stringify(value, ctx, () => valueComment = null, () => chompKeep = true);
    let ws = ' ';

    if (vcb || this.comment) {
      ws = "".concat(vcb, "\n").concat(ctx.indent);
    } else if (!explicitKey && value instanceof Collection$1) {
      const flow = valueStr[0] === '[' || valueStr[0] === '{';
      if (!flow || valueStr.includes('\n')) ws = "\n".concat(ctx.indent);
    } else if (valueStr[0] === '\n') ws = '';

    if (chompKeep && !valueComment && onChompKeep) onChompKeep();
    return addComment(str + ws + valueStr, ctx.indent, valueComment);
  }

}

_defineProperty(Pair, "Type", {
  PAIR: 'PAIR',
  MERGE_PAIR: 'MERGE_PAIR'
});

const getAliasCount = (node, anchors) => {
  if (node instanceof Alias$1) {
    const anchor = anchors.get(node.source);
    return anchor.count * anchor.aliasCount;
  } else if (node instanceof Collection$1) {
    let count = 0;

    for (const item of node.items) {
      const c = getAliasCount(item, anchors);
      if (c > count) count = c;
    }

    return count;
  } else if (node instanceof Pair) {
    const kc = getAliasCount(node.key, anchors);
    const vc = getAliasCount(node.value, anchors);
    return Math.max(kc, vc);
  }

  return 1;
};

class Alias$1 extends Node$1 {
  static stringify({
    range,
    source
  }, {
    anchors,
    doc,
    implicitKey,
    inStringifyKey
  }) {
    let anchor = Object.keys(anchors).find(a => anchors[a] === source);
    if (!anchor && inStringifyKey) anchor = doc.anchors.getName(source) || doc.anchors.newName();
    if (anchor) return "*".concat(anchor).concat(implicitKey ? ' ' : '');
    const msg = doc.anchors.getName(source) ? 'Alias node must be after source node' : 'Source node not found for alias node';
    throw new Error("".concat(msg, " [").concat(range, "]"));
  }

  constructor(source) {
    super();
    this.source = source;
    this.type = Type.ALIAS;
  }

  set tag(t) {
    throw new Error('Alias nodes cannot have tags');
  }

  toJSON(arg, ctx) {
    if (!ctx) return toJS(this.source, arg, ctx);
    const {
      anchors,
      maxAliasCount
    } = ctx;
    const anchor = anchors.get(this.source);
    /* istanbul ignore if */

    if (!anchor || anchor.res === undefined) {
      const msg = 'This should not happen: Alias anchor was not resolved?';
      if (this.cstNode) throw new YAMLReferenceError(this.cstNode, msg);else throw new ReferenceError(msg);
    }

    if (maxAliasCount >= 0) {
      anchor.count += 1;
      if (anchor.aliasCount === 0) anchor.aliasCount = getAliasCount(this.source, anchors);

      if (anchor.count * anchor.aliasCount > maxAliasCount) {
        const msg = 'Excessive alias count indicates a resource exhaustion attack';
        if (this.cstNode) throw new YAMLReferenceError(this.cstNode, msg);else throw new ReferenceError(msg);
      }
    }

    return anchor.res;
  } // Only called when stringifying an alias mapping key while constructing
  // Object output.


  toString(ctx) {
    return Alias$1.stringify(this, ctx);
  }

}

_defineProperty(Alias$1, "default", true);

function resolveScalar(str, tags) {
  for (const {
    format,
    test,
    resolve
  } of tags) {
    if (test && test.test(str)) {
      let res = resolve(str);
      if (!(res instanceof Scalar)) res = new Scalar(res);
      if (format) res.format = format;
      return res;
    }
  }

  return new Scalar(str); // fallback to string
}

const FOLD_FLOW = 'flow';
const FOLD_BLOCK = 'block';
const FOLD_QUOTED = 'quoted'; // presumes i+1 is at the start of a line
// returns index of last newline in more-indented block

const consumeMoreIndentedLines = (text, i) => {
  let ch = text[i + 1];

  while (ch === ' ' || ch === '\t') {
    do {
      ch = text[i += 1];
    } while (ch && ch !== '\n');

    ch = text[i + 1];
  }

  return i;
};
/**
 * Tries to keep input at up to `lineWidth` characters, splitting only on spaces
 * not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
 * terminated with `\n` and started with `indent`.
 *
 * @param {string} text
 * @param {string} indent
 * @param {string} [mode='flow'] `'block'` prevents more-indented lines
 *   from being folded; `'quoted'` allows for `\` escapes, including escaped
 *   newlines
 * @param {Object} options
 * @param {number} [options.indentAtStart] Accounts for leading contents on
 *   the first line, defaulting to `indent.length`
 * @param {number} [options.lineWidth=80]
 * @param {number} [options.minContentWidth=20] Allow highly indented lines to
 *   stretch the line width or indent content from the start
 * @param {function} options.onFold Called once if the text is folded
 * @param {function} options.onFold Called once if any line of text exceeds
 *   lineWidth characters
 */


function foldFlowLines(text, indent, mode, {
  indentAtStart,
  lineWidth = 80,
  minContentWidth = 20,
  onFold,
  onOverflow
}) {
  if (!lineWidth || lineWidth < 0) return text;
  const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
  if (text.length <= endStep) return text;
  const folds = [];
  const escapedFolds = {};
  let end = lineWidth - indent.length;

  if (typeof indentAtStart === 'number') {
    if (indentAtStart > lineWidth - Math.max(2, minContentWidth)) folds.push(0);else end = lineWidth - indentAtStart;
  }

  let split = undefined;
  let prev = undefined;
  let overflow = false;
  let i = -1;
  let escStart = -1;
  let escEnd = -1;

  if (mode === FOLD_BLOCK) {
    i = consumeMoreIndentedLines(text, i);
    if (i !== -1) end = i + endStep;
  }

  for (let ch; ch = text[i += 1];) {
    if (mode === FOLD_QUOTED && ch === '\\') {
      escStart = i;

      switch (text[i + 1]) {
        case 'x':
          i += 3;
          break;

        case 'u':
          i += 5;
          break;

        case 'U':
          i += 9;
          break;

        default:
          i += 1;
      }

      escEnd = i;
    }

    if (ch === '\n') {
      if (mode === FOLD_BLOCK) i = consumeMoreIndentedLines(text, i);
      end = i + endStep;
      split = undefined;
    } else {
      if (ch === ' ' && prev && prev !== ' ' && prev !== '\n' && prev !== '\t') {
        // space surrounded by non-space can be replaced with newline + indent
        const next = text[i + 1];
        if (next && next !== ' ' && next !== '\n' && next !== '\t') split = i;
      }

      if (i >= end) {
        if (split) {
          folds.push(split);
          end = split + endStep;
          split = undefined;
        } else if (mode === FOLD_QUOTED) {
          // white-space collected at end may stretch past lineWidth
          while (prev === ' ' || prev === '\t') {
            prev = ch;
            ch = text[i += 1];
            overflow = true;
          } // Account for newline escape, but don't break preceding escape


          const j = i > escEnd + 1 ? i - 2 : escStart - 1; // Bail out if lineWidth & minContentWidth are shorter than an escape string

          if (escapedFolds[j]) return text;
          folds.push(j);
          escapedFolds[j] = true;
          end = j + endStep;
          split = undefined;
        } else {
          overflow = true;
        }
      }
    }

    prev = ch;
  }

  if (overflow && onOverflow) onOverflow();
  if (folds.length === 0) return text;
  if (onFold) onFold();
  let res = text.slice(0, folds[0]);

  for (let i = 0; i < folds.length; ++i) {
    const fold = folds[i];
    const end = folds[i + 1] || text.length;
    if (fold === 0) res = "\n".concat(indent).concat(text.slice(0, end));else {
      if (mode === FOLD_QUOTED && escapedFolds[fold]) res += "".concat(text[fold], "\\");
      res += "\n".concat(indent).concat(text.slice(fold + 1, end));
    }
  }

  return res;
}

const getFoldOptions = ({
  indentAtStart
}) => indentAtStart ? Object.assign({
  indentAtStart
}, strOptions.fold) : strOptions.fold; // Also checks for lines starting with %, as parsing the output as YAML 1.1 will
// presume that's starting a new document.


const containsDocumentMarker = str => /^(%|---|\.\.\.)/m.test(str);

function lineLengthOverLimit(str, limit) {
  const strLen = str.length;
  if (strLen <= limit) return false;

  for (let i = 0, start = 0; i < strLen; ++i) {
    if (str[i] === '\n') {
      if (i - start > limit) return true;
      start = i + 1;
      if (strLen - start <= limit) return false;
    }
  }

  return true;
}

function doubleQuotedString(value, ctx) {
  const {
    implicitKey
  } = ctx;
  const {
    jsonEncoding,
    minMultiLineLength
  } = strOptions.doubleQuoted;
  const json = JSON.stringify(value);
  if (jsonEncoding) return json;
  const indent = ctx.indent || (containsDocumentMarker(value) ? '  ' : '');
  let str = '';
  let start = 0;

  for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
    if (ch === ' ' && json[i + 1] === '\\' && json[i + 2] === 'n') {
      // space before newline needs to be escaped to not be folded
      str += json.slice(start, i) + '\\ ';
      i += 1;
      start = i;
      ch = '\\';
    }

    if (ch === '\\') switch (json[i + 1]) {
      case 'u':
        {
          str += json.slice(start, i);
          const code = json.substr(i + 2, 4);

          switch (code) {
            case '0000':
              str += '\\0';
              break;

            case '0007':
              str += '\\a';
              break;

            case '000b':
              str += '\\v';
              break;

            case '001b':
              str += '\\e';
              break;

            case '0085':
              str += '\\N';
              break;

            case '00a0':
              str += '\\_';
              break;

            case '2028':
              str += '\\L';
              break;

            case '2029':
              str += '\\P';
              break;

            default:
              if (code.substr(0, 2) === '00') str += '\\x' + code.substr(2);else str += json.substr(i, 6);
          }

          i += 5;
          start = i + 1;
        }
        break;

      case 'n':
        if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
          i += 1;
        } else {
          // folding will eat first newline
          str += json.slice(start, i) + '\n\n';

          while (json[i + 2] === '\\' && json[i + 3] === 'n' && json[i + 4] !== '"') {
            str += '\n';
            i += 2;
          }

          str += indent; // space after newline needs to be escaped to not be folded

          if (json[i + 2] === ' ') str += '\\';
          i += 1;
          start = i + 1;
        }

        break;

      default:
        i += 1;
    }
  }

  str = start ? str + json.slice(start) : json;
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx));
}

function singleQuotedString(value, ctx) {
  if (ctx.implicitKey) {
    if (/\n/.test(value)) return doubleQuotedString(value, ctx);
  } else {
    // single quoted string can't have leading or trailing whitespace around newline
    if (/[ \t]\n|\n[ \t]/.test(value)) return doubleQuotedString(value, ctx);
  }

  const indent = ctx.indent || (containsDocumentMarker(value) ? '  ' : '');
  const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, "$&\n".concat(indent)) + "'";
  return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx));
}

function blockString({
  comment,
  type,
  value
}, ctx, onComment, onChompKeep) {
  // 1. Block can't end in whitespace unless the last line is non-empty.
  // 2. Strings consisting of only whitespace are best rendered explicitly.
  if (/\n[\t ]+$/.test(value) || /^\s*$/.test(value)) {
    return doubleQuotedString(value, ctx);
  }

  const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? '  ' : '');
  const indentSize = indent ? '2' : '1'; // root is at -1

  const literal = type === Type.BLOCK_FOLDED ? false : type === Type.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, strOptions.fold.lineWidth - indent.length);
  let header = literal ? '|' : '>';
  if (!value) return header + '\n';
  let wsStart = '';
  let wsEnd = '';
  value = value.replace(/[\n\t ]*$/, ws => {
    const n = ws.indexOf('\n');

    if (n === -1) {
      header += '-'; // strip
    } else if (value === ws || n !== ws.length - 1) {
      header += '+'; // keep

      if (onChompKeep) onChompKeep();
    }

    wsEnd = ws.replace(/\n$/, '');
    return '';
  }).replace(/^[\n ]*/, ws => {
    if (ws.indexOf(' ') !== -1) header += indentSize;
    const m = ws.match(/ +$/);

    if (m) {
      wsStart = ws.slice(0, -m[0].length);
      return m[0];
    } else {
      wsStart = ws;
      return '';
    }
  });
  if (wsEnd) wsEnd = wsEnd.replace(/\n+(?!\n|$)/g, "$&".concat(indent));
  if (wsStart) wsStart = wsStart.replace(/\n+/g, "$&".concat(indent));

  if (comment) {
    header += ' #' + comment.replace(/ ?[\r\n]+/g, ' ');
    if (onComment) onComment();
  }

  if (!value) return "".concat(header).concat(indentSize, "\n").concat(indent).concat(wsEnd);

  if (literal) {
    value = value.replace(/\n+/g, "$&".concat(indent));
    return "".concat(header, "\n").concat(indent).concat(wsStart).concat(value).concat(wsEnd);
  }

  value = value.replace(/\n+/g, '\n$&').replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, '$1$2') // more-indented lines aren't folded
  //         ^ ind.line  ^ empty     ^ capture next empty lines only at end of indent
  .replace(/\n+/g, "$&".concat(indent));
  const body = foldFlowLines("".concat(wsStart).concat(value).concat(wsEnd), indent, FOLD_BLOCK, strOptions.fold);
  return "".concat(header, "\n").concat(indent).concat(body);
}

function plainString(item, ctx, onComment, onChompKeep) {
  const {
    comment,
    type,
    value
  } = item;
  const {
    actualString,
    implicitKey,
    indent,
    inFlow
  } = ctx;

  if (implicitKey && /[\n[\]{},]/.test(value) || inFlow && /[[\]{},]/.test(value)) {
    return doubleQuotedString(value, ctx);
  }

  if (!value || /^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
    const hasDouble = value.indexOf('"') !== -1;
    const hasSingle = value.indexOf("'") !== -1;
    let quotedString;

    if (hasDouble && !hasSingle) {
      quotedString = singleQuotedString;
    } else if (hasSingle && !hasDouble) {
      quotedString = doubleQuotedString;
    } else if (strOptions.defaultQuoteSingle) {
      quotedString = singleQuotedString;
    } else {
      quotedString = doubleQuotedString;
    } // not allowed:
    // - empty string, '-' or '?'
    // - start with an indicator character (except [?:-]) or /[?-] /
    // - '\n ', ': ' or ' \n' anywhere
    // - '#' not preceded by a non-space char
    // - end with ' ' or ':'


    return implicitKey || inFlow || value.indexOf('\n') === -1 ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
  }

  if (!implicitKey && !inFlow && type !== Type.PLAIN && value.indexOf('\n') !== -1) {
    // Where allowed & type not set explicitly, prefer block style for multiline strings
    return blockString(item, ctx, onComment, onChompKeep);
  }

  if (indent === '' && containsDocumentMarker(value)) {
    ctx.forceBlockIndent = true;
    return blockString(item, ctx, onComment, onChompKeep);
  }

  const str = value.replace(/\n+/g, "$&\n".concat(indent)); // Verify that output will be parsed as a string, as e.g. plain numbers and
  // booleans get parsed with those types in v1.2 (e.g. '42', 'true' & '0.9e-3'),
  // and others in v1.1.

  if (actualString) {
    const {
      tags
    } = ctx.doc.schema;
    const resolved = resolveScalar(str, tags).value;
    if (typeof resolved !== 'string') return doubleQuotedString(value, ctx);
  }

  const body = implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx));

  if (comment && !inFlow && (body.indexOf('\n') !== -1 || comment.indexOf('\n') !== -1)) {
    if (onComment) onComment();
    return addCommentBefore(body, indent, comment);
  }

  return body;
}

function stringifyString(item, ctx, onComment, onChompKeep) {
  const {
    defaultKeyType,
    defaultType
  } = strOptions;
  const {
    implicitKey,
    inFlow
  } = ctx;
  let {
    type,
    value
  } = item;

  if (typeof value !== 'string') {
    value = String(value);
    item = Object.assign({}, item, {
      value
    });
  }

  if (type !== Type.QUOTE_DOUBLE) {
    // force double quotes on control characters & unpaired surrogates
    if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(value)) type = Type.QUOTE_DOUBLE;
  }

  const _stringify = _type => {
    switch (_type) {
      case Type.BLOCK_FOLDED:
      case Type.BLOCK_LITERAL:
        return implicitKey || inFlow ? doubleQuotedString(value, ctx) // blocks are not valid inside flow containers
        : blockString(item, ctx, onComment, onChompKeep);

      case Type.QUOTE_DOUBLE:
        return doubleQuotedString(value, ctx);

      case Type.QUOTE_SINGLE:
        return singleQuotedString(value, ctx);

      case Type.PLAIN:
        return plainString(item, ctx, onComment, onChompKeep);

      default:
        return null;
    }
  };

  let res = _stringify(type);

  if (res === null) {
    const t = implicitKey ? defaultKeyType : defaultType;
    res = _stringify(t);
    if (res === null) throw new Error("Unsupported default string type ".concat(t));
  }

  return res;
}

function stringifyTag(doc, tag) {
  if ((doc.version || doc.options.version) === '1.0') {
    const priv = tag.match(/^tag:private\.yaml\.org,2002:([^:/]+)$/);
    if (priv) return '!' + priv[1];
    const vocab = tag.match(/^tag:([a-zA-Z0-9-]+)\.yaml\.org,2002:(.*)/);
    return vocab ? "!".concat(vocab[1], "/").concat(vocab[2]) : "!".concat(tag.replace(/^tag:/, ''));
  }

  let p = doc.tagPrefixes.find(p => tag.indexOf(p.prefix) === 0);

  if (!p) {
    const dtp = doc.getDefaults().tagPrefixes;
    p = dtp && dtp.find(p => tag.indexOf(p.prefix) === 0);
  }

  if (!p) return tag[0] === '!' ? tag : "!<".concat(tag, ">");
  const suffix = tag.substr(p.prefix.length).replace(/[!,[\]{}]/g, ch => ({
    '!': '%21',
    ',': '%2C',
    '[': '%5B',
    ']': '%5D',
    '{': '%7B',
    '}': '%7D'
  })[ch]);
  return p.handle + suffix;
}

function getTagObject(tags, item) {
  if (item instanceof Alias$1) return Alias$1;

  if (item.tag) {
    const match = tags.filter(t => t.tag === item.tag);
    if (match.length > 0) return match.find(t => t.format === item.format) || match[0];
  }

  let tagObj, obj;

  if (item instanceof Scalar) {
    obj = item.value;
    const match = tags.filter(t => t.identify && t.identify(obj));
    tagObj = match.find(t => t.format === item.format) || match.find(t => !t.format);
  } else {
    obj = item;
    tagObj = tags.find(t => t.nodeClass && obj instanceof t.nodeClass);
  }

  if (!tagObj) {
    const name = obj && obj.constructor ? obj.constructor.name : typeof obj;
    throw new Error("Tag not resolved for ".concat(name, " value"));
  }

  return tagObj;
} // needs to be called before value stringifier to allow for circular anchor refs


function stringifyProps(node, tagObj, {
  anchors,
  doc
}) {
  const props = [];
  const anchor = doc.anchors.getName(node);

  if (anchor) {
    anchors[anchor] = node;
    props.push("&".concat(anchor));
  }

  if (node.tag) {
    props.push(stringifyTag(doc, node.tag));
  } else if (!tagObj.default) {
    props.push(stringifyTag(doc, tagObj.tag));
  }

  return props.join(' ');
}

function stringify(item, ctx, onComment, onChompKeep) {
  const {
    schema
  } = ctx.doc;
  let tagObj;

  if (!(item instanceof Node$1)) {
    item = ctx.doc.createNode(item, {
      onTagObj: o => tagObj = o,
      wrapScalars: true
    });
  }

  if (item instanceof Pair) return item.toString(ctx, onComment, onChompKeep);
  if (!tagObj) tagObj = getTagObject(schema.tags, item);
  const props = stringifyProps(item, tagObj, ctx);
  if (props.length > 0) ctx.indentAtStart = (ctx.indentAtStart || 0) + props.length + 1;
  const str = typeof tagObj.stringify === 'function' ? tagObj.stringify(item, ctx, onComment, onChompKeep) : item instanceof Scalar ? stringifyString(item, ctx, onComment, onChompKeep) : item.toString(ctx, onComment, onChompKeep);
  if (!props) return str;
  return item instanceof Scalar || str[0] === '{' || str[0] === '[' ? "".concat(props, " ").concat(str) : "".concat(props, "\n").concat(ctx.indent).concat(str);
}

function findPair(items, key) {
  const k = key instanceof Scalar ? key.value : key;

  for (const it of items) {
    if (it instanceof Pair) {
      if (it.key === key || it.key === k) return it;
      if (it.key && it.key.value === k) return it;
    }
  }

  return undefined;
}
class YAMLMap extends Collection$1 {
  add(pair, overwrite) {
    if (!pair) pair = new Pair(pair);else if (!(pair instanceof Pair)) pair = new Pair(pair.key || pair, pair.value);
    const prev = findPair(this.items, pair.key);
    const sortEntries = this.schema && this.schema.sortMapEntries;

    if (prev) {
      if (!overwrite) throw new Error("Key ".concat(pair.key, " already set")); // For scalars, keep the old node & its comments and anchors

      if (prev.value instanceof Scalar && isScalarValue(pair.value)) prev.value.value = pair.value;else prev.value = pair.value;
    } else if (sortEntries) {
      const i = this.items.findIndex(item => sortEntries(pair, item) < 0);
      if (i === -1) this.items.push(pair);else this.items.splice(i, 0, pair);
    } else {
      this.items.push(pair);
    }
  }

  delete(key) {
    const it = findPair(this.items, key);
    if (!it) return false;
    const del = this.items.splice(this.items.indexOf(it), 1);
    return del.length > 0;
  }

  get(key, keepScalar) {
    const it = findPair(this.items, key);
    const node = it && it.value;
    return !keepScalar && node instanceof Scalar ? node.value : node;
  }

  has(key) {
    return !!findPair(this.items, key);
  }

  set(key, value) {
    this.add(new Pair(key, value), true);
  }
  /**
   * @param ctx - Conversion context, originally set in Document#toJS()
   * @param {Class} Type - If set, forces the returned collection type
   * @returns Instance of Type, Map, or Object
   */


  toJSON(_, ctx, Type) {
    const map = Type ? new Type() : ctx && ctx.mapAsMap ? new Map() : {};
    if (ctx && ctx.onCreate) ctx.onCreate(map);

    for (const item of this.items) item.addToJSMap(ctx, map);

    return map;
  }

  toString(ctx, onComment, onChompKeep) {
    if (!ctx) return JSON.stringify(this);

    for (const item of this.items) {
      if (!(item instanceof Pair)) throw new Error("Map items must all be pairs; found ".concat(JSON.stringify(item), " instead"));
    }

    return super.toString(ctx, {
      blockItem: n => n.str,
      flowChars: {
        start: '{',
        end: '}'
      },
      isMap: true,
      itemIndent: ctx.indent || ''
    }, onComment, onChompKeep);
  }

}

const MERGE_KEY = '<<';
class Merge extends Pair {
  constructor(pair) {
    if (pair instanceof Pair) {
      let seq = pair.value;

      if (!(seq instanceof YAMLSeq)) {
        seq = new YAMLSeq();
        seq.items.push(pair.value);
        seq.range = pair.value.range;
      }

      super(pair.key, seq);
      this.range = pair.range;
    } else {
      super(new Scalar(MERGE_KEY), new YAMLSeq());
    }

    this.type = Pair.Type.MERGE_PAIR;
  } // If the value associated with a merge key is a single mapping node, each of
  // its key/value pairs is inserted into the current mapping, unless the key
  // already exists in it. If the value associated with the merge key is a
  // sequence, then this sequence is expected to contain mapping nodes and each
  // of these nodes is merged in turn according to its order in the sequence.
  // Keys in mapping nodes earlier in the sequence override keys specified in
  // later mapping nodes. -- http://yaml.org/type/merge.html


  addToJSMap(ctx, map) {
    for (const {
      source
    } of this.value.items) {
      if (!(source instanceof YAMLMap)) throw new Error('Merge sources must be maps');
      const srcMap = source.toJSON(null, ctx, Map);

      for (const [key, value] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key)) map.set(key, value);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
    }

    return map;
  }

  toString(ctx, onComment) {
    const seq = this.value;
    if (seq.items.length > 1) return super.toString(ctx, onComment);
    this.value = seq.items[0];
    const str = super.toString(ctx, onComment);
    this.value = seq;
    return str;
  }

}

class Anchors {
  static validAnchorNode(node) {
    return node instanceof Scalar || node instanceof YAMLSeq || node instanceof YAMLMap;
  }

  constructor(prefix) {
    _defineProperty(this, "map", Object.create(null));

    this.prefix = prefix;
  }

  createAlias(node, name) {
    this.setAnchor(node, name);
    return new Alias$1(node);
  }

  createMergePair(...sources) {
    const merge = new Merge();
    merge.value.items = sources.map(s => {
      if (s instanceof Alias$1) {
        if (s.source instanceof YAMLMap) return s;
      } else if (s instanceof YAMLMap) {
        return this.createAlias(s);
      }

      throw new Error('Merge sources must be Map nodes or their Aliases');
    });
    return merge;
  }

  getName(node) {
    const {
      map
    } = this;
    return Object.keys(map).find(a => map[a] === node);
  }

  getNames() {
    return Object.keys(this.map);
  }

  getNode(name) {
    return this.map[name];
  }

  newName(prefix) {
    if (!prefix) prefix = this.prefix;
    const names = Object.keys(this.map);

    for (let i = 1; true; ++i) {
      const name = "".concat(prefix).concat(i);
      if (!names.includes(name)) return name;
    }
  } // During parsing, map & aliases contain CST nodes


  resolveNodes() {
    const {
      map,
      _cstAliases
    } = this;
    Object.keys(map).forEach(a => {
      map[a] = map[a].resolved;
    });

    _cstAliases.forEach(a => {
      a.source = a.source.resolved;
    });

    delete this._cstAliases;
  }

  setAnchor(node, name) {
    if (node != null && !Anchors.validAnchorNode(node)) {
      throw new Error('Anchors may only be set for Scalar, Seq and Map nodes');
    }

    if (name && /[\x00-\x19\s,[\]{}]/.test(name)) {
      throw new Error('Anchor names must not contain whitespace or control characters');
    }

    const {
      map
    } = this;
    const prev = node && Object.keys(map).find(a => map[a] === node);

    if (prev) {
      if (!name) {
        return prev;
      } else if (prev !== name) {
        delete map[prev];
        map[name] = node;
      }
    } else {
      if (!name) {
        if (!node) return null;
        name = this.newName();
      }

      map[name] = node;
    }

    return name;
  }

}

function stringifyNumber({
  format,
  minFractionDigits,
  tag,
  value
}) {
  if (typeof value === 'bigint') return String(value);
  if (!isFinite(value)) return isNaN(value) ? '.nan' : value < 0 ? '-.inf' : '.inf';
  let n = JSON.stringify(value);

  if (!format && minFractionDigits && (!tag || tag === 'tag:yaml.org,2002:float') && /^\d/.test(n)) {
    let i = n.indexOf('.');

    if (i < 0) {
      i = n.length;
      n += '.';
    }

    let d = minFractionDigits - (n.length - i - 1);

    while (d-- > 0) n += '0';
  }

  return n;
}

function createMap(schema, obj, ctx) {
  const {
    keepUndefined,
    replacer
  } = ctx;
  const map = new YAMLMap(schema);

  const add = (key, value) => {
    if (typeof replacer === 'function') value = replacer.call(obj, key, value);else if (Array.isArray(replacer) && !replacer.includes(key)) return;
    if (value !== undefined || keepUndefined) map.items.push(createPair(key, value, ctx));
  };

  if (obj instanceof Map) {
    for (const [key, value] of obj) add(key, value);
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) add(key, obj[key]);
  }

  if (typeof schema.sortMapEntries === 'function') {
    map.items.sort(schema.sortMapEntries);
  }

  return map;
}

const map = {
  createNode: createMap,
  default: true,
  nodeClass: YAMLMap,
  tag: 'tag:yaml.org,2002:map',
  resolve: map => map
};

function createSeq(schema, obj, ctx) {
  const {
    replacer
  } = ctx;
  const seq = new YAMLSeq(schema);

  if (obj && obj[Symbol.iterator]) {
    let i = 0;

    for (let it of obj) {
      if (typeof replacer === 'function') {
        const key = obj instanceof Set ? it : String(i++);
        it = replacer.call(obj, key, it);
      }

      seq.items.push(createNode(it, null, ctx));
    }
  }

  return seq;
}

const seq = {
  createNode: createSeq,
  default: true,
  nodeClass: YAMLSeq,
  tag: 'tag:yaml.org,2002:seq',
  resolve: seq => seq
};

const string = {
  identify: value => typeof value === 'string',
  default: true,
  tag: 'tag:yaml.org,2002:str',
  resolve: str => str,

  stringify(item, ctx, onComment, onChompKeep) {
    ctx = Object.assign({
      actualString: true
    }, ctx);
    return stringifyString(item, ctx, onComment, onChompKeep);
  },

  options: strOptions
};

const failsafe = [map, seq, string];

/* global BigInt */

const intIdentify = value => typeof value === 'bigint' || Number.isInteger(value);

const intResolve = (src, offset, radix) => intOptions.asBigInt ? BigInt(src) : parseInt(src.substring(offset), radix);

function intStringify(node, radix, prefix) {
  const {
    value
  } = node;
  if (intIdentify(value) && value >= 0) return prefix + value.toString(radix);
  return stringifyNumber(node);
}

function stringifyBool(node) {
  const {
    value,
    sourceStr
  } = node;

  if (sourceStr) {
    const match = boolObj.test.test(sourceStr);
    if (match && value === (sourceStr[0] === 't' || sourceStr[0] === 'T')) return sourceStr;
  }

  return value ? boolOptions.trueStr : boolOptions.falseStr;
}

const nullObj = {
  identify: value => value == null,
  createNode: (schema, value, ctx) => ctx.wrapScalars ? new Scalar(null) : null,
  default: true,
  tag: 'tag:yaml.org,2002:null',
  test: /^(?:~|[Nn]ull|NULL)?$/,
  resolve: str => {
    const node = new Scalar(null);
    node.sourceStr = str;
    return node;
  },
  options: nullOptions,
  stringify: ({
    sourceStr
  }) => sourceStr !== null && sourceStr !== void 0 ? sourceStr : nullOptions.nullStr
};
const boolObj = {
  identify: value => typeof value === 'boolean',
  default: true,
  tag: 'tag:yaml.org,2002:bool',
  test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
  resolve: str => {
    const node = new Scalar(str[0] === 't' || str[0] === 'T');
    node.sourceStr = str;
    return node;
  },
  options: boolOptions,
  stringify: stringifyBool
};
const octObj = {
  identify: value => intIdentify(value) && value >= 0,
  default: true,
  tag: 'tag:yaml.org,2002:int',
  format: 'OCT',
  test: /^0o[0-7]+$/,
  resolve: str => intResolve(str, 2, 8),
  options: intOptions,
  stringify: node => intStringify(node, 8, '0o')
};
const intObj = {
  identify: intIdentify,
  default: true,
  tag: 'tag:yaml.org,2002:int',
  test: /^[-+]?[0-9]+$/,
  resolve: str => intResolve(str, 0, 10),
  options: intOptions,
  stringify: stringifyNumber
};
const hexObj = {
  identify: value => intIdentify(value) && value >= 0,
  default: true,
  tag: 'tag:yaml.org,2002:int',
  format: 'HEX',
  test: /^0x[0-9a-fA-F]+$/,
  resolve: str => intResolve(str, 2, 16),
  options: intOptions,
  stringify: node => intStringify(node, 16, '0x')
};
const nanObj = {
  identify: value => typeof value === 'number',
  default: true,
  tag: 'tag:yaml.org,2002:float',
  test: /^(?:[-+]?\.(?:inf|Inf|INF|nan|NaN|NAN))$/,
  resolve: str => str.slice(-3).toLowerCase() === 'nan' ? NaN : str[0] === '-' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
const expObj = {
  identify: value => typeof value === 'number',
  default: true,
  tag: 'tag:yaml.org,2002:float',
  format: 'EXP',
  test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
  resolve: str => parseFloat(str),
  stringify: ({
    value
  }) => Number(value).toExponential()
};
const floatObj = {
  identify: value => typeof value === 'number',
  default: true,
  tag: 'tag:yaml.org,2002:float',
  test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,

  resolve(str) {
    const node = new Scalar(parseFloat(str));
    const dot = str.indexOf('.');
    if (dot !== -1 && str[str.length - 1] === '0') node.minFractionDigits = str.length - dot - 1;
    return node;
  },

  stringify: stringifyNumber
};
const core = failsafe.concat([nullObj, boolObj, octObj, intObj, hexObj, nanObj, expObj, floatObj]);

/* global BigInt */

const intIdentify$1 = value => typeof value === 'bigint' || Number.isInteger(value);

const stringifyJSON = ({
  value
}) => JSON.stringify(value);

const json = [map, seq, {
  identify: value => typeof value === 'string',
  default: true,
  tag: 'tag:yaml.org,2002:str',
  resolve: str => str,
  stringify: stringifyJSON
}, {
  identify: value => value == null,
  createNode: (schema, value, ctx) => ctx.wrapScalars ? new Scalar(null) : null,
  default: true,
  tag: 'tag:yaml.org,2002:null',
  test: /^null$/,
  resolve: () => null,
  stringify: stringifyJSON
}, {
  identify: value => typeof value === 'boolean',
  default: true,
  tag: 'tag:yaml.org,2002:bool',
  test: /^true|false$/,
  resolve: str => str === 'true',
  stringify: stringifyJSON
}, {
  identify: intIdentify$1,
  default: true,
  tag: 'tag:yaml.org,2002:int',
  test: /^-?(?:0|[1-9][0-9]*)$/,
  resolve: str => intOptions.asBigInt ? BigInt(str) : parseInt(str, 10),
  stringify: ({
    value
  }) => intIdentify$1(value) ? value.toString() : JSON.stringify(value)
}, {
  identify: value => typeof value === 'number',
  default: true,
  tag: 'tag:yaml.org,2002:float',
  test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
  resolve: str => parseFloat(str),
  stringify: stringifyJSON
}, {
  default: true,
  test: /^/,

  resolve(str, onError) {
    onError("Unresolved plain scalar ".concat(JSON.stringify(str)));
    return str;
  }

}];

/* global atob, btoa, Buffer */
const binary = {
  identify: value => value instanceof Uint8Array,
  // Buffer inherits from Uint8Array
  default: false,
  tag: 'tag:yaml.org,2002:binary',

  /**
   * Returns a Buffer in node and an Uint8Array in browsers
   *
   * To use the resulting buffer as an image, you'll want to do something like:
   *
   *   const blob = new Blob([buffer], { type: 'image/jpeg' })
   *   document.querySelector('#photo').src = URL.createObjectURL(blob)
   */
  resolve(src, onError) {
    if (typeof Buffer === 'function') {
      return Buffer.from(src, 'base64');
    } else if (typeof atob === 'function') {
      // On IE 11, atob() can't handle newlines
      const str = atob(src.replace(/[\n\r]/g, ''));
      const buffer = new Uint8Array(str.length);

      for (let i = 0; i < str.length; ++i) buffer[i] = str.charCodeAt(i);

      return buffer;
    } else {
      onError('This environment does not support reading binary tags; either Buffer or atob is required');
      return src;
    }
  },

  options: binaryOptions,
  stringify: ({
    comment,
    type,
    value
  }, ctx, onComment, onChompKeep) => {
    let src;

    if (typeof Buffer === 'function') {
      src = value instanceof Buffer ? value.toString('base64') : Buffer.from(value.buffer).toString('base64');
    } else if (typeof btoa === 'function') {
      let s = '';

      for (let i = 0; i < value.length; ++i) s += String.fromCharCode(value[i]);

      src = btoa(s);
    } else {
      throw new Error('This environment does not support writing binary tags; either Buffer or btoa is required');
    }

    if (!type) type = binaryOptions.defaultType;

    if (type === Type.QUOTE_DOUBLE) {
      value = src;
    } else {
      const {
        lineWidth
      } = binaryOptions;
      const n = Math.ceil(src.length / lineWidth);
      const lines = new Array(n);

      for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
        lines[i] = src.substr(o, lineWidth);
      }

      value = lines.join(type === Type.BLOCK_LITERAL ? '\n' : ' ');
    }

    return stringifyString({
      comment,
      type,
      value
    }, ctx, onComment, onChompKeep);
  }
};

function parsePairs(seq, onError) {
  if (seq instanceof YAMLSeq) {
    for (let i = 0; i < seq.items.length; ++i) {
      let item = seq.items[i];
      if (item instanceof Pair) continue;else if (item instanceof YAMLMap) {
        if (item.items.length > 1) onError('Each pair must have its own sequence indicator');
        const pair = item.items[0] || new Pair();
        if (item.commentBefore) pair.commentBefore = pair.commentBefore ? "".concat(item.commentBefore, "\n").concat(pair.commentBefore) : item.commentBefore;
        if (item.comment) pair.comment = pair.comment ? "".concat(item.comment, "\n").concat(pair.comment) : item.comment;
        item = pair;
      }
      seq.items[i] = item instanceof Pair ? item : new Pair(item);
    }
  } else onError('Expected a sequence for this tag');

  return seq;
}
function createPairs(schema, iterable, ctx) {
  const {
    replacer
  } = ctx;
  const pairs = new YAMLSeq(schema);
  pairs.tag = 'tag:yaml.org,2002:pairs';
  let i = 0;

  for (let it of iterable) {
    if (typeof replacer === 'function') it = replacer.call(iterable, String(i++), it);
    let key, value;

    if (Array.isArray(it)) {
      if (it.length === 2) {
        key = it[0];
        value = it[1];
      } else throw new TypeError("Expected [key, value] tuple: ".concat(it));
    } else if (it && it instanceof Object) {
      const keys = Object.keys(it);

      if (keys.length === 1) {
        key = keys[0];
        value = it[key];
      } else throw new TypeError("Expected { key: value } tuple: ".concat(it));
    } else {
      key = it;
    }

    pairs.items.push(createPair(key, value, ctx));
  }

  return pairs;
}
const pairs = {
  default: false,
  tag: 'tag:yaml.org,2002:pairs',
  resolve: parsePairs,
  createNode: createPairs
};

class YAMLOMap extends YAMLSeq {
  constructor() {
    super();

    _defineProperty(this, "add", YAMLMap.prototype.add.bind(this));

    _defineProperty(this, "delete", YAMLMap.prototype.delete.bind(this));

    _defineProperty(this, "get", YAMLMap.prototype.get.bind(this));

    _defineProperty(this, "has", YAMLMap.prototype.has.bind(this));

    _defineProperty(this, "set", YAMLMap.prototype.set.bind(this));

    this.tag = YAMLOMap.tag;
  }

  toJSON(_, ctx) {
    const map = new Map();
    if (ctx && ctx.onCreate) ctx.onCreate(map);

    for (const pair of this.items) {
      let key, value;

      if (pair instanceof Pair) {
        key = toJS(pair.key, '', ctx);
        value = toJS(pair.value, key, ctx);
      } else {
        key = toJS(pair, '', ctx);
      }

      if (map.has(key)) throw new Error('Ordered maps must not include duplicate keys');
      map.set(key, value);
    }

    return map;
  }

}

_defineProperty(YAMLOMap, "tag", 'tag:yaml.org,2002:omap');

function parseOMap(seq, onError) {
  const pairs = parsePairs(seq, onError);
  const seenKeys = [];

  for (const {
    key
  } of pairs.items) {
    if (key instanceof Scalar) {
      if (seenKeys.includes(key.value)) {
        onError("Ordered maps must not include duplicate keys: ".concat(key.value));
      } else {
        seenKeys.push(key.value);
      }
    }
  }

  return Object.assign(new YAMLOMap(), pairs);
}

function createOMap(schema, iterable, ctx) {
  const pairs = createPairs(schema, iterable, ctx);
  const omap = new YAMLOMap();
  omap.items = pairs.items;
  return omap;
}

const omap = {
  identify: value => value instanceof Map,
  nodeClass: YAMLOMap,
  default: false,
  tag: 'tag:yaml.org,2002:omap',
  resolve: parseOMap,
  createNode: createOMap
};

class YAMLSet extends YAMLMap {
  constructor(schema) {
    super(schema);
    this.tag = YAMLSet.tag;
  }

  add(key) {
    const pair = key instanceof Pair ? key : new Pair(key);
    const prev = findPair(this.items, pair.key);
    if (!prev) this.items.push(pair);
  }

  get(key, keepPair) {
    const pair = findPair(this.items, key);
    return !keepPair && pair instanceof Pair ? pair.key instanceof Scalar ? pair.key.value : pair.key : pair;
  }

  set(key, value) {
    if (typeof value !== 'boolean') throw new Error("Expected boolean value for set(key, value) in a YAML set, not ".concat(typeof value));
    const prev = findPair(this.items, key);

    if (prev && !value) {
      this.items.splice(this.items.indexOf(prev), 1);
    } else if (!prev && value) {
      this.items.push(new Pair(key));
    }
  }

  toJSON(_, ctx) {
    return super.toJSON(_, ctx, Set);
  }

  toString(ctx, onComment, onChompKeep) {
    if (!ctx) return JSON.stringify(this);
    if (this.hasAllNullValues()) return super.toString(ctx, onComment, onChompKeep);else throw new Error('Set items must all have null values');
  }

}

_defineProperty(YAMLSet, "tag", 'tag:yaml.org,2002:set');

function parseSet(map, onError) {
  if (map instanceof YAMLMap) {
    if (map.hasAllNullValues()) return Object.assign(new YAMLSet(), map);else onError('Set items must all have null values');
  } else onError('Expected a mapping for this tag');

  return map;
}

function createSet(schema, iterable, ctx) {
  const {
    replacer
  } = ctx;
  const set = new YAMLSet(schema);

  for (let value of iterable) {
    if (typeof replacer === 'function') value = replacer.call(iterable, value, value);
    set.items.push(createPair(value, null, ctx));
  }

  return set;
}

const set$1 = {
  identify: value => value instanceof Set,
  nodeClass: YAMLSet,
  default: false,
  tag: 'tag:yaml.org,2002:set',
  resolve: parseSet,
  createNode: createSet
};

/* global BigInt */

const parseSexagesimal = (str, isInt) => {
  const sign = str[0];
  const parts = sign === '-' || sign === '+' ? str.substring(1) : str;

  const num = n => isInt && intOptions.asBigInt ? BigInt(n) : Number(n);

  const res = parts.replace(/_/g, '').split(':').reduce((res, p) => res * num(60) + num(p), num(0));
  return sign === '-' ? num(-1) * res : res;
}; // hhhh:mm:ss.sss


const stringifySexagesimal = ({
  value
}) => {
  let num = n => n;

  if (typeof value === 'bigint') num = n => BigInt(n);else if (isNaN(value) || !isFinite(value)) return stringifyNumber(value);
  let sign = '';

  if (value < 0) {
    sign = '-';
    value *= num(-1);
  }

  const _60 = num(60);

  const parts = [value % _60]; // seconds, including ms

  if (value < 60) {
    parts.unshift(0); // at least one : is required
  } else {
    value = (value - parts[0]) / _60;
    parts.unshift(value % _60); // minutes

    if (value >= 60) {
      value = (value - parts[0]) / _60;
      parts.unshift(value); // hours
    }
  }

  return sign + parts.map(n => n < 10 ? '0' + String(n) : String(n)).join(':').replace(/000000\d*$/, '') // % 60 may introduce error
  ;
};

const intTime = {
  identify: value => typeof value === 'bigint' || Number.isInteger(value),
  default: true,
  tag: 'tag:yaml.org,2002:int',
  format: 'TIME',
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
  resolve: str => parseSexagesimal(str, true),
  stringify: stringifySexagesimal
};
const floatTime = {
  identify: value => typeof value === 'number',
  default: true,
  tag: 'tag:yaml.org,2002:float',
  format: 'TIME',
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
  resolve: str => parseSexagesimal(str, false),
  stringify: stringifySexagesimal
};
const timestamp = {
  identify: value => value instanceof Date,
  default: true,
  tag: 'tag:yaml.org,2002:timestamp',
  // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
  // may be omitted altogether, resulting in a date format. In such a case, the time part is
  // assumed to be 00:00:00Z (start of day, UTC).
  test: RegExp('^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})' + // YYYY-Mm-Dd
  '(?:' + // time is optional
  '(?:t|T|[ \\t]+)' + // t | T | whitespace
  '([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)' + // Hh:Mm:Ss(.ss)?
  '(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?' + // Z | +5 | -03:30
  ')?$'),

  resolve(str) {
    let [, year, month, day, hour, minute, second, millisec, tz] = str.match(timestamp.test);
    if (millisec) millisec = (millisec + '00').substr(1, 3);
    let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec || 0);

    if (tz && tz !== 'Z') {
      let d = parseSexagesimal(tz, false);
      if (Math.abs(d) < 30) d *= 60;
      date -= 60000 * d;
    }

    return new Date(date);
  },

  stringify: ({
    value
  }) => value.toISOString().replace(/((T00:00)?:00)?\.000Z$/, '')
};

/* global BigInt */

const boolStringify = ({
  value,
  sourceStr
}) => {
  const boolObj = value ? trueObj : falseObj;
  if (sourceStr && boolObj.test.test(sourceStr)) return sourceStr;
  return value ? boolOptions.trueStr : boolOptions.falseStr;
};

const boolResolve = (value, str) => {
  const node = new Scalar(value);
  node.sourceStr = str;
  return node;
};

const trueObj = {
  identify: value => value === true,
  default: true,
  tag: 'tag:yaml.org,2002:bool',
  test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
  resolve: str => boolResolve(true, str),
  options: boolOptions,
  stringify: boolStringify
};
const falseObj = {
  identify: value => value === false,
  default: true,
  tag: 'tag:yaml.org,2002:bool',
  test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/i,
  resolve: str => boolResolve(false, str),
  options: boolOptions,
  stringify: boolStringify
};

const intIdentify$2 = value => typeof value === 'bigint' || Number.isInteger(value);

function intResolve$1(str, offset, radix) {
  const sign = str[0];
  if (sign === '-' || sign === '+') offset += 1;
  str = str.substring(offset).replace(/_/g, '');

  if (intOptions.asBigInt) {
    switch (radix) {
      case 2:
        str = "0b".concat(str);
        break;

      case 8:
        str = "0o".concat(str);
        break;

      case 16:
        str = "0x".concat(str);
        break;
    }

    const n = BigInt(str);
    return sign === '-' ? BigInt(-1) * n : n;
  }

  const n = parseInt(str, radix);
  return sign === '-' ? -1 * n : n;
}

function intStringify$1(node, radix, prefix) {
  const {
    value
  } = node;

  if (intIdentify$2(value)) {
    const str = value.toString(radix);
    return value < 0 ? '-' + prefix + str.substr(1) : prefix + str;
  }

  return stringifyNumber(node);
}

const yaml11 = failsafe.concat([{
  identify: value => value == null,
  createNode: (schema, value, ctx) => ctx.wrapScalars ? new Scalar(null) : null,
  default: true,
  tag: 'tag:yaml.org,2002:null',
  test: /^(?:~|[Nn]ull|NULL)?$/,
  resolve: str => {
    const node = new Scalar(null);
    node.sourceStr = str;
    return node;
  },
  options: nullOptions,
  stringify: ({
    sourceStr
  }) => sourceStr !== null && sourceStr !== void 0 ? sourceStr : nullOptions.nullStr
}, trueObj, falseObj, {
  identify: intIdentify$2,
  default: true,
  tag: 'tag:yaml.org,2002:int',
  format: 'BIN',
  test: /^[-+]?0b[0-1_]+$/,
  resolve: str => intResolve$1(str, 2, 2),
  stringify: node => intStringify$1(node, 2, '0b')
}, {
  identify: intIdentify$2,
  default: true,
  tag: 'tag:yaml.org,2002:int',
  format: 'OCT',
  test: /^[-+]?0[0-7_]+$/,
  resolve: str => intResolve$1(str, 1, 8),
  stringify: node => intStringify$1(node, 8, '0')
}, {
  identify: intIdentify$2,
  default: true,
  tag: 'tag:yaml.org,2002:int',
  test: /^[-+]?[0-9][0-9_]*$/,
  resolve: str => intResolve$1(str, 0, 10),
  stringify: stringifyNumber
}, {
  identify: intIdentify$2,
  default: true,
  tag: 'tag:yaml.org,2002:int',
  format: 'HEX',
  test: /^[-+]?0x[0-9a-fA-F_]+$/,
  resolve: str => intResolve$1(str, 2, 16),
  stringify: node => intStringify$1(node, 16, '0x')
}, {
  identify: value => typeof value === 'number',
  default: true,
  tag: 'tag:yaml.org,2002:float',
  test: /^[-+]?\.(?:inf|Inf|INF|nan|NaN|NAN)$/,
  resolve: str => str.slice(-3).toLowerCase() === 'nan' ? NaN : str[0] === '-' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
}, {
  identify: value => typeof value === 'number',
  default: true,
  tag: 'tag:yaml.org,2002:float',
  format: 'EXP',
  test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
  resolve: str => parseFloat(str.replace(/_/g, '')),
  stringify: ({
    value
  }) => Number(value).toExponential()
}, {
  identify: value => typeof value === 'number',
  default: true,
  tag: 'tag:yaml.org,2002:float',
  test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,

  resolve(str) {
    const node = new Scalar(parseFloat(str.replace(/_/g, '')));
    const dot = str.indexOf('.');

    if (dot !== -1) {
      const f = str.substring(dot + 1).replace(/_/g, '');
      if (f[f.length - 1] === '0') node.minFractionDigits = f.length;
    }

    return node;
  },

  stringify: stringifyNumber
}], binary, omap, pairs, set$1, intTime, floatTime, timestamp);

const schemas = {
  core,
  failsafe,
  json,
  yaml11
};
const tags = {
  binary,
  bool: boolObj,
  float: floatObj,
  floatExp: expObj,
  floatNaN: nanObj,
  floatTime,
  int: intObj,
  intHex: hexObj,
  intOct: octObj,
  intTime,
  map,
  null: nullObj,
  omap,
  pairs,
  seq,
  set: set$1,
  timestamp
};

function getSchemaTags(schemas, knownTags, customTags, schemaId) {
  let tags = schemas[schemaId.replace(/\W/g, '')]; // 'yaml-1.1' -> 'yaml11'

  if (!tags) {
    const keys = Object.keys(schemas).map(key => JSON.stringify(key)).join(', ');
    throw new Error("Unknown schema \"".concat(schemaId, "\"; use one of ").concat(keys));
  }

  if (Array.isArray(customTags)) {
    for (const tag of customTags) tags = tags.concat(tag);
  } else if (typeof customTags === 'function') {
    tags = customTags(tags.slice());
  }

  for (let i = 0; i < tags.length; ++i) {
    const tag = tags[i];

    if (typeof tag === 'string') {
      const tagObj = knownTags[tag];

      if (!tagObj) {
        const keys = Object.keys(knownTags).map(key => JSON.stringify(key)).join(', ');
        throw new Error("Unknown custom tag \"".concat(tag, "\"; use one of ").concat(keys));
      }

      tags[i] = tagObj;
    }
  }

  return tags;
}

const sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

const coreKnownTags = {
  'tag:yaml.org,2002:binary': tags.binary,
  'tag:yaml.org,2002:omap': tags.omap,
  'tag:yaml.org,2002:pairs': tags.pairs,
  'tag:yaml.org,2002:set': tags.set,
  'tag:yaml.org,2002:timestamp': tags.timestamp
};
class Schema {
  constructor({
    customTags,
    merge,
    resolveKnownTags,
    schema,
    sortMapEntries
  }) {
    this.merge = !!merge;
    this.name = schema;
    this.knownTags = resolveKnownTags ? coreKnownTags : {};
    this.tags = getSchemaTags(schemas, tags, customTags, schema); // Used by createNode(), to avoid circular dependencies

    this.map = tags.map;
    this.seq = tags.seq; // Used by createMap()

    this.sortMapEntries = sortMapEntries === true ? sortMapEntriesByKey : sortMapEntries || null;
  }

}

/**
 * Applies the JSON.parse reviver algorithm as defined in the ECMA-262 spec,
 * in section 24.5.1.1 "Runtime Semantics: InternalizeJSONProperty" of the
 * 2021 edition: https://tc39.es/ecma262/#sec-json.parse
 *
 * Includes extensions for handling Map and Set objects.
 */
function applyReviver(reviver, obj, key, val) {
  if (val && typeof val === 'object') {
    if (Array.isArray(val)) {
      for (let i = 0, len = val.length; i < len; ++i) {
        const v0 = val[i];
        const v1 = applyReviver(reviver, val, String(i), v0);
        if (v1 === undefined) delete val[i];else if (v1 !== v0) val[i] = v1;
      }
    } else if (val instanceof Map) {
      for (const k of Array.from(val.keys())) {
        const v0 = val.get(k);
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === undefined) val.delete(k);else if (v1 !== v0) val.set(k, v1);
      }
    } else if (val instanceof Set) {
      for (const v0 of Array.from(val)) {
        const v1 = applyReviver(reviver, val, v0, v0);
        if (v1 === undefined) val.delete(v0);else if (v1 !== v0) {
          val.delete(v0);
          val.add(v1);
        }
      }
    } else {
      for (const [k, v0] of Object.entries(val)) {
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === undefined) delete val[k];else if (v1 !== v0) val[k] = v1;
      }
    }
  }

  return reviver.call(obj, key, val);
}

const visit = (node, tags) => {
  if (node && typeof node === 'object') {
    const {
      tag
    } = node;

    if (node instanceof Collection$1) {
      if (tag) tags[tag] = true;
      node.items.forEach(n => visit(n, tags));
    } else if (node instanceof Pair) {
      visit(node.key, tags);
      visit(node.value, tags);
    } else if (node instanceof Scalar) {
      if (tag) tags[tag] = true;
    }
  }

  return tags;
};

const listTagNames = node => Object.keys(visit(node, {}));

function resolveTagHandle(doc, node) {
  const {
    handle,
    suffix
  } = node.tag;
  let prefix = doc.tagPrefixes.find(p => p.handle === handle);

  if (!prefix) {
    const dtp = doc.getDefaults().tagPrefixes;
    if (dtp) prefix = dtp.find(p => p.handle === handle);
    if (!prefix) throw new YAMLSemanticError(node, "The ".concat(handle, " tag handle is non-default and was not declared."));
  }

  if (!suffix) throw new YAMLSemanticError(node, "The ".concat(handle, " tag has no suffix."));

  if (handle === '!' && (doc.version || doc.options.version) === '1.0') {
    if (suffix[0] === '^') {
      doc.warnings.push(new YAMLWarning(node, 'YAML 1.0 ^ tag expansion is not supported'));
      return suffix;
    }

    if (/[:/]/.test(suffix)) {
      // word/foo -> tag:word.yaml.org,2002:foo
      const vocab = suffix.match(/^([a-z0-9-]+)\/(.*)/i);
      return vocab ? "tag:".concat(vocab[1], ".yaml.org,2002:").concat(vocab[2]) : "tag:".concat(suffix);
    }
  }

  return prefix.prefix + decodeURIComponent(suffix);
}

function resolveTagName(doc, node) {
  const {
    tag,
    type
  } = node;
  let nonSpecific = false;

  if (tag) {
    const {
      handle,
      suffix,
      verbatim
    } = tag;

    if (verbatim) {
      if (verbatim !== '!' && verbatim !== '!!') return verbatim;
      const msg = "Verbatim tags aren't resolved, so ".concat(verbatim, " is invalid.");
      doc.errors.push(new YAMLSemanticError(node, msg));
    } else if (handle === '!' && !suffix) {
      nonSpecific = true;
    } else {
      try {
        return resolveTagHandle(doc, node);
      } catch (error) {
        doc.errors.push(error);
      }
    }
  }

  switch (type) {
    case Type.BLOCK_FOLDED:
    case Type.BLOCK_LITERAL:
    case Type.QUOTE_DOUBLE:
    case Type.QUOTE_SINGLE:
      return defaultTags.STR;

    case Type.FLOW_MAP:
    case Type.MAP:
      return defaultTags.MAP;

    case Type.FLOW_SEQ:
    case Type.SEQ:
      return defaultTags.SEQ;

    case Type.PLAIN:
      return nonSpecific ? defaultTags.STR : null;

    default:
      return null;
  }
}

function checkFlowCollectionEnd(errors, cst) {
  let char, name;

  switch (cst.type) {
    case Type.FLOW_MAP:
      char = '}';
      name = 'flow map';
      break;

    case Type.FLOW_SEQ:
      char = ']';
      name = 'flow sequence';
      break;

    default:
      errors.push(new YAMLSemanticError(cst, 'Not a flow collection!?'));
      return;
  }

  let lastItem;

  for (let i = cst.items.length - 1; i >= 0; --i) {
    const item = cst.items[i];

    if (!item || item.type !== Type.COMMENT) {
      lastItem = item;
      break;
    }
  }

  if (lastItem && lastItem.char !== char) {
    const msg = "Expected ".concat(name, " to end with ").concat(char);
    let err;

    if (typeof lastItem.offset === 'number') {
      err = new YAMLSemanticError(cst, msg);
      err.offset = lastItem.offset + 1;
    } else {
      err = new YAMLSemanticError(lastItem, msg);
      if (lastItem.range && lastItem.range.end) err.offset = lastItem.range.end - lastItem.range.start;
    }

    errors.push(err);
  }
}
function checkFlowCommentSpace(errors, comment) {
  const prev = comment.context.src[comment.range.start - 1];

  if (prev !== '\n' && prev !== '\t' && prev !== ' ') {
    const msg = 'Comments must be separated from other tokens by white space characters';
    errors.push(new YAMLSemanticError(comment, msg));
  }
}
function getLongKeyError(source, key) {
  const sk = String(key);
  const k = sk.substr(0, 8) + '...' + sk.substr(-8);
  return new YAMLSemanticError(source, "The \"".concat(k, "\" key is too long"));
}
function resolveComments(collection, comments) {
  for (const {
    afterKey,
    before,
    comment
  } of comments) {
    let item = collection.items[before];

    if (!item) {
      if (comment !== undefined) {
        if (collection.comment) collection.comment += '\n' + comment;else collection.comment = comment;
      }
    } else {
      if (afterKey && item.value) item = item.value;

      if (comment === undefined) {
        if (afterKey || !item.commentBefore) item.spaceBefore = true;
      } else {
        if (item.commentBefore) item.commentBefore += '\n' + comment;else item.commentBefore = comment;
      }
    }
  }
}

function resolveMap(doc, cst) {
  const {
    comments,
    items
  } = cst.type === Type.FLOW_MAP ? resolveFlowMapItems(doc, cst) : resolveBlockMapItems(doc, cst);
  const map = new YAMLMap(doc.schema);
  map.items = items;
  resolveComments(map, comments);

  for (let i = 0; i < items.length; ++i) {
    const {
      key: iKey
    } = items[i];

    if (doc.schema.merge && iKey && iKey.value === MERGE_KEY) {
      items[i] = new Merge(items[i]);
      const sources = items[i].value.items;
      let error = null;
      sources.some(node => {
        if (node instanceof Alias$1) {
          // During parsing, alias sources are CST nodes; to account for
          // circular references their resolved values can't be used here.
          const {
            type
          } = node.source;
          if (type === Type.MAP || type === Type.FLOW_MAP) return false;
          return error = 'Merge nodes aliases can only point to maps';
        }

        return error = 'Merge nodes can only have Alias nodes as values';
      });
      if (error) doc.errors.push(new YAMLSemanticError(cst, error));
    } else {
      for (let j = i + 1; j < items.length; ++j) {
        const {
          key: jKey
        } = items[j];

        if (iKey === jKey || iKey && jKey && Object.prototype.hasOwnProperty.call(iKey, 'value') && iKey.value === jKey.value) {
          const msg = "Map keys must be unique; \"".concat(iKey, "\" is repeated");
          doc.errors.push(new YAMLSemanticError(cst, msg));
          break;
        }
      }
    }
  }

  cst.resolved = map;
  return map;
}

const valueHasPairComment = ({
  context: {
    lineStart,
    node,
    src
  },
  props
}) => {
  if (props.length === 0) return false;
  const {
    start
  } = props[0];
  if (node && start > node.valueRange.start) return false;
  if (src[start] !== Char.COMMENT) return false;

  for (let i = lineStart; i < start; ++i) if (src[i] === '\n') return false;

  return true;
};

function resolvePairComment(item, pair) {
  if (!valueHasPairComment(item)) return;
  const comment = item.getPropValue(0, Char.COMMENT, true);
  let found = false;
  const cb = pair.value.commentBefore;

  if (cb && cb.startsWith(comment)) {
    pair.value.commentBefore = cb.substr(comment.length + 1);
    found = true;
  } else {
    const cc = pair.value.comment;

    if (!item.node && cc && cc.startsWith(comment)) {
      pair.value.comment = cc.substr(comment.length + 1);
      found = true;
    }
  }

  if (found) pair.comment = comment;
}

function resolveBlockMapItems(doc, cst) {
  const comments = [];
  const items = [];
  let key = undefined;
  let keyStart = null;

  for (let i = 0; i < cst.items.length; ++i) {
    const item = cst.items[i];

    switch (item.type) {
      case Type.BLANK_LINE:
        comments.push({
          afterKey: !!key,
          before: items.length
        });
        break;

      case Type.COMMENT:
        comments.push({
          afterKey: !!key,
          before: items.length,
          comment: item.comment
        });
        break;

      case Type.MAP_KEY:
        if (key !== undefined) items.push(new Pair(key));
        if (item.error) doc.errors.push(item.error);
        key = resolveNode(doc, item.node);
        keyStart = null;
        break;

      case Type.MAP_VALUE:
        {
          if (key === undefined) key = null;
          if (item.error) doc.errors.push(item.error);

          if (!item.context.atLineStart && item.node && item.node.type === Type.MAP && !item.node.context.atLineStart) {
            const msg = 'Nested mappings are not allowed in compact mappings';
            doc.errors.push(new YAMLSemanticError(item.node, msg));
          }

          let valueNode = item.node;

          if (!valueNode && item.props.length > 0) {
            // Comments on an empty mapping value need to be preserved, so we
            // need to construct a minimal empty node here to use instead of the
            // missing `item.node`. -- eemeli/yaml#19
            valueNode = new PlainValue(Type.PLAIN, []);
            valueNode.context = {
              parent: item,
              src: item.context.src
            };
            const pos = item.range.start + 1;
            valueNode.range = {
              start: pos,
              end: pos
            };
            valueNode.valueRange = {
              start: pos,
              end: pos
            };

            if (typeof item.range.origStart === 'number') {
              const origPos = item.range.origStart + 1;
              valueNode.range.origStart = valueNode.range.origEnd = origPos;
              valueNode.valueRange.origStart = valueNode.valueRange.origEnd = origPos;
            }
          }

          const pair = new Pair(key, resolveNode(doc, valueNode));
          resolvePairComment(item, pair);
          items.push(pair);

          if (key && typeof keyStart === 'number') {
            if (item.range.start > keyStart + 1024) doc.errors.push(getLongKeyError(cst, key));
          }

          key = undefined;
          keyStart = null;
        }
        break;

      default:
        if (key !== undefined) items.push(new Pair(key));
        key = resolveNode(doc, item);
        keyStart = item.range.start;
        if (item.error) doc.errors.push(item.error);

        next: for (let j = i + 1;; ++j) {
          const nextItem = cst.items[j];

          switch (nextItem && nextItem.type) {
            case Type.BLANK_LINE:
            case Type.COMMENT:
              continue next;

            case Type.MAP_VALUE:
              break next;

            default:
              {
                const msg = 'Implicit map keys need to be followed by map values';
                doc.errors.push(new YAMLSemanticError(item, msg));
                break next;
              }
          }
        }

        if (item.valueRangeContainsNewline) {
          const msg = 'Implicit map keys need to be on a single line';
          doc.errors.push(new YAMLSemanticError(item, msg));
        }

    }
  }

  if (key !== undefined) items.push(new Pair(key));
  return {
    comments,
    items
  };
}

function resolveFlowMapItems(doc, cst) {
  const comments = [];
  const items = [];
  let key = undefined;
  let explicitKey = false;
  let next = '{';

  for (let i = 0; i < cst.items.length; ++i) {
    const item = cst.items[i];

    if (typeof item.char === 'string') {
      const {
        char,
        offset
      } = item;

      if (char === '?' && key === undefined && !explicitKey) {
        explicitKey = true;
        next = ':';
        continue;
      }

      if (char === ':') {
        if (key === undefined) key = null;

        if (next === ':') {
          next = ',';
          continue;
        }
      } else {
        if (explicitKey) {
          if (key === undefined && char !== ',') key = null;
          explicitKey = false;
        }

        if (key !== undefined) {
          items.push(new Pair(key));
          key = undefined;

          if (char === ',') {
            next = ':';
            continue;
          }
        }
      }

      if (char === '}') {
        if (i === cst.items.length - 1) continue;
      } else if (char === next) {
        next = ':';
        continue;
      }

      const msg = "Flow map contains an unexpected ".concat(char);
      const err = new YAMLSyntaxError(cst, msg);
      err.offset = offset;
      doc.errors.push(err);
    } else if (item.type === Type.BLANK_LINE) {
      comments.push({
        afterKey: !!key,
        before: items.length
      });
    } else if (item.type === Type.COMMENT) {
      checkFlowCommentSpace(doc.errors, item);
      comments.push({
        afterKey: !!key,
        before: items.length,
        comment: item.comment
      });
    } else if (key === undefined) {
      if (next === ',') doc.errors.push(new YAMLSemanticError(item, 'Separator , missing in flow map'));
      key = resolveNode(doc, item);
    } else {
      if (next !== ',') doc.errors.push(new YAMLSemanticError(item, 'Indicator : missing in flow map entry'));
      items.push(new Pair(key, resolveNode(doc, item)));
      key = undefined;
      explicitKey = false;
    }
  }

  checkFlowCollectionEnd(doc.errors, cst);
  if (key !== undefined) items.push(new Pair(key));
  return {
    comments,
    items
  };
}

function resolveSeq(doc, cst) {
  const {
    comments,
    items
  } = cst.type === Type.FLOW_SEQ ? resolveFlowSeqItems(doc, cst) : resolveBlockSeqItems(doc, cst);
  const seq = new YAMLSeq(doc.schema);
  seq.items = items;
  resolveComments(seq, comments);
  cst.resolved = seq;
  return seq;
}

function resolveBlockSeqItems(doc, cst) {
  const comments = [];
  const items = [];

  for (let i = 0; i < cst.items.length; ++i) {
    const item = cst.items[i];

    switch (item.type) {
      case Type.BLANK_LINE:
        comments.push({
          before: items.length
        });
        break;

      case Type.COMMENT:
        comments.push({
          comment: item.comment,
          before: items.length
        });
        break;

      case Type.SEQ_ITEM:
        if (item.error) doc.errors.push(item.error);
        items.push(resolveNode(doc, item.node));

        if (item.hasProps) {
          const msg = 'Sequence items cannot have tags or anchors before the - indicator';
          doc.errors.push(new YAMLSemanticError(item, msg));
        }

        break;

      default:
        if (item.error) doc.errors.push(item.error);
        doc.errors.push(new YAMLSyntaxError(item, "Unexpected ".concat(item.type, " node in sequence")));
    }
  }

  return {
    comments,
    items
  };
}

function resolveFlowSeqItems(doc, cst) {
  const comments = [];
  const items = [];
  let explicitKey = false;
  let key = undefined;
  let keyStart = null;
  let next = '[';
  let prevItem = null;

  for (let i = 0; i < cst.items.length; ++i) {
    const item = cst.items[i];

    if (typeof item.char === 'string') {
      const {
        char,
        offset
      } = item;

      if (char !== ':' && (explicitKey || key !== undefined)) {
        if (explicitKey && key === undefined) key = next ? items.pop() : null;
        items.push(new Pair(key));
        explicitKey = false;
        key = undefined;
        keyStart = null;
      }

      if (char === next) {
        next = null;
      } else if (!next && char === '?') {
        explicitKey = true;
      } else if (next !== '[' && char === ':' && key === undefined) {
        if (next === ',') {
          key = items.pop();

          if (key instanceof Pair) {
            const msg = 'Chaining flow sequence pairs is invalid';
            const err = new YAMLSemanticError(cst, msg);
            err.offset = offset;
            doc.errors.push(err);
          }

          if (!explicitKey && typeof keyStart === 'number') {
            const keyEnd = item.range ? item.range.start : item.offset;
            if (keyEnd > keyStart + 1024) doc.errors.push(getLongKeyError(cst, key));
            const {
              src
            } = prevItem.context;

            for (let i = keyStart; i < keyEnd; ++i) if (src[i] === '\n') {
              const msg = 'Implicit keys of flow sequence pairs need to be on a single line';
              doc.errors.push(new YAMLSemanticError(prevItem, msg));
              break;
            }
          }
        } else {
          key = null;
        }

        keyStart = null;
        explicitKey = false;
        next = null;
      } else if (next === '[' || char !== ']' || i < cst.items.length - 1) {
        const msg = "Flow sequence contains an unexpected ".concat(char);
        const err = new YAMLSyntaxError(cst, msg);
        err.offset = offset;
        doc.errors.push(err);
      }
    } else if (item.type === Type.BLANK_LINE) {
      comments.push({
        before: items.length
      });
    } else if (item.type === Type.COMMENT) {
      checkFlowCommentSpace(doc.errors, item);
      comments.push({
        comment: item.comment,
        before: items.length
      });
    } else {
      if (next) {
        const msg = "Expected a ".concat(next, " in flow sequence");
        doc.errors.push(new YAMLSemanticError(item, msg));
      }

      const value = resolveNode(doc, item);

      if (key === undefined) {
        items.push(value);
        prevItem = item;
      } else {
        items.push(new Pair(key, value));
        key = undefined;
      }

      keyStart = item.range.start;
      next = ',';
    }
  }

  checkFlowCollectionEnd(doc.errors, cst);
  if (key !== undefined) items.push(new Pair(key));
  return {
    comments,
    items
  };
}

function resolveByTagName({
  knownTags,
  tags
}, tagName, value, onError) {
  const matchWithTest = [];

  for (const tag of tags) {
    if (tag.tag === tagName) {
      if (tag.test) {
        if (typeof value === 'string') matchWithTest.push(tag);else onError("The tag ".concat(tagName, " cannot be applied to a collection"));
      } else {
        const res = tag.resolve(value, onError);
        return res instanceof Collection$1 ? res : new Scalar(res);
      }
    }
  }

  if (matchWithTest.length > 0) return resolveScalar(value, matchWithTest);
  const kt = knownTags[tagName];

  if (kt) {
    tags.push(Object.assign({}, kt, {
      default: false,
      test: undefined
    }));
    const res = kt.resolve(value, onError);
    return res instanceof Collection$1 ? res : new Scalar(res);
  }

  return null;
}

function resolveTag(doc, node, tagName) {
  const {
    MAP,
    SEQ,
    STR
  } = defaultTags;
  let value, fallback;

  const onError = message => doc.errors.push(new YAMLSemanticError(node, message));

  try {
    switch (node.type) {
      case Type.FLOW_MAP:
      case Type.MAP:
        value = resolveMap(doc, node);
        fallback = MAP;
        if (tagName === SEQ || tagName === STR) onError("The tag ".concat(tagName, " cannot be applied to a mapping"));
        break;

      case Type.FLOW_SEQ:
      case Type.SEQ:
        value = resolveSeq(doc, node);
        fallback = SEQ;
        if (tagName === MAP || tagName === STR) onError("The tag ".concat(tagName, " cannot be applied to a sequence"));
        break;

      default:
        value = node.strValue || '';

        if (typeof value !== 'string') {
          value.errors.forEach(error => doc.errors.push(error));
          value = value.str;
        }

        if (tagName === MAP || tagName === SEQ) onError("The tag ".concat(tagName, " cannot be applied to a scalar"));
        fallback = STR;
    }

    const res = resolveByTagName(doc.schema, tagName, value, onError);

    if (res) {
      if (tagName && node.tag) res.tag = tagName;
      return res;
    }
  } catch (error) {
    /* istanbul ignore if */
    if (!error.source) error.source = node;
    doc.errors.push(error);
    return null;
  }

  try {
    if (!fallback) throw new Error("The tag ".concat(tagName, " is unavailable"));
    const msg = "The tag ".concat(tagName, " is unavailable, falling back to ").concat(fallback);
    doc.warnings.push(new YAMLWarning(node, msg));
    const res = resolveByTagName(doc.schema, fallback, value, onError);
    res.tag = tagName;
    return res;
  } catch (error) {
    const refError = new YAMLReferenceError(node, error.message);
    refError.stack = error.stack;
    doc.errors.push(refError);
    return null;
  }
}

const isCollectionItem = node => {
  if (!node) return false;
  const {
    type
  } = node;
  return type === Type.MAP_KEY || type === Type.MAP_VALUE || type === Type.SEQ_ITEM;
};

function resolveNodeProps(errors, node) {
  const comments = {
    before: [],
    after: []
  };
  let hasAnchor = false;
  let hasTag = false;
  const props = isCollectionItem(node.context.parent) ? node.context.parent.props.concat(node.props) : node.props;

  for (const {
    start,
    end
  } of props) {
    switch (node.context.src[start]) {
      case Char.COMMENT:
        {
          if (!node.commentHasRequiredWhitespace(start)) {
            const msg = 'Comments must be separated from other tokens by white space characters';
            errors.push(new YAMLSemanticError(node, msg));
          }

          const {
            header,
            valueRange
          } = node;
          const cc = valueRange && (start > valueRange.start || header && start > header.start) ? comments.after : comments.before;
          cc.push(node.context.src.slice(start + 1, end));
          break;
        }
      // Actual anchor & tag resolution is handled by schema, here we just complain

      case Char.ANCHOR:
        if (hasAnchor) {
          const msg = 'A node can have at most one anchor';
          errors.push(new YAMLSemanticError(node, msg));
        }

        hasAnchor = true;
        break;

      case Char.TAG:
        if (hasTag) {
          const msg = 'A node can have at most one tag';
          errors.push(new YAMLSemanticError(node, msg));
        }

        hasTag = true;
        break;
    }
  }

  return {
    comments,
    hasAnchor,
    hasTag
  };
}

function resolveNodeValue(doc, node) {
  const {
    anchors,
    errors,
    schema
  } = doc;

  if (node.type === Type.ALIAS) {
    const name = node.rawValue;
    const src = anchors.getNode(name);

    if (!src) {
      const msg = "Aliased anchor not found: ".concat(name);
      errors.push(new YAMLReferenceError(node, msg));
      return null;
    } // Lazy resolution for circular references


    const res = new Alias$1(src);

    anchors._cstAliases.push(res);

    return res;
  }

  const tagName = resolveTagName(doc, node);
  if (tagName) return resolveTag(doc, node, tagName);

  if (node.type !== Type.PLAIN) {
    const msg = "Failed to resolve ".concat(node.type, " node here");
    errors.push(new YAMLSyntaxError(node, msg));
    return null;
  }

  try {
    let str = node.strValue || '';

    if (typeof str !== 'string') {
      str.errors.forEach(error => doc.errors.push(error));
      str = str.str;
    }

    return resolveScalar(str, schema.tags);
  } catch (error) {
    if (!error.source) error.source = node;
    errors.push(error);
    return null;
  }
} // sets node.resolved on success


function resolveNode(doc, node) {
  if (!node) return null;
  if (node.error) doc.errors.push(node.error);
  const {
    comments,
    hasAnchor,
    hasTag
  } = resolveNodeProps(doc.errors, node);

  if (hasAnchor) {
    const {
      anchors
    } = doc;
    const name = node.anchor;
    const prev = anchors.getNode(name); // At this point, aliases for any preceding node with the same anchor
    // name have already been resolved, so it may safely be renamed.

    if (prev) anchors.map[anchors.newName(name)] = prev; // During parsing, we need to store the CST node in anchors.map as
    // anchors need to be available during resolution to allow for
    // circular references.

    anchors.map[name] = node;
  }

  if (node.type === Type.ALIAS && (hasAnchor || hasTag)) {
    const msg = 'An alias node must not specify any properties';
    doc.errors.push(new YAMLSemanticError(node, msg));
  }

  const res = resolveNodeValue(doc, node);

  if (res) {
    res.range = [node.range.start, node.range.end];
    if (doc.options.keepCstNodes) res.cstNode = node;
    if (doc.options.keepNodeTypes) res.type = node.type;
    const cb = comments.before.join('\n');

    if (cb) {
      res.commentBefore = res.commentBefore ? "".concat(res.commentBefore, "\n").concat(cb) : cb;
    }

    const ca = comments.after.join('\n');
    if (ca) res.comment = res.comment ? "".concat(res.comment, "\n").concat(ca) : ca;
  }

  return node.resolved = res;
}

function parseContents(doc, contents) {
  const comments = {
    before: [],
    after: []
  };
  let body = undefined;
  let spaceBefore = false;

  for (const node of contents) {
    if (node.valueRange) {
      if (body !== undefined) {
        const msg = 'Document contains trailing content not separated by a ... or --- line';
        doc.errors.push(new YAMLSyntaxError(node, msg));
        break;
      }

      const res = resolveNode(doc, node);

      if (spaceBefore) {
        res.spaceBefore = true;
        spaceBefore = false;
      }

      body = res;
    } else if (node.comment !== null) {
      const cc = body === undefined ? comments.before : comments.after;
      cc.push(node.comment);
    } else if (node.type === Type.BLANK_LINE) {
      spaceBefore = true;

      if (body === undefined && comments.before.length > 0 && !doc.commentBefore) {
        // space-separated comments at start are parsed as document comments
        doc.commentBefore = comments.before.join('\n');
        comments.before = [];
      }
    }
  }

  doc.contents = body || null;

  if (!body) {
    doc.comment = comments.before.concat(comments.after).join('\n') || null;
  } else {
    const cb = comments.before.join('\n');

    if (cb) {
      const cbNode = body instanceof Collection$1 && body.items[0] ? body.items[0] : body;
      cbNode.commentBefore = cbNode.commentBefore ? "".concat(cb, "\n").concat(cbNode.commentBefore) : cb;
    }

    doc.comment = comments.after.join('\n') || null;
  }
}

function resolveTagDirective({
  tagPrefixes
}, directive) {
  const [handle, prefix] = directive.parameters;

  if (!handle || !prefix) {
    const msg = 'Insufficient parameters given for %TAG directive';
    throw new YAMLSemanticError(directive, msg);
  }

  if (tagPrefixes.some(p => p.handle === handle)) {
    const msg = 'The %TAG directive must only be given at most once per handle in the same document.';
    throw new YAMLSemanticError(directive, msg);
  }

  return {
    handle,
    prefix
  };
}

function resolveYamlDirective(doc, directive) {
  let [version] = directive.parameters;
  if (directive.name === 'YAML:1.0') version = '1.0';

  if (!version) {
    const msg = 'Insufficient parameters given for %YAML directive';
    throw new YAMLSemanticError(directive, msg);
  }

  if (!documentOptions[version]) {
    const v0 = doc.version || doc.options.version;
    const msg = "Document will be parsed as YAML ".concat(v0, " rather than YAML ").concat(version);
    doc.warnings.push(new YAMLWarning(directive, msg));
  }

  return version;
}

function parseDirectives(doc, directives, prevDoc) {
  const directiveComments = [];
  let hasDirectives = false;

  for (const directive of directives) {
    const {
      comment,
      name
    } = directive;

    switch (name) {
      case 'TAG':
        try {
          doc.tagPrefixes.push(resolveTagDirective(doc, directive));
        } catch (error) {
          doc.errors.push(error);
        }

        hasDirectives = true;
        break;

      case 'YAML':
      case 'YAML:1.0':
        if (doc.version) {
          const msg = 'The %YAML directive must only be given at most once per document.';
          doc.errors.push(new YAMLSemanticError(directive, msg));
        }

        try {
          doc.version = resolveYamlDirective(doc, directive);
        } catch (error) {
          doc.errors.push(error);
        }

        hasDirectives = true;
        break;

      default:
        if (name) {
          const msg = "YAML only supports %TAG and %YAML directives, and not %".concat(name);
          doc.warnings.push(new YAMLWarning(directive, msg));
        }

    }

    if (comment) directiveComments.push(comment);
  }

  if (prevDoc && !hasDirectives && '1.1' === (doc.version || prevDoc.version || doc.options.version)) {
    const copyTagPrefix = ({
      handle,
      prefix
    }) => ({
      handle,
      prefix
    });

    doc.tagPrefixes = prevDoc.tagPrefixes.map(copyTagPrefix);
    doc.version = prevDoc.version;
  }

  doc.commentBefore = directiveComments.join('\n') || null;
}

function assertCollection(contents) {
  if (contents instanceof Collection$1) return true;
  throw new Error('Expected a YAML collection as document contents');
}

class Document$1 {
  constructor(value, replacer, options) {
    if (options === undefined && replacer && typeof replacer === 'object' && !Array.isArray(replacer)) {
      options = replacer;
      replacer = undefined;
    }

    this.options = Object.assign({}, defaultOptions, options);
    this.anchors = new Anchors(this.options.anchorPrefix);
    this.commentBefore = null;
    this.comment = null;
    this.directivesEndMarker = null;
    this.errors = [];
    this.schema = null;
    this.tagPrefixes = [];
    this.version = null;
    this.warnings = [];

    if (value === undefined) {
      // note that this.schema is left as null here
      this.contents = null;
    } else if (value instanceof Document) {
      this.parse(value);
    } else {
      this.contents = this.createNode(value, {
        replacer
      });
    }
  }

  add(value) {
    assertCollection(this.contents);
    return this.contents.add(value);
  }

  addIn(path, value) {
    assertCollection(this.contents);
    this.contents.addIn(path, value);
  }

  createNode(value, {
    keepUndefined,
    onTagObj,
    replacer,
    tag,
    wrapScalars
  } = {}) {
    this.setSchema();
    if (typeof replacer === 'function') value = replacer.call({
      '': value
    }, '', value);else if (Array.isArray(replacer)) {
      const keyToStr = v => typeof v === 'number' || v instanceof String || v instanceof Number;

      const asStr = replacer.filter(keyToStr).map(String);
      if (asStr.length > 0) replacer = replacer.concat(asStr);
    }
    if (typeof keepUndefined !== 'boolean') keepUndefined = !!this.options.keepUndefined;
    const aliasNodes = [];
    const ctx = {
      keepUndefined,

      onAlias(source) {
        const alias = new Alias$1(source);
        aliasNodes.push(alias);
        return alias;
      },

      onTagObj,
      prevObjects: new Map(),
      replacer,
      schema: this.schema,
      wrapScalars: wrapScalars !== false
    };
    const node = createNode(value, tag, ctx);

    for (const alias of aliasNodes) {
      // With circular references, the source node is only resolved after all of
      // its child nodes are. This is why anchors are set only after all of the
      // nodes have been created.
      alias.source = alias.source.node;
      let name = this.anchors.getName(alias.source);

      if (!name) {
        name = this.anchors.newName();
        this.anchors.map[name] = alias.source;
      }
    }

    return node;
  }

  createPair(key, value, options = {}) {
    const k = this.createNode(key, options);
    const v = this.createNode(value, options);
    return new Pair(k, v);
  }

  delete(key) {
    assertCollection(this.contents);
    return this.contents.delete(key);
  }

  deleteIn(path) {
    if (isEmptyPath(path)) {
      if (this.contents == null) return false;
      this.contents = null;
      return true;
    }

    assertCollection(this.contents);
    return this.contents.deleteIn(path);
  }

  getDefaults() {
    return Document$1.defaults[this.version] || Document$1.defaults[this.options.version] || {};
  }

  get(key, keepScalar) {
    return this.contents instanceof Collection$1 ? this.contents.get(key, keepScalar) : undefined;
  }

  getIn(path, keepScalar) {
    if (isEmptyPath(path)) return !keepScalar && this.contents instanceof Scalar ? this.contents.value : this.contents;
    return this.contents instanceof Collection$1 ? this.contents.getIn(path, keepScalar) : undefined;
  }

  has(key) {
    return this.contents instanceof Collection$1 ? this.contents.has(key) : false;
  }

  hasIn(path) {
    if (isEmptyPath(path)) return this.contents !== undefined;
    return this.contents instanceof Collection$1 ? this.contents.hasIn(path) : false;
  }

  set(key, value) {
    if (this.contents == null) {
      this.setSchema();
      this.contents = collectionFromPath(this.schema, [key], value);
    } else {
      assertCollection(this.contents);
      this.contents.set(key, value);
    }
  }

  setIn(path, value) {
    if (isEmptyPath(path)) this.contents = value;else if (this.contents == null) {
      this.setSchema();
      this.contents = collectionFromPath(this.schema, path, value);
    } else {
      assertCollection(this.contents);
      this.contents.setIn(path, value);
    }
  }

  setSchema(id, customTags) {
    if (!id && !customTags && this.schema) return;
    if (typeof id === 'number') id = id.toFixed(1);

    if (id === '1.0' || id === '1.1' || id === '1.2') {
      if (this.version) this.version = id;else this.options.version = id;
      delete this.options.schema;
    } else if (id && typeof id === 'string') {
      this.options.schema = id;
    }

    if (Array.isArray(customTags)) this.options.customTags = customTags;
    const opt = Object.assign({}, this.getDefaults(), this.options);
    this.schema = new Schema(opt);
  }

  parse(node, prevDoc) {
    if (this.options.keepCstNodes) this.cstNode = node;
    if (this.options.keepNodeTypes) this.type = 'DOCUMENT';
    const {
      directives = [],
      contents = [],
      directivesEndMarker,
      error,
      valueRange
    } = node;

    if (error) {
      if (!error.source) error.source = this;
      this.errors.push(error);
    }

    parseDirectives(this, directives, prevDoc);
    if (directivesEndMarker) this.directivesEndMarker = true;
    this.range = valueRange ? [valueRange.start, valueRange.end] : null;
    this.setSchema();
    this.anchors._cstAliases = [];
    parseContents(this, contents);
    this.anchors.resolveNodes();

    if (this.options.prettyErrors) {
      for (const error of this.errors) if (error instanceof YAMLError) error.makePretty();

      for (const warn of this.warnings) if (warn instanceof YAMLError) warn.makePretty();
    }

    return this;
  }

  listNonDefaultTags() {
    return listTagNames(this.contents).filter(t => t.indexOf(defaultTagPrefix) !== 0);
  }

  setTagPrefix(handle, prefix) {
    if (handle[0] !== '!' || handle[handle.length - 1] !== '!') throw new Error('Handle must start and end with !');

    if (prefix) {
      const prev = this.tagPrefixes.find(p => p.handle === handle);
      if (prev) prev.prefix = prefix;else this.tagPrefixes.push({
        handle,
        prefix
      });
    } else {
      this.tagPrefixes = this.tagPrefixes.filter(p => p.handle !== handle);
    }
  }

  toJS({
    json,
    jsonArg,
    mapAsMap,
    onAnchor,
    reviver
  } = {}) {
    const anchorNodes = Object.values(this.anchors.map).map(node => [node, {
      alias: [],
      aliasCount: 0,
      count: 1
    }]);
    const anchors = anchorNodes.length > 0 ? new Map(anchorNodes) : null;
    const ctx = {
      anchors,
      doc: this,
      indentStep: '  ',
      keep: !json,
      mapAsMap: typeof mapAsMap === 'boolean' ? mapAsMap : !!this.options.mapAsMap,
      mapKeyWarned: false,
      maxAliasCount: this.options.maxAliasCount,
      stringify // Requiring directly in Pair would create circular dependencies

    };
    const res = toJS(this.contents, jsonArg || '', ctx);
    if (typeof onAnchor === 'function' && anchors) for (const {
      count,
      res
    } of anchors.values()) onAnchor(res, count);
    return typeof reviver === 'function' ? applyReviver(reviver, {
      '': res
    }, '', res) : res;
  }

  toJSON(jsonArg, onAnchor) {
    return this.toJS({
      json: true,
      jsonArg,
      mapAsMap: false,
      onAnchor
    });
  }

  toString() {
    if (this.errors.length > 0) throw new Error('Document with errors cannot be stringified');
    const indentSize = this.options.indent;

    if (!Number.isInteger(indentSize) || indentSize <= 0) {
      const s = JSON.stringify(indentSize);
      throw new Error("\"indent\" option must be a positive integer, not ".concat(s));
    }

    this.setSchema();
    const lines = [];
    let hasDirectives = false;

    if (this.version) {
      let vd = '%YAML 1.2';

      if (this.schema.name === 'yaml-1.1') {
        if (this.version === '1.0') vd = '%YAML:1.0';else if (this.version === '1.1') vd = '%YAML 1.1';
      }

      lines.push(vd);
      hasDirectives = true;
    }

    const tagNames = this.listNonDefaultTags();
    this.tagPrefixes.forEach(({
      handle,
      prefix
    }) => {
      if (tagNames.some(t => t.indexOf(prefix) === 0)) {
        lines.push("%TAG ".concat(handle, " ").concat(prefix));
        hasDirectives = true;
      }
    });
    if (hasDirectives || this.directivesEndMarker) lines.push('---');

    if (this.commentBefore) {
      if (hasDirectives || !this.directivesEndMarker) lines.unshift('');
      lines.unshift(this.commentBefore.replace(/^/gm, '#'));
    }

    const ctx = {
      anchors: Object.create(null),
      doc: this,
      indent: '',
      indentStep: ' '.repeat(indentSize),
      stringify // Requiring directly in nodes would create circular dependencies

    };
    let chompKeep = false;
    let contentComment = null;

    if (this.contents) {
      if (this.contents instanceof Node$1) {
        if (this.contents.spaceBefore && (hasDirectives || this.directivesEndMarker)) lines.push('');
        if (this.contents.commentBefore) lines.push(this.contents.commentBefore.replace(/^/gm, '#')); // top-level block scalars need to be indented if followed by a comment

        ctx.forceBlockIndent = !!this.comment;
        contentComment = this.contents.comment;
      }

      const onChompKeep = contentComment ? null : () => chompKeep = true;
      const body = stringify(this.contents, ctx, () => contentComment = null, onChompKeep);
      lines.push(addComment(body, '', contentComment));
    } else {
      lines.push(stringify(this.contents, ctx));
    }

    if (this.comment) {
      if ((!chompKeep || contentComment) && lines[lines.length - 1] !== '') lines.push('');
      lines.push(this.comment.replace(/^/gm, '#'));
    }

    return lines.join('\n') + '\n';
  }

}

_defineProperty(Document$1, "defaults", documentOptions);

function parseDocument(src, options) {
  const cst = parse(src);
  const doc = new Document$1(cst[0], null, options);

  if (cst.length > 1 && LogLevel.indexOf(doc.options.logLevel) >= LogLevel.ERROR) {
    const errMsg = 'Source contains multiple documents; please use YAML.parseAllDocuments()';
    doc.errors.unshift(new YAMLSemanticError(cst[1], errMsg));
  }

  return doc;
}

class File {

    constructor(app, filename, tagPositions, hasFrontMatter) {
        this.app = app;
        this.filename = filename;
        this.basename = filename.split("/").pop();
        this.tagPositions = tagPositions;
        this.hasFrontMatter = !!hasFrontMatter;
    }

    /** @param {Replacement} replace */
    async renamed(replace) {
        const file = this.app.vault.getAbstractFileByPath(this.filename);
        const original = await this.app.vault.read(file);
        let text = original;

        for (const { position: { start, end }, tag } of this.tagPositions) {
            if (text.slice(start.offset, end.offset) !== tag) {
                const msg = `File ${this.filename} has changed; skipping`;
                new obsidian.Notice(msg);
                console.error(msg);
                console.debug(text.slice(start.offset, end.offset), tag);
                return;
            }
            text = replace.inString(text, start.offset);
        }

        if (this.hasFrontMatter)
            text = this.replaceInFrontMatter(text, replace);

        if (text !== original) {
            await this.app.vault.modify(file, text);
            return true;
        }
    }

    /** @param {Replacement} replace */
    replaceInFrontMatter(text, replace) {
        const [empty, frontMatter] = text.split(/^---\r?$\n?/m, 2);

        // Check for valid, non-empty, properly terminated front matter
        if (empty !== "" || !frontMatter.trim() || !frontMatter.endsWith("\n"))
            return text;

        const parsed = parseDocument(frontMatter);
        if (parsed.errors.length) {
            const error = `YAML issue with ${this.filename}: ${parsed.errors[0]}`;
            console.error(error); new obsidian.Notice(error + "; skipping frontmatter");
            return;
        }

        let changed = false;
        for (const {key: {value:prop}} of parsed.contents.items) {
            if (!/^tags?$/i.test(prop)) continue;
            const node = parsed.get(prop, true);
            if (!node) continue;
            const field = node.toJSON();
            if (!field || !field.length) continue;
            if (typeof field === "string") {
                const parts = field.split(/(\s*,\s*|^\s+|\s+$)/);
                const after = replace.inArray(parts, true).join("");
                if (field != after) { parsed.set(prop, after); changed = true; }
            } else if (Array.isArray(field)) {
                replace.inArray(field).forEach((v, i) => {
                    if (field[i] !== v)
                        node.set(i, v); changed = true;
                });
            }
        }
        return changed ? text.replace(frontMatter, parsed.toString()) : text;
    }
}

async function renameTag(app, tagName) {
    const newName = await promptForNewName(tagName);
    if (newName === false) return;  // aborted

    if (!newName || newName === tagName) {
        return new obsidian.Notice("Unchanged or empty tag: No changes made.");
    }

    const
        oldTag  = new Tag(tagName),
        newTag  = new Tag(newName),
        replace = new Replacement(oldTag, newTag),
        clashing = replace.willMergeTags(
            allTags(app).reverse()   // find longest clash first
        ),
        shouldAbort = clashing &&
            await shouldAbortDueToClash(clashing, oldTag, newTag)
        ;

    if (shouldAbort) return;

    const targets = await findTargets(app, oldTag);
    if (!targets) return;

    const progress = new Progress(`Renaming to #${newName}/*`, "Processing files...");
    let renamed = 0;
    await progress.forEach(targets, async (target) => {
        progress.message = "Processing " + target.basename;
        if (await target.renamed(replace)) renamed++;
    });

    return new obsidian.Notice(`Operation ${progress.aborted ? "cancelled" : "complete"}: ${renamed} file(s) updated`);
}

function allTags(app) {
    return Object.keys(app.metadataCache.getTags());
}

async function findTargets(app, tag) {
    const targets = [];
    const progress = new Progress(`Searching for ${tag}/*`, "Matching files...");
    await progress.forEach(
        app.metadataCache.getCachedFiles(),
        filename => {
            let { frontmatter, tags } = app.metadataCache.getCache(filename) || {};
            tags = (tags || []).filter(t => t.tag && tag.matches(t.tag)).reverse(); // last positions first
            const fmtags = (obsidian.parseFrontMatterTags(frontmatter) || []).filter(tag.matches);
            if (tags.length || fmtags.length)
                targets.push(new File(app, filename, tags, fmtags.length));
        }
    );
    if (!progress.aborted)
        return targets;
}

async function promptForNewName(tagName) {
    try {
        return await validatedInput(
            `Renaming #${tagName} (and any sub-tags)`, "Enter new name (must be a valid Obsidian tag):\n",
            tagName,
            "[^\u2000-\u206F\u2E00-\u2E7F'!\"#$%&()*+,.:;<=>?@^`{|}~\\[\\]\\\\\\s]+",
            "Obsidian tag name"
        );
    } catch(e) {
        return false;  // user cancelled
    }
}

async function shouldAbortDueToClash([origin, clash], oldTag, newTag) {
    try {
        await confirm(
            "WARNING: No Undo!",
            `Renaming <code>${oldTag}</code> to <code>${newTag}</code> will merge ${
                (origin.canonical === oldTag.canonical) ?
                    `these tags` : `multiple tags
                    into existing tags (such as <code>${origin}</code>
                    merging with <code>${clash}</code>)`
            }.

            This <b>cannot</b> be undone.  Do you wish to proceed?`
        );
    } catch(e) {
        return true;
    }
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
    }

    onMenu(e, tagEl) {
        if (!e.obsidian_contextmenu) {
            e.obsidian_contextmenu = new obsidian.Menu(this.app);
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
            .addItem(item("expand-vertically"  , "Expand tags at this level"  , () => toggle(false)));
        }
    }

    leafView(containerEl) {
        let view;
        this.app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.containerEl === containerEl) { view = leaf.view; return true; }
        });
        return view;
    }


    async rename(tagName) {
        const scope = new obsidian.Scope;
        this.app.keymap.pushScope(scope);
        try { await renameTag(this.app, tagName); }
        catch (e) { console.error(e); new obsidian.Notice("error: " + e); }
        this.app.keymap.popScope(scope);
    }

}

function item(icon, title, click) {
    return i => i.setIcon(icon).setTitle(title).onClick(click);
}

module.exports = TagWrangler;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLnlhcm4vY2FjaGUvY3VycmlmeS1ucG0tNC4wLjAtYjkyZWUzYTRlYi04MjViNjgxODQxLnppcC9ub2RlX21vZHVsZXMvY3VycmlmeS9saWIvY3VycmlmeS5qcyIsIi55YXJuL2NhY2hlL2Z1bGxzdG9yZS1ucG0tMy4wLjAtYzQ4NTY0NGE2NS02ZDM5OTNjN2JmLnppcC9ub2RlX21vZHVsZXMvZnVsbHN0b3JlL2xpYi9mdWxsc3RvcmUuanMiLCIueWFybi9jYWNoZS9AY2xvdWRjbWQtY3JlYXRlLWVsZW1lbnQtbnBtLTIuMC4yLTE5NzY5NTlhNmMtMTk2ZDA5YjJkMi56aXAvbm9kZV9tb2R1bGVzL0BjbG91ZGNtZC9jcmVhdGUtZWxlbWVudC9saWIvY3JlYXRlLWVsZW1lbnQuanMiLCIueWFybi9jYWNoZS9zbWFsbHRhbGstbnBtLTQuMC43LTgyMzM5ZjY2NzItZDY3MzZmMzI0Yy56aXAvbm9kZV9tb2R1bGVzL3NtYWxsdGFsay9saWIvc21hbGx0YWxrLmpzIiwic3JjL3Byb2dyZXNzLmpzIiwic3JjL3ZhbGlkYXRpb24uanMiLCJzcmMvVGFnLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9jb25zdGFudHMuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9zb3VyY2UtdXRpbHMuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9SYW5nZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L05vZGUuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2Vycm9ycy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L0JsYW5rTGluZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L0NvbGxlY3Rpb25JdGVtLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9jc3QvQ29tbWVudC5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L0NvbGxlY3Rpb24uanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9EaXJlY3RpdmUuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9Eb2N1bWVudC5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvX3ZpcnR1YWwvX3JvbGx1cFBsdWdpbkJhYmVsSGVscGVycy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L0FsaWFzLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9jc3QvQmxvY2tWYWx1ZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L0Zsb3dDb2xsZWN0aW9uLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9jc3QvUGxhaW5WYWx1ZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L1F1b3RlRG91YmxlLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9jc3QvUXVvdGVTaW5nbGUuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9QYXJzZUNvbnRleHQuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9wYXJzZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvdGFncy9vcHRpb25zLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9vcHRpb25zLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9zdHJpbmdpZnkvYWRkQ29tbWVudC5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvYXN0L05vZGUuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2FzdC90b0pTLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9hc3QvU2NhbGFyLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9kb2MvY3JlYXRlTm9kZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvYXN0L0NvbGxlY3Rpb24uanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2xvZy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvYXN0L1lBTUxTZXEuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2FzdC9QYWlyLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9hc3QvQWxpYXMuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3Jlc29sdmUvcmVzb2x2ZVNjYWxhci5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3Qvc3RyaW5naWZ5L2ZvbGRGbG93TGluZXMuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3N0cmluZ2lmeS9zdHJpbmdpZnlTdHJpbmcuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3N0cmluZ2lmeS9zdHJpbmdpZnlUYWcuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3N0cmluZ2lmeS9zdHJpbmdpZnkuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2FzdC9ZQU1MTWFwLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9hc3QvTWVyZ2UuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2RvYy9BbmNob3JzLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9zdHJpbmdpZnkvc3RyaW5naWZ5TnVtYmVyLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC90YWdzL2ZhaWxzYWZlL21hcC5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvdGFncy9mYWlsc2FmZS9zZXEuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3RhZ3MvZmFpbHNhZmUvc3RyaW5nLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC90YWdzL2ZhaWxzYWZlL2luZGV4LmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC90YWdzL2NvcmUuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3RhZ3MvanNvbi5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvdGFncy95YW1sLTEuMS9iaW5hcnkuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3RhZ3MveWFtbC0xLjEvcGFpcnMuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3RhZ3MveWFtbC0xLjEvb21hcC5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvdGFncy95YW1sLTEuMS9zZXQuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3RhZ3MveWFtbC0xLjEvdGltZXN0YW1wLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC90YWdzL3lhbWwtMS4xL2luZGV4LmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC90YWdzL2luZGV4LmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9kb2MvZ2V0U2NoZW1hVGFncy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvZG9jL1NjaGVtYS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvZG9jL2FwcGx5UmV2aXZlci5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvZG9jL2xpc3RUYWdOYW1lcy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvcmVzb2x2ZS9yZXNvbHZlVGFnTmFtZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvcmVzb2x2ZS9jb2xsZWN0aW9uLXV0aWxzLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9yZXNvbHZlL3Jlc29sdmVNYXAuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3Jlc29sdmUvcmVzb2x2ZVNlcS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvcmVzb2x2ZS9yZXNvbHZlVGFnLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9yZXNvbHZlL3Jlc29sdmVOb2RlLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9kb2MvcGFyc2VDb250ZW50cy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvZG9jL3BhcnNlRGlyZWN0aXZlcy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvZG9jL0RvY3VtZW50LmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9pbmRleC5qcyIsInNyYy9GaWxlLmpzIiwic3JjL3JlbmFtaW5nLmpzIiwic3JjL3BsdWdpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGYgPSAoZm4pID0+IFtcbiAgICAvKmVzbGludCBuby11bnVzZWQtdmFyczogMCovXG4gICAgZnVuY3Rpb24gKGEpIHtyZXR1cm4gZm4oLi4uYXJndW1lbnRzKTt9LFxuICAgIGZ1bmN0aW9uIChhLCBiKSB7cmV0dXJuIGZuKC4uLmFyZ3VtZW50cyk7fSxcbiAgICBmdW5jdGlvbiAoYSwgYiwgYykge3JldHVybiBmbiguLi5hcmd1bWVudHMpO30sXG4gICAgZnVuY3Rpb24gKGEsIGIsIGMsIGQpIHtyZXR1cm4gZm4oLi4uYXJndW1lbnRzKTt9LFxuICAgIGZ1bmN0aW9uIChhLCBiLCBjLCBkLCBlKSB7cmV0dXJuIGZuKC4uLmFyZ3VtZW50cyk7fSxcbl07XG5cbmNvbnN0IGN1cnJpZnkgPSAoZm4sIC4uLmFyZ3MpID0+IHtcbiAgICBjaGVjayhmbik7XG4gICAgXG4gICAgaWYgKGFyZ3MubGVuZ3RoID49IGZuLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIFxuICAgIGNvbnN0IGFnYWluID0gKC4uLmFyZ3MyKSA9PiB7XG4gICAgICAgIHJldHVybiBjdXJyaWZ5KGZuLCAuLi5bLi4uYXJncywgLi4uYXJnczJdKTtcbiAgICB9O1xuICAgIFxuICAgIGNvbnN0IGNvdW50ID0gZm4ubGVuZ3RoIC0gYXJncy5sZW5ndGggLSAxO1xuICAgIGNvbnN0IGZ1bmMgPSBmKGFnYWluKVtjb3VudF07XG4gICAgXG4gICAgcmV0dXJuIGZ1bmMgfHwgYWdhaW47XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGN1cnJpZnk7XG5cbmZ1bmN0aW9uIGNoZWNrKGZuKSB7XG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgdGhyb3cgRXJyb3IoJ2ZuIHNob3VsZCBiZSBmdW5jdGlvbiEnKTtcbn1cblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9ICh2YWx1ZSkgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgIHZhbHVlLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSBhcmdzO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFhcmdzLmxlbmd0aClcbiAgICAgICAgICAgIHJldHVybiBkYXRhLnZhbHVlO1xuICAgICAgICBcbiAgICAgICAgZGF0YS52YWx1ZSA9IHZhbHVlO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGN1cnJpZnkgPSByZXF1aXJlKCdjdXJyaWZ5Jyk7XG5jb25zdCBxdWVyeSA9IChhKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBbZGF0YS1uYW1lPVwiJHthfVwiXWApO1xuXG5jb25zdCBzZXRBdHRyaWJ1dGUgPSBjdXJyaWZ5KChlbCwgb2JqLCBuYW1lKSA9PiBlbC5zZXRBdHRyaWJ1dGUobmFtZSwgb2JqW25hbWVdKSk7XG5jb25zdCBzZXQgPSBjdXJyaWZ5KChlbCwgb2JqLCBuYW1lKSA9PiBlbFtuYW1lXSA9IG9ialtuYW1lXSk7XG5jb25zdCBub3QgPSBjdXJyaWZ5KChmLCBhKSA9PiAhZihhKSk7XG5jb25zdCBpc0NhbWVsQ2FzZSA9IChhKSA9PiBhICE9IGEudG9Mb3dlckNhc2UoKTtcblxubW9kdWxlLmV4cG9ydHMgPSAobmFtZSwgb3B0aW9ucyA9IHt9KSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgICBkYXRhTmFtZSxcbiAgICAgICAgbm90QXBwZW5kLFxuICAgICAgICBwYXJlbnQgPSBkb2N1bWVudC5ib2R5LFxuICAgICAgICB1bmlxID0gdHJ1ZSxcbiAgICAgICAgLi4ucmVzdE9wdGlvbnNcbiAgICB9ID0gb3B0aW9ucztcbiAgICBcbiAgICBjb25zdCBlbEZvdW5kID0gaXNFbGVtZW50UHJlc2VudChkYXRhTmFtZSk7XG4gICAgXG4gICAgaWYgKHVuaXEgJiYgZWxGb3VuZClcbiAgICAgICAgcmV0dXJuIGVsRm91bmQ7XG4gICAgXG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KG5hbWUpO1xuICAgIFxuICAgIGlmIChkYXRhTmFtZSlcbiAgICAgICAgZWwuZGF0YXNldC5uYW1lID0gZGF0YU5hbWU7XG4gICAgXG4gICAgT2JqZWN0LmtleXMocmVzdE9wdGlvbnMpXG4gICAgICAgIC5maWx0ZXIoaXNDYW1lbENhc2UpXG4gICAgICAgIC5tYXAoc2V0KGVsLCBvcHRpb25zKSk7XG4gICAgXG4gICAgT2JqZWN0LmtleXMocmVzdE9wdGlvbnMpXG4gICAgICAgIC5maWx0ZXIobm90KGlzQ2FtZWxDYXNlKSlcbiAgICAgICAgLm1hcChzZXRBdHRyaWJ1dGUoZWwsIG9wdGlvbnMpKTtcbiAgICBcbiAgICBpZiAoIW5vdEFwcGVuZClcbiAgICAgICAgcGFyZW50LmFwcGVuZENoaWxkKGVsKTtcbiAgICBcbiAgICByZXR1cm4gZWw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5pc0VsZW1lbnRQcmVzZW50ID0gaXNFbGVtZW50UHJlc2VudDtcblxuZnVuY3Rpb24gaXNFbGVtZW50UHJlc2VudChkYXRhTmFtZSkge1xuICAgIGlmICghZGF0YU5hbWUpXG4gICAgICAgIHJldHVybjtcbiAgICBcbiAgICByZXR1cm4gcXVlcnkoZGF0YU5hbWUpO1xufVxuXG4iLCIndXNlIHN0cmljdCc7XG5cbnJlcXVpcmUoJy4uL2Nzcy9zbWFsbHRhbGsuY3NzJyk7XG5cbmNvbnN0IGN1cnJpZnkgPSByZXF1aXJlKCdjdXJyaWZ5Jyk7XG5jb25zdCBzdG9yZSA9IHJlcXVpcmUoJ2Z1bGxzdG9yZScpO1xuY29uc3QgY3JlYXRlRWxlbWVudCA9IHJlcXVpcmUoJ0BjbG91ZGNtZC9jcmVhdGUtZWxlbWVudCcpO1xuXG5jb25zdCBrZXlEb3duID0gY3VycmlmeShrZXlEb3duXyk7XG5cbmNvbnN0IEJVVFRPTl9PSyA9IHtcbiAgICBvazogJ09LJyxcbn07XG5cbmNvbnN0IEJVVFRPTl9PS19DQU5DRUwgPSB7XG4gICAgb2s6ICdPSycsXG4gICAgY2FuY2VsOiAnQ2FuY2VsJyxcbn07XG5cbmNvbnN0IHpJbmRleCA9IHN0b3JlKDEwMCk7XG5cbmV4cG9ydHMuYWxlcnQgPSAodGl0bGUsIG1zZywgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IGJ1dHRvbnMgPSBnZXRCdXR0b25zKG9wdGlvbnMpIHx8IEJVVFRPTl9PSztcbiAgICByZXR1cm4gc2hvd0RpYWxvZyh0aXRsZSwgbXNnLCAnJywgYnV0dG9ucywgb3B0aW9ucyk7XG59O1xuXG5leHBvcnRzLnByb21wdCA9ICh0aXRsZSwgbXNnLCB2YWx1ZSA9ICcnLCBvcHRpb25zKSA9PiB7XG4gICAgY29uc3QgdHlwZSA9IGdldFR5cGUob3B0aW9ucyk7XG4gICAgY29uc3QgdmFsID0gU3RyaW5nKHZhbHVlKVxuICAgICAgICAucmVwbGFjZSgvXCIvZywgJyZxdW90OycpO1xuICAgIFxuICAgIGNvbnN0IHZhbHVlU3RyID0gYDxpbnB1dCB0eXBlPVwiJHsgdHlwZSB9XCIgdmFsdWU9XCIkeyB2YWwgfVwiIGRhdGEtbmFtZT1cImpzLWlucHV0XCI+YDtcbiAgICBjb25zdCBidXR0b25zID0gZ2V0QnV0dG9ucyhvcHRpb25zKSB8fCBCVVRUT05fT0tfQ0FOQ0VMO1xuICAgIFxuICAgIHJldHVybiBzaG93RGlhbG9nKHRpdGxlLCBtc2csIHZhbHVlU3RyLCBidXR0b25zLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydHMuY29uZmlybSA9ICh0aXRsZSwgbXNnLCBvcHRpb25zKSA9PiB7XG4gICAgY29uc3QgYnV0dG9ucyA9IGdldEJ1dHRvbnMob3B0aW9ucykgfHwgQlVUVE9OX09LX0NBTkNFTDtcbiAgICBcbiAgICByZXR1cm4gc2hvd0RpYWxvZyh0aXRsZSwgbXNnLCAnJywgYnV0dG9ucywgb3B0aW9ucyk7XG59O1xuXG5leHBvcnRzLnByb2dyZXNzID0gKHRpdGxlLCBtZXNzYWdlLCBvcHRpb25zKSA9PiB7XG4gICAgY29uc3QgdmFsdWVTdHIgPSBgXG4gICAgICAgIDxwcm9ncmVzcyB2YWx1ZT1cIjBcIiBkYXRhLW5hbWU9XCJqcy1wcm9ncmVzc1wiIGNsYXNzPVwicHJvZ3Jlc3NcIiBtYXg9XCIxMDBcIj48L3Byb2dyZXNzPlxuICAgICAgICA8c3BhbiBkYXRhLW5hbWU9XCJqcy1jb3VudGVyXCI+MCU8L3NwYW4+XG4gICAgYDtcbiAgICBcbiAgICBjb25zdCBidXR0b25zID0ge1xuICAgICAgICBjYW5jZWw6ICdBYm9ydCcsXG4gICAgfTtcbiAgICBcbiAgICBjb25zdCBwcm9taXNlID0gc2hvd0RpYWxvZyh0aXRsZSwgbWVzc2FnZSwgdmFsdWVTdHIsIGJ1dHRvbnMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHtvaywgZGlhbG9nfSA9IHByb21pc2U7XG4gICAgY29uc3QgcmVzb2x2ZSA9IG9rKCk7XG4gICAgXG4gICAgZmluZChkaWFsb2csIFsnY2FuY2VsJ10pLm1hcCgoZWwpID0+IHtcbiAgICAgICAgZWwuZm9jdXMoKTtcbiAgICB9KTtcbiAgICBcbiAgICBPYmplY3QuYXNzaWduKHByb21pc2UsIHtcbiAgICAgICAgc2V0UHJvZ3Jlc3MoY291bnQpIHtcbiAgICAgICAgICAgIGNvbnN0IFtlbFByb2dyZXNzXSA9IGZpbmQoZGlhbG9nLCBbJ3Byb2dyZXNzJ10pO1xuICAgICAgICAgICAgY29uc3QgW2VsQ291bnRlcl0gPSBmaW5kKGRpYWxvZywgWydjb3VudGVyJ10pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBlbFByb2dyZXNzLnZhbHVlID0gY291bnQ7XG4gICAgICAgICAgICBlbENvdW50ZXIudGV4dENvbnRlbnQgPSBgJHtjb3VudH0lYDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGNvdW50ID09PSAxMDApIHtcbiAgICAgICAgICAgICAgICByZW1vdmUoZGlhbG9nKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIFxuICAgICAgICByZW1vdmUoKSB7XG4gICAgICAgICAgICByZW1vdmUoZGlhbG9nKTtcbiAgICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbmZ1bmN0aW9uIGdldEJ1dHRvbnMob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qge2J1dHRvbnN9ID0gb3B0aW9ucztcbiAgICBcbiAgICBpZiAoIWJ1dHRvbnMpXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIFxuICAgIHJldHVybiBidXR0b25zO1xufVxuXG5mdW5jdGlvbiBnZXRUeXBlKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHt0eXBlfSA9IG9wdGlvbnM7XG4gICAgXG4gICAgaWYgKHR5cGUgPT09ICdwYXNzd29yZCcpXG4gICAgICAgIHJldHVybiAncGFzc3dvcmQnO1xuICAgIFxuICAgIHJldHVybiAndGV4dCc7XG59XG5cbmZ1bmN0aW9uIGdldFRlbXBsYXRlKHRpdGxlLCBtc2csIHZhbHVlLCBidXR0b25zKSB7XG4gICAgY29uc3QgZW5jb2RlZE1zZyA9IG1zZy5yZXBsYWNlKC9cXG4vZywgJzxicj4nKTtcbiAgICBcbiAgICByZXR1cm4gYDxkaXYgY2xhc3M9XCJwYWdlXCI+XG4gICAgICAgIDxkaXYgZGF0YS1uYW1lPVwianMtY2xvc2VcIiBjbGFzcz1cImNsb3NlLWJ1dHRvblwiPjwvZGl2PlxuICAgICAgICA8aGVhZGVyPiR7IHRpdGxlIH08L2hlYWRlcj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRlbnQtYXJlYVwiPiR7IGVuY29kZWRNc2cgfSR7IHZhbHVlIH08L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1hcmVhXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnV0dG9uLXN0cmlwXCI+XG4gICAgICAgICAgICAgICAgJHtwYXJzZUJ1dHRvbnMoYnV0dG9ucyl9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gcGFyc2VCdXR0b25zKGJ1dHRvbnMpIHtcbiAgICBjb25zdCBuYW1lcyA9IE9iamVjdC5rZXlzKGJ1dHRvbnMpO1xuICAgIGNvbnN0IHBhcnNlID0gY3VycmlmeSgoYnV0dG9ucywgbmFtZSwgaSkgPT4gYDxidXR0b25cbiAgICAgICAgICAgIHRhYmluZGV4PSR7aX1cbiAgICAgICAgICAgIGRhdGEtbmFtZT1cImpzLSR7bmFtZS50b0xvd2VyQ2FzZSgpfVwiPlxuICAgICAgICAgICAgJHtidXR0b25zW25hbWVdfVxuICAgICAgICA8L2J1dHRvbj5gKTtcbiAgICBcbiAgICByZXR1cm4gbmFtZXNcbiAgICAgICAgLm1hcChwYXJzZShidXR0b25zKSlcbiAgICAgICAgLmpvaW4oJycpO1xufVxuXG5mdW5jdGlvbiBzaG93RGlhbG9nKHRpdGxlLCBtc2csIHZhbHVlLCBidXR0b25zLCBvcHRpb25zKSB7XG4gICAgY29uc3Qgb2sgPSBzdG9yZSgpO1xuICAgIGNvbnN0IGNhbmNlbCA9IHN0b3JlKCk7XG4gICAgXG4gICAgY29uc3QgY2xvc2VCdXR0b25zID0gW1xuICAgICAgICAnY2FuY2VsJyxcbiAgICAgICAgJ2Nsb3NlJyxcbiAgICAgICAgJ29rJyxcbiAgICBdO1xuICAgIFxuICAgIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IG5vQ2FuY2VsID0gb3B0aW9ucyAmJiBvcHRpb25zLmNhbmNlbCA9PT0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGVtcHR5ID0gKCkgPT4ge307XG4gICAgICAgIGNvbnN0IHJlamVjdEVycm9yID0gKCkgPT4gcmVqZWN0KEVycm9yKCkpO1xuICAgICAgICBcbiAgICAgICAgb2socmVzb2x2ZSk7XG4gICAgICAgIGNhbmNlbChub0NhbmNlbCA/IGVtcHR5IDogcmVqZWN0RXJyb3IpO1xuICAgIH0pO1xuICAgIFxuICAgIGNvbnN0IGlubmVySFRNTCA9IGdldFRlbXBsYXRlKHRpdGxlLCBtc2csIHZhbHVlLCBidXR0b25zKTtcbiAgICBcbiAgICBjb25zdCBkaWFsb2cgPSBjcmVhdGVFbGVtZW50KCdkaXYnLCB7XG4gICAgICAgIGlubmVySFRNTCxcbiAgICAgICAgY2xhc3NOYW1lOiAnc21hbGx0YWxrJyxcbiAgICAgICAgc3R5bGU6IGB6LWluZGV4OiAke3pJbmRleCh6SW5kZXgoKSArIDEpfWAsXG4gICAgfSk7XG4gICAgXG4gICAgZm9yIChjb25zdCBlbCBvZiBmaW5kKGRpYWxvZywgWydvaycsICdpbnB1dCddKSlcbiAgICAgICAgZWwuZm9jdXMoKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGVsIG9mIGZpbmQoZGlhbG9nLCBbJ2lucHV0J10pKSB7XG4gICAgICAgIGVsLnNldFNlbGVjdGlvblJhbmdlKDAsIHZhbHVlLmxlbmd0aCk7XG4gICAgfVxuICAgIFxuICAgIGFkZExpc3RlbmVyQWxsKCdjbGljaycsIGRpYWxvZywgY2xvc2VCdXR0b25zLCAoZXZlbnQpID0+IHtcbiAgICAgICAgY2xvc2VEaWFsb2coZXZlbnQudGFyZ2V0LCBkaWFsb2csIG9rKCksIGNhbmNlbCgpKTtcbiAgICB9KTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGV2ZW50IG9mIFsnY2xpY2snLCAnY29udGV4dG1lbnUnXSlcbiAgICAgICAgZGlhbG9nLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIChlKSA9PiB7XG4gICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBlbCBvZiBmaW5kKGRpYWxvZywgWydvaycsICdpbnB1dCddKSlcbiAgICAgICAgICAgICAgICBlbC5mb2N1cygpO1xuICAgICAgICB9KTtcbiAgICBcbiAgICBkaWFsb2cuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGtleURvd24oZGlhbG9nLCBvaygpLCBjYW5jZWwoKSkpO1xuICAgIFxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb21pc2UsIHtcbiAgICAgICAgZGlhbG9nLFxuICAgICAgICBvayxcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24ga2V5RG93bl8oZGlhbG9nLCBvaywgY2FuY2VsLCBldmVudCkge1xuICAgIGNvbnN0IEtFWSA9IHtcbiAgICAgICAgRU5URVIgOiAxMyxcbiAgICAgICAgRVNDICAgOiAyNyxcbiAgICAgICAgVEFCICAgOiA5LFxuICAgICAgICBMRUZUICA6IDM3LFxuICAgICAgICBVUCAgICA6IDM4LFxuICAgICAgICBSSUdIVCA6IDM5LFxuICAgICAgICBET1dOICA6IDQwLFxuICAgIH07XG4gICAgXG4gICAgY29uc3Qge2tleUNvZGV9ID0gZXZlbnQ7XG4gICAgY29uc3QgZWwgPSBldmVudC50YXJnZXQ7XG4gICAgXG4gICAgY29uc3QgbmFtZXNBbGwgPSBbJ29rJywgJ2NhbmNlbCcsICdpbnB1dCddO1xuICAgIGNvbnN0IG5hbWVzID0gZmluZChkaWFsb2csIG5hbWVzQWxsKVxuICAgICAgICAubWFwKGdldERhdGFOYW1lKTtcbiAgICBcbiAgICBzd2l0Y2goa2V5Q29kZSkge1xuICAgIGNhc2UgS0VZLkVOVEVSOlxuICAgICAgICBjbG9zZURpYWxvZyhlbCwgZGlhbG9nLCBvaywgY2FuY2VsKTtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgXG4gICAgY2FzZSBLRVkuRVNDOlxuICAgICAgICByZW1vdmUoZGlhbG9nKTtcbiAgICAgICAgY2FuY2VsKCk7XG4gICAgICAgIGJyZWFrO1xuICAgIFxuICAgIGNhc2UgS0VZLlRBQjpcbiAgICAgICAgaWYgKGV2ZW50LnNoaWZ0S2V5KVxuICAgICAgICAgICAgdGFiKGRpYWxvZywgbmFtZXMpO1xuICAgICAgICBcbiAgICAgICAgdGFiKGRpYWxvZywgbmFtZXMpO1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBicmVhaztcbiAgICBcbiAgICBkZWZhdWx0OlxuICAgICAgICBbJ2xlZnQnLCAncmlnaHQnLCAndXAnLCAnZG93biddLmZpbHRlcigobmFtZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGtleUNvZGUgPT09IEtFWVtuYW1lLnRvVXBwZXJDYXNlKCldO1xuICAgICAgICB9KS5mb3JFYWNoKCgpID0+IHtcbiAgICAgICAgICAgIGNoYW5nZUJ1dHRvbkZvY3VzKGRpYWxvZywgbmFtZXMpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbn1cblxuZnVuY3Rpb24gZ2V0RGF0YU5hbWUoZWwpIHtcbiAgICByZXR1cm4gZWxcbiAgICAgICAgLmdldEF0dHJpYnV0ZSgnZGF0YS1uYW1lJylcbiAgICAgICAgLnJlcGxhY2UoJ2pzLScsICcnKTtcbn1cblxuY29uc3QgZ2V0TmFtZSA9IChhY3RpdmVOYW1lKSA9PiB7XG4gICAgaWYgKGFjdGl2ZU5hbWUgPT09ICdjYW5jZWwnKVxuICAgICAgICByZXR1cm4gJ29rJztcbiAgICBcbiAgICByZXR1cm4gJ2NhbmNlbCc7XG59O1xuXG5mdW5jdGlvbiBjaGFuZ2VCdXR0b25Gb2N1cyhkaWFsb2csIG5hbWVzKSB7XG4gICAgY29uc3QgYWN0aXZlID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgICBjb25zdCBhY3RpdmVOYW1lID0gZ2V0RGF0YU5hbWUoYWN0aXZlKTtcbiAgICBjb25zdCBpc0J1dHRvbiA9IC9va3xjYW5jZWwvLnRlc3QoYWN0aXZlTmFtZSk7XG4gICAgY29uc3QgY291bnQgPSBuYW1lcy5sZW5ndGggLSAxO1xuICAgIFxuICAgIGlmIChhY3RpdmVOYW1lID09PSAnaW5wdXQnIHx8ICFjb3VudCB8fCAhaXNCdXR0b24pXG4gICAgICAgIHJldHVybjtcbiAgICBcbiAgICBjb25zdCBuYW1lID0gZ2V0TmFtZShhY3RpdmVOYW1lKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGVsIG9mIGZpbmQoZGlhbG9nLCBbbmFtZV0pKSB7XG4gICAgICAgIGVsLmZvY3VzKCk7XG4gICAgfVxufVxuXG5jb25zdCBnZXRJbmRleCA9IChjb3VudCwgaW5kZXgpID0+IHtcbiAgICBpZiAoaW5kZXggPT09IGNvdW50KVxuICAgICAgICByZXR1cm4gMDtcbiAgICBcbiAgICByZXR1cm4gaW5kZXggKyAxO1xufTtcblxuZnVuY3Rpb24gdGFiKGRpYWxvZywgbmFtZXMpIHtcbiAgICBjb25zdCBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICAgIGNvbnN0IGFjdGl2ZU5hbWUgPSBnZXREYXRhTmFtZShhY3RpdmUpO1xuICAgIGNvbnN0IGNvdW50ID0gbmFtZXMubGVuZ3RoIC0gMTtcbiAgICBcbiAgICBjb25zdCBhY3RpdmVJbmRleCA9IG5hbWVzLmluZGV4T2YoYWN0aXZlTmFtZSk7XG4gICAgY29uc3QgaW5kZXggPSBnZXRJbmRleChjb3VudCwgYWN0aXZlSW5kZXgpO1xuICAgIFxuICAgIGNvbnN0IG5hbWUgPSBuYW1lc1tpbmRleF07XG4gICAgXG4gICAgZm9yIChjb25zdCBlbCBvZiBmaW5kKGRpYWxvZywgW25hbWVdKSlcbiAgICAgICAgZWwuZm9jdXMoKTtcbn1cblxuZnVuY3Rpb24gY2xvc2VEaWFsb2coZWwsIGRpYWxvZywgb2ssIGNhbmNlbCkge1xuICAgIGNvbnN0IG5hbWUgPSBlbFxuICAgICAgICAuZ2V0QXR0cmlidXRlKCdkYXRhLW5hbWUnKVxuICAgICAgICAucmVwbGFjZSgnanMtJywgJycpO1xuICAgIFxuICAgIGlmICgvY2xvc2V8Y2FuY2VsLy50ZXN0KG5hbWUpKSB7XG4gICAgICAgIGNhbmNlbCgpO1xuICAgICAgICByZW1vdmUoZGlhbG9nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB2YWx1ZSA9IGZpbmQoZGlhbG9nLCBbJ2lucHV0J10pXG4gICAgICAgIC5yZWR1Y2UoKHZhbHVlLCBlbCkgPT4gZWwudmFsdWUsIG51bGwpO1xuICAgIFxuICAgIG9rKHZhbHVlKTtcbiAgICByZW1vdmUoZGlhbG9nKTtcbn1cblxuY29uc3QgcXVlcnkgPSBjdXJyaWZ5KChlbGVtZW50LCBuYW1lKSA9PiBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYFtkYXRhLW5hbWU9XCJqcy0keyBuYW1lIH1cIl1gKSk7XG5cbmZ1bmN0aW9uIGZpbmQoZWxlbWVudCwgbmFtZXMpIHtcbiAgICBjb25zdCBlbGVtZW50cyA9IG5hbWVzXG4gICAgICAgIC5tYXAocXVlcnkoZWxlbWVudCkpXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG4gICAgXG4gICAgcmV0dXJuIGVsZW1lbnRzO1xufVxuXG5mdW5jdGlvbiBhZGRMaXN0ZW5lckFsbChldmVudCwgcGFyZW50LCBlbGVtZW50cywgZm4pIHtcbiAgICBmb3IgKGNvbnN0IGVsIG9mIGZpbmQocGFyZW50LCBlbGVtZW50cykpIHtcbiAgICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZm4pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlKGRpYWxvZykge1xuICAgIGNvbnN0IHtwYXJlbnRFbGVtZW50fSA9IGRpYWxvZztcbiAgICBcbiAgICBpZiAocGFyZW50RWxlbWVudClcbiAgICAgICAgcGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChkaWFsb2cpO1xufVxuXG4iLCJpbXBvcnQgeyBwcm9ncmVzcyB9IGZyb20gXCJzbWFsbHRhbGtcIjtcblxuZXhwb3J0IGNsYXNzIFByb2dyZXNzIHtcblxuICAgIGNvbnN0cnVjdG9yKHRpdGxlLCBtZXNzYWdlKSB7XG4gICAgICAgIHRoaXMucHJvZ3Jlc3MgPSBwcm9ncmVzcyh0aXRsZSwgbWVzc2FnZSk7XG4gICAgICAgIHRoaXMucHJvZ3Jlc3MuY2F0Y2goZSA9PiB7XG4gICAgICAgICAgICB0aGlzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKGUgJiYgKGUuY29uc3RydWN0b3IgIT09IEVycm9yIHx8IGUubWVzc2FnZSAhPT0gXCJcIikpIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmRpYWxvZyA9IHRoaXMucHJvZ3Jlc3MuZGlhbG9nO1xuICAgICAgICB0aGlzLmFib3J0ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBhc3luYyBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmFib3J0ZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgbGV0IHByb2Nlc3NlZCA9IDAsIHJhbmdlID0gY29sbGVjdGlvbi5sZW5ndGgsIGFjY3VtID0gMCwgcGN0ID0gMDtcbiAgICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgZnVuYyhpdGVtLCBwcm9jZXNzZWQrKywgY29sbGVjdGlvbiwgdGhpcyk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYWJvcnRlZClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGFjY3VtICs9IDEwMDtcbiAgICAgICAgICAgICAgICBpZiAoYWNjdW0gPiByYW5nZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1haW5kZXIgPSBhY2N1bSAlIHJhbmdlLCBzdGVwID0gKGFjY3VtIC0gcmVtYWluZGVyKSAvIHJhbmdlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2dyZXNzLnNldFByb2dyZXNzKHBjdCArPSBzdGVwKTtcbiAgICAgICAgICAgICAgICAgICAgYWNjdW0gPSByZW1haW5kZXI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBjdCA8IDEwMClcbiAgICAgICAgICAgICAgICB0aGlzLnByb2dyZXNzLnNldFByb2dyZXNzKDEwMCk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMucHJvZ3Jlc3MucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXQgdGl0bGUodGV4dCkgeyB0aGlzLmRpYWxvZy5xdWVyeVNlbGVjdG9yKFwiaGVhZGVyXCIpLnRleHRDb250ZW50ID0gdGV4dDsgfVxuICAgIGdldCB0aXRsZSgpIHsgcmV0dXJuIHRoaXMuZGlhbG9nLnF1ZXJ5U2VsZWN0b3IoXCJoZWFkZXJcIikudGV4dENvbnRlbnQ7IH1cblxuICAgIHNldCBtZXNzYWdlKHRleHQpIHtcbiAgICAgICAgY29uc3QgYXJlYSA9IHRoaXMuZGlhbG9nLnF1ZXJ5U2VsZWN0b3IoXCIuY29udGVudC1hcmVhXCIpLmNoaWxkTm9kZXNbMF0udGV4dENvbnRlbnQgPSB0ZXh0O1xuICAgIH1cblxuICAgIGdldCBtZXNzYWdlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kaWFsb2cucXVlcnlTZWxlY3RvcihcIi5jb250ZW50LWFyZWFcIikuY2hpbGROb2Rlc1swXS50ZXh0Q29udGVudDtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBOb3RpY2UgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IHByb21wdCB9IGZyb20gXCJzbWFsbHRhbGtcIjtcblxuaW1wb3J0IFwiLi92YWxpZGF0aW9uLnNjc3NcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZhbGlkYXRlZElucHV0KHRpdGxlLCBtZXNzYWdlLCB2YWx1ZSA9IFwiXCIsIHJlZ2V4ID0gXCIuKlwiLCB3aGF0ID0gXCJlbnRyeVwiKSB7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29uc3QgaW5wdXQgPSBwcm9tcHQodGl0bGUsIG1lc3NhZ2UsIHZhbHVlKTtcbiAgICAgICAgY29uc3QgaW5wdXRGaWVsZCA9IGlucHV0LmRpYWxvZy5maW5kKFwiaW5wdXRcIik7XG4gICAgICAgIGNvbnN0IGlzVmFsaWQgPSAodCkgPT4gbmV3IFJlZ0V4cChgXiR7cmVnZXh9JGApLnRlc3QodCk7XG5cbiAgICAgICAgaW5wdXRGaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSh2YWx1ZS5sZW5ndGgsIHZhbHVlLmxlbmd0aCk7XG4gICAgICAgIGlucHV0RmllbGQucGF0dGVybiA9IHJlZ2V4O1xuICAgICAgICBpbnB1dEZpZWxkLm9uaW5wdXQgPSAoKSA9PiBpbnB1dEZpZWxkLnNldEF0dHJpYnV0ZShcImFyaWEtaW52YWxpZFwiLCAhaXNWYWxpZChpbnB1dEZpZWxkLnZhbHVlKSk7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaW5wdXQ7XG4gICAgICAgIGlmIChpc1ZhbGlkKHJlc3VsdCkpIHJldHVybiByZXN1bHQ7XG5cbiAgICAgICAgbmV3IE5vdGljZShgXCIke3Jlc3VsdH1cIiBpcyBub3QgYSB2YWxpZCAke3doYXR9YCk7XG4gICAgfVxufVxuIiwiZXhwb3J0IGNsYXNzIFRhZyB7XG4gICAgY29uc3RydWN0b3IobmFtZSkge1xuICAgICAgICB3aGlsZSAobmFtZS5zdGFydHNXaXRoKFwiI1wiKSkgbmFtZSA9IG5hbWUuc2xpY2UoMSk7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIGNvbnN0XG4gICAgICAgICAgICBoYXNoZWQgPSB0aGlzLnRhZyA9IFwiI1wiICsgbmFtZSxcbiAgICAgICAgICAgIGNhbm9uaWNhbCA9IHRoaXMuY2Fub25pY2FsID0gaGFzaGVkLnRvTG93ZXJDYXNlKCksXG4gICAgICAgICAgICBjYW5vbmljYWxfcHJlZml4ID0gdGhpcy5jYW5vbmljYWxfcHJlZml4ID0gY2Fub25pY2FsICsgXCIvXCI7XG4gICAgICAgIHRoaXMubWF0Y2hlcyA9IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgICAgICB0ZXh0ID0gdGV4dC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgcmV0dXJuIHRleHQgPT0gY2Fub25pY2FsIHx8IHRleHQuc3RhcnRzV2l0aChjYW5vbmljYWxfcHJlZml4KTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgdG9TdHJpbmcoKSB7IHJldHVybiB0aGlzLnRhZzsgfVxufVxuXG5leHBvcnQgY2xhc3MgUmVwbGFjZW1lbnQge1xuXG4gICAgY29uc3RydWN0b3IoZnJvbVRhZywgdG9UYWcpIHtcbiAgICAgICAgY29uc3QgY2FjaGUgPSAgT2JqZWN0LmFzc2lnbihcbiAgICAgICAgICAgIE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgICAgICAgICAgICAgICBbZnJvbVRhZy50YWddOiAgdG9UYWcudGFnLFxuICAgICAgICAgICAgICAgIFtmcm9tVGFnLm5hbWVdOiB0b1RhZy5uYW1lLFxuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuaW5TdHJpbmcgPSBmdW5jdGlvbih0ZXh0LCBwb3MgPSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGV4dC5zbGljZSgwLCBwb3MpICsgdG9UYWcudGFnICsgdGV4dC5zbGljZShwb3MgKyBmcm9tVGFnLnRhZy5sZW5ndGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pbkFycmF5ID0gKHRhZ3MsIHNraXBPZGQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0YWdzLm1hcCgodCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChza2lwT2RkICYmIChpICYgMSkpIHJldHVybiB0OyAgIC8vIGxlYXZlIG9kZCBlbnRyaWVzIChzZXBhcmF0b3JzKSBhbG9uZVxuICAgICAgICAgICAgICAgIGlmIChjYWNoZVt0XSkgcmV0dXJuIGNhY2hlW3RdO1xuICAgICAgICAgICAgICAgIGlmICghdCkgcmV0dXJuIHQ7XG4gICAgICAgICAgICAgICAgY29uc3QgbGMgPSB0LnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgaWYgKGNhY2hlW2xjXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FjaGVbdF0gPSBjYWNoZVtsY107XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsYy5zdGFydHNXaXRoKGZyb21UYWcuY2Fub25pY2FsX3ByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhY2hlW3RdID0gY2FjaGVbbGNdID0gdGhpcy5pblN0cmluZyh0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKChcIiNcIiArIGxjKS5zdGFydHNXaXRoKGZyb21UYWcuY2Fub25pY2FsX3ByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhY2hlW3RdID0gY2FjaGVbbGNdID0gdGhpcy5pblN0cmluZyhcIiNcIiArIHQpLnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gY2FjaGVbdF0gPSBjYWNoZVtsY10gPSB0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy53aWxsTWVyZ2VUYWdzID0gZnVuY3Rpb24gKHRhZ05hbWVzKSB7XG4gICAgICAgICAgICAvLyBSZW5hbWluZyB0byBjaGFuZ2UgY2FzZSBkb2Vzbid0IGxvc2UgaW5mbywgc28gaWdub3JlIGl0XG4gICAgICAgICAgICBpZiAoZnJvbVRhZy5jYW5vbmljYWwgPT09IHRvVGFnLmNhbm9uaWNhbCkgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCBleGlzdGluZyA9IG5ldyBTZXQodGFnTmFtZXMubWFwKHMgPT4gcy50b0xvd2VyQ2FzZSgpKSk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgdGFnTmFtZSBvZiB0YWdOYW1lcy5maWx0ZXIoZnJvbVRhZy5tYXRjaGVzKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoYW5nZWQgPSB0aGlzLmluU3RyaW5nKHRhZ05hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChleGlzdGluZy5oYXMoY2hhbmdlZC50b0xvd2VyQ2FzZSgpKSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtuZXcgVGFnKHRhZ05hbWUpLCBuZXcgVGFnKGNoYW5nZWQpXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbiIsImNvbnN0IENoYXIgPSB7XG4gIEFOQ0hPUjogJyYnLFxuICBDT01NRU5UOiAnIycsXG4gIFRBRzogJyEnLFxuICBESVJFQ1RJVkVTX0VORDogJy0nLFxuICBET0NVTUVOVF9FTkQ6ICcuJ1xufTtcbmNvbnN0IExvZ0xldmVsID0gT2JqZWN0LmFzc2lnbihbJ3NpbGVudCcsICdlcnJvcicsICd3YXJuJywgJ2RlYnVnJ10sIHtcbiAgU0lMRU5UOiAwLFxuICBFUlJPUjogMSxcbiAgV0FSTjogMixcbiAgREVCVUc6IDNcbn0pO1xuY29uc3QgVHlwZSA9IHtcbiAgQUxJQVM6ICdBTElBUycsXG4gIEJMQU5LX0xJTkU6ICdCTEFOS19MSU5FJyxcbiAgQkxPQ0tfRk9MREVEOiAnQkxPQ0tfRk9MREVEJyxcbiAgQkxPQ0tfTElURVJBTDogJ0JMT0NLX0xJVEVSQUwnLFxuICBDT01NRU5UOiAnQ09NTUVOVCcsXG4gIERJUkVDVElWRTogJ0RJUkVDVElWRScsXG4gIERPQ1VNRU5UOiAnRE9DVU1FTlQnLFxuICBGTE9XX01BUDogJ0ZMT1dfTUFQJyxcbiAgRkxPV19TRVE6ICdGTE9XX1NFUScsXG4gIE1BUDogJ01BUCcsXG4gIE1BUF9LRVk6ICdNQVBfS0VZJyxcbiAgTUFQX1ZBTFVFOiAnTUFQX1ZBTFVFJyxcbiAgUExBSU46ICdQTEFJTicsXG4gIFFVT1RFX0RPVUJMRTogJ1FVT1RFX0RPVUJMRScsXG4gIFFVT1RFX1NJTkdMRTogJ1FVT1RFX1NJTkdMRScsXG4gIFNFUTogJ1NFUScsXG4gIFNFUV9JVEVNOiAnU0VRX0lURU0nXG59O1xuY29uc3QgZGVmYXVsdFRhZ1ByZWZpeCA9ICd0YWc6eWFtbC5vcmcsMjAwMjonO1xuY29uc3QgZGVmYXVsdFRhZ3MgPSB7XG4gIE1BUDogJ3RhZzp5YW1sLm9yZywyMDAyOm1hcCcsXG4gIFNFUTogJ3RhZzp5YW1sLm9yZywyMDAyOnNlcScsXG4gIFNUUjogJ3RhZzp5YW1sLm9yZywyMDAyOnN0cidcbn07XG5cbmV4cG9ydCB7IENoYXIsIExvZ0xldmVsLCBUeXBlLCBkZWZhdWx0VGFnUHJlZml4LCBkZWZhdWx0VGFncyB9O1xuIiwiZnVuY3Rpb24gZmluZExpbmVTdGFydHMoc3JjKSB7XG4gIGNvbnN0IGxzID0gWzBdO1xuICBsZXQgb2Zmc2V0ID0gc3JjLmluZGV4T2YoJ1xcbicpO1xuXG4gIHdoaWxlIChvZmZzZXQgIT09IC0xKSB7XG4gICAgb2Zmc2V0ICs9IDE7XG4gICAgbHMucHVzaChvZmZzZXQpO1xuICAgIG9mZnNldCA9IHNyYy5pbmRleE9mKCdcXG4nLCBvZmZzZXQpO1xuICB9XG5cbiAgcmV0dXJuIGxzO1xufVxuXG5mdW5jdGlvbiBnZXRTcmNJbmZvKGNzdCkge1xuICBsZXQgbGluZVN0YXJ0cywgc3JjO1xuXG4gIGlmICh0eXBlb2YgY3N0ID09PSAnc3RyaW5nJykge1xuICAgIGxpbmVTdGFydHMgPSBmaW5kTGluZVN0YXJ0cyhjc3QpO1xuICAgIHNyYyA9IGNzdDtcbiAgfSBlbHNlIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShjc3QpKSBjc3QgPSBjc3RbMF07XG5cbiAgICBpZiAoY3N0ICYmIGNzdC5jb250ZXh0KSB7XG4gICAgICBpZiAoIWNzdC5saW5lU3RhcnRzKSBjc3QubGluZVN0YXJ0cyA9IGZpbmRMaW5lU3RhcnRzKGNzdC5jb250ZXh0LnNyYyk7XG4gICAgICBsaW5lU3RhcnRzID0gY3N0LmxpbmVTdGFydHM7XG4gICAgICBzcmMgPSBjc3QuY29udGV4dC5zcmM7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBsaW5lU3RhcnRzLFxuICAgIHNyY1xuICB9O1xufVxuLyoqXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSBMaW5lUG9zIC0gT25lLWluZGV4ZWQgcG9zaXRpb24gaW4gdGhlIHNvdXJjZVxuICogQHByb3BlcnR5IHtudW1iZXJ9IGxpbmVcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjb2xcbiAqL1xuXG4vKipcbiAqIERldGVybWluZSB0aGUgbGluZS9jb2wgcG9zaXRpb24gbWF0Y2hpbmcgYSBjaGFyYWN0ZXIgb2Zmc2V0LlxuICpcbiAqIEFjY2VwdHMgYSBzb3VyY2Ugc3RyaW5nIG9yIGEgQ1NUIGRvY3VtZW50IGFzIHRoZSBzZWNvbmQgcGFyYW1ldGVyLiBXaXRoXG4gKiB0aGUgbGF0dGVyLCBzdGFydGluZyBpbmRpY2VzIGZvciBsaW5lcyBhcmUgY2FjaGVkIGluIHRoZSBkb2N1bWVudCBhc1xuICogYGxpbmVTdGFydHM6IG51bWJlcltdYC5cbiAqXG4gKiBSZXR1cm5zIGEgb25lLWluZGV4ZWQgYHsgbGluZSwgY29sIH1gIGxvY2F0aW9uIGlmIGZvdW5kLCBvclxuICogYHVuZGVmaW5lZGAgb3RoZXJ3aXNlLlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyfSBvZmZzZXRcbiAqIEBwYXJhbSB7c3RyaW5nfERvY3VtZW50fERvY3VtZW50W119IGNzdFxuICogQHJldHVybnMgez9MaW5lUG9zfVxuICovXG5cblxuZnVuY3Rpb24gZ2V0TGluZVBvcyhvZmZzZXQsIGNzdCkge1xuICBpZiAodHlwZW9mIG9mZnNldCAhPT0gJ251bWJlcicgfHwgb2Zmc2V0IDwgMCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHtcbiAgICBsaW5lU3RhcnRzLFxuICAgIHNyY1xuICB9ID0gZ2V0U3JjSW5mbyhjc3QpO1xuICBpZiAoIWxpbmVTdGFydHMgfHwgIXNyYyB8fCBvZmZzZXQgPiBzcmMubGVuZ3RoKSByZXR1cm4gbnVsbDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVTdGFydHMubGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCBzdGFydCA9IGxpbmVTdGFydHNbaV07XG5cbiAgICBpZiAob2Zmc2V0IDwgc3RhcnQpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGxpbmU6IGksXG4gICAgICAgIGNvbDogb2Zmc2V0IC0gbGluZVN0YXJ0c1tpIC0gMV0gKyAxXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChvZmZzZXQgPT09IHN0YXJ0KSByZXR1cm4ge1xuICAgICAgbGluZTogaSArIDEsXG4gICAgICBjb2w6IDFcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgbGluZSA9IGxpbmVTdGFydHMubGVuZ3RoO1xuICByZXR1cm4ge1xuICAgIGxpbmUsXG4gICAgY29sOiBvZmZzZXQgLSBsaW5lU3RhcnRzW2xpbmUgLSAxXSArIDFcbiAgfTtcbn1cbi8qKlxuICogR2V0IGEgc3BlY2lmaWVkIGxpbmUgZnJvbSB0aGUgc291cmNlLlxuICpcbiAqIEFjY2VwdHMgYSBzb3VyY2Ugc3RyaW5nIG9yIGEgQ1NUIGRvY3VtZW50IGFzIHRoZSBzZWNvbmQgcGFyYW1ldGVyLiBXaXRoXG4gKiB0aGUgbGF0dGVyLCBzdGFydGluZyBpbmRpY2VzIGZvciBsaW5lcyBhcmUgY2FjaGVkIGluIHRoZSBkb2N1bWVudCBhc1xuICogYGxpbmVTdGFydHM6IG51bWJlcltdYC5cbiAqXG4gKiBSZXR1cm5zIHRoZSBsaW5lIGFzIGEgc3RyaW5nIGlmIGZvdW5kLCBvciBgbnVsbGAgb3RoZXJ3aXNlLlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyfSBsaW5lIE9uZS1pbmRleGVkIGxpbmUgbnVtYmVyXG4gKiBAcGFyYW0ge3N0cmluZ3xEb2N1bWVudHxEb2N1bWVudFtdfSBjc3RcbiAqIEByZXR1cm5zIHs/c3RyaW5nfVxuICovXG5cbmZ1bmN0aW9uIGdldExpbmUobGluZSwgY3N0KSB7XG4gIGNvbnN0IHtcbiAgICBsaW5lU3RhcnRzLFxuICAgIHNyY1xuICB9ID0gZ2V0U3JjSW5mbyhjc3QpO1xuICBpZiAoIWxpbmVTdGFydHMgfHwgIShsaW5lID49IDEpIHx8IGxpbmUgPiBsaW5lU3RhcnRzLmxlbmd0aCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHN0YXJ0ID0gbGluZVN0YXJ0c1tsaW5lIC0gMV07XG4gIGxldCBlbmQgPSBsaW5lU3RhcnRzW2xpbmVdOyAvLyB1bmRlZmluZWQgZm9yIGxhc3QgbGluZTsgdGhhdCdzIG9rIGZvciBzbGljZSgpXG5cbiAgd2hpbGUgKGVuZCAmJiBlbmQgPiBzdGFydCAmJiBzcmNbZW5kIC0gMV0gPT09ICdcXG4nKSAtLWVuZDtcblxuICByZXR1cm4gc3JjLnNsaWNlKHN0YXJ0LCBlbmQpO1xufVxuLyoqXG4gKiBQcmV0dHktcHJpbnQgdGhlIHN0YXJ0aW5nIGxpbmUgZnJvbSB0aGUgc291cmNlIGluZGljYXRlZCBieSB0aGUgcmFuZ2UgYHBvc2BcbiAqXG4gKiBUcmltcyBvdXRwdXQgdG8gYG1heFdpZHRoYCBjaGFycyB3aGlsZSBrZWVwaW5nIHRoZSBzdGFydGluZyBjb2x1bW4gdmlzaWJsZSxcbiAqIHVzaW5nIGDigKZgIGF0IGVpdGhlciBlbmQgdG8gaW5kaWNhdGUgZHJvcHBlZCBjaGFyYWN0ZXJzLlxuICpcbiAqIFJldHVybnMgYSB0d28tbGluZSBzdHJpbmcgKG9yIGBudWxsYCkgd2l0aCBgXFxuYCBhcyBzZXBhcmF0b3I7IHRoZSBzZWNvbmQgbGluZVxuICogd2lsbCBob2xkIGFwcHJvcHJpYXRlbHkgaW5kZW50ZWQgYF5gIG1hcmtzIGluZGljYXRpbmcgdGhlIGNvbHVtbiByYW5nZS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gcG9zXG4gKiBAcGFyYW0ge0xpbmVQb3N9IHBvcy5zdGFydFxuICogQHBhcmFtIHtMaW5lUG9zfSBbcG9zLmVuZF1cbiAqIEBwYXJhbSB7c3RyaW5nfERvY3VtZW50fERvY3VtZW50W10qfSBjc3RcbiAqIEBwYXJhbSB7bnVtYmVyfSBbbWF4V2lkdGg9ODBdXG4gKiBAcmV0dXJucyB7P3N0cmluZ31cbiAqL1xuXG5mdW5jdGlvbiBnZXRQcmV0dHlDb250ZXh0KHtcbiAgc3RhcnQsXG4gIGVuZFxufSwgY3N0LCBtYXhXaWR0aCA9IDgwKSB7XG4gIGxldCBzcmMgPSBnZXRMaW5lKHN0YXJ0LmxpbmUsIGNzdCk7XG4gIGlmICghc3JjKSByZXR1cm4gbnVsbDtcbiAgbGV0IHtcbiAgICBjb2xcbiAgfSA9IHN0YXJ0O1xuXG4gIGlmIChzcmMubGVuZ3RoID4gbWF4V2lkdGgpIHtcbiAgICBpZiAoY29sIDw9IG1heFdpZHRoIC0gMTApIHtcbiAgICAgIHNyYyA9IHNyYy5zdWJzdHIoMCwgbWF4V2lkdGggLSAxKSArICfigKYnO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBoYWxmV2lkdGggPSBNYXRoLnJvdW5kKG1heFdpZHRoIC8gMik7XG4gICAgICBpZiAoc3JjLmxlbmd0aCA+IGNvbCArIGhhbGZXaWR0aCkgc3JjID0gc3JjLnN1YnN0cigwLCBjb2wgKyBoYWxmV2lkdGggLSAxKSArICfigKYnO1xuICAgICAgY29sIC09IHNyYy5sZW5ndGggLSBtYXhXaWR0aDtcbiAgICAgIHNyYyA9ICfigKYnICsgc3JjLnN1YnN0cigxIC0gbWF4V2lkdGgpO1xuICAgIH1cbiAgfVxuXG4gIGxldCBlcnJMZW4gPSAxO1xuICBsZXQgZXJyRW5kID0gJyc7XG5cbiAgaWYgKGVuZCkge1xuICAgIGlmIChlbmQubGluZSA9PT0gc3RhcnQubGluZSAmJiBjb2wgKyAoZW5kLmNvbCAtIHN0YXJ0LmNvbCkgPD0gbWF4V2lkdGggKyAxKSB7XG4gICAgICBlcnJMZW4gPSBlbmQuY29sIC0gc3RhcnQuY29sO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnJMZW4gPSBNYXRoLm1pbihzcmMubGVuZ3RoICsgMSwgbWF4V2lkdGgpIC0gY29sO1xuICAgICAgZXJyRW5kID0gJ+KApic7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgb2Zmc2V0ID0gY29sID4gMSA/ICcgJy5yZXBlYXQoY29sIC0gMSkgOiAnJztcbiAgY29uc3QgZXJyID0gJ14nLnJlcGVhdChlcnJMZW4pO1xuICByZXR1cm4gXCJcIi5jb25jYXQoc3JjLCBcIlxcblwiKS5jb25jYXQob2Zmc2V0KS5jb25jYXQoZXJyKS5jb25jYXQoZXJyRW5kKTtcbn1cblxuZXhwb3J0IHsgZ2V0TGluZSwgZ2V0TGluZVBvcywgZ2V0UHJldHR5Q29udGV4dCB9O1xuIiwiY2xhc3MgUmFuZ2Uge1xuICBzdGF0aWMgY29weShvcmlnKSB7XG4gICAgcmV0dXJuIG5ldyBSYW5nZShvcmlnLnN0YXJ0LCBvcmlnLmVuZCk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihzdGFydCwgZW5kKSB7XG4gICAgdGhpcy5zdGFydCA9IHN0YXJ0O1xuICAgIHRoaXMuZW5kID0gZW5kIHx8IHN0YXJ0O1xuICB9XG5cbiAgaXNFbXB0eSgpIHtcbiAgICByZXR1cm4gdHlwZW9mIHRoaXMuc3RhcnQgIT09ICdudW1iZXInIHx8ICF0aGlzLmVuZCB8fCB0aGlzLmVuZCA8PSB0aGlzLnN0YXJ0O1xuICB9XG4gIC8qKlxuICAgKiBTZXQgYG9yaWdTdGFydGAgYW5kIGBvcmlnRW5kYCB0byBwb2ludCB0byB0aGUgb3JpZ2luYWwgc291cmNlIHJhbmdlIGZvclxuICAgKiB0aGlzIG5vZGUsIHdoaWNoIG1heSBkaWZmZXIgZHVlIHRvIGRyb3BwZWQgQ1IgY2hhcmFjdGVycy5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJbXX0gY3IgLSBQb3NpdGlvbnMgb2YgZHJvcHBlZCBDUiBjaGFyYWN0ZXJzXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBvZmZzZXQgLSBTdGFydGluZyBpbmRleCBvZiBgY3JgIGZyb20gdGhlIGxhc3QgY2FsbFxuICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIFRoZSBuZXh0IG9mZnNldCwgbWF0Y2hpbmcgdGhlIG9uZSBmb3VuZCBmb3IgYG9yaWdTdGFydGBcbiAgICovXG5cblxuICBzZXRPcmlnUmFuZ2UoY3IsIG9mZnNldCkge1xuICAgIGNvbnN0IHtcbiAgICAgIHN0YXJ0LFxuICAgICAgZW5kXG4gICAgfSA9IHRoaXM7XG5cbiAgICBpZiAoY3IubGVuZ3RoID09PSAwIHx8IGVuZCA8PSBjclswXSkge1xuICAgICAgdGhpcy5vcmlnU3RhcnQgPSBzdGFydDtcbiAgICAgIHRoaXMub3JpZ0VuZCA9IGVuZDtcbiAgICAgIHJldHVybiBvZmZzZXQ7XG4gICAgfVxuXG4gICAgbGV0IGkgPSBvZmZzZXQ7XG5cbiAgICB3aGlsZSAoaSA8IGNyLmxlbmd0aCkge1xuICAgICAgaWYgKGNyW2ldID4gc3RhcnQpIGJyZWFrO2Vsc2UgKytpO1xuICAgIH1cblxuICAgIHRoaXMub3JpZ1N0YXJ0ID0gc3RhcnQgKyBpO1xuICAgIGNvbnN0IG5leHRPZmZzZXQgPSBpO1xuXG4gICAgd2hpbGUgKGkgPCBjci5sZW5ndGgpIHtcbiAgICAgIC8vIGlmIGVuZCB3YXMgYXQgXFxuLCBpdCBzaG91bGQgbm93IGJlIGF0IFxcclxuICAgICAgaWYgKGNyW2ldID49IGVuZCkgYnJlYWs7ZWxzZSArK2k7XG4gICAgfVxuXG4gICAgdGhpcy5vcmlnRW5kID0gZW5kICsgaTtcbiAgICByZXR1cm4gbmV4dE9mZnNldDtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IFJhbmdlIH07XG4iLCJpbXBvcnQgeyBDaGFyLCBUeXBlIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGdldExpbmVQb3MgfSBmcm9tICcuL3NvdXJjZS11dGlscy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG4vKiogUm9vdCBjbGFzcyBvZiBhbGwgbm9kZXMgKi9cblxuY2xhc3MgTm9kZSB7XG4gIHN0YXRpYyBhZGRTdHJpbmdUZXJtaW5hdG9yKHNyYywgb2Zmc2V0LCBzdHIpIHtcbiAgICBpZiAoc3RyW3N0ci5sZW5ndGggLSAxXSA9PT0gJ1xcbicpIHJldHVybiBzdHI7XG4gICAgY29uc3QgbmV4dCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0KTtcbiAgICByZXR1cm4gbmV4dCA+PSBzcmMubGVuZ3RoIHx8IHNyY1tuZXh0XSA9PT0gJ1xcbicgPyBzdHIgKyAnXFxuJyA6IHN0cjtcbiAgfSAvLyBeKC0tLXwuLi4pXG5cblxuICBzdGF0aWMgYXREb2N1bWVudEJvdW5kYXJ5KHNyYywgb2Zmc2V0LCBzZXApIHtcbiAgICBjb25zdCBjaDAgPSBzcmNbb2Zmc2V0XTtcbiAgICBpZiAoIWNoMCkgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgcHJldiA9IHNyY1tvZmZzZXQgLSAxXTtcbiAgICBpZiAocHJldiAmJiBwcmV2ICE9PSAnXFxuJykgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKHNlcCkge1xuICAgICAgaWYgKGNoMCAhPT0gc2VwKSByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjaDAgIT09IENoYXIuRElSRUNUSVZFU19FTkQgJiYgY2gwICE9PSBDaGFyLkRPQ1VNRU5UX0VORCkgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IGNoMSA9IHNyY1tvZmZzZXQgKyAxXTtcbiAgICBjb25zdCBjaDIgPSBzcmNbb2Zmc2V0ICsgMl07XG4gICAgaWYgKGNoMSAhPT0gY2gwIHx8IGNoMiAhPT0gY2gwKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgY2gzID0gc3JjW29mZnNldCArIDNdO1xuICAgIHJldHVybiAhY2gzIHx8IGNoMyA9PT0gJ1xcbicgfHwgY2gzID09PSAnXFx0JyB8fCBjaDMgPT09ICcgJztcbiAgfVxuXG4gIHN0YXRpYyBlbmRPZklkZW50aWZpZXIoc3JjLCBvZmZzZXQpIHtcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0XTtcbiAgICBjb25zdCBpc1ZlcmJhdGltID0gY2ggPT09ICc8JztcbiAgICBjb25zdCBub3RPayA9IGlzVmVyYmF0aW0gPyBbJ1xcbicsICdcXHQnLCAnICcsICc+J10gOiBbJ1xcbicsICdcXHQnLCAnICcsICdbJywgJ10nLCAneycsICd9JywgJywnXTtcblxuICAgIHdoaWxlIChjaCAmJiBub3RPay5pbmRleE9mKGNoKSA9PT0gLTEpIGNoID0gc3JjW29mZnNldCArPSAxXTtcblxuICAgIGlmIChpc1ZlcmJhdGltICYmIGNoID09PSAnPicpIG9mZnNldCArPSAxO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBzdGF0aWMgZW5kT2ZJbmRlbnQoc3JjLCBvZmZzZXQpIHtcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0XTtcblxuICAgIHdoaWxlIChjaCA9PT0gJyAnKSBjaCA9IHNyY1tvZmZzZXQgKz0gMV07XG5cbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgc3RhdGljIGVuZE9mTGluZShzcmMsIG9mZnNldCkge1xuICAgIGxldCBjaCA9IHNyY1tvZmZzZXRdO1xuXG4gICAgd2hpbGUgKGNoICYmIGNoICE9PSAnXFxuJykgY2ggPSBzcmNbb2Zmc2V0ICs9IDFdO1xuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIHN0YXRpYyBlbmRPZldoaXRlU3BhY2Uoc3JjLCBvZmZzZXQpIHtcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0XTtcblxuICAgIHdoaWxlIChjaCA9PT0gJ1xcdCcgfHwgY2ggPT09ICcgJykgY2ggPSBzcmNbb2Zmc2V0ICs9IDFdO1xuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIHN0YXRpYyBzdGFydE9mTGluZShzcmMsIG9mZnNldCkge1xuICAgIGxldCBjaCA9IHNyY1tvZmZzZXQgLSAxXTtcbiAgICBpZiAoY2ggPT09ICdcXG4nKSByZXR1cm4gb2Zmc2V0O1xuXG4gICAgd2hpbGUgKGNoICYmIGNoICE9PSAnXFxuJykgY2ggPSBzcmNbb2Zmc2V0IC09IDFdO1xuXG4gICAgcmV0dXJuIG9mZnNldCArIDE7XG4gIH1cbiAgLyoqXG4gICAqIEVuZCBvZiBpbmRlbnRhdGlvbiwgb3IgbnVsbCBpZiB0aGUgbGluZSdzIGluZGVudCBsZXZlbCBpcyBub3QgbW9yZVxuICAgKiB0aGFuIGBpbmRlbnRgXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBzcmNcbiAgICogQHBhcmFtIHtudW1iZXJ9IGluZGVudFxuICAgKiBAcGFyYW0ge251bWJlcn0gbGluZVN0YXJ0XG4gICAqIEByZXR1cm5zIHs/bnVtYmVyfVxuICAgKi9cblxuXG4gIHN0YXRpYyBlbmRPZkJsb2NrSW5kZW50KHNyYywgaW5kZW50LCBsaW5lU3RhcnQpIHtcbiAgICBjb25zdCBpbkVuZCA9IE5vZGUuZW5kT2ZJbmRlbnQoc3JjLCBsaW5lU3RhcnQpO1xuXG4gICAgaWYgKGluRW5kID4gbGluZVN0YXJ0ICsgaW5kZW50KSB7XG4gICAgICByZXR1cm4gaW5FbmQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHdzRW5kID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBpbkVuZCk7XG4gICAgICBjb25zdCBjaCA9IHNyY1t3c0VuZF07XG4gICAgICBpZiAoIWNoIHx8IGNoID09PSAnXFxuJykgcmV0dXJuIHdzRW5kO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgc3RhdGljIGF0Qmxhbmsoc3JjLCBvZmZzZXQsIGVuZEFzQmxhbmspIHtcbiAgICBjb25zdCBjaCA9IHNyY1tvZmZzZXRdO1xuICAgIHJldHVybiBjaCA9PT0gJ1xcbicgfHwgY2ggPT09ICdcXHQnIHx8IGNoID09PSAnICcgfHwgZW5kQXNCbGFuayAmJiAhY2g7XG4gIH1cblxuICBzdGF0aWMgbmV4dE5vZGVJc0luZGVudGVkKGNoLCBpbmRlbnREaWZmLCBpbmRpY2F0b3JBc0luZGVudCkge1xuICAgIGlmICghY2ggfHwgaW5kZW50RGlmZiA8IDApIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW5kZW50RGlmZiA+IDApIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBpbmRpY2F0b3JBc0luZGVudCAmJiBjaCA9PT0gJy0nO1xuICB9IC8vIHNob3VsZCBiZSBhdCBsaW5lIG9yIHN0cmluZyBlbmQsIG9yIGF0IG5leHQgbm9uLXdoaXRlc3BhY2UgY2hhclxuXG5cbiAgc3RhdGljIG5vcm1hbGl6ZU9mZnNldChzcmMsIG9mZnNldCkge1xuICAgIGNvbnN0IGNoID0gc3JjW29mZnNldF07XG4gICAgcmV0dXJuICFjaCA/IG9mZnNldCA6IGNoICE9PSAnXFxuJyAmJiBzcmNbb2Zmc2V0IC0gMV0gPT09ICdcXG4nID8gb2Zmc2V0IC0gMSA6IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0KTtcbiAgfSAvLyBmb2xkIHNpbmdsZSBuZXdsaW5lIGludG8gc3BhY2UsIG11bHRpcGxlIG5ld2xpbmVzIHRvIE4gLSAxIG5ld2xpbmVzXG4gIC8vIHByZXN1bWVzIHNyY1tvZmZzZXRdID09PSAnXFxuJ1xuXG5cbiAgc3RhdGljIGZvbGROZXdsaW5lKHNyYywgb2Zmc2V0LCBpbmRlbnQpIHtcbiAgICBsZXQgaW5Db3VudCA9IDA7XG4gICAgbGV0IGVycm9yID0gZmFsc2U7XG4gICAgbGV0IGZvbGQgPSAnJztcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0ICsgMV07XG5cbiAgICB3aGlsZSAoY2ggPT09ICcgJyB8fCBjaCA9PT0gJ1xcdCcgfHwgY2ggPT09ICdcXG4nKSB7XG4gICAgICBzd2l0Y2ggKGNoKSB7XG4gICAgICAgIGNhc2UgJ1xcbic6XG4gICAgICAgICAgaW5Db3VudCA9IDA7XG4gICAgICAgICAgb2Zmc2V0ICs9IDE7XG4gICAgICAgICAgZm9sZCArPSAnXFxuJztcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdcXHQnOlxuICAgICAgICAgIGlmIChpbkNvdW50IDw9IGluZGVudCkgZXJyb3IgPSB0cnVlO1xuICAgICAgICAgIG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0ICsgMikgLSAxO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJyAnOlxuICAgICAgICAgIGluQ291bnQgKz0gMTtcbiAgICAgICAgICBvZmZzZXQgKz0gMTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY2ggPSBzcmNbb2Zmc2V0ICsgMV07XG4gICAgfVxuXG4gICAgaWYgKCFmb2xkKSBmb2xkID0gJyAnO1xuICAgIGlmIChjaCAmJiBpbkNvdW50IDw9IGluZGVudCkgZXJyb3IgPSB0cnVlO1xuICAgIHJldHVybiB7XG4gICAgICBmb2xkLFxuICAgICAgb2Zmc2V0LFxuICAgICAgZXJyb3JcbiAgICB9O1xuICB9XG5cbiAgY29uc3RydWN0b3IodHlwZSwgcHJvcHMsIGNvbnRleHQpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2NvbnRleHQnLCB7XG4gICAgICB2YWx1ZTogY29udGV4dCB8fCBudWxsLFxuICAgICAgd3JpdGFibGU6IHRydWVcbiAgICB9KTtcbiAgICB0aGlzLmVycm9yID0gbnVsbDtcbiAgICB0aGlzLnJhbmdlID0gbnVsbDtcbiAgICB0aGlzLnZhbHVlUmFuZ2UgPSBudWxsO1xuICAgIHRoaXMucHJvcHMgPSBwcm9wcyB8fCBbXTtcbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuICAgIHRoaXMudmFsdWUgPSBudWxsO1xuICB9XG5cbiAgZ2V0UHJvcFZhbHVlKGlkeCwga2V5LCBza2lwS2V5KSB7XG4gICAgaWYgKCF0aGlzLmNvbnRleHQpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgY29uc3QgcHJvcCA9IHRoaXMucHJvcHNbaWR4XTtcbiAgICByZXR1cm4gcHJvcCAmJiBzcmNbcHJvcC5zdGFydF0gPT09IGtleSA/IHNyYy5zbGljZShwcm9wLnN0YXJ0ICsgKHNraXBLZXkgPyAxIDogMCksIHByb3AuZW5kKSA6IG51bGw7XG4gIH1cblxuICBnZXQgYW5jaG9yKCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wcm9wcy5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgYW5jaG9yID0gdGhpcy5nZXRQcm9wVmFsdWUoaSwgQ2hhci5BTkNIT1IsIHRydWUpO1xuICAgICAgaWYgKGFuY2hvciAhPSBudWxsKSByZXR1cm4gYW5jaG9yO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0IGNvbW1lbnQoKSB7XG4gICAgY29uc3QgY29tbWVudHMgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wcm9wcy5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgY29tbWVudCA9IHRoaXMuZ2V0UHJvcFZhbHVlKGksIENoYXIuQ09NTUVOVCwgdHJ1ZSk7XG4gICAgICBpZiAoY29tbWVudCAhPSBudWxsKSBjb21tZW50cy5wdXNoKGNvbW1lbnQpO1xuICAgIH1cblxuICAgIHJldHVybiBjb21tZW50cy5sZW5ndGggPiAwID8gY29tbWVudHMuam9pbignXFxuJykgOiBudWxsO1xuICB9XG5cbiAgY29tbWVudEhhc1JlcXVpcmVkV2hpdGVzcGFjZShzdGFydCkge1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgaWYgKHRoaXMuaGVhZGVyICYmIHN0YXJ0ID09PSB0aGlzLmhlYWRlci5lbmQpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIXRoaXMudmFsdWVSYW5nZSkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IHtcbiAgICAgIGVuZFxuICAgIH0gPSB0aGlzLnZhbHVlUmFuZ2U7XG4gICAgcmV0dXJuIHN0YXJ0ICE9PSBlbmQgfHwgTm9kZS5hdEJsYW5rKHNyYywgZW5kIC0gMSk7XG4gIH1cblxuICBnZXQgaGFzQ29tbWVudCgpIHtcbiAgICBpZiAodGhpcy5jb250ZXh0KSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIHNyY1xuICAgICAgfSA9IHRoaXMuY29udGV4dDtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnByb3BzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmIChzcmNbdGhpcy5wcm9wc1tpXS5zdGFydF0gPT09IENoYXIuQ09NTUVOVCkgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZ2V0IGhhc1Byb3BzKCkge1xuICAgIGlmICh0aGlzLmNvbnRleHQpIHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgc3JjXG4gICAgICB9ID0gdGhpcy5jb250ZXh0O1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucHJvcHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaWYgKHNyY1t0aGlzLnByb3BzW2ldLnN0YXJ0XSAhPT0gQ2hhci5DT01NRU5UKSByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBnZXQgaW5jbHVkZXNUcmFpbGluZ0xpbmVzKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGdldCBqc29uTGlrZSgpIHtcbiAgICBjb25zdCBqc29uTGlrZVR5cGVzID0gW1R5cGUuRkxPV19NQVAsIFR5cGUuRkxPV19TRVEsIFR5cGUuUVVPVEVfRE9VQkxFLCBUeXBlLlFVT1RFX1NJTkdMRV07XG4gICAgcmV0dXJuIGpzb25MaWtlVHlwZXMuaW5kZXhPZih0aGlzLnR5cGUpICE9PSAtMTtcbiAgfVxuXG4gIGdldCByYW5nZUFzTGluZVBvcygpIHtcbiAgICBpZiAoIXRoaXMucmFuZ2UgfHwgIXRoaXMuY29udGV4dCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICBjb25zdCBzdGFydCA9IGdldExpbmVQb3ModGhpcy5yYW5nZS5zdGFydCwgdGhpcy5jb250ZXh0LnJvb3QpO1xuICAgIGlmICghc3RhcnQpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgY29uc3QgZW5kID0gZ2V0TGluZVBvcyh0aGlzLnJhbmdlLmVuZCwgdGhpcy5jb250ZXh0LnJvb3QpO1xuICAgIHJldHVybiB7XG4gICAgICBzdGFydCxcbiAgICAgIGVuZFxuICAgIH07XG4gIH1cblxuICBnZXQgcmF3VmFsdWUoKSB7XG4gICAgaWYgKCF0aGlzLnZhbHVlUmFuZ2UgfHwgIXRoaXMuY29udGV4dCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3Qge1xuICAgICAgc3RhcnQsXG4gICAgICBlbmRcbiAgICB9ID0gdGhpcy52YWx1ZVJhbmdlO1xuICAgIHJldHVybiB0aGlzLmNvbnRleHQuc3JjLnNsaWNlKHN0YXJ0LCBlbmQpO1xuICB9XG5cbiAgZ2V0IHRhZygpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucHJvcHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IHRhZyA9IHRoaXMuZ2V0UHJvcFZhbHVlKGksIENoYXIuVEFHLCBmYWxzZSk7XG5cbiAgICAgIGlmICh0YWcgIT0gbnVsbCkge1xuICAgICAgICBpZiAodGFnWzFdID09PSAnPCcpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmVyYmF0aW06IHRhZy5zbGljZSgyLCAtMSlcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICAgIGNvbnN0IFtfLCBoYW5kbGUsIHN1ZmZpeF0gPSB0YWcubWF0Y2goL14oLiohKShbXiFdKikkLyk7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGhhbmRsZSxcbiAgICAgICAgICAgIHN1ZmZpeFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCB2YWx1ZVJhbmdlQ29udGFpbnNOZXdsaW5lKCkge1xuICAgIGlmICghdGhpcy52YWx1ZVJhbmdlIHx8ICF0aGlzLmNvbnRleHQpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCB7XG4gICAgICBzdGFydCxcbiAgICAgIGVuZFxuICAgIH0gPSB0aGlzLnZhbHVlUmFuZ2U7XG4gICAgY29uc3Qge1xuICAgICAgc3JjXG4gICAgfSA9IHRoaXMuY29udGV4dDtcblxuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgICBpZiAoc3JjW2ldID09PSAnXFxuJykgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcGFyc2VDb21tZW50KHN0YXJ0KSB7XG4gICAgY29uc3Qge1xuICAgICAgc3JjXG4gICAgfSA9IHRoaXMuY29udGV4dDtcblxuICAgIGlmIChzcmNbc3RhcnRdID09PSBDaGFyLkNPTU1FTlQpIHtcbiAgICAgIGNvbnN0IGVuZCA9IE5vZGUuZW5kT2ZMaW5lKHNyYywgc3RhcnQgKyAxKTtcbiAgICAgIGNvbnN0IGNvbW1lbnRSYW5nZSA9IG5ldyBSYW5nZShzdGFydCwgZW5kKTtcbiAgICAgIHRoaXMucHJvcHMucHVzaChjb21tZW50UmFuZ2UpO1xuICAgICAgcmV0dXJuIGVuZDtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhcnQ7XG4gIH1cbiAgLyoqXG4gICAqIFBvcHVsYXRlcyB0aGUgYG9yaWdTdGFydGAgYW5kIGBvcmlnRW5kYCB2YWx1ZXMgb2YgYWxsIHJhbmdlcyBmb3IgdGhpc1xuICAgKiBub2RlLiBFeHRlbmRlZCBieSBjaGlsZCBjbGFzc2VzIHRvIGhhbmRsZSBkZXNjZW5kYW50IG5vZGVzLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcltdfSBjciAtIFBvc2l0aW9ucyBvZiBkcm9wcGVkIENSIGNoYXJhY3RlcnNcbiAgICogQHBhcmFtIHtudW1iZXJ9IG9mZnNldCAtIFN0YXJ0aW5nIGluZGV4IG9mIGBjcmAgZnJvbSB0aGUgbGFzdCBjYWxsXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gVGhlIG5leHQgb2Zmc2V0LCBtYXRjaGluZyB0aGUgb25lIGZvdW5kIGZvciBgb3JpZ1N0YXJ0YFxuICAgKi9cblxuXG4gIHNldE9yaWdSYW5nZXMoY3IsIG9mZnNldCkge1xuICAgIGlmICh0aGlzLnJhbmdlKSBvZmZzZXQgPSB0aGlzLnJhbmdlLnNldE9yaWdSYW5nZShjciwgb2Zmc2V0KTtcbiAgICBpZiAodGhpcy52YWx1ZVJhbmdlKSB0aGlzLnZhbHVlUmFuZ2Uuc2V0T3JpZ1JhbmdlKGNyLCBvZmZzZXQpO1xuICAgIHRoaXMucHJvcHMuZm9yRWFjaChwcm9wID0+IHByb3Auc2V0T3JpZ1JhbmdlKGNyLCBvZmZzZXQpKTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgdG9TdHJpbmcoKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29udGV4dDoge1xuICAgICAgICBzcmNcbiAgICAgIH0sXG4gICAgICByYW5nZSxcbiAgICAgIHZhbHVlXG4gICAgfSA9IHRoaXM7XG4gICAgaWYgKHZhbHVlICE9IG51bGwpIHJldHVybiB2YWx1ZTtcbiAgICBjb25zdCBzdHIgPSBzcmMuc2xpY2UocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCk7XG4gICAgcmV0dXJuIE5vZGUuYWRkU3RyaW5nVGVybWluYXRvcihzcmMsIHJhbmdlLmVuZCwgc3RyKTtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IE5vZGUgfTtcbiIsImltcG9ydCB7IE5vZGUgfSBmcm9tICcuL2NzdC9Ob2RlLmpzJztcbmltcG9ydCB7IGdldExpbmVQb3MsIGdldFByZXR0eUNvbnRleHQgfSBmcm9tICcuL2NzdC9zb3VyY2UtdXRpbHMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL2NzdC9SYW5nZS5qcyc7XG5cbmNsYXNzIFlBTUxFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobmFtZSwgc291cmNlLCBtZXNzYWdlKSB7XG4gICAgaWYgKCFtZXNzYWdlIHx8ICEoc291cmNlIGluc3RhbmNlb2YgTm9kZSkpIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgYXJndW1lbnRzIGZvciBuZXcgXCIuY29uY2F0KG5hbWUpKTtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICB0aGlzLnNvdXJjZSA9IHNvdXJjZTtcbiAgfVxuXG4gIG1ha2VQcmV0dHkoKSB7XG4gICAgaWYgKCF0aGlzLnNvdXJjZSkgcmV0dXJuO1xuICAgIHRoaXMubm9kZVR5cGUgPSB0aGlzLnNvdXJjZS50eXBlO1xuICAgIGNvbnN0IGNzdCA9IHRoaXMuc291cmNlLmNvbnRleHQgJiYgdGhpcy5zb3VyY2UuY29udGV4dC5yb290O1xuXG4gICAgaWYgKHR5cGVvZiB0aGlzLm9mZnNldCA9PT0gJ251bWJlcicpIHtcbiAgICAgIHRoaXMucmFuZ2UgPSBuZXcgUmFuZ2UodGhpcy5vZmZzZXQsIHRoaXMub2Zmc2V0ICsgMSk7XG4gICAgICBjb25zdCBzdGFydCA9IGNzdCAmJiBnZXRMaW5lUG9zKHRoaXMub2Zmc2V0LCBjc3QpO1xuXG4gICAgICBpZiAoc3RhcnQpIHtcbiAgICAgICAgY29uc3QgZW5kID0ge1xuICAgICAgICAgIGxpbmU6IHN0YXJ0LmxpbmUsXG4gICAgICAgICAgY29sOiBzdGFydC5jb2wgKyAxXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMubGluZVBvcyA9IHtcbiAgICAgICAgICBzdGFydCxcbiAgICAgICAgICBlbmRcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgZGVsZXRlIHRoaXMub2Zmc2V0O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJhbmdlID0gdGhpcy5zb3VyY2UucmFuZ2U7XG4gICAgICB0aGlzLmxpbmVQb3MgPSB0aGlzLnNvdXJjZS5yYW5nZUFzTGluZVBvcztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5saW5lUG9zKSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIGxpbmUsXG4gICAgICAgIGNvbFxuICAgICAgfSA9IHRoaXMubGluZVBvcy5zdGFydDtcbiAgICAgIHRoaXMubWVzc2FnZSArPSBcIiBhdCBsaW5lIFwiLmNvbmNhdChsaW5lLCBcIiwgY29sdW1uIFwiKS5jb25jYXQoY29sKTtcbiAgICAgIGNvbnN0IGN0eCA9IGNzdCAmJiBnZXRQcmV0dHlDb250ZXh0KHRoaXMubGluZVBvcywgY3N0KTtcbiAgICAgIGlmIChjdHgpIHRoaXMubWVzc2FnZSArPSBcIjpcXG5cXG5cIi5jb25jYXQoY3R4LCBcIlxcblwiKTtcbiAgICB9XG5cbiAgICBkZWxldGUgdGhpcy5zb3VyY2U7XG4gIH1cblxufVxuY2xhc3MgWUFNTFJlZmVyZW5jZUVycm9yIGV4dGVuZHMgWUFNTEVycm9yIHtcbiAgY29uc3RydWN0b3Ioc291cmNlLCBtZXNzYWdlKSB7XG4gICAgc3VwZXIoJ1lBTUxSZWZlcmVuY2VFcnJvcicsIHNvdXJjZSwgbWVzc2FnZSk7XG4gIH1cblxufVxuY2xhc3MgWUFNTFNlbWFudGljRXJyb3IgZXh0ZW5kcyBZQU1MRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcihzb3VyY2UsIG1lc3NhZ2UpIHtcbiAgICBzdXBlcignWUFNTFNlbWFudGljRXJyb3InLCBzb3VyY2UsIG1lc3NhZ2UpO1xuICB9XG5cbn1cbmNsYXNzIFlBTUxTeW50YXhFcnJvciBleHRlbmRzIFlBTUxFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHNvdXJjZSwgbWVzc2FnZSkge1xuICAgIHN1cGVyKCdZQU1MU3ludGF4RXJyb3InLCBzb3VyY2UsIG1lc3NhZ2UpO1xuICB9XG5cbn1cbmNsYXNzIFlBTUxXYXJuaW5nIGV4dGVuZHMgWUFNTEVycm9yIHtcbiAgY29uc3RydWN0b3Ioc291cmNlLCBtZXNzYWdlKSB7XG4gICAgc3VwZXIoJ1lBTUxXYXJuaW5nJywgc291cmNlLCBtZXNzYWdlKTtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IFlBTUxFcnJvciwgWUFNTFJlZmVyZW5jZUVycm9yLCBZQU1MU2VtYW50aWNFcnJvciwgWUFNTFN5bnRheEVycm9yLCBZQU1MV2FybmluZyB9O1xuIiwiaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi9SYW5nZS5qcyc7XG5cbmNsYXNzIEJsYW5rTGluZSBleHRlbmRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihUeXBlLkJMQU5LX0xJTkUpO1xuICB9XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cblxuICBnZXQgaW5jbHVkZXNUcmFpbGluZ0xpbmVzKCkge1xuICAgIC8vIFRoaXMgaXMgbmV2ZXIgY2FsbGVkIGZyb20gYW55d2hlcmUsIGJ1dCBpZiBpdCB3ZXJlLFxuICAgIC8vIHRoaXMgaXMgdGhlIHZhbHVlIGl0IHNob3VsZCByZXR1cm4uXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgLyoqXG4gICAqIFBhcnNlcyBhIGJsYW5rIGxpbmUgZnJvbSB0aGUgc291cmNlXG4gICAqXG4gICAqIEBwYXJhbSB7UGFyc2VDb250ZXh0fSBjb250ZXh0XG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydCAtIEluZGV4IG9mIGZpcnN0IFxcbiBjaGFyYWN0ZXJcbiAgICogQHJldHVybnMge251bWJlcn0gLSBJbmRleCBvZiB0aGUgY2hhcmFjdGVyIGFmdGVyIHRoaXNcbiAgICovXG5cblxuICBwYXJzZShjb250ZXh0LCBzdGFydCkge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgdGhpcy5yYW5nZSA9IG5ldyBSYW5nZShzdGFydCwgc3RhcnQgKyAxKTtcbiAgICByZXR1cm4gc3RhcnQgKyAxO1xuICB9XG5cbn1cblxuZXhwb3J0IHsgQmxhbmtMaW5lIH07XG4iLCJpbXBvcnQgeyBUeXBlIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFlBTUxTZW1hbnRpY0Vycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IEJsYW5rTGluZSB9IGZyb20gJy4vQmxhbmtMaW5lLmpzJztcbmltcG9ydCB7IE5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL1JhbmdlLmpzJztcblxuY2xhc3MgQ29sbGVjdGlvbkl0ZW0gZXh0ZW5kcyBOb2RlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgcHJvcHMpIHtcbiAgICBzdXBlcih0eXBlLCBwcm9wcyk7XG4gICAgdGhpcy5ub2RlID0gbnVsbDtcbiAgfVxuXG4gIGdldCBpbmNsdWRlc1RyYWlsaW5nTGluZXMoKSB7XG4gICAgcmV0dXJuICEhdGhpcy5ub2RlICYmIHRoaXMubm9kZS5pbmNsdWRlc1RyYWlsaW5nTGluZXM7XG4gIH1cbiAgLyoqXG4gICAqIEBwYXJhbSB7UGFyc2VDb250ZXh0fSBjb250ZXh0XG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydCAtIEluZGV4IG9mIGZpcnN0IGNoYXJhY3RlclxuICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIEluZGV4IG9mIHRoZSBjaGFyYWN0ZXIgYWZ0ZXIgdGhpc1xuICAgKi9cblxuXG4gIHBhcnNlKGNvbnRleHQsIHN0YXJ0KSB7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICBjb25zdCB7XG4gICAgICBwYXJzZU5vZGUsXG4gICAgICBzcmNcbiAgICB9ID0gY29udGV4dDtcbiAgICBsZXQge1xuICAgICAgYXRMaW5lU3RhcnQsXG4gICAgICBsaW5lU3RhcnRcbiAgICB9ID0gY29udGV4dDtcbiAgICBpZiAoIWF0TGluZVN0YXJ0ICYmIHRoaXMudHlwZSA9PT0gVHlwZS5TRVFfSVRFTSkgdGhpcy5lcnJvciA9IG5ldyBZQU1MU2VtYW50aWNFcnJvcih0aGlzLCAnU2VxdWVuY2UgaXRlbXMgbXVzdCBub3QgaGF2ZSBwcmVjZWRpbmcgY29udGVudCBvbiB0aGUgc2FtZSBsaW5lJyk7XG4gICAgY29uc3QgaW5kZW50ID0gYXRMaW5lU3RhcnQgPyBzdGFydCAtIGxpbmVTdGFydCA6IGNvbnRleHQuaW5kZW50O1xuICAgIGxldCBvZmZzZXQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIHN0YXJ0ICsgMSk7XG4gICAgbGV0IGNoID0gc3JjW29mZnNldF07XG4gICAgY29uc3QgaW5saW5lQ29tbWVudCA9IGNoID09PSAnIyc7XG4gICAgY29uc3QgY29tbWVudHMgPSBbXTtcbiAgICBsZXQgYmxhbmtMaW5lID0gbnVsbDtcblxuICAgIHdoaWxlIChjaCA9PT0gJ1xcbicgfHwgY2ggPT09ICcjJykge1xuICAgICAgaWYgKGNoID09PSAnIycpIHtcbiAgICAgICAgY29uc3QgZW5kID0gTm9kZS5lbmRPZkxpbmUoc3JjLCBvZmZzZXQgKyAxKTtcbiAgICAgICAgY29tbWVudHMucHVzaChuZXcgUmFuZ2Uob2Zmc2V0LCBlbmQpKTtcbiAgICAgICAgb2Zmc2V0ID0gZW5kO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXRMaW5lU3RhcnQgPSB0cnVlO1xuICAgICAgICBsaW5lU3RhcnQgPSBvZmZzZXQgKyAxO1xuICAgICAgICBjb25zdCB3c0VuZCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgbGluZVN0YXJ0KTtcblxuICAgICAgICBpZiAoc3JjW3dzRW5kXSA9PT0gJ1xcbicgJiYgY29tbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgYmxhbmtMaW5lID0gbmV3IEJsYW5rTGluZSgpO1xuICAgICAgICAgIGxpbmVTdGFydCA9IGJsYW5rTGluZS5wYXJzZSh7XG4gICAgICAgICAgICBzcmNcbiAgICAgICAgICB9LCBsaW5lU3RhcnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgb2Zmc2V0ID0gTm9kZS5lbmRPZkluZGVudChzcmMsIGxpbmVTdGFydCk7XG4gICAgICB9XG5cbiAgICAgIGNoID0gc3JjW29mZnNldF07XG4gICAgfVxuXG4gICAgaWYgKE5vZGUubmV4dE5vZGVJc0luZGVudGVkKGNoLCBvZmZzZXQgLSAobGluZVN0YXJ0ICsgaW5kZW50KSwgdGhpcy50eXBlICE9PSBUeXBlLlNFUV9JVEVNKSkge1xuICAgICAgdGhpcy5ub2RlID0gcGFyc2VOb2RlKHtcbiAgICAgICAgYXRMaW5lU3RhcnQsXG4gICAgICAgIGluQ29sbGVjdGlvbjogZmFsc2UsXG4gICAgICAgIGluZGVudCxcbiAgICAgICAgbGluZVN0YXJ0LFxuICAgICAgICBwYXJlbnQ6IHRoaXNcbiAgICAgIH0sIG9mZnNldCk7XG4gICAgfSBlbHNlIGlmIChjaCAmJiBsaW5lU3RhcnQgPiBzdGFydCArIDEpIHtcbiAgICAgIG9mZnNldCA9IGxpbmVTdGFydCAtIDE7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubm9kZSkge1xuICAgICAgaWYgKGJsYW5rTGluZSkge1xuICAgICAgICAvLyBPbmx5IGJsYW5rIGxpbmVzIHByZWNlZGluZyBub24tZW1wdHkgbm9kZXMgYXJlIGNhcHR1cmVkLiBOb3RlIHRoYXRcbiAgICAgICAgLy8gdGhpcyBtZWFucyB0aGF0IGNvbGxlY3Rpb24gaXRlbSByYW5nZSBzdGFydCBpbmRpY2VzIGRvIG5vdCBhbHdheXNcbiAgICAgICAgLy8gaW5jcmVhc2UgbW9ub3RvbmljYWxseS4gLS0gZWVtZWxpL3lhbWwjMTI2XG4gICAgICAgIGNvbnN0IGl0ZW1zID0gY29udGV4dC5wYXJlbnQuaXRlbXMgfHwgY29udGV4dC5wYXJlbnQuY29udGVudHM7XG4gICAgICAgIGlmIChpdGVtcykgaXRlbXMucHVzaChibGFua0xpbmUpO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29tbWVudHMubGVuZ3RoKSBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseSh0aGlzLnByb3BzLCBjb21tZW50cyk7XG4gICAgICBvZmZzZXQgPSB0aGlzLm5vZGUucmFuZ2UuZW5kO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaW5saW5lQ29tbWVudCkge1xuICAgICAgICBjb25zdCBjID0gY29tbWVudHNbMF07XG4gICAgICAgIHRoaXMucHJvcHMucHVzaChjKTtcbiAgICAgICAgb2Zmc2V0ID0gYy5lbmQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvZmZzZXQgPSBOb2RlLmVuZE9mTGluZShzcmMsIHN0YXJ0ICsgMSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZW5kID0gdGhpcy5ub2RlID8gdGhpcy5ub2RlLnZhbHVlUmFuZ2UuZW5kIDogb2Zmc2V0O1xuICAgIHRoaXMudmFsdWVSYW5nZSA9IG5ldyBSYW5nZShzdGFydCwgZW5kKTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gc3VwZXIuc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KTtcbiAgICByZXR1cm4gdGhpcy5ub2RlID8gdGhpcy5ub2RlLnNldE9yaWdSYW5nZXMoY3IsIG9mZnNldCkgOiBvZmZzZXQ7XG4gIH1cblxuICB0b1N0cmluZygpIHtcbiAgICBjb25zdCB7XG4gICAgICBjb250ZXh0OiB7XG4gICAgICAgIHNyY1xuICAgICAgfSxcbiAgICAgIG5vZGUsXG4gICAgICByYW5nZSxcbiAgICAgIHZhbHVlXG4gICAgfSA9IHRoaXM7XG4gICAgaWYgKHZhbHVlICE9IG51bGwpIHJldHVybiB2YWx1ZTtcbiAgICBjb25zdCBzdHIgPSBub2RlID8gc3JjLnNsaWNlKHJhbmdlLnN0YXJ0LCBub2RlLnJhbmdlLnN0YXJ0KSArIFN0cmluZyhub2RlKSA6IHNyYy5zbGljZShyYW5nZS5zdGFydCwgcmFuZ2UuZW5kKTtcbiAgICByZXR1cm4gTm9kZS5hZGRTdHJpbmdUZXJtaW5hdG9yKHNyYywgcmFuZ2UuZW5kLCBzdHIpO1xuICB9XG5cbn1cblxuZXhwb3J0IHsgQ29sbGVjdGlvbkl0ZW0gfTtcbiIsImltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5jbGFzcyBDb21tZW50IGV4dGVuZHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFR5cGUuQ09NTUVOVCk7XG4gIH1cbiAgLyoqXG4gICAqIFBhcnNlcyBhIGNvbW1lbnQgbGluZSBmcm9tIHRoZSBzb3VyY2VcbiAgICpcbiAgICogQHBhcmFtIHtQYXJzZUNvbnRleHR9IGNvbnRleHRcbiAgICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IC0gSW5kZXggb2YgZmlyc3QgY2hhcmFjdGVyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gSW5kZXggb2YgdGhlIGNoYXJhY3RlciBhZnRlciB0aGlzIHNjYWxhclxuICAgKi9cblxuXG4gIHBhcnNlKGNvbnRleHQsIHN0YXJ0KSB7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICBjb25zdCBvZmZzZXQgPSB0aGlzLnBhcnNlQ29tbWVudChzdGFydCk7XG4gICAgdGhpcy5yYW5nZSA9IG5ldyBSYW5nZShzdGFydCwgb2Zmc2V0KTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbn1cblxuZXhwb3J0IHsgQ29tbWVudCB9O1xuIiwiaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MU3ludGF4RXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgQmxhbmtMaW5lIH0gZnJvbSAnLi9CbGFua0xpbmUuanMnO1xuaW1wb3J0IHsgQ29sbGVjdGlvbkl0ZW0gfSBmcm9tICcuL0NvbGxlY3Rpb25JdGVtLmpzJztcbmltcG9ydCB7IENvbW1lbnQgfSBmcm9tICcuL0NvbW1lbnQuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5mdW5jdGlvbiBncmFiQ29sbGVjdGlvbkVuZENvbW1lbnRzKG5vZGUpIHtcbiAgbGV0IGNub2RlID0gbm9kZTtcblxuICB3aGlsZSAoY25vZGUgaW5zdGFuY2VvZiBDb2xsZWN0aW9uSXRlbSkgY25vZGUgPSBjbm9kZS5ub2RlO1xuXG4gIGlmICghKGNub2RlIGluc3RhbmNlb2YgQ29sbGVjdGlvbikpIHJldHVybiBudWxsO1xuICBjb25zdCBsZW4gPSBjbm9kZS5pdGVtcy5sZW5ndGg7XG4gIGxldCBjaSA9IC0xO1xuXG4gIGZvciAobGV0IGkgPSBsZW4gLSAxOyBpID49IDA7IC0taSkge1xuICAgIGNvbnN0IG4gPSBjbm9kZS5pdGVtc1tpXTtcblxuICAgIGlmIChuLnR5cGUgPT09IFR5cGUuQ09NTUVOVCkge1xuICAgICAgLy8gS2VlcCBzdWZmaWNpZW50bHkgaW5kZW50ZWQgY29tbWVudHMgd2l0aCBwcmVjZWRpbmcgbm9kZVxuICAgICAgY29uc3Qge1xuICAgICAgICBpbmRlbnQsXG4gICAgICAgIGxpbmVTdGFydFxuICAgICAgfSA9IG4uY29udGV4dDtcbiAgICAgIGlmIChpbmRlbnQgPiAwICYmIG4ucmFuZ2Uuc3RhcnQgPj0gbGluZVN0YXJ0ICsgaW5kZW50KSBicmVhaztcbiAgICAgIGNpID0gaTtcbiAgICB9IGVsc2UgaWYgKG4udHlwZSA9PT0gVHlwZS5CTEFOS19MSU5FKSBjaSA9IGk7ZWxzZSBicmVhaztcbiAgfVxuXG4gIGlmIChjaSA9PT0gLTEpIHJldHVybiBudWxsO1xuICBjb25zdCBjYSA9IGNub2RlLml0ZW1zLnNwbGljZShjaSwgbGVuIC0gY2kpO1xuICBjb25zdCBwcmV2RW5kID0gY2FbMF0ucmFuZ2Uuc3RhcnQ7XG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjbm9kZS5yYW5nZS5lbmQgPSBwcmV2RW5kO1xuICAgIGlmIChjbm9kZS52YWx1ZVJhbmdlICYmIGNub2RlLnZhbHVlUmFuZ2UuZW5kID4gcHJldkVuZCkgY25vZGUudmFsdWVSYW5nZS5lbmQgPSBwcmV2RW5kO1xuICAgIGlmIChjbm9kZSA9PT0gbm9kZSkgYnJlYWs7XG4gICAgY25vZGUgPSBjbm9kZS5jb250ZXh0LnBhcmVudDtcbiAgfVxuXG4gIHJldHVybiBjYTtcbn1cbmNsYXNzIENvbGxlY3Rpb24gZXh0ZW5kcyBOb2RlIHtcbiAgc3RhdGljIG5leHRDb250ZW50SGFzSW5kZW50KHNyYywgb2Zmc2V0LCBpbmRlbnQpIHtcbiAgICBjb25zdCBsaW5lU3RhcnQgPSBOb2RlLmVuZE9mTGluZShzcmMsIG9mZnNldCkgKyAxO1xuICAgIG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgbGluZVN0YXJ0KTtcbiAgICBjb25zdCBjaCA9IHNyY1tvZmZzZXRdO1xuICAgIGlmICghY2gpIHJldHVybiBmYWxzZTtcbiAgICBpZiAob2Zmc2V0ID49IGxpbmVTdGFydCArIGluZGVudCkgcmV0dXJuIHRydWU7XG4gICAgaWYgKGNoICE9PSAnIycgJiYgY2ggIT09ICdcXG4nKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIENvbGxlY3Rpb24ubmV4dENvbnRlbnRIYXNJbmRlbnQoc3JjLCBvZmZzZXQsIGluZGVudCk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihmaXJzdEl0ZW0pIHtcbiAgICBzdXBlcihmaXJzdEl0ZW0udHlwZSA9PT0gVHlwZS5TRVFfSVRFTSA/IFR5cGUuU0VRIDogVHlwZS5NQVApO1xuXG4gICAgZm9yIChsZXQgaSA9IGZpcnN0SXRlbS5wcm9wcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgaWYgKGZpcnN0SXRlbS5wcm9wc1tpXS5zdGFydCA8IGZpcnN0SXRlbS5jb250ZXh0LmxpbmVTdGFydCkge1xuICAgICAgICAvLyBwcm9wcyBvbiBwcmV2aW91cyBsaW5lIGFyZSBhc3N1bWVkIGJ5IHRoZSBjb2xsZWN0aW9uXG4gICAgICAgIHRoaXMucHJvcHMgPSBmaXJzdEl0ZW0ucHJvcHMuc2xpY2UoMCwgaSArIDEpO1xuICAgICAgICBmaXJzdEl0ZW0ucHJvcHMgPSBmaXJzdEl0ZW0ucHJvcHMuc2xpY2UoaSArIDEpO1xuICAgICAgICBjb25zdCBpdGVtUmFuZ2UgPSBmaXJzdEl0ZW0ucHJvcHNbMF0gfHwgZmlyc3RJdGVtLnZhbHVlUmFuZ2U7XG4gICAgICAgIGZpcnN0SXRlbS5yYW5nZS5zdGFydCA9IGl0ZW1SYW5nZS5zdGFydDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5pdGVtcyA9IFtmaXJzdEl0ZW1dO1xuICAgIGNvbnN0IGVjID0gZ3JhYkNvbGxlY3Rpb25FbmRDb21tZW50cyhmaXJzdEl0ZW0pO1xuICAgIGlmIChlYykgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkodGhpcy5pdGVtcywgZWMpO1xuICB9XG5cbiAgZ2V0IGluY2x1ZGVzVHJhaWxpbmdMaW5lcygpIHtcbiAgICByZXR1cm4gdGhpcy5pdGVtcy5sZW5ndGggPiAwO1xuICB9XG4gIC8qKlxuICAgKiBAcGFyYW0ge1BhcnNlQ29udGV4dH0gY29udGV4dFxuICAgKiBAcGFyYW0ge251bWJlcn0gc3RhcnQgLSBJbmRleCBvZiBmaXJzdCBjaGFyYWN0ZXJcbiAgICogQHJldHVybnMge251bWJlcn0gLSBJbmRleCBvZiB0aGUgY2hhcmFjdGVyIGFmdGVyIHRoaXNcbiAgICovXG5cblxuICBwYXJzZShjb250ZXh0LCBzdGFydCkge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgY29uc3Qge1xuICAgICAgcGFyc2VOb2RlLFxuICAgICAgc3JjXG4gICAgfSA9IGNvbnRleHQ7IC8vIEl0J3MgZWFzaWVyIHRvIHJlY2FsY3VsYXRlIGxpbmVTdGFydCBoZXJlIHJhdGhlciB0aGFuIHRyYWNraW5nIGRvd24gdGhlXG4gICAgLy8gbGFzdCBjb250ZXh0IGZyb20gd2hpY2ggdG8gcmVhZCBpdCAtLSBlZW1lbGkveWFtbCMyXG5cbiAgICBsZXQgbGluZVN0YXJ0ID0gTm9kZS5zdGFydE9mTGluZShzcmMsIHN0YXJ0KTtcbiAgICBjb25zdCBmaXJzdEl0ZW0gPSB0aGlzLml0ZW1zWzBdOyAvLyBGaXJzdC1pdGVtIGNvbnRleHQgbmVlZHMgdG8gYmUgY29ycmVjdCBmb3IgbGF0ZXIgY29tbWVudCBoYW5kbGluZ1xuICAgIC8vIC0tIGVlbWVsaS95YW1sIzE3XG5cbiAgICBmaXJzdEl0ZW0uY29udGV4dC5wYXJlbnQgPSB0aGlzO1xuICAgIHRoaXMudmFsdWVSYW5nZSA9IFJhbmdlLmNvcHkoZmlyc3RJdGVtLnZhbHVlUmFuZ2UpO1xuICAgIGNvbnN0IGluZGVudCA9IGZpcnN0SXRlbS5yYW5nZS5zdGFydCAtIGZpcnN0SXRlbS5jb250ZXh0LmxpbmVTdGFydDtcbiAgICBsZXQgb2Zmc2V0ID0gc3RhcnQ7XG4gICAgb2Zmc2V0ID0gTm9kZS5ub3JtYWxpemVPZmZzZXQoc3JjLCBvZmZzZXQpO1xuICAgIGxldCBjaCA9IHNyY1tvZmZzZXRdO1xuICAgIGxldCBhdExpbmVTdGFydCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgbGluZVN0YXJ0KSA9PT0gb2Zmc2V0O1xuICAgIGxldCBwcmV2SW5jbHVkZXNUcmFpbGluZ0xpbmVzID0gZmFsc2U7XG5cbiAgICB3aGlsZSAoY2gpIHtcbiAgICAgIHdoaWxlIChjaCA9PT0gJ1xcbicgfHwgY2ggPT09ICcjJykge1xuICAgICAgICBpZiAoYXRMaW5lU3RhcnQgJiYgY2ggPT09ICdcXG4nICYmICFwcmV2SW5jbHVkZXNUcmFpbGluZ0xpbmVzKSB7XG4gICAgICAgICAgY29uc3QgYmxhbmtMaW5lID0gbmV3IEJsYW5rTGluZSgpO1xuICAgICAgICAgIG9mZnNldCA9IGJsYW5rTGluZS5wYXJzZSh7XG4gICAgICAgICAgICBzcmNcbiAgICAgICAgICB9LCBvZmZzZXQpO1xuICAgICAgICAgIHRoaXMudmFsdWVSYW5nZS5lbmQgPSBvZmZzZXQ7XG5cbiAgICAgICAgICBpZiAob2Zmc2V0ID49IHNyYy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNoID0gbnVsbDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuaXRlbXMucHVzaChibGFua0xpbmUpO1xuICAgICAgICAgIG9mZnNldCAtPSAxOyAvLyBibGFua0xpbmUucGFyc2UoKSBjb25zdW1lcyB0ZXJtaW5hbCBuZXdsaW5lXG4gICAgICAgIH0gZWxzZSBpZiAoY2ggPT09ICcjJykge1xuICAgICAgICAgIGlmIChvZmZzZXQgPCBsaW5lU3RhcnQgKyBpbmRlbnQgJiYgIUNvbGxlY3Rpb24ubmV4dENvbnRlbnRIYXNJbmRlbnQoc3JjLCBvZmZzZXQsIGluZGVudCkpIHtcbiAgICAgICAgICAgIHJldHVybiBvZmZzZXQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY29tbWVudCA9IG5ldyBDb21tZW50KCk7XG4gICAgICAgICAgb2Zmc2V0ID0gY29tbWVudC5wYXJzZSh7XG4gICAgICAgICAgICBpbmRlbnQsXG4gICAgICAgICAgICBsaW5lU3RhcnQsXG4gICAgICAgICAgICBzcmNcbiAgICAgICAgICB9LCBvZmZzZXQpO1xuICAgICAgICAgIHRoaXMuaXRlbXMucHVzaChjb21tZW50KTtcbiAgICAgICAgICB0aGlzLnZhbHVlUmFuZ2UuZW5kID0gb2Zmc2V0O1xuXG4gICAgICAgICAgaWYgKG9mZnNldCA+PSBzcmMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjaCA9IG51bGw7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsaW5lU3RhcnQgPSBvZmZzZXQgKyAxO1xuICAgICAgICBvZmZzZXQgPSBOb2RlLmVuZE9mSW5kZW50KHNyYywgbGluZVN0YXJ0KTtcblxuICAgICAgICBpZiAoTm9kZS5hdEJsYW5rKHNyYywgb2Zmc2V0KSkge1xuICAgICAgICAgIGNvbnN0IHdzRW5kID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBvZmZzZXQpO1xuICAgICAgICAgIGNvbnN0IG5leHQgPSBzcmNbd3NFbmRdO1xuXG4gICAgICAgICAgaWYgKCFuZXh0IHx8IG5leHQgPT09ICdcXG4nIHx8IG5leHQgPT09ICcjJykge1xuICAgICAgICAgICAgb2Zmc2V0ID0gd3NFbmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY2ggPSBzcmNbb2Zmc2V0XTtcbiAgICAgICAgYXRMaW5lU3RhcnQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWNoKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAob2Zmc2V0ICE9PSBsaW5lU3RhcnQgKyBpbmRlbnQgJiYgKGF0TGluZVN0YXJ0IHx8IGNoICE9PSAnOicpKSB7XG4gICAgICAgIGlmIChvZmZzZXQgPCBsaW5lU3RhcnQgKyBpbmRlbnQpIHtcbiAgICAgICAgICBpZiAobGluZVN0YXJ0ID4gc3RhcnQpIG9mZnNldCA9IGxpbmVTdGFydDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIGlmICghdGhpcy5lcnJvcikge1xuICAgICAgICAgIGNvbnN0IG1zZyA9ICdBbGwgY29sbGVjdGlvbiBpdGVtcyBtdXN0IHN0YXJ0IGF0IHRoZSBzYW1lIGNvbHVtbic7XG4gICAgICAgICAgdGhpcy5lcnJvciA9IG5ldyBZQU1MU3ludGF4RXJyb3IodGhpcywgbXNnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZmlyc3RJdGVtLnR5cGUgPT09IFR5cGUuU0VRX0lURU0pIHtcbiAgICAgICAgaWYgKGNoICE9PSAnLScpIHtcbiAgICAgICAgICBpZiAobGluZVN0YXJ0ID4gc3RhcnQpIG9mZnNldCA9IGxpbmVTdGFydDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjaCA9PT0gJy0nICYmICF0aGlzLmVycm9yKSB7XG4gICAgICAgIC8vIG1hcCBrZXkgbWF5IHN0YXJ0IHdpdGggLSwgYXMgbG9uZyBhcyBpdCdzIGZvbGxvd2VkIGJ5IGEgbm9uLXdoaXRlc3BhY2UgY2hhclxuICAgICAgICBjb25zdCBuZXh0ID0gc3JjW29mZnNldCArIDFdO1xuXG4gICAgICAgIGlmICghbmV4dCB8fCBuZXh0ID09PSAnXFxuJyB8fCBuZXh0ID09PSAnXFx0JyB8fCBuZXh0ID09PSAnICcpIHtcbiAgICAgICAgICBjb25zdCBtc2cgPSAnQSBjb2xsZWN0aW9uIGNhbm5vdCBiZSBib3RoIGEgbWFwcGluZyBhbmQgYSBzZXF1ZW5jZSc7XG4gICAgICAgICAgdGhpcy5lcnJvciA9IG5ldyBZQU1MU3ludGF4RXJyb3IodGhpcywgbXNnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBub2RlID0gcGFyc2VOb2RlKHtcbiAgICAgICAgYXRMaW5lU3RhcnQsXG4gICAgICAgIGluQ29sbGVjdGlvbjogdHJ1ZSxcbiAgICAgICAgaW5kZW50LFxuICAgICAgICBsaW5lU3RhcnQsXG4gICAgICAgIHBhcmVudDogdGhpc1xuICAgICAgfSwgb2Zmc2V0KTtcbiAgICAgIGlmICghbm9kZSkgcmV0dXJuIG9mZnNldDsgLy8gYXQgbmV4dCBkb2N1bWVudCBzdGFydFxuXG4gICAgICB0aGlzLml0ZW1zLnB1c2gobm9kZSk7XG4gICAgICB0aGlzLnZhbHVlUmFuZ2UuZW5kID0gbm9kZS52YWx1ZVJhbmdlLmVuZDtcbiAgICAgIG9mZnNldCA9IE5vZGUubm9ybWFsaXplT2Zmc2V0KHNyYywgbm9kZS5yYW5nZS5lbmQpO1xuICAgICAgY2ggPSBzcmNbb2Zmc2V0XTtcbiAgICAgIGF0TGluZVN0YXJ0ID0gZmFsc2U7XG4gICAgICBwcmV2SW5jbHVkZXNUcmFpbGluZ0xpbmVzID0gbm9kZS5pbmNsdWRlc1RyYWlsaW5nTGluZXM7IC8vIE5lZWQgdG8gcmVzZXQgbGluZVN0YXJ0IGFuZCBhdExpbmVTdGFydCBoZXJlIGlmIHByZWNlZGluZyBub2RlJ3MgcmFuZ2VcbiAgICAgIC8vIGhhcyBhZHZhbmNlZCB0byBjaGVjayB0aGUgY3VycmVudCBsaW5lJ3MgaW5kZW50YXRpb24gbGV2ZWxcbiAgICAgIC8vIC0tIGVlbWVsaS95YW1sIzEwICYgZWVtZWxpL3lhbWwjMzhcblxuICAgICAgaWYgKGNoKSB7XG4gICAgICAgIGxldCBscyA9IG9mZnNldCAtIDE7XG4gICAgICAgIGxldCBwcmV2ID0gc3JjW2xzXTtcblxuICAgICAgICB3aGlsZSAocHJldiA9PT0gJyAnIHx8IHByZXYgPT09ICdcXHQnKSBwcmV2ID0gc3JjWy0tbHNdO1xuXG4gICAgICAgIGlmIChwcmV2ID09PSAnXFxuJykge1xuICAgICAgICAgIGxpbmVTdGFydCA9IGxzICsgMTtcbiAgICAgICAgICBhdExpbmVTdGFydCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgZWMgPSBncmFiQ29sbGVjdGlvbkVuZENvbW1lbnRzKG5vZGUpO1xuICAgICAgaWYgKGVjKSBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseSh0aGlzLml0ZW1zLCBlYyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIHNldE9yaWdSYW5nZXMoY3IsIG9mZnNldCkge1xuICAgIG9mZnNldCA9IHN1cGVyLnNldE9yaWdSYW5nZXMoY3IsIG9mZnNldCk7XG4gICAgdGhpcy5pdGVtcy5mb3JFYWNoKG5vZGUgPT4ge1xuICAgICAgb2Zmc2V0ID0gbm9kZS5zZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpO1xuICAgIH0pO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICB0b1N0cmluZygpIHtcbiAgICBjb25zdCB7XG4gICAgICBjb250ZXh0OiB7XG4gICAgICAgIHNyY1xuICAgICAgfSxcbiAgICAgIGl0ZW1zLFxuICAgICAgcmFuZ2UsXG4gICAgICB2YWx1ZVxuICAgIH0gPSB0aGlzO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKSByZXR1cm4gdmFsdWU7XG4gICAgbGV0IHN0ciA9IHNyYy5zbGljZShyYW5nZS5zdGFydCwgaXRlbXNbMF0ucmFuZ2Uuc3RhcnQpICsgU3RyaW5nKGl0ZW1zWzBdKTtcblxuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaXRlbXMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBpdGVtc1tpXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgYXRMaW5lU3RhcnQsXG4gICAgICAgIGluZGVudFxuICAgICAgfSA9IGl0ZW0uY29udGV4dDtcbiAgICAgIGlmIChhdExpbmVTdGFydCkgZm9yIChsZXQgaSA9IDA7IGkgPCBpbmRlbnQ7ICsraSkgc3RyICs9ICcgJztcbiAgICAgIHN0ciArPSBTdHJpbmcoaXRlbSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE5vZGUuYWRkU3RyaW5nVGVybWluYXRvcihzcmMsIHJhbmdlLmVuZCwgc3RyKTtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IENvbGxlY3Rpb24sIGdyYWJDb2xsZWN0aW9uRW5kQ29tbWVudHMgfTtcbiIsImltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5jbGFzcyBEaXJlY3RpdmUgZXh0ZW5kcyBOb2RlIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoVHlwZS5ESVJFQ1RJVkUpO1xuICAgIHRoaXMubmFtZSA9IG51bGw7XG4gIH1cblxuICBnZXQgcGFyYW1ldGVycygpIHtcbiAgICBjb25zdCByYXcgPSB0aGlzLnJhd1ZhbHVlO1xuICAgIHJldHVybiByYXcgPyByYXcudHJpbSgpLnNwbGl0KC9bIFxcdF0rLykgOiBbXTtcbiAgfVxuXG4gIHBhcnNlTmFtZShzdGFydCkge1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgbGV0IG9mZnNldCA9IHN0YXJ0O1xuICAgIGxldCBjaCA9IHNyY1tvZmZzZXRdO1xuXG4gICAgd2hpbGUgKGNoICYmIGNoICE9PSAnXFxuJyAmJiBjaCAhPT0gJ1xcdCcgJiYgY2ggIT09ICcgJykgY2ggPSBzcmNbb2Zmc2V0ICs9IDFdO1xuXG4gICAgdGhpcy5uYW1lID0gc3JjLnNsaWNlKHN0YXJ0LCBvZmZzZXQpO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBwYXJzZVBhcmFtZXRlcnMoc3RhcnQpIHtcbiAgICBjb25zdCB7XG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGxldCBvZmZzZXQgPSBzdGFydDtcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0XTtcblxuICAgIHdoaWxlIChjaCAmJiBjaCAhPT0gJ1xcbicgJiYgY2ggIT09ICcjJykgY2ggPSBzcmNbb2Zmc2V0ICs9IDFdO1xuXG4gICAgdGhpcy52YWx1ZVJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LCBvZmZzZXQpO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBwYXJzZShjb250ZXh0LCBzdGFydCkge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgbGV0IG9mZnNldCA9IHRoaXMucGFyc2VOYW1lKHN0YXJ0ICsgMSk7XG4gICAgb2Zmc2V0ID0gdGhpcy5wYXJzZVBhcmFtZXRlcnMob2Zmc2V0KTtcbiAgICBvZmZzZXQgPSB0aGlzLnBhcnNlQ29tbWVudChvZmZzZXQpO1xuICAgIHRoaXMucmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIG9mZnNldCk7XG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IERpcmVjdGl2ZSB9O1xuIiwiaW1wb3J0IHsgVHlwZSwgQ2hhciB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MU2VtYW50aWNFcnJvciwgWUFNTFN5bnRheEVycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IEJsYW5rTGluZSB9IGZyb20gJy4vQmxhbmtMaW5lLmpzJztcbmltcG9ydCB7IGdyYWJDb2xsZWN0aW9uRW5kQ29tbWVudHMgfSBmcm9tICcuL0NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgQ29tbWVudCB9IGZyb20gJy4vQ29tbWVudC5qcyc7XG5pbXBvcnQgeyBEaXJlY3RpdmUgfSBmcm9tICcuL0RpcmVjdGl2ZS5qcyc7XG5pbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi9SYW5nZS5qcyc7XG5cbmNsYXNzIERvY3VtZW50IGV4dGVuZHMgTm9kZSB7XG4gIHN0YXRpYyBzdGFydENvbW1lbnRPckVuZEJsYW5rTGluZShzcmMsIHN0YXJ0KSB7XG4gICAgY29uc3Qgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBzdGFydCk7XG4gICAgY29uc3QgY2ggPSBzcmNbb2Zmc2V0XTtcbiAgICByZXR1cm4gY2ggPT09ICcjJyB8fCBjaCA9PT0gJ1xcbicgPyBvZmZzZXQgOiBzdGFydDtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFR5cGUuRE9DVU1FTlQpO1xuICAgIHRoaXMuZGlyZWN0aXZlcyA9IG51bGw7XG4gICAgdGhpcy5jb250ZW50cyA9IG51bGw7XG4gICAgdGhpcy5kaXJlY3RpdmVzRW5kTWFya2VyID0gbnVsbDtcbiAgICB0aGlzLmRvY3VtZW50RW5kTWFya2VyID0gbnVsbDtcbiAgfVxuXG4gIHBhcnNlRGlyZWN0aXZlcyhzdGFydCkge1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgdGhpcy5kaXJlY3RpdmVzID0gW107XG4gICAgbGV0IGF0TGluZVN0YXJ0ID0gdHJ1ZTtcbiAgICBsZXQgaGFzRGlyZWN0aXZlcyA9IGZhbHNlO1xuICAgIGxldCBvZmZzZXQgPSBzdGFydDtcblxuICAgIHdoaWxlICghTm9kZS5hdERvY3VtZW50Qm91bmRhcnkoc3JjLCBvZmZzZXQsIENoYXIuRElSRUNUSVZFU19FTkQpKSB7XG4gICAgICBvZmZzZXQgPSBEb2N1bWVudC5zdGFydENvbW1lbnRPckVuZEJsYW5rTGluZShzcmMsIG9mZnNldCk7XG5cbiAgICAgIHN3aXRjaCAoc3JjW29mZnNldF0pIHtcbiAgICAgICAgY2FzZSAnXFxuJzpcbiAgICAgICAgICBpZiAoYXRMaW5lU3RhcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGJsYW5rTGluZSA9IG5ldyBCbGFua0xpbmUoKTtcbiAgICAgICAgICAgIG9mZnNldCA9IGJsYW5rTGluZS5wYXJzZSh7XG4gICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgfSwgb2Zmc2V0KTtcblxuICAgICAgICAgICAgaWYgKG9mZnNldCA8IHNyYy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5kaXJlY3RpdmVzLnB1c2goYmxhbmtMaW5lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb2Zmc2V0ICs9IDE7XG4gICAgICAgICAgICBhdExpbmVTdGFydCA9IHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnIyc6XG4gICAgICAgICAge1xuICAgICAgICAgICAgY29uc3QgY29tbWVudCA9IG5ldyBDb21tZW50KCk7XG4gICAgICAgICAgICBvZmZzZXQgPSBjb21tZW50LnBhcnNlKHtcbiAgICAgICAgICAgICAgc3JjXG4gICAgICAgICAgICB9LCBvZmZzZXQpO1xuICAgICAgICAgICAgdGhpcy5kaXJlY3RpdmVzLnB1c2goY29tbWVudCk7XG4gICAgICAgICAgICBhdExpbmVTdGFydCA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICclJzpcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjb25zdCBkaXJlY3RpdmUgPSBuZXcgRGlyZWN0aXZlKCk7XG4gICAgICAgICAgICBvZmZzZXQgPSBkaXJlY3RpdmUucGFyc2Uoe1xuICAgICAgICAgICAgICBwYXJlbnQ6IHRoaXMsXG4gICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgfSwgb2Zmc2V0KTtcbiAgICAgICAgICAgIHRoaXMuZGlyZWN0aXZlcy5wdXNoKGRpcmVjdGl2ZSk7XG4gICAgICAgICAgICBoYXNEaXJlY3RpdmVzID0gdHJ1ZTtcbiAgICAgICAgICAgIGF0TGluZVN0YXJ0ID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKGhhc0RpcmVjdGl2ZXMpIHtcbiAgICAgICAgICAgIHRoaXMuZXJyb3IgPSBuZXcgWUFNTFNlbWFudGljRXJyb3IodGhpcywgJ01pc3NpbmcgZGlyZWN0aXZlcy1lbmQgaW5kaWNhdG9yIGxpbmUnKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZGlyZWN0aXZlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRlbnRzID0gdGhpcy5kaXJlY3RpdmVzO1xuICAgICAgICAgICAgdGhpcy5kaXJlY3RpdmVzID0gW107XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIG9mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3JjW29mZnNldF0pIHtcbiAgICAgIHRoaXMuZGlyZWN0aXZlc0VuZE1hcmtlciA9IG5ldyBSYW5nZShvZmZzZXQsIG9mZnNldCArIDMpO1xuICAgICAgcmV0dXJuIG9mZnNldCArIDM7XG4gICAgfVxuXG4gICAgaWYgKGhhc0RpcmVjdGl2ZXMpIHtcbiAgICAgIHRoaXMuZXJyb3IgPSBuZXcgWUFNTFNlbWFudGljRXJyb3IodGhpcywgJ01pc3NpbmcgZGlyZWN0aXZlcy1lbmQgaW5kaWNhdG9yIGxpbmUnKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuZGlyZWN0aXZlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmNvbnRlbnRzID0gdGhpcy5kaXJlY3RpdmVzO1xuICAgICAgdGhpcy5kaXJlY3RpdmVzID0gW107XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIHBhcnNlQ29udGVudHMoc3RhcnQpIHtcbiAgICBjb25zdCB7XG4gICAgICBwYXJzZU5vZGUsXG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGlmICghdGhpcy5jb250ZW50cykgdGhpcy5jb250ZW50cyA9IFtdO1xuICAgIGxldCBsaW5lU3RhcnQgPSBzdGFydDtcblxuICAgIHdoaWxlIChzcmNbbGluZVN0YXJ0IC0gMV0gPT09ICctJykgbGluZVN0YXJ0IC09IDE7XG5cbiAgICBsZXQgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBzdGFydCk7XG4gICAgbGV0IGF0TGluZVN0YXJ0ID0gbGluZVN0YXJ0ID09PSBzdGFydDtcbiAgICB0aGlzLnZhbHVlUmFuZ2UgPSBuZXcgUmFuZ2Uob2Zmc2V0KTtcblxuICAgIHdoaWxlICghTm9kZS5hdERvY3VtZW50Qm91bmRhcnkoc3JjLCBvZmZzZXQsIENoYXIuRE9DVU1FTlRfRU5EKSkge1xuICAgICAgc3dpdGNoIChzcmNbb2Zmc2V0XSkge1xuICAgICAgICBjYXNlICdcXG4nOlxuICAgICAgICAgIGlmIChhdExpbmVTdGFydCkge1xuICAgICAgICAgICAgY29uc3QgYmxhbmtMaW5lID0gbmV3IEJsYW5rTGluZSgpO1xuICAgICAgICAgICAgb2Zmc2V0ID0gYmxhbmtMaW5lLnBhcnNlKHtcbiAgICAgICAgICAgICAgc3JjXG4gICAgICAgICAgICB9LCBvZmZzZXQpO1xuXG4gICAgICAgICAgICBpZiAob2Zmc2V0IDwgc3JjLmxlbmd0aCkge1xuICAgICAgICAgICAgICB0aGlzLmNvbnRlbnRzLnB1c2goYmxhbmtMaW5lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb2Zmc2V0ICs9IDE7XG4gICAgICAgICAgICBhdExpbmVTdGFydCA9IHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGluZVN0YXJ0ID0gb2Zmc2V0O1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJyMnOlxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbW1lbnQgPSBuZXcgQ29tbWVudCgpO1xuICAgICAgICAgICAgb2Zmc2V0ID0gY29tbWVudC5wYXJzZSh7XG4gICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgfSwgb2Zmc2V0KTtcbiAgICAgICAgICAgIHRoaXMuY29udGVudHMucHVzaChjb21tZW50KTtcbiAgICAgICAgICAgIGF0TGluZVN0YXJ0ID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAge1xuICAgICAgICAgICAgY29uc3QgaUVuZCA9IE5vZGUuZW5kT2ZJbmRlbnQoc3JjLCBvZmZzZXQpO1xuICAgICAgICAgICAgY29uc3QgY29udGV4dCA9IHtcbiAgICAgICAgICAgICAgYXRMaW5lU3RhcnQsXG4gICAgICAgICAgICAgIGluZGVudDogLTEsXG4gICAgICAgICAgICAgIGluRmxvdzogZmFsc2UsXG4gICAgICAgICAgICAgIGluQ29sbGVjdGlvbjogZmFsc2UsXG4gICAgICAgICAgICAgIGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgcGFyZW50OiB0aGlzXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHBhcnNlTm9kZShjb250ZXh0LCBpRW5kKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHRoaXMudmFsdWVSYW5nZS5lbmQgPSBpRW5kOyAvLyBhdCBuZXh0IGRvY3VtZW50IHN0YXJ0XG5cbiAgICAgICAgICAgIHRoaXMuY29udGVudHMucHVzaChub2RlKTtcbiAgICAgICAgICAgIG9mZnNldCA9IG5vZGUucmFuZ2UuZW5kO1xuICAgICAgICAgICAgYXRMaW5lU3RhcnQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IGVjID0gZ3JhYkNvbGxlY3Rpb25FbmRDb21tZW50cyhub2RlKTtcbiAgICAgICAgICAgIGlmIChlYykgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkodGhpcy5jb250ZW50cywgZWMpO1xuICAgICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgb2Zmc2V0ID0gRG9jdW1lbnQuc3RhcnRDb21tZW50T3JFbmRCbGFua0xpbmUoc3JjLCBvZmZzZXQpO1xuICAgIH1cblxuICAgIHRoaXMudmFsdWVSYW5nZS5lbmQgPSBvZmZzZXQ7XG5cbiAgICBpZiAoc3JjW29mZnNldF0pIHtcbiAgICAgIHRoaXMuZG9jdW1lbnRFbmRNYXJrZXIgPSBuZXcgUmFuZ2Uob2Zmc2V0LCBvZmZzZXQgKyAzKTtcbiAgICAgIG9mZnNldCArPSAzO1xuXG4gICAgICBpZiAoc3JjW29mZnNldF0pIHtcbiAgICAgICAgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBvZmZzZXQpO1xuXG4gICAgICAgIGlmIChzcmNbb2Zmc2V0XSA9PT0gJyMnKSB7XG4gICAgICAgICAgY29uc3QgY29tbWVudCA9IG5ldyBDb21tZW50KCk7XG4gICAgICAgICAgb2Zmc2V0ID0gY29tbWVudC5wYXJzZSh7XG4gICAgICAgICAgICBzcmNcbiAgICAgICAgICB9LCBvZmZzZXQpO1xuICAgICAgICAgIHRoaXMuY29udGVudHMucHVzaChjb21tZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3aXRjaCAoc3JjW29mZnNldF0pIHtcbiAgICAgICAgICBjYXNlICdcXG4nOlxuICAgICAgICAgICAgb2Zmc2V0ICs9IDE7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhpcy5lcnJvciA9IG5ldyBZQU1MU3ludGF4RXJyb3IodGhpcywgJ0RvY3VtZW50IGVuZCBtYXJrZXIgbGluZSBjYW5ub3QgaGF2ZSBhIG5vbi1jb21tZW50IHN1ZmZpeCcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuICAvKipcbiAgICogQHBhcmFtIHtQYXJzZUNvbnRleHR9IGNvbnRleHRcbiAgICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IC0gSW5kZXggb2YgZmlyc3QgY2hhcmFjdGVyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gSW5kZXggb2YgdGhlIGNoYXJhY3RlciBhZnRlciB0aGlzXG4gICAqL1xuXG5cbiAgcGFyc2UoY29udGV4dCwgc3RhcnQpIHtcbiAgICBjb250ZXh0LnJvb3QgPSB0aGlzO1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgY29uc3Qge1xuICAgICAgc3JjXG4gICAgfSA9IGNvbnRleHQ7XG4gICAgbGV0IG9mZnNldCA9IHNyYy5jaGFyQ29kZUF0KHN0YXJ0KSA9PT0gMHhmZWZmID8gc3RhcnQgKyAxIDogc3RhcnQ7IC8vIHNraXAgQk9NXG5cbiAgICBvZmZzZXQgPSB0aGlzLnBhcnNlRGlyZWN0aXZlcyhvZmZzZXQpO1xuICAgIG9mZnNldCA9IHRoaXMucGFyc2VDb250ZW50cyhvZmZzZXQpO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBzZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBzdXBlci5zZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpO1xuICAgIHRoaXMuZGlyZWN0aXZlcy5mb3JFYWNoKG5vZGUgPT4ge1xuICAgICAgb2Zmc2V0ID0gbm9kZS5zZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpO1xuICAgIH0pO1xuICAgIGlmICh0aGlzLmRpcmVjdGl2ZXNFbmRNYXJrZXIpIG9mZnNldCA9IHRoaXMuZGlyZWN0aXZlc0VuZE1hcmtlci5zZXRPcmlnUmFuZ2UoY3IsIG9mZnNldCk7XG4gICAgdGhpcy5jb250ZW50cy5mb3JFYWNoKG5vZGUgPT4ge1xuICAgICAgb2Zmc2V0ID0gbm9kZS5zZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpO1xuICAgIH0pO1xuICAgIGlmICh0aGlzLmRvY3VtZW50RW5kTWFya2VyKSBvZmZzZXQgPSB0aGlzLmRvY3VtZW50RW5kTWFya2VyLnNldE9yaWdSYW5nZShjciwgb2Zmc2V0KTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgdG9TdHJpbmcoKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29udGVudHMsXG4gICAgICBkaXJlY3RpdmVzLFxuICAgICAgdmFsdWVcbiAgICB9ID0gdGhpcztcbiAgICBpZiAodmFsdWUgIT0gbnVsbCkgcmV0dXJuIHZhbHVlO1xuICAgIGxldCBzdHIgPSBkaXJlY3RpdmVzLmpvaW4oJycpO1xuXG4gICAgaWYgKGNvbnRlbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGlmIChkaXJlY3RpdmVzLmxlbmd0aCA+IDAgfHwgY29udGVudHNbMF0udHlwZSA9PT0gVHlwZS5DT01NRU5UKSBzdHIgKz0gJy0tLVxcbic7XG4gICAgICBzdHIgKz0gY29udGVudHMuam9pbignJyk7XG4gICAgfVxuXG4gICAgaWYgKHN0cltzdHIubGVuZ3RoIC0gMV0gIT09ICdcXG4nKSBzdHIgKz0gJ1xcbic7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IERvY3VtZW50IH07XG4iLCJmdW5jdGlvbiBfZGVmaW5lUHJvcGVydHkob2JqLCBrZXksIHZhbHVlKSB7XG4gIGlmIChrZXkgaW4gb2JqKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwga2V5LCB7XG4gICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgd3JpdGFibGU6IHRydWVcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBvYmpba2V5XSA9IHZhbHVlO1xuICB9XG5cbiAgcmV0dXJuIG9iajtcbn1cblxuZXhwb3J0IHsgX2RlZmluZVByb3BlcnR5IGFzIGRlZmluZVByb3BlcnR5IH07XG4iLCJpbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi9SYW5nZS5qcyc7XG5cbmNsYXNzIEFsaWFzIGV4dGVuZHMgTm9kZSB7XG4gIC8qKlxuICAgKiBQYXJzZXMgYW4gKmFsaWFzIGZyb20gdGhlIHNvdXJjZVxuICAgKlxuICAgKiBAcGFyYW0ge1BhcnNlQ29udGV4dH0gY29udGV4dFxuICAgKiBAcGFyYW0ge251bWJlcn0gc3RhcnQgLSBJbmRleCBvZiBmaXJzdCBjaGFyYWN0ZXJcbiAgICogQHJldHVybnMge251bWJlcn0gLSBJbmRleCBvZiB0aGUgY2hhcmFjdGVyIGFmdGVyIHRoaXMgc2NhbGFyXG4gICAqL1xuICBwYXJzZShjb250ZXh0LCBzdGFydCkge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgY29uc3Qge1xuICAgICAgc3JjXG4gICAgfSA9IGNvbnRleHQ7XG4gICAgbGV0IG9mZnNldCA9IE5vZGUuZW5kT2ZJZGVudGlmaWVyKHNyYywgc3RhcnQgKyAxKTtcbiAgICB0aGlzLnZhbHVlUmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQgKyAxLCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0KTtcbiAgICBvZmZzZXQgPSB0aGlzLnBhcnNlQ29tbWVudChvZmZzZXQpO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxufVxuXG5leHBvcnQgeyBBbGlhcyB9O1xuIiwiaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MU2VtYW50aWNFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi9SYW5nZS5qcyc7XG5cbmNvbnN0IENob21wID0ge1xuICBDTElQOiAnQ0xJUCcsXG4gIEtFRVA6ICdLRUVQJyxcbiAgU1RSSVA6ICdTVFJJUCdcbn07XG5jbGFzcyBCbG9ja1ZhbHVlIGV4dGVuZHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHR5cGUsIHByb3BzKSB7XG4gICAgc3VwZXIodHlwZSwgcHJvcHMpO1xuICAgIHRoaXMuYmxvY2tJbmRlbnQgPSBudWxsO1xuICAgIHRoaXMuY2hvbXBpbmcgPSBDaG9tcC5DTElQO1xuICAgIHRoaXMuaGVhZGVyID0gbnVsbDtcbiAgfVxuXG4gIGdldCBpbmNsdWRlc1RyYWlsaW5nTGluZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2hvbXBpbmcgPT09IENob21wLktFRVA7XG4gIH1cblxuICBnZXQgc3RyVmFsdWUoKSB7XG4gICAgaWYgKCF0aGlzLnZhbHVlUmFuZ2UgfHwgIXRoaXMuY29udGV4dCkgcmV0dXJuIG51bGw7XG4gICAgbGV0IHtcbiAgICAgIHN0YXJ0LFxuICAgICAgZW5kXG4gICAgfSA9IHRoaXMudmFsdWVSYW5nZTtcbiAgICBjb25zdCB7XG4gICAgICBpbmRlbnQsXG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGlmICh0aGlzLnZhbHVlUmFuZ2UuaXNFbXB0eSgpKSByZXR1cm4gJyc7XG4gICAgbGV0IGxhc3ROZXdMaW5lID0gbnVsbDtcbiAgICBsZXQgY2ggPSBzcmNbZW5kIC0gMV07XG5cbiAgICB3aGlsZSAoY2ggPT09ICdcXG4nIHx8IGNoID09PSAnXFx0JyB8fCBjaCA9PT0gJyAnKSB7XG4gICAgICBlbmQgLT0gMTtcblxuICAgICAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgICAgICBpZiAodGhpcy5jaG9tcGluZyA9PT0gQ2hvbXAuS0VFUCkgYnJlYWs7ZWxzZSByZXR1cm4gJyc7IC8vIHByb2JhYmx5IG5ldmVyIGhhcHBlbnNcbiAgICAgIH1cblxuICAgICAgaWYgKGNoID09PSAnXFxuJykgbGFzdE5ld0xpbmUgPSBlbmQ7XG4gICAgICBjaCA9IHNyY1tlbmQgLSAxXTtcbiAgICB9XG5cbiAgICBsZXQga2VlcFN0YXJ0ID0gZW5kICsgMTtcblxuICAgIGlmIChsYXN0TmV3TGluZSkge1xuICAgICAgaWYgKHRoaXMuY2hvbXBpbmcgPT09IENob21wLktFRVApIHtcbiAgICAgICAga2VlcFN0YXJ0ID0gbGFzdE5ld0xpbmU7XG4gICAgICAgIGVuZCA9IHRoaXMudmFsdWVSYW5nZS5lbmQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbmQgPSBsYXN0TmV3TGluZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBiaSA9IGluZGVudCArIHRoaXMuYmxvY2tJbmRlbnQ7XG4gICAgY29uc3QgZm9sZGVkID0gdGhpcy50eXBlID09PSBUeXBlLkJMT0NLX0ZPTERFRDtcbiAgICBsZXQgYXRTdGFydCA9IHRydWU7XG4gICAgbGV0IHN0ciA9ICcnO1xuICAgIGxldCBzZXAgPSAnJztcbiAgICBsZXQgcHJldk1vcmVJbmRlbnRlZCA9IGZhbHNlO1xuXG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYmk7ICsraikge1xuICAgICAgICBpZiAoc3JjW2ldICE9PSAnICcpIGJyZWFrO1xuICAgICAgICBpICs9IDE7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNoID0gc3JjW2ldO1xuXG4gICAgICBpZiAoY2ggPT09ICdcXG4nKSB7XG4gICAgICAgIGlmIChzZXAgPT09ICdcXG4nKSBzdHIgKz0gJ1xcbic7ZWxzZSBzZXAgPSAnXFxuJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGxpbmVFbmQgPSBOb2RlLmVuZE9mTGluZShzcmMsIGkpO1xuICAgICAgICBjb25zdCBsaW5lID0gc3JjLnNsaWNlKGksIGxpbmVFbmQpO1xuICAgICAgICBpID0gbGluZUVuZDtcblxuICAgICAgICBpZiAoZm9sZGVkICYmIChjaCA9PT0gJyAnIHx8IGNoID09PSAnXFx0JykgJiYgaSA8IGtlZXBTdGFydCkge1xuICAgICAgICAgIGlmIChzZXAgPT09ICcgJykgc2VwID0gJ1xcbic7ZWxzZSBpZiAoIXByZXZNb3JlSW5kZW50ZWQgJiYgIWF0U3RhcnQgJiYgc2VwID09PSAnXFxuJykgc2VwID0gJ1xcblxcbic7XG4gICAgICAgICAgc3RyICs9IHNlcCArIGxpbmU7IC8vKyAoKGxpbmVFbmQgPCBlbmQgJiYgc3JjW2xpbmVFbmRdKSB8fCAnJylcblxuICAgICAgICAgIHNlcCA9IGxpbmVFbmQgPCBlbmQgJiYgc3JjW2xpbmVFbmRdIHx8ICcnO1xuICAgICAgICAgIHByZXZNb3JlSW5kZW50ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0ciArPSBzZXAgKyBsaW5lO1xuICAgICAgICAgIHNlcCA9IGZvbGRlZCAmJiBpIDwga2VlcFN0YXJ0ID8gJyAnIDogJ1xcbic7XG4gICAgICAgICAgcHJldk1vcmVJbmRlbnRlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0U3RhcnQgJiYgbGluZSAhPT0gJycpIGF0U3RhcnQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5jaG9tcGluZyA9PT0gQ2hvbXAuU1RSSVAgPyBzdHIgOiBzdHIgKyAnXFxuJztcbiAgfVxuXG4gIHBhcnNlQmxvY2tIZWFkZXIoc3RhcnQpIHtcbiAgICBjb25zdCB7XG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGxldCBvZmZzZXQgPSBzdGFydCArIDE7XG4gICAgbGV0IGJpID0gJyc7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgY2ggPSBzcmNbb2Zmc2V0XTtcblxuICAgICAgc3dpdGNoIChjaCkge1xuICAgICAgICBjYXNlICctJzpcbiAgICAgICAgICB0aGlzLmNob21waW5nID0gQ2hvbXAuU1RSSVA7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgdGhpcy5jaG9tcGluZyA9IENob21wLktFRVA7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnMCc6XG4gICAgICAgIGNhc2UgJzEnOlxuICAgICAgICBjYXNlICcyJzpcbiAgICAgICAgY2FzZSAnMyc6XG4gICAgICAgIGNhc2UgJzQnOlxuICAgICAgICBjYXNlICc1JzpcbiAgICAgICAgY2FzZSAnNic6XG4gICAgICAgIGNhc2UgJzcnOlxuICAgICAgICBjYXNlICc4JzpcbiAgICAgICAgY2FzZSAnOSc6XG4gICAgICAgICAgYmkgKz0gY2g7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aGlzLmJsb2NrSW5kZW50ID0gTnVtYmVyKGJpKSB8fCBudWxsO1xuICAgICAgICAgIHRoaXMuaGVhZGVyID0gbmV3IFJhbmdlKHN0YXJ0LCBvZmZzZXQpO1xuICAgICAgICAgIHJldHVybiBvZmZzZXQ7XG4gICAgICB9XG5cbiAgICAgIG9mZnNldCArPSAxO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlQmxvY2tWYWx1ZShzdGFydCkge1xuICAgIGNvbnN0IHtcbiAgICAgIGluZGVudCxcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgY29uc3QgZXhwbGljaXQgPSAhIXRoaXMuYmxvY2tJbmRlbnQ7XG4gICAgbGV0IG9mZnNldCA9IHN0YXJ0O1xuICAgIGxldCB2YWx1ZUVuZCA9IHN0YXJ0O1xuICAgIGxldCBtaW5CbG9ja0luZGVudCA9IDE7XG5cbiAgICBmb3IgKGxldCBjaCA9IHNyY1tvZmZzZXRdOyBjaCA9PT0gJ1xcbic7IGNoID0gc3JjW29mZnNldF0pIHtcbiAgICAgIG9mZnNldCArPSAxO1xuICAgICAgaWYgKE5vZGUuYXREb2N1bWVudEJvdW5kYXJ5KHNyYywgb2Zmc2V0KSkgYnJlYWs7XG4gICAgICBjb25zdCBlbmQgPSBOb2RlLmVuZE9mQmxvY2tJbmRlbnQoc3JjLCBpbmRlbnQsIG9mZnNldCk7IC8vIHNob3VsZCBub3QgaW5jbHVkZSB0YWI/XG5cbiAgICAgIGlmIChlbmQgPT09IG51bGwpIGJyZWFrO1xuICAgICAgY29uc3QgY2ggPSBzcmNbZW5kXTtcbiAgICAgIGNvbnN0IGxpbmVJbmRlbnQgPSBlbmQgLSAob2Zmc2V0ICsgaW5kZW50KTtcblxuICAgICAgaWYgKCF0aGlzLmJsb2NrSW5kZW50KSB7XG4gICAgICAgIC8vIG5vIGV4cGxpY2l0IGJsb2NrIGluZGVudCwgbm9uZSB5ZXQgZGV0ZWN0ZWRcbiAgICAgICAgaWYgKHNyY1tlbmRdICE9PSAnXFxuJykge1xuICAgICAgICAgIC8vIGZpcnN0IGxpbmUgd2l0aCBub24td2hpdGVzcGFjZSBjb250ZW50XG4gICAgICAgICAgaWYgKGxpbmVJbmRlbnQgPCBtaW5CbG9ja0luZGVudCkge1xuICAgICAgICAgICAgY29uc3QgbXNnID0gJ0Jsb2NrIHNjYWxhcnMgd2l0aCBtb3JlLWluZGVudGVkIGxlYWRpbmcgZW1wdHkgbGluZXMgbXVzdCB1c2UgYW4gZXhwbGljaXQgaW5kZW50YXRpb24gaW5kaWNhdG9yJztcbiAgICAgICAgICAgIHRoaXMuZXJyb3IgPSBuZXcgWUFNTFNlbWFudGljRXJyb3IodGhpcywgbXNnKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmJsb2NrSW5kZW50ID0gbGluZUluZGVudDtcbiAgICAgICAgfSBlbHNlIGlmIChsaW5lSW5kZW50ID4gbWluQmxvY2tJbmRlbnQpIHtcbiAgICAgICAgICAvLyBlbXB0eSBsaW5lIHdpdGggbW9yZSB3aGl0ZXNwYWNlXG4gICAgICAgICAgbWluQmxvY2tJbmRlbnQgPSBsaW5lSW5kZW50O1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNoICYmIGNoICE9PSAnXFxuJyAmJiBsaW5lSW5kZW50IDwgdGhpcy5ibG9ja0luZGVudCkge1xuICAgICAgICBpZiAoc3JjW2VuZF0gPT09ICcjJykgYnJlYWs7XG5cbiAgICAgICAgaWYgKCF0aGlzLmVycm9yKSB7XG4gICAgICAgICAgY29uc3Qgc3JjID0gZXhwbGljaXQgPyAnZXhwbGljaXQgaW5kZW50YXRpb24gaW5kaWNhdG9yJyA6ICdmaXJzdCBsaW5lJztcbiAgICAgICAgICBjb25zdCBtc2cgPSBcIkJsb2NrIHNjYWxhcnMgbXVzdCBub3QgYmUgbGVzcyBpbmRlbnRlZCB0aGFuIHRoZWlyIFwiLmNvbmNhdChzcmMpO1xuICAgICAgICAgIHRoaXMuZXJyb3IgPSBuZXcgWUFNTFNlbWFudGljRXJyb3IodGhpcywgbXNnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc3JjW2VuZF0gPT09ICdcXG4nKSB7XG4gICAgICAgIG9mZnNldCA9IGVuZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9mZnNldCA9IHZhbHVlRW5kID0gTm9kZS5lbmRPZkxpbmUoc3JjLCBlbmQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmNob21waW5nICE9PSBDaG9tcC5LRUVQKSB7XG4gICAgICBvZmZzZXQgPSBzcmNbdmFsdWVFbmRdID8gdmFsdWVFbmQgKyAxIDogdmFsdWVFbmQ7XG4gICAgfVxuXG4gICAgdGhpcy52YWx1ZVJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0ICsgMSwgb2Zmc2V0KTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG4gIC8qKlxuICAgKiBQYXJzZXMgYSBibG9jayB2YWx1ZSBmcm9tIHRoZSBzb3VyY2VcbiAgICpcbiAgICogQWNjZXB0ZWQgZm9ybXMgYXJlOlxuICAgKiBgYGBcbiAgICogQlNcbiAgICogYmxvY2tcbiAgICogbGluZXNcbiAgICpcbiAgICogQlMgI2NvbW1lbnRcbiAgICogYmxvY2tcbiAgICogbGluZXNcbiAgICogYGBgXG4gICAqIHdoZXJlIHRoZSBibG9jayBzdHlsZSBCUyBtYXRjaGVzIHRoZSByZWdleHAgYFt8Pl1bLSsxLTldKmAgYW5kIGJsb2NrIGxpbmVzXG4gICAqIGFyZSBlbXB0eSBvciBoYXZlIGFuIGluZGVudCBsZXZlbCBncmVhdGVyIHRoYW4gYGluZGVudGAuXG4gICAqXG4gICAqIEBwYXJhbSB7UGFyc2VDb250ZXh0fSBjb250ZXh0XG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydCAtIEluZGV4IG9mIGZpcnN0IGNoYXJhY3RlclxuICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIEluZGV4IG9mIHRoZSBjaGFyYWN0ZXIgYWZ0ZXIgdGhpcyBibG9ja1xuICAgKi9cblxuXG4gIHBhcnNlKGNvbnRleHQsIHN0YXJ0KSB7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICBjb25zdCB7XG4gICAgICBzcmNcbiAgICB9ID0gY29udGV4dDtcbiAgICBsZXQgb2Zmc2V0ID0gdGhpcy5wYXJzZUJsb2NrSGVhZGVyKHN0YXJ0KTtcbiAgICBvZmZzZXQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIG9mZnNldCk7XG4gICAgb2Zmc2V0ID0gdGhpcy5wYXJzZUNvbW1lbnQob2Zmc2V0KTtcbiAgICBvZmZzZXQgPSB0aGlzLnBhcnNlQmxvY2tWYWx1ZShvZmZzZXQpO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBzZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBzdXBlci5zZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpO1xuICAgIHJldHVybiB0aGlzLmhlYWRlciA/IHRoaXMuaGVhZGVyLnNldE9yaWdSYW5nZShjciwgb2Zmc2V0KSA6IG9mZnNldDtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IEJsb2NrVmFsdWUsIENob21wIH07XG4iLCJpbXBvcnQgeyBUeXBlIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFlBTUxTZW1hbnRpY0Vycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IEJsYW5rTGluZSB9IGZyb20gJy4vQmxhbmtMaW5lLmpzJztcbmltcG9ydCB7IENvbW1lbnQgfSBmcm9tICcuL0NvbW1lbnQuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5jbGFzcyBGbG93Q29sbGVjdGlvbiBleHRlbmRzIE5vZGUge1xuICBjb25zdHJ1Y3Rvcih0eXBlLCBwcm9wcykge1xuICAgIHN1cGVyKHR5cGUsIHByb3BzKTtcbiAgICB0aGlzLml0ZW1zID0gbnVsbDtcbiAgfVxuXG4gIHByZXZOb2RlSXNKc29uTGlrZShpZHggPSB0aGlzLml0ZW1zLmxlbmd0aCkge1xuICAgIGNvbnN0IG5vZGUgPSB0aGlzLml0ZW1zW2lkeCAtIDFdO1xuICAgIHJldHVybiAhIW5vZGUgJiYgKG5vZGUuanNvbkxpa2UgfHwgbm9kZS50eXBlID09PSBUeXBlLkNPTU1FTlQgJiYgdGhpcy5wcmV2Tm9kZUlzSnNvbkxpa2UoaWR4IC0gMSkpO1xuICB9XG4gIC8qKlxuICAgKiBAcGFyYW0ge1BhcnNlQ29udGV4dH0gY29udGV4dFxuICAgKiBAcGFyYW0ge251bWJlcn0gc3RhcnQgLSBJbmRleCBvZiBmaXJzdCBjaGFyYWN0ZXJcbiAgICogQHJldHVybnMge251bWJlcn0gLSBJbmRleCBvZiB0aGUgY2hhcmFjdGVyIGFmdGVyIHRoaXNcbiAgICovXG5cblxuICBwYXJzZShjb250ZXh0LCBzdGFydCkge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgY29uc3Qge1xuICAgICAgcGFyc2VOb2RlLFxuICAgICAgc3JjXG4gICAgfSA9IGNvbnRleHQ7XG4gICAgbGV0IHtcbiAgICAgIGluZGVudCxcbiAgICAgIGxpbmVTdGFydFxuICAgIH0gPSBjb250ZXh0O1xuICAgIGxldCBjaGFyID0gc3JjW3N0YXJ0XTsgLy8geyBvciBbXG5cbiAgICB0aGlzLml0ZW1zID0gW3tcbiAgICAgIGNoYXIsXG4gICAgICBvZmZzZXQ6IHN0YXJ0XG4gICAgfV07XG4gICAgbGV0IG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgc3RhcnQgKyAxKTtcbiAgICBjaGFyID0gc3JjW29mZnNldF07XG5cbiAgICB3aGlsZSAoY2hhciAmJiBjaGFyICE9PSAnXScgJiYgY2hhciAhPT0gJ30nKSB7XG4gICAgICBzd2l0Y2ggKGNoYXIpIHtcbiAgICAgICAgY2FzZSAnXFxuJzpcbiAgICAgICAgICB7XG4gICAgICAgICAgICBsaW5lU3RhcnQgPSBvZmZzZXQgKyAxO1xuICAgICAgICAgICAgY29uc3Qgd3NFbmQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIGxpbmVTdGFydCk7XG5cbiAgICAgICAgICAgIGlmIChzcmNbd3NFbmRdID09PSAnXFxuJykge1xuICAgICAgICAgICAgICBjb25zdCBibGFua0xpbmUgPSBuZXcgQmxhbmtMaW5lKCk7XG4gICAgICAgICAgICAgIGxpbmVTdGFydCA9IGJsYW5rTGluZS5wYXJzZSh7XG4gICAgICAgICAgICAgICAgc3JjXG4gICAgICAgICAgICAgIH0sIGxpbmVTdGFydCk7XG4gICAgICAgICAgICAgIHRoaXMuaXRlbXMucHVzaChibGFua0xpbmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvZmZzZXQgPSBOb2RlLmVuZE9mSW5kZW50KHNyYywgbGluZVN0YXJ0KTtcblxuICAgICAgICAgICAgaWYgKG9mZnNldCA8PSBsaW5lU3RhcnQgKyBpbmRlbnQpIHtcbiAgICAgICAgICAgICAgY2hhciA9IHNyY1tvZmZzZXRdO1xuXG4gICAgICAgICAgICAgIGlmIChvZmZzZXQgPCBsaW5lU3RhcnQgKyBpbmRlbnQgfHwgY2hhciAhPT0gJ10nICYmIGNoYXIgIT09ICd9Jykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1zZyA9ICdJbnN1ZmZpY2llbnQgaW5kZW50YXRpb24gaW4gZmxvdyBjb2xsZWN0aW9uJztcbiAgICAgICAgICAgICAgICB0aGlzLmVycm9yID0gbmV3IFlBTUxTZW1hbnRpY0Vycm9yKHRoaXMsIG1zZyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnLCc6XG4gICAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5wdXNoKHtcbiAgICAgICAgICAgICAgY2hhcixcbiAgICAgICAgICAgICAgb2Zmc2V0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG9mZnNldCArPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICcjJzpcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjb25zdCBjb21tZW50ID0gbmV3IENvbW1lbnQoKTtcbiAgICAgICAgICAgIG9mZnNldCA9IGNvbW1lbnQucGFyc2Uoe1xuICAgICAgICAgICAgICBzcmNcbiAgICAgICAgICAgIH0sIG9mZnNldCk7XG4gICAgICAgICAgICB0aGlzLml0ZW1zLnB1c2goY29tbWVudCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJz8nOlxuICAgICAgICBjYXNlICc6JzpcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjb25zdCBuZXh0ID0gc3JjW29mZnNldCArIDFdO1xuXG4gICAgICAgICAgICBpZiAobmV4dCA9PT0gJ1xcbicgfHwgbmV4dCA9PT0gJ1xcdCcgfHwgbmV4dCA9PT0gJyAnIHx8IG5leHQgPT09ICcsJyB8fCAvLyBpbi1mbG93IDogYWZ0ZXIgSlNPTi1saWtlIGtleSBkb2VzIG5vdCBuZWVkIHRvIGJlIGZvbGxvd2VkIGJ5IHdoaXRlc3BhY2VcbiAgICAgICAgICAgIGNoYXIgPT09ICc6JyAmJiB0aGlzLnByZXZOb2RlSXNKc29uTGlrZSgpKSB7XG4gICAgICAgICAgICAgIHRoaXMuaXRlbXMucHVzaCh7XG4gICAgICAgICAgICAgICAgY2hhcixcbiAgICAgICAgICAgICAgICBvZmZzZXRcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIG9mZnNldCArPSAxO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIC8vIGZhbGx0aHJvdWdoXG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gcGFyc2VOb2RlKHtcbiAgICAgICAgICAgICAgYXRMaW5lU3RhcnQ6IGZhbHNlLFxuICAgICAgICAgICAgICBpbkNvbGxlY3Rpb246IGZhbHNlLFxuICAgICAgICAgICAgICBpbkZsb3c6IHRydWUsXG4gICAgICAgICAgICAgIGluZGVudDogLTEsXG4gICAgICAgICAgICAgIGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgcGFyZW50OiB0aGlzXG4gICAgICAgICAgICB9LCBvZmZzZXQpO1xuXG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgLy8gYXQgbmV4dCBkb2N1bWVudCBzdGFydFxuICAgICAgICAgICAgICB0aGlzLnZhbHVlUmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIG9mZnNldCk7XG4gICAgICAgICAgICAgIHJldHVybiBvZmZzZXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuaXRlbXMucHVzaChub2RlKTtcbiAgICAgICAgICAgIG9mZnNldCA9IE5vZGUubm9ybWFsaXplT2Zmc2V0KHNyYywgbm9kZS5yYW5nZS5lbmQpO1xuICAgICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBvZmZzZXQpO1xuICAgICAgY2hhciA9IHNyY1tvZmZzZXRdO1xuICAgIH1cblxuICAgIHRoaXMudmFsdWVSYW5nZSA9IG5ldyBSYW5nZShzdGFydCwgb2Zmc2V0ICsgMSk7XG5cbiAgICBpZiAoY2hhcikge1xuICAgICAgdGhpcy5pdGVtcy5wdXNoKHtcbiAgICAgICAgY2hhcixcbiAgICAgICAgb2Zmc2V0XG4gICAgICB9KTtcbiAgICAgIG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0ICsgMSk7XG4gICAgICBvZmZzZXQgPSB0aGlzLnBhcnNlQ29tbWVudChvZmZzZXQpO1xuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBzZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBzdXBlci5zZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpO1xuICAgIHRoaXMuaXRlbXMuZm9yRWFjaChub2RlID0+IHtcbiAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgTm9kZSkge1xuICAgICAgICBvZmZzZXQgPSBub2RlLnNldE9yaWdSYW5nZXMoY3IsIG9mZnNldCk7XG4gICAgICB9IGVsc2UgaWYgKGNyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBub2RlLm9yaWdPZmZzZXQgPSBub2RlLm9mZnNldDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBpID0gb2Zmc2V0O1xuXG4gICAgICAgIHdoaWxlIChpIDwgY3IubGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKGNyW2ldID4gbm9kZS5vZmZzZXQpIGJyZWFrO2Vsc2UgKytpO1xuICAgICAgICB9XG5cbiAgICAgICAgbm9kZS5vcmlnT2Zmc2V0ID0gbm9kZS5vZmZzZXQgKyBpO1xuICAgICAgICBvZmZzZXQgPSBpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICB0b1N0cmluZygpIHtcbiAgICBjb25zdCB7XG4gICAgICBjb250ZXh0OiB7XG4gICAgICAgIHNyY1xuICAgICAgfSxcbiAgICAgIGl0ZW1zLFxuICAgICAgcmFuZ2UsXG4gICAgICB2YWx1ZVxuICAgIH0gPSB0aGlzO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKSByZXR1cm4gdmFsdWU7XG4gICAgY29uc3Qgbm9kZXMgPSBpdGVtcy5maWx0ZXIoaXRlbSA9PiBpdGVtIGluc3RhbmNlb2YgTm9kZSk7XG4gICAgbGV0IHN0ciA9ICcnO1xuICAgIGxldCBwcmV2RW5kID0gcmFuZ2Uuc3RhcnQ7XG4gICAgbm9kZXMuZm9yRWFjaChub2RlID0+IHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IHNyYy5zbGljZShwcmV2RW5kLCBub2RlLnJhbmdlLnN0YXJ0KTtcbiAgICAgIHByZXZFbmQgPSBub2RlLnJhbmdlLmVuZDtcbiAgICAgIHN0ciArPSBwcmVmaXggKyBTdHJpbmcobm9kZSk7XG5cbiAgICAgIGlmIChzdHJbc3RyLmxlbmd0aCAtIDFdID09PSAnXFxuJyAmJiBzcmNbcHJldkVuZCAtIDFdICE9PSAnXFxuJyAmJiBzcmNbcHJldkVuZF0gPT09ICdcXG4nKSB7XG4gICAgICAgIC8vIENvbW1lbnQgcmFuZ2UgZG9lcyBub3QgaW5jbHVkZSB0aGUgdGVybWluYWwgbmV3bGluZSwgYnV0IGl0c1xuICAgICAgICAvLyBzdHJpbmdpZmllZCB2YWx1ZSBkb2VzLiBXaXRob3V0IHRoaXMgZml4LCBuZXdsaW5lcyBhdCBjb21tZW50IGVuZHNcbiAgICAgICAgLy8gZ2V0IGR1cGxpY2F0ZWQuXG4gICAgICAgIHByZXZFbmQgKz0gMTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBzdHIgKz0gc3JjLnNsaWNlKHByZXZFbmQsIHJhbmdlLmVuZCk7XG4gICAgcmV0dXJuIE5vZGUuYWRkU3RyaW5nVGVybWluYXRvcihzcmMsIHJhbmdlLmVuZCwgc3RyKTtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IEZsb3dDb2xsZWN0aW9uIH07XG4iLCJpbXBvcnQgeyBZQU1MU2VtYW50aWNFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi9SYW5nZS5qcyc7XG5cbmNsYXNzIFBsYWluVmFsdWUgZXh0ZW5kcyBOb2RlIHtcbiAgc3RhdGljIGVuZE9mTGluZShzcmMsIHN0YXJ0LCBpbkZsb3cpIHtcbiAgICBsZXQgY2ggPSBzcmNbc3RhcnRdO1xuICAgIGxldCBvZmZzZXQgPSBzdGFydDtcblxuICAgIHdoaWxlIChjaCAmJiBjaCAhPT0gJ1xcbicpIHtcbiAgICAgIGlmIChpbkZsb3cgJiYgKGNoID09PSAnWycgfHwgY2ggPT09ICddJyB8fCBjaCA9PT0gJ3snIHx8IGNoID09PSAnfScgfHwgY2ggPT09ICcsJykpIGJyZWFrO1xuICAgICAgY29uc3QgbmV4dCA9IHNyY1tvZmZzZXQgKyAxXTtcbiAgICAgIGlmIChjaCA9PT0gJzonICYmICghbmV4dCB8fCBuZXh0ID09PSAnXFxuJyB8fCBuZXh0ID09PSAnXFx0JyB8fCBuZXh0ID09PSAnICcgfHwgaW5GbG93ICYmIG5leHQgPT09ICcsJykpIGJyZWFrO1xuICAgICAgaWYgKChjaCA9PT0gJyAnIHx8IGNoID09PSAnXFx0JykgJiYgbmV4dCA9PT0gJyMnKSBicmVhaztcbiAgICAgIG9mZnNldCArPSAxO1xuICAgICAgY2ggPSBuZXh0O1xuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBnZXQgc3RyVmFsdWUoKSB7XG4gICAgaWYgKCF0aGlzLnZhbHVlUmFuZ2UgfHwgIXRoaXMuY29udGV4dCkgcmV0dXJuIG51bGw7XG4gICAgbGV0IHtcbiAgICAgIHN0YXJ0LFxuICAgICAgZW5kXG4gICAgfSA9IHRoaXMudmFsdWVSYW5nZTtcbiAgICBjb25zdCB7XG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGxldCBjaCA9IHNyY1tlbmQgLSAxXTtcblxuICAgIHdoaWxlIChzdGFydCA8IGVuZCAmJiAoY2ggPT09ICdcXG4nIHx8IGNoID09PSAnXFx0JyB8fCBjaCA9PT0gJyAnKSkgY2ggPSBzcmNbLS1lbmQgLSAxXTtcblxuICAgIGxldCBzdHIgPSAnJztcblxuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgICBjb25zdCBjaCA9IHNyY1tpXTtcblxuICAgICAgaWYgKGNoID09PSAnXFxuJykge1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgZm9sZCxcbiAgICAgICAgICBvZmZzZXRcbiAgICAgICAgfSA9IE5vZGUuZm9sZE5ld2xpbmUoc3JjLCBpLCAtMSk7XG4gICAgICAgIHN0ciArPSBmb2xkO1xuICAgICAgICBpID0gb2Zmc2V0O1xuICAgICAgfSBlbHNlIGlmIChjaCA9PT0gJyAnIHx8IGNoID09PSAnXFx0Jykge1xuICAgICAgICAvLyB0cmltIHRyYWlsaW5nIHdoaXRlc3BhY2VcbiAgICAgICAgY29uc3Qgd3NTdGFydCA9IGk7XG4gICAgICAgIGxldCBuZXh0ID0gc3JjW2kgKyAxXTtcblxuICAgICAgICB3aGlsZSAoaSA8IGVuZCAmJiAobmV4dCA9PT0gJyAnIHx8IG5leHQgPT09ICdcXHQnKSkge1xuICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgICBuZXh0ID0gc3JjW2kgKyAxXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXh0ICE9PSAnXFxuJykgc3RyICs9IGkgPiB3c1N0YXJ0ID8gc3JjLnNsaWNlKHdzU3RhcnQsIGkgKyAxKSA6IGNoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9IGNoO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNoMCA9IHNyY1tzdGFydF07XG5cbiAgICBzd2l0Y2ggKGNoMCkge1xuICAgICAgY2FzZSAnXFx0JzpcbiAgICAgICAge1xuICAgICAgICAgIGNvbnN0IG1zZyA9ICdQbGFpbiB2YWx1ZSBjYW5ub3Qgc3RhcnQgd2l0aCBhIHRhYiBjaGFyYWN0ZXInO1xuICAgICAgICAgIGNvbnN0IGVycm9ycyA9IFtuZXcgWUFNTFNlbWFudGljRXJyb3IodGhpcywgbXNnKV07XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGVycm9ycyxcbiAgICAgICAgICAgIHN0clxuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgY2FzZSAnQCc6XG4gICAgICBjYXNlICdgJzpcbiAgICAgICAge1xuICAgICAgICAgIGNvbnN0IG1zZyA9IFwiUGxhaW4gdmFsdWUgY2Fubm90IHN0YXJ0IHdpdGggcmVzZXJ2ZWQgY2hhcmFjdGVyIFwiLmNvbmNhdChjaDApO1xuICAgICAgICAgIGNvbnN0IGVycm9ycyA9IFtuZXcgWUFNTFNlbWFudGljRXJyb3IodGhpcywgbXNnKV07XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGVycm9ycyxcbiAgICAgICAgICAgIHN0clxuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gIH1cblxuICBwYXJzZUJsb2NrVmFsdWUoc3RhcnQpIHtcbiAgICBjb25zdCB7XG4gICAgICBpbmRlbnQsXG4gICAgICBpbkZsb3csXG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGxldCBvZmZzZXQgPSBzdGFydDtcbiAgICBsZXQgdmFsdWVFbmQgPSBzdGFydDtcblxuICAgIGZvciAobGV0IGNoID0gc3JjW29mZnNldF07IGNoID09PSAnXFxuJzsgY2ggPSBzcmNbb2Zmc2V0XSkge1xuICAgICAgaWYgKE5vZGUuYXREb2N1bWVudEJvdW5kYXJ5KHNyYywgb2Zmc2V0ICsgMSkpIGJyZWFrO1xuICAgICAgY29uc3QgZW5kID0gTm9kZS5lbmRPZkJsb2NrSW5kZW50KHNyYywgaW5kZW50LCBvZmZzZXQgKyAxKTtcbiAgICAgIGlmIChlbmQgPT09IG51bGwgfHwgc3JjW2VuZF0gPT09ICcjJykgYnJlYWs7XG5cbiAgICAgIGlmIChzcmNbZW5kXSA9PT0gJ1xcbicpIHtcbiAgICAgICAgb2Zmc2V0ID0gZW5kO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWVFbmQgPSBQbGFpblZhbHVlLmVuZE9mTGluZShzcmMsIGVuZCwgaW5GbG93KTtcbiAgICAgICAgb2Zmc2V0ID0gdmFsdWVFbmQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMudmFsdWVSYW5nZS5pc0VtcHR5KCkpIHRoaXMudmFsdWVSYW5nZS5zdGFydCA9IHN0YXJ0O1xuICAgIHRoaXMudmFsdWVSYW5nZS5lbmQgPSB2YWx1ZUVuZDtcbiAgICByZXR1cm4gdmFsdWVFbmQ7XG4gIH1cbiAgLyoqXG4gICAqIFBhcnNlcyBhIHBsYWluIHZhbHVlIGZyb20gdGhlIHNvdXJjZVxuICAgKlxuICAgKiBBY2NlcHRlZCBmb3JtcyBhcmU6XG4gICAqIGBgYFxuICAgKiAjY29tbWVudFxuICAgKlxuICAgKiBmaXJzdCBsaW5lXG4gICAqXG4gICAqIGZpcnN0IGxpbmUgI2NvbW1lbnRcbiAgICpcbiAgICogZmlyc3QgbGluZVxuICAgKiBibG9ja1xuICAgKiBsaW5lc1xuICAgKlxuICAgKiAjY29tbWVudFxuICAgKiBibG9ja1xuICAgKiBsaW5lc1xuICAgKiBgYGBcbiAgICogd2hlcmUgYmxvY2sgbGluZXMgYXJlIGVtcHR5IG9yIGhhdmUgYW4gaW5kZW50IGxldmVsIGdyZWF0ZXIgdGhhbiBgaW5kZW50YC5cbiAgICpcbiAgICogQHBhcmFtIHtQYXJzZUNvbnRleHR9IGNvbnRleHRcbiAgICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IC0gSW5kZXggb2YgZmlyc3QgY2hhcmFjdGVyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gSW5kZXggb2YgdGhlIGNoYXJhY3RlciBhZnRlciB0aGlzIHNjYWxhciwgbWF5IGJlIGBcXG5gXG4gICAqL1xuXG5cbiAgcGFyc2UoY29udGV4dCwgc3RhcnQpIHtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIGNvbnN0IHtcbiAgICAgIGluRmxvdyxcbiAgICAgIHNyY1xuICAgIH0gPSBjb250ZXh0O1xuICAgIGxldCBvZmZzZXQgPSBzdGFydDtcbiAgICBjb25zdCBjaCA9IHNyY1tvZmZzZXRdO1xuXG4gICAgaWYgKGNoICYmIGNoICE9PSAnIycgJiYgY2ggIT09ICdcXG4nKSB7XG4gICAgICBvZmZzZXQgPSBQbGFpblZhbHVlLmVuZE9mTGluZShzcmMsIHN0YXJ0LCBpbkZsb3cpO1xuICAgIH1cblxuICAgIHRoaXMudmFsdWVSYW5nZSA9IG5ldyBSYW5nZShzdGFydCwgb2Zmc2V0KTtcbiAgICBvZmZzZXQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIG9mZnNldCk7XG4gICAgb2Zmc2V0ID0gdGhpcy5wYXJzZUNvbW1lbnQob2Zmc2V0KTtcblxuICAgIGlmICghdGhpcy5oYXNDb21tZW50IHx8IHRoaXMudmFsdWVSYW5nZS5pc0VtcHR5KCkpIHtcbiAgICAgIG9mZnNldCA9IHRoaXMucGFyc2VCbG9ja1ZhbHVlKG9mZnNldCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IFBsYWluVmFsdWUgfTtcbiIsImltcG9ydCB7IFlBTUxTeW50YXhFcnJvciwgWUFNTFNlbWFudGljRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5jbGFzcyBRdW90ZURvdWJsZSBleHRlbmRzIE5vZGUge1xuICBzdGF0aWMgZW5kT2ZRdW90ZShzcmMsIG9mZnNldCkge1xuICAgIGxldCBjaCA9IHNyY1tvZmZzZXRdO1xuXG4gICAgd2hpbGUgKGNoICYmIGNoICE9PSAnXCInKSB7XG4gICAgICBvZmZzZXQgKz0gY2ggPT09ICdcXFxcJyA/IDIgOiAxO1xuICAgICAgY2ggPSBzcmNbb2Zmc2V0XTtcbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0ICsgMTtcbiAgfVxuICAvKipcbiAgICogQHJldHVybnMge3N0cmluZyB8IHsgc3RyOiBzdHJpbmcsIGVycm9yczogWUFNTFN5bnRheEVycm9yW10gfX1cbiAgICovXG5cblxuICBnZXQgc3RyVmFsdWUoKSB7XG4gICAgaWYgKCF0aGlzLnZhbHVlUmFuZ2UgfHwgIXRoaXMuY29udGV4dCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgZXJyb3JzID0gW107XG4gICAgY29uc3Qge1xuICAgICAgc3RhcnQsXG4gICAgICBlbmRcbiAgICB9ID0gdGhpcy52YWx1ZVJhbmdlO1xuICAgIGNvbnN0IHtcbiAgICAgIGluZGVudCxcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgaWYgKHNyY1tlbmQgLSAxXSAhPT0gJ1wiJykgZXJyb3JzLnB1c2gobmV3IFlBTUxTeW50YXhFcnJvcih0aGlzLCAnTWlzc2luZyBjbG9zaW5nIFwicXVvdGUnKSk7IC8vIFVzaW5nIFN0cmluZyNyZXBsYWNlIGlzIHRvbyBwYWluZnVsIHdpdGggZXNjYXBlZCBuZXdsaW5lcyBwcmVjZWRlZCBieVxuICAgIC8vIGVzY2FwZWQgYmFja3NsYXNoZXM7IGFsc28sIHRoaXMgc2hvdWxkIGJlIGZhc3Rlci5cblxuICAgIGxldCBzdHIgPSAnJztcblxuICAgIGZvciAobGV0IGkgPSBzdGFydCArIDE7IGkgPCBlbmQgLSAxOyArK2kpIHtcbiAgICAgIGNvbnN0IGNoID0gc3JjW2ldO1xuXG4gICAgICBpZiAoY2ggPT09ICdcXG4nKSB7XG4gICAgICAgIGlmIChOb2RlLmF0RG9jdW1lbnRCb3VuZGFyeShzcmMsIGkgKyAxKSkgZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKHRoaXMsICdEb2N1bWVudCBib3VuZGFyeSBpbmRpY2F0b3JzIGFyZSBub3QgYWxsb3dlZCB3aXRoaW4gc3RyaW5nIHZhbHVlcycpKTtcbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgIGZvbGQsXG4gICAgICAgICAgb2Zmc2V0LFxuICAgICAgICAgIGVycm9yXG4gICAgICAgIH0gPSBOb2RlLmZvbGROZXdsaW5lKHNyYywgaSwgaW5kZW50KTtcbiAgICAgICAgc3RyICs9IGZvbGQ7XG4gICAgICAgIGkgPSBvZmZzZXQ7XG4gICAgICAgIGlmIChlcnJvcikgZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKHRoaXMsICdNdWx0aS1saW5lIGRvdWJsZS1xdW90ZWQgc3RyaW5nIG5lZWRzIHRvIGJlIHN1ZmZpY2llbnRseSBpbmRlbnRlZCcpKTtcbiAgICAgIH0gZWxzZSBpZiAoY2ggPT09ICdcXFxcJykge1xuICAgICAgICBpICs9IDE7XG5cbiAgICAgICAgc3dpdGNoIChzcmNbaV0pIHtcbiAgICAgICAgICBjYXNlICcwJzpcbiAgICAgICAgICAgIHN0ciArPSAnXFwwJztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIG51bGwgY2hhcmFjdGVyXG5cbiAgICAgICAgICBjYXNlICdhJzpcbiAgICAgICAgICAgIHN0ciArPSAnXFx4MDcnO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gYmVsbCBjaGFyYWN0ZXJcblxuICAgICAgICAgIGNhc2UgJ2InOlxuICAgICAgICAgICAgc3RyICs9ICdcXGInO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gYmFja3NwYWNlXG5cbiAgICAgICAgICBjYXNlICdlJzpcbiAgICAgICAgICAgIHN0ciArPSAnXFx4MWInO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gZXNjYXBlIGNoYXJhY3RlclxuXG4gICAgICAgICAgY2FzZSAnZic6XG4gICAgICAgICAgICBzdHIgKz0gJ1xcZic7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBmb3JtIGZlZWRcblxuICAgICAgICAgIGNhc2UgJ24nOlxuICAgICAgICAgICAgc3RyICs9ICdcXG4nO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gbGluZSBmZWVkXG5cbiAgICAgICAgICBjYXNlICdyJzpcbiAgICAgICAgICAgIHN0ciArPSAnXFxyJztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIGNhcnJpYWdlIHJldHVyblxuXG4gICAgICAgICAgY2FzZSAndCc6XG4gICAgICAgICAgICBzdHIgKz0gJ1xcdCc7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBob3Jpem9udGFsIHRhYlxuXG4gICAgICAgICAgY2FzZSAndic6XG4gICAgICAgICAgICBzdHIgKz0gJ1xcdic7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyB2ZXJ0aWNhbCB0YWJcblxuICAgICAgICAgIGNhc2UgJ04nOlxuICAgICAgICAgICAgc3RyICs9ICdcXHUwMDg1JztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIFVuaWNvZGUgbmV4dCBsaW5lXG5cbiAgICAgICAgICBjYXNlICdfJzpcbiAgICAgICAgICAgIHN0ciArPSAnXFx1MDBhMCc7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBVbmljb2RlIG5vbi1icmVha2luZyBzcGFjZVxuXG4gICAgICAgICAgY2FzZSAnTCc6XG4gICAgICAgICAgICBzdHIgKz0gJ1xcdTIwMjgnO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gVW5pY29kZSBsaW5lIHNlcGFyYXRvclxuXG4gICAgICAgICAgY2FzZSAnUCc6XG4gICAgICAgICAgICBzdHIgKz0gJ1xcdTIwMjknO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gVW5pY29kZSBwYXJhZ3JhcGggc2VwYXJhdG9yXG5cbiAgICAgICAgICBjYXNlICcgJzpcbiAgICAgICAgICAgIHN0ciArPSAnICc7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ1wiJzpcbiAgICAgICAgICAgIHN0ciArPSAnXCInO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgICAgIHN0ciArPSAnLyc7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ1xcXFwnOlxuICAgICAgICAgICAgc3RyICs9ICdcXFxcJztcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAnXFx0JzpcbiAgICAgICAgICAgIHN0ciArPSAnXFx0JztcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAneCc6XG4gICAgICAgICAgICBzdHIgKz0gdGhpcy5wYXJzZUNoYXJDb2RlKGkgKyAxLCAyLCBlcnJvcnMpO1xuICAgICAgICAgICAgaSArPSAyO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1JzpcbiAgICAgICAgICAgIHN0ciArPSB0aGlzLnBhcnNlQ2hhckNvZGUoaSArIDEsIDQsIGVycm9ycyk7XG4gICAgICAgICAgICBpICs9IDQ7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ1UnOlxuICAgICAgICAgICAgc3RyICs9IHRoaXMucGFyc2VDaGFyQ29kZShpICsgMSwgOCwgZXJyb3JzKTtcbiAgICAgICAgICAgIGkgKz0gODtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAnXFxuJzpcbiAgICAgICAgICAgIC8vIHNraXAgZXNjYXBlZCBuZXdsaW5lcywgYnV0IHN0aWxsIHRyaW0gdGhlIGZvbGxvd2luZyBsaW5lXG4gICAgICAgICAgICB3aGlsZSAoc3JjW2kgKyAxXSA9PT0gJyAnIHx8IHNyY1tpICsgMV0gPT09ICdcXHQnKSBpICs9IDE7XG5cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKG5ldyBZQU1MU3ludGF4RXJyb3IodGhpcywgXCJJbnZhbGlkIGVzY2FwZSBzZXF1ZW5jZSBcIi5jb25jYXQoc3JjLnN1YnN0cihpIC0gMSwgMikpKSk7XG4gICAgICAgICAgICBzdHIgKz0gJ1xcXFwnICsgc3JjW2ldO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNoID09PSAnICcgfHwgY2ggPT09ICdcXHQnKSB7XG4gICAgICAgIC8vIHRyaW0gdHJhaWxpbmcgd2hpdGVzcGFjZVxuICAgICAgICBjb25zdCB3c1N0YXJ0ID0gaTtcbiAgICAgICAgbGV0IG5leHQgPSBzcmNbaSArIDFdO1xuXG4gICAgICAgIHdoaWxlIChuZXh0ID09PSAnICcgfHwgbmV4dCA9PT0gJ1xcdCcpIHtcbiAgICAgICAgICBpICs9IDE7XG4gICAgICAgICAgbmV4dCA9IHNyY1tpICsgMV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV4dCAhPT0gJ1xcbicpIHN0ciArPSBpID4gd3NTdGFydCA/IHNyYy5zbGljZSh3c1N0YXJ0LCBpICsgMSkgOiBjaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBjaDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZXJyb3JzLmxlbmd0aCA+IDAgPyB7XG4gICAgICBlcnJvcnMsXG4gICAgICBzdHJcbiAgICB9IDogc3RyO1xuICB9XG5cbiAgcGFyc2VDaGFyQ29kZShvZmZzZXQsIGxlbmd0aCwgZXJyb3JzKSB7XG4gICAgY29uc3Qge1xuICAgICAgc3JjXG4gICAgfSA9IHRoaXMuY29udGV4dDtcbiAgICBjb25zdCBjYyA9IHNyYy5zdWJzdHIob2Zmc2V0LCBsZW5ndGgpO1xuICAgIGNvbnN0IG9rID0gY2MubGVuZ3RoID09PSBsZW5ndGggJiYgL15bMC05YS1mQS1GXSskLy50ZXN0KGNjKTtcbiAgICBjb25zdCBjb2RlID0gb2sgPyBwYXJzZUludChjYywgMTYpIDogTmFOO1xuXG4gICAgaWYgKGlzTmFOKGNvZGUpKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgWUFNTFN5bnRheEVycm9yKHRoaXMsIFwiSW52YWxpZCBlc2NhcGUgc2VxdWVuY2UgXCIuY29uY2F0KHNyYy5zdWJzdHIob2Zmc2V0IC0gMiwgbGVuZ3RoICsgMikpKSk7XG4gICAgICByZXR1cm4gc3JjLnN1YnN0cihvZmZzZXQgLSAyLCBsZW5ndGggKyAyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gU3RyaW5nLmZyb21Db2RlUG9pbnQoY29kZSk7XG4gIH1cbiAgLyoqXG4gICAqIFBhcnNlcyBhIFwiZG91YmxlIHF1b3RlZFwiIHZhbHVlIGZyb20gdGhlIHNvdXJjZVxuICAgKlxuICAgKiBAcGFyYW0ge1BhcnNlQ29udGV4dH0gY29udGV4dFxuICAgKiBAcGFyYW0ge251bWJlcn0gc3RhcnQgLSBJbmRleCBvZiBmaXJzdCBjaGFyYWN0ZXJcbiAgICogQHJldHVybnMge251bWJlcn0gLSBJbmRleCBvZiB0aGUgY2hhcmFjdGVyIGFmdGVyIHRoaXMgc2NhbGFyXG4gICAqL1xuXG5cbiAgcGFyc2UoY29udGV4dCwgc3RhcnQpIHtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSBjb250ZXh0O1xuICAgIGxldCBvZmZzZXQgPSBRdW90ZURvdWJsZS5lbmRPZlF1b3RlKHNyYywgc3RhcnQgKyAxKTtcbiAgICB0aGlzLnZhbHVlUmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIG9mZnNldCk7XG4gICAgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IHRoaXMucGFyc2VDb21tZW50KG9mZnNldCk7XG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IFF1b3RlRG91YmxlIH07XG4iLCJpbXBvcnQgeyBZQU1MU3ludGF4RXJyb3IsIFlBTUxTZW1hbnRpY0Vycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IE5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL1JhbmdlLmpzJztcblxuY2xhc3MgUXVvdGVTaW5nbGUgZXh0ZW5kcyBOb2RlIHtcbiAgc3RhdGljIGVuZE9mUXVvdGUoc3JjLCBvZmZzZXQpIHtcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0XTtcblxuICAgIHdoaWxlIChjaCkge1xuICAgICAgaWYgKGNoID09PSBcIidcIikge1xuICAgICAgICBpZiAoc3JjW29mZnNldCArIDFdICE9PSBcIidcIikgYnJlYWs7XG4gICAgICAgIGNoID0gc3JjW29mZnNldCArPSAyXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNoID0gc3JjW29mZnNldCArPSAxXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0ICsgMTtcbiAgfVxuICAvKipcbiAgICogQHJldHVybnMge3N0cmluZyB8IHsgc3RyOiBzdHJpbmcsIGVycm9yczogWUFNTFN5bnRheEVycm9yW10gfX1cbiAgICovXG5cblxuICBnZXQgc3RyVmFsdWUoKSB7XG4gICAgaWYgKCF0aGlzLnZhbHVlUmFuZ2UgfHwgIXRoaXMuY29udGV4dCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgZXJyb3JzID0gW107XG4gICAgY29uc3Qge1xuICAgICAgc3RhcnQsXG4gICAgICBlbmRcbiAgICB9ID0gdGhpcy52YWx1ZVJhbmdlO1xuICAgIGNvbnN0IHtcbiAgICAgIGluZGVudCxcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgaWYgKHNyY1tlbmQgLSAxXSAhPT0gXCInXCIpIGVycm9ycy5wdXNoKG5ldyBZQU1MU3ludGF4RXJyb3IodGhpcywgXCJNaXNzaW5nIGNsb3NpbmcgJ3F1b3RlXCIpKTtcbiAgICBsZXQgc3RyID0gJyc7XG5cbiAgICBmb3IgKGxldCBpID0gc3RhcnQgKyAxOyBpIDwgZW5kIC0gMTsgKytpKSB7XG4gICAgICBjb25zdCBjaCA9IHNyY1tpXTtcblxuICAgICAgaWYgKGNoID09PSAnXFxuJykge1xuICAgICAgICBpZiAoTm9kZS5hdERvY3VtZW50Qm91bmRhcnkoc3JjLCBpICsgMSkpIGVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcih0aGlzLCAnRG9jdW1lbnQgYm91bmRhcnkgaW5kaWNhdG9ycyBhcmUgbm90IGFsbG93ZWQgd2l0aGluIHN0cmluZyB2YWx1ZXMnKSk7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICBmb2xkLFxuICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICBlcnJvclxuICAgICAgICB9ID0gTm9kZS5mb2xkTmV3bGluZShzcmMsIGksIGluZGVudCk7XG4gICAgICAgIHN0ciArPSBmb2xkO1xuICAgICAgICBpID0gb2Zmc2V0O1xuICAgICAgICBpZiAoZXJyb3IpIGVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcih0aGlzLCAnTXVsdGktbGluZSBzaW5nbGUtcXVvdGVkIHN0cmluZyBuZWVkcyB0byBiZSBzdWZmaWNpZW50bHkgaW5kZW50ZWQnKSk7XG4gICAgICB9IGVsc2UgaWYgKGNoID09PSBcIidcIikge1xuICAgICAgICBzdHIgKz0gY2g7XG4gICAgICAgIGkgKz0gMTtcbiAgICAgICAgaWYgKHNyY1tpXSAhPT0gXCInXCIpIGVycm9ycy5wdXNoKG5ldyBZQU1MU3ludGF4RXJyb3IodGhpcywgJ1VuZXNjYXBlZCBzaW5nbGUgcXVvdGU/IFRoaXMgc2hvdWxkIG5vdCBoYXBwZW4uJykpO1xuICAgICAgfSBlbHNlIGlmIChjaCA9PT0gJyAnIHx8IGNoID09PSAnXFx0Jykge1xuICAgICAgICAvLyB0cmltIHRyYWlsaW5nIHdoaXRlc3BhY2VcbiAgICAgICAgY29uc3Qgd3NTdGFydCA9IGk7XG4gICAgICAgIGxldCBuZXh0ID0gc3JjW2kgKyAxXTtcblxuICAgICAgICB3aGlsZSAobmV4dCA9PT0gJyAnIHx8IG5leHQgPT09ICdcXHQnKSB7XG4gICAgICAgICAgaSArPSAxO1xuICAgICAgICAgIG5leHQgPSBzcmNbaSArIDFdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHQgIT09ICdcXG4nKSBzdHIgKz0gaSA+IHdzU3RhcnQgPyBzcmMuc2xpY2Uod3NTdGFydCwgaSArIDEpIDogY2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gY2g7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGVycm9ycy5sZW5ndGggPiAwID8ge1xuICAgICAgZXJyb3JzLFxuICAgICAgc3RyXG4gICAgfSA6IHN0cjtcbiAgfVxuICAvKipcbiAgICogUGFyc2VzIGEgJ3NpbmdsZSBxdW90ZWQnIHZhbHVlIGZyb20gdGhlIHNvdXJjZVxuICAgKlxuICAgKiBAcGFyYW0ge1BhcnNlQ29udGV4dH0gY29udGV4dFxuICAgKiBAcGFyYW0ge251bWJlcn0gc3RhcnQgLSBJbmRleCBvZiBmaXJzdCBjaGFyYWN0ZXJcbiAgICogQHJldHVybnMge251bWJlcn0gLSBJbmRleCBvZiB0aGUgY2hhcmFjdGVyIGFmdGVyIHRoaXMgc2NhbGFyXG4gICAqL1xuXG5cbiAgcGFyc2UoY29udGV4dCwgc3RhcnQpIHtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSBjb250ZXh0O1xuICAgIGxldCBvZmZzZXQgPSBRdW90ZVNpbmdsZS5lbmRPZlF1b3RlKHNyYywgc3RhcnQgKyAxKTtcbiAgICB0aGlzLnZhbHVlUmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIG9mZnNldCk7XG4gICAgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IHRoaXMucGFyc2VDb21tZW50KG9mZnNldCk7XG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IFF1b3RlU2luZ2xlIH07XG4iLCJpbXBvcnQgeyBkZWZpbmVQcm9wZXJ0eSBhcyBfZGVmaW5lUHJvcGVydHkgfSBmcm9tICcuLi9fdmlydHVhbC9fcm9sbHVwUGx1Z2luQmFiZWxIZWxwZXJzLmpzJztcbmltcG9ydCB7IFR5cGUsIENoYXIgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWUFNTFN5bnRheEVycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IEFsaWFzIH0gZnJvbSAnLi9BbGlhcy5qcyc7XG5pbXBvcnQgeyBCbG9ja1ZhbHVlIH0gZnJvbSAnLi9CbG9ja1ZhbHVlLmpzJztcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuL0NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgQ29sbGVjdGlvbkl0ZW0gfSBmcm9tICcuL0NvbGxlY3Rpb25JdGVtLmpzJztcbmltcG9ydCB7IEZsb3dDb2xsZWN0aW9uIH0gZnJvbSAnLi9GbG93Q29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcbmltcG9ydCB7IFBsYWluVmFsdWUgfSBmcm9tICcuL1BsYWluVmFsdWUuanMnO1xuaW1wb3J0IHsgUXVvdGVEb3VibGUgfSBmcm9tICcuL1F1b3RlRG91YmxlLmpzJztcbmltcG9ydCB7IFF1b3RlU2luZ2xlIH0gZnJvbSAnLi9RdW90ZVNpbmdsZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5mdW5jdGlvbiBjcmVhdGVOZXdOb2RlKHR5cGUsIHByb3BzKSB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgVHlwZS5BTElBUzpcbiAgICAgIHJldHVybiBuZXcgQWxpYXModHlwZSwgcHJvcHMpO1xuXG4gICAgY2FzZSBUeXBlLkJMT0NLX0ZPTERFRDpcbiAgICBjYXNlIFR5cGUuQkxPQ0tfTElURVJBTDpcbiAgICAgIHJldHVybiBuZXcgQmxvY2tWYWx1ZSh0eXBlLCBwcm9wcyk7XG5cbiAgICBjYXNlIFR5cGUuRkxPV19NQVA6XG4gICAgY2FzZSBUeXBlLkZMT1dfU0VROlxuICAgICAgcmV0dXJuIG5ldyBGbG93Q29sbGVjdGlvbih0eXBlLCBwcm9wcyk7XG5cbiAgICBjYXNlIFR5cGUuTUFQX0tFWTpcbiAgICBjYXNlIFR5cGUuTUFQX1ZBTFVFOlxuICAgIGNhc2UgVHlwZS5TRVFfSVRFTTpcbiAgICAgIHJldHVybiBuZXcgQ29sbGVjdGlvbkl0ZW0odHlwZSwgcHJvcHMpO1xuXG4gICAgY2FzZSBUeXBlLkNPTU1FTlQ6XG4gICAgY2FzZSBUeXBlLlBMQUlOOlxuICAgICAgcmV0dXJuIG5ldyBQbGFpblZhbHVlKHR5cGUsIHByb3BzKTtcblxuICAgIGNhc2UgVHlwZS5RVU9URV9ET1VCTEU6XG4gICAgICByZXR1cm4gbmV3IFF1b3RlRG91YmxlKHR5cGUsIHByb3BzKTtcblxuICAgIGNhc2UgVHlwZS5RVU9URV9TSU5HTEU6XG4gICAgICByZXR1cm4gbmV3IFF1b3RlU2luZ2xlKHR5cGUsIHByb3BzKTtcblxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgLy8gc2hvdWxkIG5ldmVyIGhhcHBlblxuICB9XG59XG4vKipcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gYXRMaW5lU3RhcnQgLSBOb2RlIHN0YXJ0cyBhdCBiZWdpbm5pbmcgb2YgbGluZVxuICogQHBhcmFtIHtib29sZWFufSBpbkZsb3cgLSB0cnVlIGlmIGN1cnJlbnRseSBpbiBhIGZsb3cgY29udGV4dFxuICogQHBhcmFtIHtib29sZWFufSBpbkNvbGxlY3Rpb24gLSB0cnVlIGlmIGN1cnJlbnRseSBpbiBhIGNvbGxlY3Rpb24gY29udGV4dFxuICogQHBhcmFtIHtudW1iZXJ9IGluZGVudCAtIEN1cnJlbnQgbGV2ZWwgb2YgaW5kZW50YXRpb25cbiAqIEBwYXJhbSB7bnVtYmVyfSBsaW5lU3RhcnQgLSBTdGFydCBvZiB0aGUgY3VycmVudCBsaW5lXG4gKiBAcGFyYW0ge05vZGV9IHBhcmVudCAtIFRoZSBwYXJlbnQgb2YgdGhlIG5vZGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBzcmMgLSBTb3VyY2Ugb2YgdGhlIFlBTUwgZG9jdW1lbnRcbiAqL1xuXG5cbmNsYXNzIFBhcnNlQ29udGV4dCB7XG4gIHN0YXRpYyBwYXJzZVR5cGUoc3JjLCBvZmZzZXQsIGluRmxvdykge1xuICAgIHN3aXRjaCAoc3JjW29mZnNldF0pIHtcbiAgICAgIGNhc2UgJyonOlxuICAgICAgICByZXR1cm4gVHlwZS5BTElBUztcblxuICAgICAgY2FzZSAnPic6XG4gICAgICAgIHJldHVybiBUeXBlLkJMT0NLX0ZPTERFRDtcblxuICAgICAgY2FzZSAnfCc6XG4gICAgICAgIHJldHVybiBUeXBlLkJMT0NLX0xJVEVSQUw7XG5cbiAgICAgIGNhc2UgJ3snOlxuICAgICAgICByZXR1cm4gVHlwZS5GTE9XX01BUDtcblxuICAgICAgY2FzZSAnWyc6XG4gICAgICAgIHJldHVybiBUeXBlLkZMT1dfU0VRO1xuXG4gICAgICBjYXNlICc/JzpcbiAgICAgICAgcmV0dXJuICFpbkZsb3cgJiYgTm9kZS5hdEJsYW5rKHNyYywgb2Zmc2V0ICsgMSwgdHJ1ZSkgPyBUeXBlLk1BUF9LRVkgOiBUeXBlLlBMQUlOO1xuXG4gICAgICBjYXNlICc6JzpcbiAgICAgICAgcmV0dXJuICFpbkZsb3cgJiYgTm9kZS5hdEJsYW5rKHNyYywgb2Zmc2V0ICsgMSwgdHJ1ZSkgPyBUeXBlLk1BUF9WQUxVRSA6IFR5cGUuUExBSU47XG5cbiAgICAgIGNhc2UgJy0nOlxuICAgICAgICByZXR1cm4gIWluRmxvdyAmJiBOb2RlLmF0Qmxhbmsoc3JjLCBvZmZzZXQgKyAxLCB0cnVlKSA/IFR5cGUuU0VRX0lURU0gOiBUeXBlLlBMQUlOO1xuXG4gICAgICBjYXNlICdcIic6XG4gICAgICAgIHJldHVybiBUeXBlLlFVT1RFX0RPVUJMRTtcblxuICAgICAgY2FzZSBcIidcIjpcbiAgICAgICAgcmV0dXJuIFR5cGUuUVVPVEVfU0lOR0xFO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gVHlwZS5QTEFJTjtcbiAgICB9XG4gIH1cblxuICBjb25zdHJ1Y3RvcihvcmlnID0ge30sIHtcbiAgICBhdExpbmVTdGFydCxcbiAgICBpbkNvbGxlY3Rpb24sXG4gICAgaW5GbG93LFxuICAgIGluZGVudCxcbiAgICBsaW5lU3RhcnQsXG4gICAgcGFyZW50XG4gIH0gPSB7fSkge1xuICAgIF9kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInBhcnNlTm9kZVwiLCAob3ZlcmxheSwgc3RhcnQpID0+IHtcbiAgICAgIGlmIChOb2RlLmF0RG9jdW1lbnRCb3VuZGFyeSh0aGlzLnNyYywgc3RhcnQpKSByZXR1cm4gbnVsbDtcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgUGFyc2VDb250ZXh0KHRoaXMsIG92ZXJsYXkpO1xuICAgICAgY29uc3Qge1xuICAgICAgICBwcm9wcyxcbiAgICAgICAgdHlwZSxcbiAgICAgICAgdmFsdWVTdGFydFxuICAgICAgfSA9IGNvbnRleHQucGFyc2VQcm9wcyhzdGFydCk7XG4gICAgICBjb25zdCBub2RlID0gY3JlYXRlTmV3Tm9kZSh0eXBlLCBwcm9wcyk7XG4gICAgICBsZXQgb2Zmc2V0ID0gbm9kZS5wYXJzZShjb250ZXh0LCB2YWx1ZVN0YXJ0KTtcbiAgICAgIG5vZGUucmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIG9mZnNldCk7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cblxuICAgICAgaWYgKG9mZnNldCA8PSBzdGFydCkge1xuICAgICAgICAvLyBUaGlzIHNob3VsZCBuZXZlciBoYXBwZW4sIGJ1dCBpZiBpdCBkb2VzLCBsZXQncyBtYWtlIHN1cmUgdG8gYXQgbGVhc3RcbiAgICAgICAgLy8gc3RlcCBvbmUgY2hhcmFjdGVyIGZvcndhcmQgdG8gYXZvaWQgYSBidXN5IGxvb3AuXG4gICAgICAgIG5vZGUuZXJyb3IgPSBuZXcgRXJyb3IoXCJOb2RlI3BhcnNlIGNvbnN1bWVkIG5vIGNoYXJhY3RlcnNcIik7XG4gICAgICAgIG5vZGUuZXJyb3IucGFyc2VFbmQgPSBvZmZzZXQ7XG4gICAgICAgIG5vZGUuZXJyb3Iuc291cmNlID0gbm9kZTtcbiAgICAgICAgbm9kZS5yYW5nZS5lbmQgPSBzdGFydCArIDE7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb250ZXh0Lm5vZGVTdGFydHNDb2xsZWN0aW9uKG5vZGUpKSB7XG4gICAgICAgIGlmICghbm9kZS5lcnJvciAmJiAhY29udGV4dC5hdExpbmVTdGFydCAmJiBjb250ZXh0LnBhcmVudC50eXBlID09PSBUeXBlLkRPQ1VNRU5UKSB7XG4gICAgICAgICAgbm9kZS5lcnJvciA9IG5ldyBZQU1MU3ludGF4RXJyb3Iobm9kZSwgJ0Jsb2NrIGNvbGxlY3Rpb24gbXVzdCBub3QgaGF2ZSBwcmVjZWRpbmcgY29udGVudCBoZXJlIChlLmcuIGRpcmVjdGl2ZXMtZW5kIGluZGljYXRvciknKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgQ29sbGVjdGlvbihub2RlKTtcbiAgICAgICAgb2Zmc2V0ID0gY29sbGVjdGlvbi5wYXJzZShuZXcgUGFyc2VDb250ZXh0KGNvbnRleHQpLCBvZmZzZXQpO1xuICAgICAgICBjb2xsZWN0aW9uLnJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LCBvZmZzZXQpO1xuICAgICAgICByZXR1cm4gY29sbGVjdGlvbjtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfSk7XG5cbiAgICB0aGlzLmF0TGluZVN0YXJ0ID0gYXRMaW5lU3RhcnQgIT0gbnVsbCA/IGF0TGluZVN0YXJ0IDogb3JpZy5hdExpbmVTdGFydCB8fCBmYWxzZTtcbiAgICB0aGlzLmluQ29sbGVjdGlvbiA9IGluQ29sbGVjdGlvbiAhPSBudWxsID8gaW5Db2xsZWN0aW9uIDogb3JpZy5pbkNvbGxlY3Rpb24gfHwgZmFsc2U7XG4gICAgdGhpcy5pbkZsb3cgPSBpbkZsb3cgIT0gbnVsbCA/IGluRmxvdyA6IG9yaWcuaW5GbG93IHx8IGZhbHNlO1xuICAgIHRoaXMuaW5kZW50ID0gaW5kZW50ICE9IG51bGwgPyBpbmRlbnQgOiBvcmlnLmluZGVudDtcbiAgICB0aGlzLmxpbmVTdGFydCA9IGxpbmVTdGFydCAhPSBudWxsID8gbGluZVN0YXJ0IDogb3JpZy5saW5lU3RhcnQ7XG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQgIT0gbnVsbCA/IHBhcmVudCA6IG9yaWcucGFyZW50IHx8IHt9O1xuICAgIHRoaXMucm9vdCA9IG9yaWcucm9vdDtcbiAgICB0aGlzLnNyYyA9IG9yaWcuc3JjO1xuICB9XG5cbiAgbm9kZVN0YXJ0c0NvbGxlY3Rpb24obm9kZSkge1xuICAgIGNvbnN0IHtcbiAgICAgIGluQ29sbGVjdGlvbixcbiAgICAgIGluRmxvdyxcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzO1xuICAgIGlmIChpbkNvbGxlY3Rpb24gfHwgaW5GbG93KSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBDb2xsZWN0aW9uSXRlbSkgcmV0dXJuIHRydWU7IC8vIGNoZWNrIGZvciBpbXBsaWNpdCBrZXlcblxuICAgIGxldCBvZmZzZXQgPSBub2RlLnJhbmdlLmVuZDtcbiAgICBpZiAoc3JjW29mZnNldF0gPT09ICdcXG4nIHx8IHNyY1tvZmZzZXQgLSAxXSA9PT0gJ1xcbicpIHJldHVybiBmYWxzZTtcbiAgICBvZmZzZXQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIG9mZnNldCk7XG4gICAgcmV0dXJuIHNyY1tvZmZzZXRdID09PSAnOic7XG4gIH0gLy8gQW5jaG9yIGFuZCB0YWcgYXJlIGJlZm9yZSB0eXBlLCB3aGljaCBkZXRlcm1pbmVzIHRoZSBub2RlIGltcGxlbWVudGF0aW9uXG4gIC8vIGNsYXNzOyBoZW5jZSB0aGlzIGludGVybWVkaWF0ZSBzdGVwLlxuXG5cbiAgcGFyc2VQcm9wcyhvZmZzZXQpIHtcbiAgICBjb25zdCB7XG4gICAgICBpbkZsb3csXG4gICAgICBwYXJlbnQsXG4gICAgICBzcmNcbiAgICB9ID0gdGhpcztcbiAgICBjb25zdCBwcm9wcyA9IFtdO1xuICAgIGxldCBsaW5lSGFzUHJvcHMgPSBmYWxzZTtcbiAgICBvZmZzZXQgPSB0aGlzLmF0TGluZVN0YXJ0ID8gTm9kZS5lbmRPZkluZGVudChzcmMsIG9mZnNldCkgOiBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIG9mZnNldCk7XG4gICAgbGV0IGNoID0gc3JjW29mZnNldF07XG5cbiAgICB3aGlsZSAoY2ggPT09IENoYXIuQU5DSE9SIHx8IGNoID09PSBDaGFyLkNPTU1FTlQgfHwgY2ggPT09IENoYXIuVEFHIHx8IGNoID09PSAnXFxuJykge1xuICAgICAgaWYgKGNoID09PSAnXFxuJykge1xuICAgICAgICBjb25zdCBsaW5lU3RhcnQgPSBvZmZzZXQgKyAxO1xuICAgICAgICBjb25zdCBpbkVuZCA9IE5vZGUuZW5kT2ZJbmRlbnQoc3JjLCBsaW5lU3RhcnQpO1xuICAgICAgICBjb25zdCBpbmRlbnREaWZmID0gaW5FbmQgLSAobGluZVN0YXJ0ICsgdGhpcy5pbmRlbnQpO1xuICAgICAgICBjb25zdCBub0luZGljYXRvckFzSW5kZW50ID0gcGFyZW50LnR5cGUgPT09IFR5cGUuU0VRX0lURU0gJiYgcGFyZW50LmNvbnRleHQuYXRMaW5lU3RhcnQ7XG4gICAgICAgIGlmICghTm9kZS5uZXh0Tm9kZUlzSW5kZW50ZWQoc3JjW2luRW5kXSwgaW5kZW50RGlmZiwgIW5vSW5kaWNhdG9yQXNJbmRlbnQpKSBicmVhaztcbiAgICAgICAgdGhpcy5hdExpbmVTdGFydCA9IHRydWU7XG4gICAgICAgIHRoaXMubGluZVN0YXJ0ID0gbGluZVN0YXJ0O1xuICAgICAgICBsaW5lSGFzUHJvcHMgPSBmYWxzZTtcbiAgICAgICAgb2Zmc2V0ID0gaW5FbmQ7XG4gICAgICB9IGVsc2UgaWYgKGNoID09PSBDaGFyLkNPTU1FTlQpIHtcbiAgICAgICAgY29uc3QgZW5kID0gTm9kZS5lbmRPZkxpbmUoc3JjLCBvZmZzZXQgKyAxKTtcbiAgICAgICAgcHJvcHMucHVzaChuZXcgUmFuZ2Uob2Zmc2V0LCBlbmQpKTtcbiAgICAgICAgb2Zmc2V0ID0gZW5kO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IGVuZCA9IE5vZGUuZW5kT2ZJZGVudGlmaWVyKHNyYywgb2Zmc2V0ICsgMSk7XG5cbiAgICAgICAgaWYgKGNoID09PSBDaGFyLlRBRyAmJiBzcmNbZW5kXSA9PT0gJywnICYmIC9eW2EtekEtWjAtOS1dK1xcLlthLXpBLVowLTktXSssXFxkXFxkXFxkXFxkKC1cXGRcXGQpezAsMn1cXC9cXFMvLnRlc3Qoc3JjLnNsaWNlKG9mZnNldCArIDEsIGVuZCArIDEzKSkpIHtcbiAgICAgICAgICAvLyBMZXQncyBwcmVzdW1lIHdlJ3JlIGRlYWxpbmcgd2l0aCBhIFlBTUwgMS4wIGRvbWFpbiB0YWcgaGVyZSwgcmF0aGVyXG4gICAgICAgICAgLy8gdGhhbiBhbiBlbXB0eSBidXQgJ2Zvby5iYXInIHByaXZhdGUtdGFnZ2VkIG5vZGUgaW4gYSBmbG93IGNvbGxlY3Rpb25cbiAgICAgICAgICAvLyBmb2xsb3dlZCB3aXRob3V0IHdoaXRlc3BhY2UgYnkgYSBwbGFpbiBzdHJpbmcgc3RhcnRpbmcgd2l0aCBhIHllYXJcbiAgICAgICAgICAvLyBvciBkYXRlIGRpdmlkZWQgYnkgc29tZXRoaW5nLlxuICAgICAgICAgIGVuZCA9IE5vZGUuZW5kT2ZJZGVudGlmaWVyKHNyYywgZW5kICsgNSk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9wcy5wdXNoKG5ldyBSYW5nZShvZmZzZXQsIGVuZCkpO1xuICAgICAgICBsaW5lSGFzUHJvcHMgPSB0cnVlO1xuICAgICAgICBvZmZzZXQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIGVuZCk7XG4gICAgICB9XG5cbiAgICAgIGNoID0gc3JjW29mZnNldF07XG4gICAgfSAvLyAnLSAmYSA6IGInIGhhcyBhbiBhbmNob3Igb24gYW4gZW1wdHkgbm9kZVxuXG5cbiAgICBpZiAobGluZUhhc1Byb3BzICYmIGNoID09PSAnOicgJiYgTm9kZS5hdEJsYW5rKHNyYywgb2Zmc2V0ICsgMSwgdHJ1ZSkpIG9mZnNldCAtPSAxO1xuICAgIGNvbnN0IHR5cGUgPSBQYXJzZUNvbnRleHQucGFyc2VUeXBlKHNyYywgb2Zmc2V0LCBpbkZsb3cpO1xuICAgIHJldHVybiB7XG4gICAgICBwcm9wcyxcbiAgICAgIHR5cGUsXG4gICAgICB2YWx1ZVN0YXJ0OiBvZmZzZXRcbiAgICB9O1xuICB9XG4gIC8qKlxuICAgKiBQYXJzZXMgYSBub2RlIGZyb20gdGhlIHNvdXJjZVxuICAgKiBAcGFyYW0ge1BhcnNlQ29udGV4dH0gb3ZlcmxheVxuICAgKiBAcGFyYW0ge251bWJlcn0gc3RhcnQgLSBJbmRleCBvZiBmaXJzdCBub24td2hpdGVzcGFjZSBjaGFyYWN0ZXIgZm9yIHRoZSBub2RlXG4gICAqIEByZXR1cm5zIHs/Tm9kZX0gLSBudWxsIGlmIGF0IGEgZG9jdW1lbnQgYm91bmRhcnlcbiAgICovXG5cblxufVxuXG5leHBvcnQgeyBQYXJzZUNvbnRleHQgfTtcbiIsImltcG9ydCB7IERvY3VtZW50IH0gZnJvbSAnLi9Eb2N1bWVudC5qcyc7XG5pbXBvcnQgeyBQYXJzZUNvbnRleHQgfSBmcm9tICcuL1BhcnNlQ29udGV4dC5qcyc7XG5cbmZ1bmN0aW9uIHBhcnNlKHNyYykge1xuICBjb25zdCBjciA9IFtdO1xuXG4gIGlmIChzcmMuaW5kZXhPZignXFxyJykgIT09IC0xKSB7XG4gICAgc3JjID0gc3JjLnJlcGxhY2UoL1xcclxcbj8vZywgKG1hdGNoLCBvZmZzZXQpID0+IHtcbiAgICAgIGlmIChtYXRjaC5sZW5ndGggPiAxKSBjci5wdXNoKG9mZnNldCk7XG4gICAgICByZXR1cm4gJ1xcbic7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBkb2N1bWVudHMgPSBbXTtcbiAgbGV0IG9mZnNldCA9IDA7XG5cbiAgZG8ge1xuICAgIGNvbnN0IGRvYyA9IG5ldyBEb2N1bWVudCgpO1xuICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgUGFyc2VDb250ZXh0KHtcbiAgICAgIHNyY1xuICAgIH0pO1xuICAgIG9mZnNldCA9IGRvYy5wYXJzZShjb250ZXh0LCBvZmZzZXQpO1xuICAgIGRvY3VtZW50cy5wdXNoKGRvYyk7XG4gIH0gd2hpbGUgKG9mZnNldCA8IHNyYy5sZW5ndGgpO1xuXG4gIGRvY3VtZW50cy5zZXRPcmlnUmFuZ2VzID0gKCkgPT4ge1xuICAgIGlmIChjci5sZW5ndGggPT09IDApIHJldHVybiBmYWxzZTtcblxuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgY3IubGVuZ3RoOyArK2kpIGNyW2ldIC09IGk7XG5cbiAgICBsZXQgY3JPZmZzZXQgPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2N1bWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNyT2Zmc2V0ID0gZG9jdW1lbnRzW2ldLnNldE9yaWdSYW5nZXMoY3IsIGNyT2Zmc2V0KTtcbiAgICB9XG5cbiAgICBjci5zcGxpY2UoMCwgY3IubGVuZ3RoKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICBkb2N1bWVudHMudG9TdHJpbmcgPSAoKSA9PiBkb2N1bWVudHMuam9pbignLi4uXFxuJyk7XG5cbiAgcmV0dXJuIGRvY3VtZW50cztcbn1cblxuZXhwb3J0IHsgcGFyc2UgfTtcbiIsImltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5jb25zdCBiaW5hcnlPcHRpb25zID0ge1xuICBkZWZhdWx0VHlwZTogVHlwZS5CTE9DS19MSVRFUkFMLFxuICBsaW5lV2lkdGg6IDc2XG59O1xuY29uc3QgYm9vbE9wdGlvbnMgPSB7XG4gIHRydWVTdHI6ICd0cnVlJyxcbiAgZmFsc2VTdHI6ICdmYWxzZSdcbn07XG5jb25zdCBpbnRPcHRpb25zID0ge1xuICBhc0JpZ0ludDogZmFsc2Vcbn07XG5jb25zdCBudWxsT3B0aW9ucyA9IHtcbiAgbnVsbFN0cjogJ251bGwnXG59O1xuY29uc3Qgc3RyT3B0aW9ucyA9IHtcbiAgZGVmYXVsdFR5cGU6IFR5cGUuUExBSU4sXG4gIGRlZmF1bHRLZXlUeXBlOiBUeXBlLlBMQUlOLFxuICBkZWZhdWx0UXVvdGVTaW5nbGU6IGZhbHNlLFxuICBkb3VibGVRdW90ZWQ6IHtcbiAgICBqc29uRW5jb2Rpbmc6IGZhbHNlLFxuICAgIG1pbk11bHRpTGluZUxlbmd0aDogNDBcbiAgfSxcbiAgZm9sZDoge1xuICAgIGxpbmVXaWR0aDogODAsXG4gICAgbWluQ29udGVudFdpZHRoOiAyMFxuICB9XG59O1xuXG5leHBvcnQgeyBiaW5hcnlPcHRpb25zLCBib29sT3B0aW9ucywgaW50T3B0aW9ucywgbnVsbE9wdGlvbnMsIHN0ck9wdGlvbnMgfTtcbiIsImltcG9ydCB7IGRlZmF1bHRUYWdQcmVmaXggfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBiaW5hcnlPcHRpb25zLCBib29sT3B0aW9ucywgaW50T3B0aW9ucywgbnVsbE9wdGlvbnMsIHN0ck9wdGlvbnMgfSBmcm9tICcuL3RhZ3Mvb3B0aW9ucy5qcyc7XG5cbmNvbnN0IGRlZmF1bHRPcHRpb25zID0ge1xuICBhbmNob3JQcmVmaXg6ICdhJyxcbiAgY3VzdG9tVGFnczogbnVsbCxcbiAgaW5kZW50OiAyLFxuICBpbmRlbnRTZXE6IHRydWUsXG4gIGtlZXBDc3ROb2RlczogZmFsc2UsXG4gIGtlZXBOb2RlVHlwZXM6IHRydWUsXG4gIGtlZXBVbmRlZmluZWQ6IGZhbHNlLFxuICBsb2dMZXZlbDogJ3dhcm4nLFxuICBtYXBBc01hcDogZmFsc2UsXG4gIG1heEFsaWFzQ291bnQ6IDEwMCxcbiAgcHJldHR5RXJyb3JzOiB0cnVlLFxuICBzaW1wbGVLZXlzOiBmYWxzZSxcbiAgdmVyc2lvbjogJzEuMidcbn07XG5jb25zdCBzY2FsYXJPcHRpb25zID0ge1xuICBnZXQgYmluYXJ5KCkge1xuICAgIHJldHVybiBiaW5hcnlPcHRpb25zO1xuICB9LFxuXG4gIHNldCBiaW5hcnkob3B0KSB7XG4gICAgT2JqZWN0LmFzc2lnbihiaW5hcnlPcHRpb25zLCBvcHQpO1xuICB9LFxuXG4gIGdldCBib29sKCkge1xuICAgIHJldHVybiBib29sT3B0aW9ucztcbiAgfSxcblxuICBzZXQgYm9vbChvcHQpIHtcbiAgICBPYmplY3QuYXNzaWduKGJvb2xPcHRpb25zLCBvcHQpO1xuICB9LFxuXG4gIGdldCBpbnQoKSB7XG4gICAgcmV0dXJuIGludE9wdGlvbnM7XG4gIH0sXG5cbiAgc2V0IGludChvcHQpIHtcbiAgICBPYmplY3QuYXNzaWduKGludE9wdGlvbnMsIG9wdCk7XG4gIH0sXG5cbiAgZ2V0IG51bGwoKSB7XG4gICAgcmV0dXJuIG51bGxPcHRpb25zO1xuICB9LFxuXG4gIHNldCBudWxsKG9wdCkge1xuICAgIE9iamVjdC5hc3NpZ24obnVsbE9wdGlvbnMsIG9wdCk7XG4gIH0sXG5cbiAgZ2V0IHN0cigpIHtcbiAgICByZXR1cm4gc3RyT3B0aW9ucztcbiAgfSxcblxuICBzZXQgc3RyKG9wdCkge1xuICAgIE9iamVjdC5hc3NpZ24oc3RyT3B0aW9ucywgb3B0KTtcbiAgfVxuXG59O1xuY29uc3QgZG9jdW1lbnRPcHRpb25zID0ge1xuICAnMS4wJzoge1xuICAgIHNjaGVtYTogJ3lhbWwtMS4xJyxcbiAgICBtZXJnZTogdHJ1ZSxcbiAgICB0YWdQcmVmaXhlczogW3tcbiAgICAgIGhhbmRsZTogJyEnLFxuICAgICAgcHJlZml4OiBkZWZhdWx0VGFnUHJlZml4XG4gICAgfSwge1xuICAgICAgaGFuZGxlOiAnISEnLFxuICAgICAgcHJlZml4OiAndGFnOnByaXZhdGUueWFtbC5vcmcsMjAwMjonXG4gICAgfV1cbiAgfSxcbiAgMS4xOiB7XG4gICAgc2NoZW1hOiAneWFtbC0xLjEnLFxuICAgIG1lcmdlOiB0cnVlLFxuICAgIHRhZ1ByZWZpeGVzOiBbe1xuICAgICAgaGFuZGxlOiAnIScsXG4gICAgICBwcmVmaXg6ICchJ1xuICAgIH0sIHtcbiAgICAgIGhhbmRsZTogJyEhJyxcbiAgICAgIHByZWZpeDogZGVmYXVsdFRhZ1ByZWZpeFxuICAgIH1dXG4gIH0sXG4gIDEuMjoge1xuICAgIHNjaGVtYTogJ2NvcmUnLFxuICAgIG1lcmdlOiBmYWxzZSxcbiAgICByZXNvbHZlS25vd25UYWdzOiB0cnVlLFxuICAgIHRhZ1ByZWZpeGVzOiBbe1xuICAgICAgaGFuZGxlOiAnIScsXG4gICAgICBwcmVmaXg6ICchJ1xuICAgIH0sIHtcbiAgICAgIGhhbmRsZTogJyEhJyxcbiAgICAgIHByZWZpeDogZGVmYXVsdFRhZ1ByZWZpeFxuICAgIH1dXG4gIH1cbn07XG5cbmV4cG9ydCB7IGRlZmF1bHRPcHRpb25zLCBkb2N1bWVudE9wdGlvbnMsIHNjYWxhck9wdGlvbnMgfTtcbiIsImZ1bmN0aW9uIGFkZENvbW1lbnRCZWZvcmUoc3RyLCBpbmRlbnQsIGNvbW1lbnQpIHtcbiAgaWYgKCFjb21tZW50KSByZXR1cm4gc3RyO1xuICBjb25zdCBjYyA9IGNvbW1lbnQucmVwbGFjZSgvW1xcc1xcU11eL2dtLCBcIiQmXCIuY29uY2F0KGluZGVudCwgXCIjXCIpKTtcbiAgcmV0dXJuIFwiI1wiLmNvbmNhdChjYywgXCJcXG5cIikuY29uY2F0KGluZGVudCkuY29uY2F0KHN0cik7XG59XG5mdW5jdGlvbiBhZGRDb21tZW50KHN0ciwgaW5kZW50LCBjb21tZW50KSB7XG4gIHJldHVybiAhY29tbWVudCA/IHN0ciA6IGNvbW1lbnQuaW5kZXhPZignXFxuJykgPT09IC0xID8gXCJcIi5jb25jYXQoc3RyLCBcIiAjXCIpLmNvbmNhdChjb21tZW50KSA6IFwiXCIuY29uY2F0KHN0ciwgXCJcXG5cIikgKyBjb21tZW50LnJlcGxhY2UoL14vZ20sIFwiXCIuY29uY2F0KGluZGVudCB8fCAnJywgXCIjXCIpKTtcbn1cblxuZXhwb3J0IHsgYWRkQ29tbWVudCwgYWRkQ29tbWVudEJlZm9yZSB9O1xuIiwiY2xhc3MgTm9kZSB7fVxuXG5leHBvcnQgeyBOb2RlIH07XG4iLCIvKipcbiAqIFJlY3Vyc2l2ZWx5IGNvbnZlcnQgYW55IG5vZGUgb3IgaXRzIGNvbnRlbnRzIHRvIG5hdGl2ZSBKYXZhU2NyaXB0XG4gKlxuICogQHBhcmFtIHZhbHVlIC0gVGhlIGlucHV0IHZhbHVlXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBhcmcgLSBJZiBgdmFsdWVgIGRlZmluZXMgYSBgdG9KU09OKClgIG1ldGhvZCwgdXNlIHRoaXNcbiAqICAgYXMgaXRzIGZpcnN0IGFyZ3VtZW50XG4gKiBAcGFyYW0gY3R4IC0gQ29udmVyc2lvbiBjb250ZXh0LCBvcmlnaW5hbGx5IHNldCBpbiBEb2N1bWVudCN0b0pTKCkuIElmXG4gKiAgIGB7IGtlZXA6IHRydWUgfWAgaXMgbm90IHNldCwgb3V0cHV0IHNob3VsZCBiZSBzdWl0YWJsZSBmb3IgSlNPTlxuICogICBzdHJpbmdpZmljYXRpb24uXG4gKi9cbmZ1bmN0aW9uIHRvSlModmFsdWUsIGFyZywgY3R4KSB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlLm1hcCgodiwgaSkgPT4gdG9KUyh2LCBTdHJpbmcoaSksIGN0eCkpO1xuXG4gIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUudG9KU09OID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY29uc3QgYW5jaG9yID0gY3R4ICYmIGN0eC5hbmNob3JzICYmIGN0eC5hbmNob3JzLmdldCh2YWx1ZSk7XG4gICAgaWYgKGFuY2hvcikgY3R4Lm9uQ3JlYXRlID0gcmVzID0+IHtcbiAgICAgIGFuY2hvci5yZXMgPSByZXM7XG4gICAgICBkZWxldGUgY3R4Lm9uQ3JlYXRlO1xuICAgIH07XG4gICAgY29uc3QgcmVzID0gdmFsdWUudG9KU09OKGFyZywgY3R4KTtcbiAgICBpZiAoYW5jaG9yICYmIGN0eC5vbkNyZWF0ZSkgY3R4Lm9uQ3JlYXRlKHJlcyk7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIGlmICghKGN0eCAmJiBjdHgua2VlcCkgJiYgdHlwZW9mIHZhbHVlID09PSAnYmlnaW50JykgcmV0dXJuIE51bWJlcih2YWx1ZSk7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuZXhwb3J0IHsgdG9KUyB9O1xuIiwiaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyB0b0pTIH0gZnJvbSAnLi90b0pTLmpzJztcblxuY29uc3QgaXNTY2FsYXJWYWx1ZSA9IHZhbHVlID0+ICF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JztcbmNsYXNzIFNjYWxhciBleHRlbmRzIE5vZGUge1xuICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG5cbiAgdG9KU09OKGFyZywgY3R4KSB7XG4gICAgcmV0dXJuIGN0eCAmJiBjdHgua2VlcCA/IHRoaXMudmFsdWUgOiB0b0pTKHRoaXMudmFsdWUsIGFyZywgY3R4KTtcbiAgfVxuXG4gIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiBTdHJpbmcodGhpcy52YWx1ZSk7XG4gIH1cblxufVxuXG5leHBvcnQgeyBTY2FsYXIsIGlzU2NhbGFyVmFsdWUgfTtcbiIsImltcG9ydCB7IE5vZGUgfSBmcm9tICcuLi9hc3QvTm9kZS5qcyc7XG5pbXBvcnQgeyBTY2FsYXIgfSBmcm9tICcuLi9hc3QvU2NhbGFyLmpzJztcbmltcG9ydCB7IGRlZmF1bHRUYWdQcmVmaXggfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5mdW5jdGlvbiBmaW5kVGFnT2JqZWN0KHZhbHVlLCB0YWdOYW1lLCB0YWdzKSB7XG4gIGlmICh0YWdOYW1lKSB7XG4gICAgY29uc3QgbWF0Y2ggPSB0YWdzLmZpbHRlcih0ID0+IHQudGFnID09PSB0YWdOYW1lKTtcbiAgICBjb25zdCB0YWdPYmogPSBtYXRjaC5maW5kKHQgPT4gIXQuZm9ybWF0KSB8fCBtYXRjaFswXTtcbiAgICBpZiAoIXRhZ09iaikgdGhyb3cgbmV3IEVycm9yKFwiVGFnIFwiLmNvbmNhdCh0YWdOYW1lLCBcIiBub3QgZm91bmRcIikpO1xuICAgIHJldHVybiB0YWdPYmo7XG4gIH1cblxuICByZXR1cm4gdGFncy5maW5kKHQgPT4gdC5pZGVudGlmeSAmJiB0LmlkZW50aWZ5KHZhbHVlKSAmJiAhdC5mb3JtYXQpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVOb2RlKHZhbHVlLCB0YWdOYW1lLCBjdHgpIHtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgTm9kZSkgcmV0dXJuIHZhbHVlO1xuICBjb25zdCB7XG4gICAgb25BbGlhcyxcbiAgICBvblRhZ09iaixcbiAgICBwcmV2T2JqZWN0cyxcbiAgICB3cmFwU2NhbGFyc1xuICB9ID0gY3R4O1xuICBjb25zdCB7XG4gICAgbWFwLFxuICAgIHNlcSxcbiAgICB0YWdzXG4gIH0gPSBjdHguc2NoZW1hO1xuICBpZiAodGFnTmFtZSAmJiB0YWdOYW1lLnN0YXJ0c1dpdGgoJyEhJykpIHRhZ05hbWUgPSBkZWZhdWx0VGFnUHJlZml4ICsgdGFnTmFtZS5zbGljZSgyKTtcbiAgbGV0IHRhZ09iaiA9IGZpbmRUYWdPYmplY3QodmFsdWUsIHRhZ05hbWUsIHRhZ3MpO1xuXG4gIGlmICghdGFnT2JqKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZS50b0pTT04gPT09ICdmdW5jdGlvbicpIHZhbHVlID0gdmFsdWUudG9KU09OKCk7XG4gICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSByZXR1cm4gd3JhcFNjYWxhcnMgPyBuZXcgU2NhbGFyKHZhbHVlKSA6IHZhbHVlO1xuICAgIHRhZ09iaiA9IHZhbHVlIGluc3RhbmNlb2YgTWFwID8gbWFwIDogdmFsdWVbU3ltYm9sLml0ZXJhdG9yXSA/IHNlcSA6IG1hcDtcbiAgfVxuXG4gIGlmIChvblRhZ09iaikge1xuICAgIG9uVGFnT2JqKHRhZ09iaik7XG4gICAgZGVsZXRlIGN0eC5vblRhZ09iajtcbiAgfSAvLyBEZXRlY3QgZHVwbGljYXRlIHJlZmVyZW5jZXMgdG8gdGhlIHNhbWUgb2JqZWN0ICYgdXNlIEFsaWFzIG5vZGVzIGZvciBhbGxcbiAgLy8gYWZ0ZXIgZmlyc3QuIFRoZSBgb2JqYCB3cmFwcGVyIGFsbG93cyBmb3IgY2lyY3VsYXIgcmVmZXJlbmNlcyB0byByZXNvbHZlLlxuXG5cbiAgY29uc3Qgb2JqID0ge1xuICAgIHZhbHVlOiB1bmRlZmluZWQsXG4gICAgbm9kZTogdW5kZWZpbmVkXG4gIH07XG5cbiAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICBjb25zdCBwcmV2ID0gcHJldk9iamVjdHMuZ2V0KHZhbHVlKTtcbiAgICBpZiAocHJldikgcmV0dXJuIG9uQWxpYXMocHJldik7XG4gICAgb2JqLnZhbHVlID0gdmFsdWU7XG4gICAgcHJldk9iamVjdHMuc2V0KHZhbHVlLCBvYmopO1xuICB9XG5cbiAgb2JqLm5vZGUgPSB0YWdPYmouY3JlYXRlTm9kZSA/IHRhZ09iai5jcmVhdGVOb2RlKGN0eC5zY2hlbWEsIHZhbHVlLCBjdHgpIDogd3JhcFNjYWxhcnMgPyBuZXcgU2NhbGFyKHZhbHVlKSA6IHZhbHVlO1xuICBpZiAodGFnTmFtZSAmJiBvYmoubm9kZSBpbnN0YW5jZW9mIE5vZGUpIG9iai5ub2RlLnRhZyA9IHRhZ05hbWU7XG4gIHJldHVybiBvYmoubm9kZTtcbn1cblxuZXhwb3J0IHsgY3JlYXRlTm9kZSB9O1xuIiwiaW1wb3J0IHsgZGVmaW5lUHJvcGVydHkgYXMgX2RlZmluZVByb3BlcnR5IH0gZnJvbSAnLi4vX3ZpcnR1YWwvX3JvbGx1cFBsdWdpbkJhYmVsSGVscGVycy5qcyc7XG5pbXBvcnQgeyBhZGRDb21tZW50IH0gZnJvbSAnLi4vc3RyaW5naWZ5L2FkZENvbW1lbnQuanMnO1xuaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVOb2RlIH0gZnJvbSAnLi4vZG9jL2NyZWF0ZU5vZGUuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBTY2FsYXIgfSBmcm9tICcuL1NjYWxhci5qcyc7XG5cbmZ1bmN0aW9uIGNvbGxlY3Rpb25Gcm9tUGF0aChzY2hlbWEsIHBhdGgsIHZhbHVlKSB7XG4gIGxldCB2ID0gdmFsdWU7XG5cbiAgZm9yIChsZXQgaSA9IHBhdGgubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICBjb25zdCBrID0gcGF0aFtpXTtcblxuICAgIGlmIChOdW1iZXIuaXNJbnRlZ2VyKGspICYmIGsgPj0gMCkge1xuICAgICAgY29uc3QgYSA9IFtdO1xuICAgICAgYVtrXSA9IHY7XG4gICAgICB2ID0gYTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbyA9IHt9O1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIGssIHtcbiAgICAgICAgdmFsdWU6IHYsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgICAgdiA9IG87XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNyZWF0ZU5vZGUodiwgbnVsbCwge1xuICAgIG9uQWxpYXMoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlcGVhdGVkIG9iamVjdHMgYXJlIG5vdCBzdXBwb3J0ZWQgaGVyZScpO1xuICAgIH0sXG5cbiAgICBwcmV2T2JqZWN0czogbmV3IE1hcCgpLFxuICAgIHNjaGVtYSxcbiAgICB3cmFwU2NhbGFyczogZmFsc2VcbiAgfSk7XG59IC8vIG51bGwsIHVuZGVmaW5lZCwgb3IgYW4gZW1wdHkgbm9uLXN0cmluZyBpdGVyYWJsZSAoZS5nLiBbXSlcblxuY29uc3QgaXNFbXB0eVBhdGggPSBwYXRoID0+IHBhdGggPT0gbnVsbCB8fCB0eXBlb2YgcGF0aCA9PT0gJ29iamVjdCcgJiYgcGF0aFtTeW1ib2wuaXRlcmF0b3JdKCkubmV4dCgpLmRvbmU7XG5jbGFzcyBDb2xsZWN0aW9uIGV4dGVuZHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHNjaGVtYSkge1xuICAgIHN1cGVyKCk7XG5cbiAgICBfZGVmaW5lUHJvcGVydHkodGhpcywgXCJpdGVtc1wiLCBbXSk7XG5cbiAgICB0aGlzLnNjaGVtYSA9IHNjaGVtYTtcbiAgfVxuXG4gIGFkZEluKHBhdGgsIHZhbHVlKSB7XG4gICAgaWYgKGlzRW1wdHlQYXRoKHBhdGgpKSB0aGlzLmFkZCh2YWx1ZSk7ZWxzZSB7XG4gICAgICBjb25zdCBba2V5LCAuLi5yZXN0XSA9IHBhdGg7XG4gICAgICBjb25zdCBub2RlID0gdGhpcy5nZXQoa2V5LCB0cnVlKTtcbiAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgQ29sbGVjdGlvbikgbm9kZS5hZGRJbihyZXN0LCB2YWx1ZSk7ZWxzZSBpZiAobm9kZSA9PT0gdW5kZWZpbmVkICYmIHRoaXMuc2NoZW1hKSB0aGlzLnNldChrZXksIGNvbGxlY3Rpb25Gcm9tUGF0aCh0aGlzLnNjaGVtYSwgcmVzdCwgdmFsdWUpKTtlbHNlIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIFlBTUwgY29sbGVjdGlvbiBhdCBcIi5jb25jYXQoa2V5LCBcIi4gUmVtYWluaW5nIHBhdGg6IFwiKS5jb25jYXQocmVzdCkpO1xuICAgIH1cbiAgfVxuXG4gIGRlbGV0ZUluKFtrZXksIC4uLnJlc3RdKSB7XG4gICAgaWYgKHJlc3QubGVuZ3RoID09PSAwKSByZXR1cm4gdGhpcy5kZWxldGUoa2V5KTtcbiAgICBjb25zdCBub2RlID0gdGhpcy5nZXQoa2V5LCB0cnVlKTtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIENvbGxlY3Rpb24pIHJldHVybiBub2RlLmRlbGV0ZUluKHJlc3QpO2Vsc2UgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgWUFNTCBjb2xsZWN0aW9uIGF0IFwiLmNvbmNhdChrZXksIFwiLiBSZW1haW5pbmcgcGF0aDogXCIpLmNvbmNhdChyZXN0KSk7XG4gIH1cblxuICBnZXRJbihba2V5LCAuLi5yZXN0XSwga2VlcFNjYWxhcikge1xuICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldChrZXksIHRydWUpO1xuICAgIGlmIChyZXN0Lmxlbmd0aCA9PT0gMCkgcmV0dXJuICFrZWVwU2NhbGFyICYmIG5vZGUgaW5zdGFuY2VvZiBTY2FsYXIgPyBub2RlLnZhbHVlIDogbm9kZTtlbHNlIHJldHVybiBub2RlIGluc3RhbmNlb2YgQ29sbGVjdGlvbiA/IG5vZGUuZ2V0SW4ocmVzdCwga2VlcFNjYWxhcikgOiB1bmRlZmluZWQ7XG4gIH1cblxuICBoYXNBbGxOdWxsVmFsdWVzKCkge1xuICAgIHJldHVybiB0aGlzLml0ZW1zLmV2ZXJ5KG5vZGUgPT4ge1xuICAgICAgaWYgKCFub2RlIHx8IG5vZGUudHlwZSAhPT0gJ1BBSVInKSByZXR1cm4gZmFsc2U7XG4gICAgICBjb25zdCBuID0gbm9kZS52YWx1ZTtcbiAgICAgIHJldHVybiBuID09IG51bGwgfHwgbiBpbnN0YW5jZW9mIFNjYWxhciAmJiBuLnZhbHVlID09IG51bGwgJiYgIW4uY29tbWVudEJlZm9yZSAmJiAhbi5jb21tZW50ICYmICFuLnRhZztcbiAgICB9KTtcbiAgfVxuXG4gIGhhc0luKFtrZXksIC4uLnJlc3RdKSB7XG4gICAgaWYgKHJlc3QubGVuZ3RoID09PSAwKSByZXR1cm4gdGhpcy5oYXMoa2V5KTtcbiAgICBjb25zdCBub2RlID0gdGhpcy5nZXQoa2V5LCB0cnVlKTtcbiAgICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIENvbGxlY3Rpb24gPyBub2RlLmhhc0luKHJlc3QpIDogZmFsc2U7XG4gIH1cblxuICBzZXRJbihba2V5LCAuLi5yZXN0XSwgdmFsdWUpIHtcbiAgICBpZiAocmVzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuc2V0KGtleSwgdmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBub2RlID0gdGhpcy5nZXQoa2V5LCB0cnVlKTtcbiAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgQ29sbGVjdGlvbikgbm9kZS5zZXRJbihyZXN0LCB2YWx1ZSk7ZWxzZSBpZiAobm9kZSA9PT0gdW5kZWZpbmVkICYmIHRoaXMuc2NoZW1hKSB0aGlzLnNldChrZXksIGNvbGxlY3Rpb25Gcm9tUGF0aCh0aGlzLnNjaGVtYSwgcmVzdCwgdmFsdWUpKTtlbHNlIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIFlBTUwgY29sbGVjdGlvbiBhdCBcIi5jb25jYXQoa2V5LCBcIi4gUmVtYWluaW5nIHBhdGg6IFwiKS5jb25jYXQocmVzdCkpO1xuICAgIH1cbiAgfVxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dDogb3ZlcnJpZGRlbiBpbiBpbXBsZW1lbnRhdGlvbnMgKi9cblxuXG4gIHRvSlNPTigpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHRvU3RyaW5nKGN0eCwge1xuICAgIGJsb2NrSXRlbSxcbiAgICBmbG93Q2hhcnMsXG4gICAgaXNNYXAsXG4gICAgaXRlbUluZGVudFxuICB9LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKSB7XG4gICAgY29uc3Qge1xuICAgICAgaW5kZW50LFxuICAgICAgaW5kZW50U3RlcCxcbiAgICAgIHN0cmluZ2lmeVxuICAgIH0gPSBjdHg7XG4gICAgY29uc3QgaW5GbG93ID0gdGhpcy50eXBlID09PSBUeXBlLkZMT1dfTUFQIHx8IHRoaXMudHlwZSA9PT0gVHlwZS5GTE9XX1NFUSB8fCBjdHguaW5GbG93O1xuICAgIGlmIChpbkZsb3cpIGl0ZW1JbmRlbnQgKz0gaW5kZW50U3RlcDtcbiAgICBjb25zdCBhbGxOdWxsVmFsdWVzID0gaXNNYXAgJiYgdGhpcy5oYXNBbGxOdWxsVmFsdWVzKCk7XG4gICAgY3R4ID0gT2JqZWN0LmFzc2lnbih7fSwgY3R4LCB7XG4gICAgICBhbGxOdWxsVmFsdWVzLFxuICAgICAgaW5kZW50OiBpdGVtSW5kZW50LFxuICAgICAgaW5GbG93LFxuICAgICAgdHlwZTogbnVsbFxuICAgIH0pO1xuICAgIGxldCBjaG9tcEtlZXAgPSBmYWxzZTtcbiAgICBsZXQgaGFzSXRlbVdpdGhOZXdMaW5lID0gZmFsc2U7XG4gICAgY29uc3Qgbm9kZXMgPSB0aGlzLml0ZW1zLnJlZHVjZSgobm9kZXMsIGl0ZW0sIGkpID0+IHtcbiAgICAgIGxldCBjb21tZW50O1xuXG4gICAgICBpZiAoaXRlbSkge1xuICAgICAgICBpZiAoIWNob21wS2VlcCAmJiBpdGVtLnNwYWNlQmVmb3JlKSBub2Rlcy5wdXNoKHtcbiAgICAgICAgICB0eXBlOiAnY29tbWVudCcsXG4gICAgICAgICAgc3RyOiAnJ1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGl0ZW0uY29tbWVudEJlZm9yZSkgaXRlbS5jb21tZW50QmVmb3JlLm1hdGNoKC9eLiokL2dtKS5mb3JFYWNoKGxpbmUgPT4ge1xuICAgICAgICAgIG5vZGVzLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogJ2NvbW1lbnQnLFxuICAgICAgICAgICAgc3RyOiBcIiNcIi5jb25jYXQobGluZSlcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChpdGVtLmNvbW1lbnQpIGNvbW1lbnQgPSBpdGVtLmNvbW1lbnQ7XG4gICAgICAgIGlmIChpbkZsb3cgJiYgKCFjaG9tcEtlZXAgJiYgaXRlbS5zcGFjZUJlZm9yZSB8fCBpdGVtLmNvbW1lbnRCZWZvcmUgfHwgaXRlbS5jb21tZW50IHx8IGl0ZW0ua2V5ICYmIChpdGVtLmtleS5jb21tZW50QmVmb3JlIHx8IGl0ZW0ua2V5LmNvbW1lbnQpIHx8IGl0ZW0udmFsdWUgJiYgKGl0ZW0udmFsdWUuY29tbWVudEJlZm9yZSB8fCBpdGVtLnZhbHVlLmNvbW1lbnQpKSkgaGFzSXRlbVdpdGhOZXdMaW5lID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgY2hvbXBLZWVwID0gZmFsc2U7XG4gICAgICBsZXQgc3RyID0gc3RyaW5naWZ5KGl0ZW0sIGN0eCwgKCkgPT4gY29tbWVudCA9IG51bGwsICgpID0+IGNob21wS2VlcCA9IHRydWUpO1xuICAgICAgaWYgKGluRmxvdyAmJiAhaGFzSXRlbVdpdGhOZXdMaW5lICYmIHN0ci5pbmNsdWRlcygnXFxuJykpIGhhc0l0ZW1XaXRoTmV3TGluZSA9IHRydWU7XG4gICAgICBpZiAoaW5GbG93ICYmIGkgPCB0aGlzLml0ZW1zLmxlbmd0aCAtIDEpIHN0ciArPSAnLCc7XG4gICAgICBzdHIgPSBhZGRDb21tZW50KHN0ciwgaXRlbUluZGVudCwgY29tbWVudCk7XG4gICAgICBpZiAoY2hvbXBLZWVwICYmIChjb21tZW50IHx8IGluRmxvdykpIGNob21wS2VlcCA9IGZhbHNlO1xuICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdpdGVtJyxcbiAgICAgICAgc3RyXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBub2RlcztcbiAgICB9LCBbXSk7XG4gICAgbGV0IHN0cjtcblxuICAgIGlmIChub2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHN0ciA9IGZsb3dDaGFycy5zdGFydCArIGZsb3dDaGFycy5lbmQ7XG4gICAgfSBlbHNlIGlmIChpbkZsb3cpIHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZFxuICAgICAgfSA9IGZsb3dDaGFycztcbiAgICAgIGNvbnN0IHN0cmluZ3MgPSBub2Rlcy5tYXAobiA9PiBuLnN0cik7XG5cbiAgICAgIGlmIChoYXNJdGVtV2l0aE5ld0xpbmUgfHwgc3RyaW5ncy5yZWR1Y2UoKHN1bSwgc3RyKSA9PiBzdW0gKyBzdHIubGVuZ3RoICsgMiwgMikgPiBDb2xsZWN0aW9uLm1heEZsb3dTdHJpbmdTaW5nbGVMaW5lTGVuZ3RoKSB7XG4gICAgICAgIHN0ciA9IHN0YXJ0O1xuXG4gICAgICAgIGZvciAoY29uc3QgcyBvZiBzdHJpbmdzKSB7XG4gICAgICAgICAgc3RyICs9IHMgPyBcIlxcblwiLmNvbmNhdChpbmRlbnRTdGVwKS5jb25jYXQoaW5kZW50KS5jb25jYXQocykgOiAnXFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIHN0ciArPSBcIlxcblwiLmNvbmNhdChpbmRlbnQpLmNvbmNhdChlbmQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gXCJcIi5jb25jYXQoc3RhcnQsIFwiIFwiKS5jb25jYXQoc3RyaW5ncy5qb2luKCcgJyksIFwiIFwiKS5jb25jYXQoZW5kKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgc3RyaW5ncyA9IG5vZGVzLm1hcChibG9ja0l0ZW0pO1xuICAgICAgc3RyID0gc3RyaW5ncy5zaGlmdCgpO1xuXG4gICAgICBmb3IgKGNvbnN0IHMgb2Ygc3RyaW5ncykgc3RyICs9IHMgPyBcIlxcblwiLmNvbmNhdChpbmRlbnQpLmNvbmNhdChzKSA6ICdcXG4nO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNvbW1lbnQpIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHRoaXMuY29tbWVudC5yZXBsYWNlKC9eL2dtLCBcIlwiLmNvbmNhdChpbmRlbnQsIFwiI1wiKSk7XG4gICAgICBpZiAob25Db21tZW50KSBvbkNvbW1lbnQoKTtcbiAgICB9IGVsc2UgaWYgKGNob21wS2VlcCAmJiBvbkNob21wS2VlcCkgb25DaG9tcEtlZXAoKTtcblxuICAgIHJldHVybiBzdHI7XG4gIH1cblxufVxuXG5fZGVmaW5lUHJvcGVydHkoQ29sbGVjdGlvbiwgXCJtYXhGbG93U3RyaW5nU2luZ2xlTGluZUxlbmd0aFwiLCA2MCk7XG5cbmV4cG9ydCB7IENvbGxlY3Rpb24sIGNvbGxlY3Rpb25Gcm9tUGF0aCwgaXNFbXB0eVBhdGggfTtcbiIsImltcG9ydCB7IExvZ0xldmVsIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG4vKiBnbG9iYWwgY29uc29sZSwgcHJvY2VzcyAqL1xuZnVuY3Rpb24gd2Fybihsb2dMZXZlbCwgd2FybmluZykge1xuICBpZiAoTG9nTGV2ZWwuaW5kZXhPZihsb2dMZXZlbCkgPj0gTG9nTGV2ZWwuV0FSTikge1xuICAgIGlmICh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgcHJvY2Vzcy5lbWl0V2FybmluZykgcHJvY2Vzcy5lbWl0V2FybmluZyh3YXJuaW5nKTtlbHNlIGNvbnNvbGUud2Fybih3YXJuaW5nKTtcbiAgfVxufVxuXG5leHBvcnQgeyB3YXJuIH07XG4iLCJpbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9Db2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IFNjYWxhciwgaXNTY2FsYXJWYWx1ZSB9IGZyb20gJy4vU2NhbGFyLmpzJztcbmltcG9ydCB7IHRvSlMgfSBmcm9tICcuL3RvSlMuanMnO1xuXG5mdW5jdGlvbiBhc0l0ZW1JbmRleChrZXkpIHtcbiAgbGV0IGlkeCA9IGtleSBpbnN0YW5jZW9mIFNjYWxhciA/IGtleS52YWx1ZSA6IGtleTtcbiAgaWYgKGlkeCAmJiB0eXBlb2YgaWR4ID09PSAnc3RyaW5nJykgaWR4ID0gTnVtYmVyKGlkeCk7XG4gIHJldHVybiBOdW1iZXIuaXNJbnRlZ2VyKGlkeCkgJiYgaWR4ID49IDAgPyBpZHggOiBudWxsO1xufVxuXG5jbGFzcyBZQU1MU2VxIGV4dGVuZHMgQ29sbGVjdGlvbiB7XG4gIGFkZCh2YWx1ZSkge1xuICAgIHRoaXMuaXRlbXMucHVzaCh2YWx1ZSk7XG4gIH1cblxuICBkZWxldGUoa2V5KSB7XG4gICAgY29uc3QgaWR4ID0gYXNJdGVtSW5kZXgoa2V5KTtcbiAgICBpZiAodHlwZW9mIGlkeCAhPT0gJ251bWJlcicpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBkZWwgPSB0aGlzLml0ZW1zLnNwbGljZShpZHgsIDEpO1xuICAgIHJldHVybiBkZWwubGVuZ3RoID4gMDtcbiAgfVxuXG4gIGdldChrZXksIGtlZXBTY2FsYXIpIHtcbiAgICBjb25zdCBpZHggPSBhc0l0ZW1JbmRleChrZXkpO1xuICAgIGlmICh0eXBlb2YgaWR4ICE9PSAnbnVtYmVyJykgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICBjb25zdCBpdCA9IHRoaXMuaXRlbXNbaWR4XTtcbiAgICByZXR1cm4gIWtlZXBTY2FsYXIgJiYgaXQgaW5zdGFuY2VvZiBTY2FsYXIgPyBpdC52YWx1ZSA6IGl0O1xuICB9XG5cbiAgaGFzKGtleSkge1xuICAgIGNvbnN0IGlkeCA9IGFzSXRlbUluZGV4KGtleSk7XG4gICAgcmV0dXJuIHR5cGVvZiBpZHggPT09ICdudW1iZXInICYmIGlkeCA8IHRoaXMuaXRlbXMubGVuZ3RoO1xuICB9XG5cbiAgc2V0KGtleSwgdmFsdWUpIHtcbiAgICBjb25zdCBpZHggPSBhc0l0ZW1JbmRleChrZXkpO1xuICAgIGlmICh0eXBlb2YgaWR4ICE9PSAnbnVtYmVyJykgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgYSB2YWxpZCBpbmRleCwgbm90IFwiLmNvbmNhdChrZXksIFwiLlwiKSk7XG4gICAgY29uc3QgcHJldiA9IHRoaXMuaXRlbXNbaWR4XTtcbiAgICBpZiAocHJldiBpbnN0YW5jZW9mIFNjYWxhciAmJiBpc1NjYWxhclZhbHVlKHZhbHVlKSkgcHJldi52YWx1ZSA9IHZhbHVlO2Vsc2UgdGhpcy5pdGVtc1tpZHhdID0gdmFsdWU7XG4gIH1cblxuICB0b0pTT04oXywgY3R4KSB7XG4gICAgY29uc3Qgc2VxID0gW107XG4gICAgaWYgKGN0eCAmJiBjdHgub25DcmVhdGUpIGN0eC5vbkNyZWF0ZShzZXEpO1xuICAgIGxldCBpID0gMDtcblxuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZW1zKSBzZXEucHVzaCh0b0pTKGl0ZW0sIFN0cmluZyhpKyspLCBjdHgpKTtcblxuICAgIHJldHVybiBzZXE7XG4gIH1cblxuICB0b1N0cmluZyhjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApIHtcbiAgICBpZiAoIWN0eCkgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMpO1xuICAgIHJldHVybiBzdXBlci50b1N0cmluZyhjdHgsIHtcbiAgICAgIGJsb2NrSXRlbTogbiA9PiBuLnR5cGUgPT09ICdjb21tZW50JyA/IG4uc3RyIDogXCItIFwiLmNvbmNhdChuLnN0ciksXG4gICAgICBmbG93Q2hhcnM6IHtcbiAgICAgICAgc3RhcnQ6ICdbJyxcbiAgICAgICAgZW5kOiAnXSdcbiAgICAgIH0sXG4gICAgICBpc01hcDogZmFsc2UsXG4gICAgICBpdGVtSW5kZW50OiAoY3R4LmluZGVudCB8fCAnJykgKyAnICAnXG4gICAgfSwgb25Db21tZW50LCBvbkNob21wS2VlcCk7XG4gIH1cblxufVxuXG5leHBvcnQgeyBZQU1MU2VxIH07XG4iLCJpbXBvcnQgeyBkZWZpbmVQcm9wZXJ0eSBhcyBfZGVmaW5lUHJvcGVydHkgfSBmcm9tICcuLi9fdmlydHVhbC9fcm9sbHVwUGx1Z2luQmFiZWxIZWxwZXJzLmpzJztcbmltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgY3JlYXRlTm9kZSB9IGZyb20gJy4uL2RvYy9jcmVhdGVOb2RlLmpzJztcbmltcG9ydCB7IHdhcm4gfSBmcm9tICcuLi9sb2cuanMnO1xuaW1wb3J0IHsgYWRkQ29tbWVudCB9IGZyb20gJy4uL3N0cmluZ2lmeS9hZGRDb21tZW50LmpzJztcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuL0NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBTY2FsYXIgfSBmcm9tICcuL1NjYWxhci5qcyc7XG5pbXBvcnQgeyBZQU1MU2VxIH0gZnJvbSAnLi9ZQU1MU2VxLmpzJztcbmltcG9ydCB7IHRvSlMgfSBmcm9tICcuL3RvSlMuanMnO1xuXG5mdW5jdGlvbiBzdHJpbmdpZnlLZXkoa2V5LCBqc0tleSwgY3R4KSB7XG4gIGlmIChqc0tleSA9PT0gbnVsbCkgcmV0dXJuICcnO1xuICBpZiAodHlwZW9mIGpzS2V5ICE9PSAnb2JqZWN0JykgcmV0dXJuIFN0cmluZyhqc0tleSk7XG5cbiAgaWYgKGtleSBpbnN0YW5jZW9mIE5vZGUgJiYgY3R4ICYmIGN0eC5kb2MpIHtcbiAgICBjb25zdCBzdHJLZXkgPSBrZXkudG9TdHJpbmcoe1xuICAgICAgYW5jaG9yczogT2JqZWN0LmNyZWF0ZShudWxsKSxcbiAgICAgIGRvYzogY3R4LmRvYyxcbiAgICAgIGluZGVudDogJycsXG4gICAgICBpbmRlbnRTdGVwOiBjdHguaW5kZW50U3RlcCxcbiAgICAgIGluRmxvdzogdHJ1ZSxcbiAgICAgIGluU3RyaW5naWZ5S2V5OiB0cnVlLFxuICAgICAgc3RyaW5naWZ5OiBjdHguc3RyaW5naWZ5XG4gICAgfSk7XG5cbiAgICBpZiAoIWN0eC5tYXBLZXlXYXJuZWQpIHtcbiAgICAgIGxldCBqc29uU3RyID0gSlNPTi5zdHJpbmdpZnkoc3RyS2V5KTtcbiAgICAgIGlmIChqc29uU3RyLmxlbmd0aCA+IDQwKSBqc29uU3RyID0ganNvblN0ci5zcGxpdCgnJykuc3BsaWNlKDM2LCAnLi4uXCInKS5qb2luKCcnKTtcbiAgICAgIHdhcm4oY3R4LmRvYy5vcHRpb25zLmxvZ0xldmVsLCBcIktleXMgd2l0aCBjb2xsZWN0aW9uIHZhbHVlcyB3aWxsIGJlIHN0cmluZ2lmaWVkIGR1ZSB0byBKUyBPYmplY3QgcmVzdHJpY3Rpb25zOiBcIi5jb25jYXQoanNvblN0ciwgXCIuIFNldCBtYXBBc01hcDogdHJ1ZSB0byB1c2Ugb2JqZWN0IGtleXMuXCIpKTtcbiAgICAgIGN0eC5tYXBLZXlXYXJuZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBzdHJLZXk7XG4gIH1cblxuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoanNLZXkpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVQYWlyKGtleSwgdmFsdWUsIGN0eCkge1xuICBjb25zdCBrID0gY3JlYXRlTm9kZShrZXksIG51bGwsIGN0eCk7XG4gIGNvbnN0IHYgPSBjcmVhdGVOb2RlKHZhbHVlLCBudWxsLCBjdHgpO1xuICByZXR1cm4gbmV3IFBhaXIoaywgdik7XG59XG5jbGFzcyBQYWlyIGV4dGVuZHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKGtleSwgdmFsdWUgPSBudWxsKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmtleSA9IGtleTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgdGhpcy50eXBlID0gUGFpci5UeXBlLlBBSVI7XG4gIH1cblxuICBnZXQgY29tbWVudEJlZm9yZSgpIHtcbiAgICByZXR1cm4gdGhpcy5rZXkgaW5zdGFuY2VvZiBOb2RlID8gdGhpcy5rZXkuY29tbWVudEJlZm9yZSA6IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHNldCBjb21tZW50QmVmb3JlKGNiKSB7XG4gICAgaWYgKHRoaXMua2V5ID09IG51bGwpIHRoaXMua2V5ID0gbmV3IFNjYWxhcihudWxsKTtcbiAgICBpZiAodGhpcy5rZXkgaW5zdGFuY2VvZiBOb2RlKSB0aGlzLmtleS5jb21tZW50QmVmb3JlID0gY2I7ZWxzZSB7XG4gICAgICBjb25zdCBtc2cgPSAnUGFpci5jb21tZW50QmVmb3JlIGlzIGFuIGFsaWFzIGZvciBQYWlyLmtleS5jb21tZW50QmVmb3JlLiBUbyBzZXQgaXQsIHRoZSBrZXkgbXVzdCBiZSBhIE5vZGUuJztcbiAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgIH1cbiAgfVxuXG4gIGFkZFRvSlNNYXAoY3R4LCBtYXApIHtcbiAgICBjb25zdCBrZXkgPSB0b0pTKHRoaXMua2V5LCAnJywgY3R4KTtcblxuICAgIGlmIChtYXAgaW5zdGFuY2VvZiBNYXApIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdG9KUyh0aGlzLnZhbHVlLCBrZXksIGN0eCk7XG4gICAgICBtYXAuc2V0KGtleSwgdmFsdWUpO1xuICAgIH0gZWxzZSBpZiAobWFwIGluc3RhbmNlb2YgU2V0KSB7XG4gICAgICBtYXAuYWRkKGtleSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHN0cmluZ0tleSA9IHN0cmluZ2lmeUtleSh0aGlzLmtleSwga2V5LCBjdHgpO1xuICAgICAgY29uc3QgdmFsdWUgPSB0b0pTKHRoaXMudmFsdWUsIHN0cmluZ0tleSwgY3R4KTtcbiAgICAgIGlmIChzdHJpbmdLZXkgaW4gbWFwKSBPYmplY3QuZGVmaW5lUHJvcGVydHkobWFwLCBzdHJpbmdLZXksIHtcbiAgICAgICAgdmFsdWUsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO2Vsc2UgbWFwW3N0cmluZ0tleV0gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gbWFwO1xuICB9XG5cbiAgdG9KU09OKF8sIGN0eCkge1xuICAgIGNvbnN0IHBhaXIgPSBjdHggJiYgY3R4Lm1hcEFzTWFwID8gbmV3IE1hcCgpIDoge307XG4gICAgcmV0dXJuIHRoaXMuYWRkVG9KU01hcChjdHgsIHBhaXIpO1xuICB9XG5cbiAgdG9TdHJpbmcoY3R4LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKSB7XG4gICAgaWYgKCFjdHggfHwgIWN0eC5kb2MpIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzKTtcbiAgICBjb25zdCB7XG4gICAgICBpbmRlbnQ6IGluZGVudFNpemUsXG4gICAgICBpbmRlbnRTZXEsXG4gICAgICBzaW1wbGVLZXlzXG4gICAgfSA9IGN0eC5kb2Mub3B0aW9ucztcbiAgICBsZXQge1xuICAgICAga2V5LFxuICAgICAgdmFsdWVcbiAgICB9ID0gdGhpcztcbiAgICBsZXQga2V5Q29tbWVudCA9IGtleSBpbnN0YW5jZW9mIE5vZGUgJiYga2V5LmNvbW1lbnQ7XG5cbiAgICBpZiAoc2ltcGxlS2V5cykge1xuICAgICAgaWYgKGtleUNvbW1lbnQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXaXRoIHNpbXBsZSBrZXlzLCBrZXkgbm9kZXMgY2Fubm90IGhhdmUgY29tbWVudHMnKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGtleSBpbnN0YW5jZW9mIENvbGxlY3Rpb24pIHtcbiAgICAgICAgY29uc3QgbXNnID0gJ1dpdGggc2ltcGxlIGtleXMsIGNvbGxlY3Rpb24gY2Fubm90IGJlIHVzZWQgYXMgYSBrZXkgdmFsdWUnO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgZXhwbGljaXRLZXkgPSAhc2ltcGxlS2V5cyAmJiAoIWtleSB8fCBrZXlDb21tZW50IHx8IChrZXkgaW5zdGFuY2VvZiBOb2RlID8ga2V5IGluc3RhbmNlb2YgQ29sbGVjdGlvbiB8fCBrZXkudHlwZSA9PT0gVHlwZS5CTE9DS19GT0xERUQgfHwga2V5LnR5cGUgPT09IFR5cGUuQkxPQ0tfTElURVJBTCA6IHR5cGVvZiBrZXkgPT09ICdvYmplY3QnKSk7XG4gICAgY29uc3Qge1xuICAgICAgYWxsTnVsbFZhbHVlcyxcbiAgICAgIGRvYyxcbiAgICAgIGluZGVudCxcbiAgICAgIGluZGVudFN0ZXAsXG4gICAgICBzdHJpbmdpZnlcbiAgICB9ID0gY3R4O1xuICAgIGN0eCA9IE9iamVjdC5hc3NpZ24oe30sIGN0eCwge1xuICAgICAgaW1wbGljaXRLZXk6ICFleHBsaWNpdEtleSAmJiAoc2ltcGxlS2V5cyB8fCAhYWxsTnVsbFZhbHVlcyksXG4gICAgICBpbmRlbnQ6IGluZGVudCArIGluZGVudFN0ZXBcbiAgICB9KTtcbiAgICBsZXQgY2hvbXBLZWVwID0gZmFsc2U7XG4gICAgbGV0IHN0ciA9IHN0cmluZ2lmeShrZXksIGN0eCwgKCkgPT4ga2V5Q29tbWVudCA9IG51bGwsICgpID0+IGNob21wS2VlcCA9IHRydWUpO1xuICAgIHN0ciA9IGFkZENvbW1lbnQoc3RyLCBjdHguaW5kZW50LCBrZXlDb21tZW50KTtcblxuICAgIGlmICghZXhwbGljaXRLZXkgJiYgc3RyLmxlbmd0aCA+IDEwMjQpIHtcbiAgICAgIGlmIChzaW1wbGVLZXlzKSB0aHJvdyBuZXcgRXJyb3IoJ1dpdGggc2ltcGxlIGtleXMsIHNpbmdsZSBsaW5lIHNjYWxhciBtdXN0IG5vdCBzcGFuIG1vcmUgdGhhbiAxMDI0IGNoYXJhY3RlcnMnKTtcbiAgICAgIGV4cGxpY2l0S2V5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoYWxsTnVsbFZhbHVlcyAmJiAhc2ltcGxlS2V5cykge1xuICAgICAgaWYgKHRoaXMuY29tbWVudCkge1xuICAgICAgICBzdHIgPSBhZGRDb21tZW50KHN0ciwgY3R4LmluZGVudCwgdGhpcy5jb21tZW50KTtcbiAgICAgICAgaWYgKG9uQ29tbWVudCkgb25Db21tZW50KCk7XG4gICAgICB9IGVsc2UgaWYgKGNob21wS2VlcCAmJiAha2V5Q29tbWVudCAmJiBvbkNob21wS2VlcCkgb25DaG9tcEtlZXAoKTtcblxuICAgICAgcmV0dXJuIGN0eC5pbkZsb3cgJiYgIWV4cGxpY2l0S2V5ID8gc3RyIDogXCI/IFwiLmNvbmNhdChzdHIpO1xuICAgIH1cblxuICAgIHN0ciA9IGV4cGxpY2l0S2V5ID8gXCI/IFwiLmNvbmNhdChzdHIsIFwiXFxuXCIpLmNvbmNhdChpbmRlbnQsIFwiOlwiKSA6IFwiXCIuY29uY2F0KHN0ciwgXCI6XCIpO1xuXG4gICAgaWYgKHRoaXMuY29tbWVudCkge1xuICAgICAgLy8gZXhwZWN0ZWQgKGJ1dCBub3Qgc3RyaWN0bHkgcmVxdWlyZWQpIHRvIGJlIGEgc2luZ2xlLWxpbmUgY29tbWVudFxuICAgICAgc3RyID0gYWRkQ29tbWVudChzdHIsIGN0eC5pbmRlbnQsIHRoaXMuY29tbWVudCk7XG4gICAgICBpZiAob25Db21tZW50KSBvbkNvbW1lbnQoKTtcbiAgICB9XG5cbiAgICBsZXQgdmNiID0gJyc7XG4gICAgbGV0IHZhbHVlQ29tbWVudCA9IG51bGw7XG5cbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBOb2RlKSB7XG4gICAgICBpZiAodmFsdWUuc3BhY2VCZWZvcmUpIHZjYiA9ICdcXG4nO1xuXG4gICAgICBpZiAodmFsdWUuY29tbWVudEJlZm9yZSkge1xuICAgICAgICBjb25zdCBjcyA9IHZhbHVlLmNvbW1lbnRCZWZvcmUucmVwbGFjZSgvXi9nbSwgXCJcIi5jb25jYXQoY3R4LmluZGVudCwgXCIjXCIpKTtcbiAgICAgICAgdmNiICs9IFwiXFxuXCIuY29uY2F0KGNzKTtcbiAgICAgIH1cblxuICAgICAgdmFsdWVDb21tZW50ID0gdmFsdWUuY29tbWVudDtcbiAgICB9IGVsc2UgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHZhbHVlID0gZG9jLmNyZWF0ZU5vZGUodmFsdWUpO1xuICAgIH1cblxuICAgIGN0eC5pbXBsaWNpdEtleSA9IGZhbHNlO1xuICAgIGlmICghZXhwbGljaXRLZXkgJiYgIXRoaXMuY29tbWVudCAmJiB2YWx1ZSBpbnN0YW5jZW9mIFNjYWxhcikgY3R4LmluZGVudEF0U3RhcnQgPSBzdHIubGVuZ3RoICsgMTtcbiAgICBjaG9tcEtlZXAgPSBmYWxzZTtcblxuICAgIGlmICghaW5kZW50U2VxICYmIGluZGVudFNpemUgPj0gMiAmJiAhY3R4LmluRmxvdyAmJiAhZXhwbGljaXRLZXkgJiYgdmFsdWUgaW5zdGFuY2VvZiBZQU1MU2VxICYmIHZhbHVlLnR5cGUgIT09IFR5cGUuRkxPV19TRVEgJiYgIXZhbHVlLnRhZyAmJiAhZG9jLmFuY2hvcnMuZ2V0TmFtZSh2YWx1ZSkpIHtcbiAgICAgIC8vIElmIGluZGVudFNlcSA9PT0gZmFsc2UsIGNvbnNpZGVyICctICcgYXMgcGFydCBvZiBpbmRlbnRhdGlvbiB3aGVyZSBwb3NzaWJsZVxuICAgICAgY3R4LmluZGVudCA9IGN0eC5pbmRlbnQuc3Vic3RyKDIpO1xuICAgIH1cblxuICAgIGNvbnN0IHZhbHVlU3RyID0gc3RyaW5naWZ5KHZhbHVlLCBjdHgsICgpID0+IHZhbHVlQ29tbWVudCA9IG51bGwsICgpID0+IGNob21wS2VlcCA9IHRydWUpO1xuICAgIGxldCB3cyA9ICcgJztcblxuICAgIGlmICh2Y2IgfHwgdGhpcy5jb21tZW50KSB7XG4gICAgICB3cyA9IFwiXCIuY29uY2F0KHZjYiwgXCJcXG5cIikuY29uY2F0KGN0eC5pbmRlbnQpO1xuICAgIH0gZWxzZSBpZiAoIWV4cGxpY2l0S2V5ICYmIHZhbHVlIGluc3RhbmNlb2YgQ29sbGVjdGlvbikge1xuICAgICAgY29uc3QgZmxvdyA9IHZhbHVlU3RyWzBdID09PSAnWycgfHwgdmFsdWVTdHJbMF0gPT09ICd7JztcbiAgICAgIGlmICghZmxvdyB8fCB2YWx1ZVN0ci5pbmNsdWRlcygnXFxuJykpIHdzID0gXCJcXG5cIi5jb25jYXQoY3R4LmluZGVudCk7XG4gICAgfSBlbHNlIGlmICh2YWx1ZVN0clswXSA9PT0gJ1xcbicpIHdzID0gJyc7XG5cbiAgICBpZiAoY2hvbXBLZWVwICYmICF2YWx1ZUNvbW1lbnQgJiYgb25DaG9tcEtlZXApIG9uQ2hvbXBLZWVwKCk7XG4gICAgcmV0dXJuIGFkZENvbW1lbnQoc3RyICsgd3MgKyB2YWx1ZVN0ciwgY3R4LmluZGVudCwgdmFsdWVDb21tZW50KTtcbiAgfVxuXG59XG5cbl9kZWZpbmVQcm9wZXJ0eShQYWlyLCBcIlR5cGVcIiwge1xuICBQQUlSOiAnUEFJUicsXG4gIE1FUkdFX1BBSVI6ICdNRVJHRV9QQUlSJ1xufSk7XG5cbmV4cG9ydCB7IFBhaXIsIGNyZWF0ZVBhaXIgfTtcbiIsImltcG9ydCB7IGRlZmluZVByb3BlcnR5IGFzIF9kZWZpbmVQcm9wZXJ0eSB9IGZyb20gJy4uL192aXJ0dWFsL19yb2xsdXBQbHVnaW5CYWJlbEhlbHBlcnMuanMnO1xuaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MUmVmZXJlbmNlRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcbmltcG9ydCB7IFBhaXIgfSBmcm9tICcuL1BhaXIuanMnO1xuaW1wb3J0IHsgdG9KUyB9IGZyb20gJy4vdG9KUy5qcyc7XG5cbmNvbnN0IGdldEFsaWFzQ291bnQgPSAobm9kZSwgYW5jaG9ycykgPT4ge1xuICBpZiAobm9kZSBpbnN0YW5jZW9mIEFsaWFzKSB7XG4gICAgY29uc3QgYW5jaG9yID0gYW5jaG9ycy5nZXQobm9kZS5zb3VyY2UpO1xuICAgIHJldHVybiBhbmNob3IuY291bnQgKiBhbmNob3IuYWxpYXNDb3VudDtcbiAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgQ29sbGVjdGlvbikge1xuICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2Ygbm9kZS5pdGVtcykge1xuICAgICAgY29uc3QgYyA9IGdldEFsaWFzQ291bnQoaXRlbSwgYW5jaG9ycyk7XG4gICAgICBpZiAoYyA+IGNvdW50KSBjb3VudCA9IGM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvdW50O1xuICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiBQYWlyKSB7XG4gICAgY29uc3Qga2MgPSBnZXRBbGlhc0NvdW50KG5vZGUua2V5LCBhbmNob3JzKTtcbiAgICBjb25zdCB2YyA9IGdldEFsaWFzQ291bnQobm9kZS52YWx1ZSwgYW5jaG9ycyk7XG4gICAgcmV0dXJuIE1hdGgubWF4KGtjLCB2Yyk7XG4gIH1cblxuICByZXR1cm4gMTtcbn07XG5cbmNsYXNzIEFsaWFzIGV4dGVuZHMgTm9kZSB7XG4gIHN0YXRpYyBzdHJpbmdpZnkoe1xuICAgIHJhbmdlLFxuICAgIHNvdXJjZVxuICB9LCB7XG4gICAgYW5jaG9ycyxcbiAgICBkb2MsXG4gICAgaW1wbGljaXRLZXksXG4gICAgaW5TdHJpbmdpZnlLZXlcbiAgfSkge1xuICAgIGxldCBhbmNob3IgPSBPYmplY3Qua2V5cyhhbmNob3JzKS5maW5kKGEgPT4gYW5jaG9yc1thXSA9PT0gc291cmNlKTtcbiAgICBpZiAoIWFuY2hvciAmJiBpblN0cmluZ2lmeUtleSkgYW5jaG9yID0gZG9jLmFuY2hvcnMuZ2V0TmFtZShzb3VyY2UpIHx8IGRvYy5hbmNob3JzLm5ld05hbWUoKTtcbiAgICBpZiAoYW5jaG9yKSByZXR1cm4gXCIqXCIuY29uY2F0KGFuY2hvcikuY29uY2F0KGltcGxpY2l0S2V5ID8gJyAnIDogJycpO1xuICAgIGNvbnN0IG1zZyA9IGRvYy5hbmNob3JzLmdldE5hbWUoc291cmNlKSA/ICdBbGlhcyBub2RlIG11c3QgYmUgYWZ0ZXIgc291cmNlIG5vZGUnIDogJ1NvdXJjZSBub2RlIG5vdCBmb3VuZCBmb3IgYWxpYXMgbm9kZSc7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiXCIuY29uY2F0KG1zZywgXCIgW1wiKS5jb25jYXQocmFuZ2UsIFwiXVwiKSk7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihzb3VyY2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc291cmNlID0gc291cmNlO1xuICAgIHRoaXMudHlwZSA9IFR5cGUuQUxJQVM7XG4gIH1cblxuICBzZXQgdGFnKHQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0FsaWFzIG5vZGVzIGNhbm5vdCBoYXZlIHRhZ3MnKTtcbiAgfVxuXG4gIHRvSlNPTihhcmcsIGN0eCkge1xuICAgIGlmICghY3R4KSByZXR1cm4gdG9KUyh0aGlzLnNvdXJjZSwgYXJnLCBjdHgpO1xuICAgIGNvbnN0IHtcbiAgICAgIGFuY2hvcnMsXG4gICAgICBtYXhBbGlhc0NvdW50XG4gICAgfSA9IGN0eDtcbiAgICBjb25zdCBhbmNob3IgPSBhbmNob3JzLmdldCh0aGlzLnNvdXJjZSk7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG5cbiAgICBpZiAoIWFuY2hvciB8fCBhbmNob3IucmVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG1zZyA9ICdUaGlzIHNob3VsZCBub3QgaGFwcGVuOiBBbGlhcyBhbmNob3Igd2FzIG5vdCByZXNvbHZlZD8nO1xuICAgICAgaWYgKHRoaXMuY3N0Tm9kZSkgdGhyb3cgbmV3IFlBTUxSZWZlcmVuY2VFcnJvcih0aGlzLmNzdE5vZGUsIG1zZyk7ZWxzZSB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IobXNnKTtcbiAgICB9XG5cbiAgICBpZiAobWF4QWxpYXNDb3VudCA+PSAwKSB7XG4gICAgICBhbmNob3IuY291bnQgKz0gMTtcbiAgICAgIGlmIChhbmNob3IuYWxpYXNDb3VudCA9PT0gMCkgYW5jaG9yLmFsaWFzQ291bnQgPSBnZXRBbGlhc0NvdW50KHRoaXMuc291cmNlLCBhbmNob3JzKTtcblxuICAgICAgaWYgKGFuY2hvci5jb3VudCAqIGFuY2hvci5hbGlhc0NvdW50ID4gbWF4QWxpYXNDb3VudCkge1xuICAgICAgICBjb25zdCBtc2cgPSAnRXhjZXNzaXZlIGFsaWFzIGNvdW50IGluZGljYXRlcyBhIHJlc291cmNlIGV4aGF1c3Rpb24gYXR0YWNrJztcbiAgICAgICAgaWYgKHRoaXMuY3N0Tm9kZSkgdGhyb3cgbmV3IFlBTUxSZWZlcmVuY2VFcnJvcih0aGlzLmNzdE5vZGUsIG1zZyk7ZWxzZSB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IobXNnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYW5jaG9yLnJlcztcbiAgfSAvLyBPbmx5IGNhbGxlZCB3aGVuIHN0cmluZ2lmeWluZyBhbiBhbGlhcyBtYXBwaW5nIGtleSB3aGlsZSBjb25zdHJ1Y3RpbmdcbiAgLy8gT2JqZWN0IG91dHB1dC5cblxuXG4gIHRvU3RyaW5nKGN0eCkge1xuICAgIHJldHVybiBBbGlhcy5zdHJpbmdpZnkodGhpcywgY3R4KTtcbiAgfVxuXG59XG5cbl9kZWZpbmVQcm9wZXJ0eShBbGlhcywgXCJkZWZhdWx0XCIsIHRydWUpO1xuXG5leHBvcnQgeyBBbGlhcyB9O1xuIiwiaW1wb3J0IHsgU2NhbGFyIH0gZnJvbSAnLi4vYXN0L1NjYWxhci5qcyc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTY2FsYXIoc3RyLCB0YWdzKSB7XG4gIGZvciAoY29uc3Qge1xuICAgIGZvcm1hdCxcbiAgICB0ZXN0LFxuICAgIHJlc29sdmVcbiAgfSBvZiB0YWdzKSB7XG4gICAgaWYgKHRlc3QgJiYgdGVzdC50ZXN0KHN0cikpIHtcbiAgICAgIGxldCByZXMgPSByZXNvbHZlKHN0cik7XG4gICAgICBpZiAoIShyZXMgaW5zdGFuY2VvZiBTY2FsYXIpKSByZXMgPSBuZXcgU2NhbGFyKHJlcyk7XG4gICAgICBpZiAoZm9ybWF0KSByZXMuZm9ybWF0ID0gZm9ybWF0O1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3IFNjYWxhcihzdHIpOyAvLyBmYWxsYmFjayB0byBzdHJpbmdcbn1cblxuZXhwb3J0IHsgcmVzb2x2ZVNjYWxhciB9O1xuIiwiY29uc3QgRk9MRF9GTE9XID0gJ2Zsb3cnO1xuY29uc3QgRk9MRF9CTE9DSyA9ICdibG9jayc7XG5jb25zdCBGT0xEX1FVT1RFRCA9ICdxdW90ZWQnOyAvLyBwcmVzdW1lcyBpKzEgaXMgYXQgdGhlIHN0YXJ0IG9mIGEgbGluZVxuLy8gcmV0dXJucyBpbmRleCBvZiBsYXN0IG5ld2xpbmUgaW4gbW9yZS1pbmRlbnRlZCBibG9ja1xuXG5jb25zdCBjb25zdW1lTW9yZUluZGVudGVkTGluZXMgPSAodGV4dCwgaSkgPT4ge1xuICBsZXQgY2ggPSB0ZXh0W2kgKyAxXTtcblxuICB3aGlsZSAoY2ggPT09ICcgJyB8fCBjaCA9PT0gJ1xcdCcpIHtcbiAgICBkbyB7XG4gICAgICBjaCA9IHRleHRbaSArPSAxXTtcbiAgICB9IHdoaWxlIChjaCAmJiBjaCAhPT0gJ1xcbicpO1xuXG4gICAgY2ggPSB0ZXh0W2kgKyAxXTtcbiAgfVxuXG4gIHJldHVybiBpO1xufTtcbi8qKlxuICogVHJpZXMgdG8ga2VlcCBpbnB1dCBhdCB1cCB0byBgbGluZVdpZHRoYCBjaGFyYWN0ZXJzLCBzcGxpdHRpbmcgb25seSBvbiBzcGFjZXNcbiAqIG5vdCBmb2xsb3dlZCBieSBuZXdsaW5lcyBvciBzcGFjZXMgdW5sZXNzIGBtb2RlYCBpcyBgJ3F1b3RlZCdgLiBMaW5lcyBhcmVcbiAqIHRlcm1pbmF0ZWQgd2l0aCBgXFxuYCBhbmQgc3RhcnRlZCB3aXRoIGBpbmRlbnRgLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG4gKiBAcGFyYW0ge3N0cmluZ30gaW5kZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gW21vZGU9J2Zsb3cnXSBgJ2Jsb2NrJ2AgcHJldmVudHMgbW9yZS1pbmRlbnRlZCBsaW5lc1xuICogICBmcm9tIGJlaW5nIGZvbGRlZDsgYCdxdW90ZWQnYCBhbGxvd3MgZm9yIGBcXGAgZXNjYXBlcywgaW5jbHVkaW5nIGVzY2FwZWRcbiAqICAgbmV3bGluZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuaW5kZW50QXRTdGFydF0gQWNjb3VudHMgZm9yIGxlYWRpbmcgY29udGVudHMgb25cbiAqICAgdGhlIGZpcnN0IGxpbmUsIGRlZmF1bHRpbmcgdG8gYGluZGVudC5sZW5ndGhgXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubGluZVdpZHRoPTgwXVxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1pbkNvbnRlbnRXaWR0aD0yMF0gQWxsb3cgaGlnaGx5IGluZGVudGVkIGxpbmVzIHRvXG4gKiAgIHN0cmV0Y2ggdGhlIGxpbmUgd2lkdGggb3IgaW5kZW50IGNvbnRlbnQgZnJvbSB0aGUgc3RhcnRcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IG9wdGlvbnMub25Gb2xkIENhbGxlZCBvbmNlIGlmIHRoZSB0ZXh0IGlzIGZvbGRlZFxuICogQHBhcmFtIHtmdW5jdGlvbn0gb3B0aW9ucy5vbkZvbGQgQ2FsbGVkIG9uY2UgaWYgYW55IGxpbmUgb2YgdGV4dCBleGNlZWRzXG4gKiAgIGxpbmVXaWR0aCBjaGFyYWN0ZXJzXG4gKi9cblxuXG5mdW5jdGlvbiBmb2xkRmxvd0xpbmVzKHRleHQsIGluZGVudCwgbW9kZSwge1xuICBpbmRlbnRBdFN0YXJ0LFxuICBsaW5lV2lkdGggPSA4MCxcbiAgbWluQ29udGVudFdpZHRoID0gMjAsXG4gIG9uRm9sZCxcbiAgb25PdmVyZmxvd1xufSkge1xuICBpZiAoIWxpbmVXaWR0aCB8fCBsaW5lV2lkdGggPCAwKSByZXR1cm4gdGV4dDtcbiAgY29uc3QgZW5kU3RlcCA9IE1hdGgubWF4KDEgKyBtaW5Db250ZW50V2lkdGgsIDEgKyBsaW5lV2lkdGggLSBpbmRlbnQubGVuZ3RoKTtcbiAgaWYgKHRleHQubGVuZ3RoIDw9IGVuZFN0ZXApIHJldHVybiB0ZXh0O1xuICBjb25zdCBmb2xkcyA9IFtdO1xuICBjb25zdCBlc2NhcGVkRm9sZHMgPSB7fTtcbiAgbGV0IGVuZCA9IGxpbmVXaWR0aCAtIGluZGVudC5sZW5ndGg7XG5cbiAgaWYgKHR5cGVvZiBpbmRlbnRBdFN0YXJ0ID09PSAnbnVtYmVyJykge1xuICAgIGlmIChpbmRlbnRBdFN0YXJ0ID4gbGluZVdpZHRoIC0gTWF0aC5tYXgoMiwgbWluQ29udGVudFdpZHRoKSkgZm9sZHMucHVzaCgwKTtlbHNlIGVuZCA9IGxpbmVXaWR0aCAtIGluZGVudEF0U3RhcnQ7XG4gIH1cblxuICBsZXQgc3BsaXQgPSB1bmRlZmluZWQ7XG4gIGxldCBwcmV2ID0gdW5kZWZpbmVkO1xuICBsZXQgb3ZlcmZsb3cgPSBmYWxzZTtcbiAgbGV0IGkgPSAtMTtcbiAgbGV0IGVzY1N0YXJ0ID0gLTE7XG4gIGxldCBlc2NFbmQgPSAtMTtcblxuICBpZiAobW9kZSA9PT0gRk9MRF9CTE9DSykge1xuICAgIGkgPSBjb25zdW1lTW9yZUluZGVudGVkTGluZXModGV4dCwgaSk7XG4gICAgaWYgKGkgIT09IC0xKSBlbmQgPSBpICsgZW5kU3RlcDtcbiAgfVxuXG4gIGZvciAobGV0IGNoOyBjaCA9IHRleHRbaSArPSAxXTspIHtcbiAgICBpZiAobW9kZSA9PT0gRk9MRF9RVU9URUQgJiYgY2ggPT09ICdcXFxcJykge1xuICAgICAgZXNjU3RhcnQgPSBpO1xuXG4gICAgICBzd2l0Y2ggKHRleHRbaSArIDFdKSB7XG4gICAgICAgIGNhc2UgJ3gnOlxuICAgICAgICAgIGkgKz0gMztcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1JzpcbiAgICAgICAgICBpICs9IDU7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnVSc6XG4gICAgICAgICAgaSArPSA5O1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaSArPSAxO1xuICAgICAgfVxuXG4gICAgICBlc2NFbmQgPSBpO1xuICAgIH1cblxuICAgIGlmIChjaCA9PT0gJ1xcbicpIHtcbiAgICAgIGlmIChtb2RlID09PSBGT0xEX0JMT0NLKSBpID0gY29uc3VtZU1vcmVJbmRlbnRlZExpbmVzKHRleHQsIGkpO1xuICAgICAgZW5kID0gaSArIGVuZFN0ZXA7XG4gICAgICBzcGxpdCA9IHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGNoID09PSAnICcgJiYgcHJldiAmJiBwcmV2ICE9PSAnICcgJiYgcHJldiAhPT0gJ1xcbicgJiYgcHJldiAhPT0gJ1xcdCcpIHtcbiAgICAgICAgLy8gc3BhY2Ugc3Vycm91bmRlZCBieSBub24tc3BhY2UgY2FuIGJlIHJlcGxhY2VkIHdpdGggbmV3bGluZSArIGluZGVudFxuICAgICAgICBjb25zdCBuZXh0ID0gdGV4dFtpICsgMV07XG4gICAgICAgIGlmIChuZXh0ICYmIG5leHQgIT09ICcgJyAmJiBuZXh0ICE9PSAnXFxuJyAmJiBuZXh0ICE9PSAnXFx0Jykgc3BsaXQgPSBpO1xuICAgICAgfVxuXG4gICAgICBpZiAoaSA+PSBlbmQpIHtcbiAgICAgICAgaWYgKHNwbGl0KSB7XG4gICAgICAgICAgZm9sZHMucHVzaChzcGxpdCk7XG4gICAgICAgICAgZW5kID0gc3BsaXQgKyBlbmRTdGVwO1xuICAgICAgICAgIHNwbGl0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IEZPTERfUVVPVEVEKSB7XG4gICAgICAgICAgLy8gd2hpdGUtc3BhY2UgY29sbGVjdGVkIGF0IGVuZCBtYXkgc3RyZXRjaCBwYXN0IGxpbmVXaWR0aFxuICAgICAgICAgIHdoaWxlIChwcmV2ID09PSAnICcgfHwgcHJldiA9PT0gJ1xcdCcpIHtcbiAgICAgICAgICAgIHByZXYgPSBjaDtcbiAgICAgICAgICAgIGNoID0gdGV4dFtpICs9IDFdO1xuICAgICAgICAgICAgb3ZlcmZsb3cgPSB0cnVlO1xuICAgICAgICAgIH0gLy8gQWNjb3VudCBmb3IgbmV3bGluZSBlc2NhcGUsIGJ1dCBkb24ndCBicmVhayBwcmVjZWRpbmcgZXNjYXBlXG5cblxuICAgICAgICAgIGNvbnN0IGogPSBpID4gZXNjRW5kICsgMSA/IGkgLSAyIDogZXNjU3RhcnQgLSAxOyAvLyBCYWlsIG91dCBpZiBsaW5lV2lkdGggJiBtaW5Db250ZW50V2lkdGggYXJlIHNob3J0ZXIgdGhhbiBhbiBlc2NhcGUgc3RyaW5nXG5cbiAgICAgICAgICBpZiAoZXNjYXBlZEZvbGRzW2pdKSByZXR1cm4gdGV4dDtcbiAgICAgICAgICBmb2xkcy5wdXNoKGopO1xuICAgICAgICAgIGVzY2FwZWRGb2xkc1tqXSA9IHRydWU7XG4gICAgICAgICAgZW5kID0gaiArIGVuZFN0ZXA7XG4gICAgICAgICAgc3BsaXQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3ZlcmZsb3cgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcHJldiA9IGNoO1xuICB9XG5cbiAgaWYgKG92ZXJmbG93ICYmIG9uT3ZlcmZsb3cpIG9uT3ZlcmZsb3coKTtcbiAgaWYgKGZvbGRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRleHQ7XG4gIGlmIChvbkZvbGQpIG9uRm9sZCgpO1xuICBsZXQgcmVzID0gdGV4dC5zbGljZSgwLCBmb2xkc1swXSk7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBmb2xkcy5sZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IGZvbGQgPSBmb2xkc1tpXTtcbiAgICBjb25zdCBlbmQgPSBmb2xkc1tpICsgMV0gfHwgdGV4dC5sZW5ndGg7XG4gICAgaWYgKGZvbGQgPT09IDApIHJlcyA9IFwiXFxuXCIuY29uY2F0KGluZGVudCkuY29uY2F0KHRleHQuc2xpY2UoMCwgZW5kKSk7ZWxzZSB7XG4gICAgICBpZiAobW9kZSA9PT0gRk9MRF9RVU9URUQgJiYgZXNjYXBlZEZvbGRzW2ZvbGRdKSByZXMgKz0gXCJcIi5jb25jYXQodGV4dFtmb2xkXSwgXCJcXFxcXCIpO1xuICAgICAgcmVzICs9IFwiXFxuXCIuY29uY2F0KGluZGVudCkuY29uY2F0KHRleHQuc2xpY2UoZm9sZCArIDEsIGVuZCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXM7XG59XG5cbmV4cG9ydCB7IEZPTERfQkxPQ0ssIEZPTERfRkxPVywgRk9MRF9RVU9URUQsIGZvbGRGbG93TGluZXMgfTtcbiIsImltcG9ydCB7IGFkZENvbW1lbnRCZWZvcmUgfSBmcm9tICcuL2FkZENvbW1lbnQuanMnO1xuaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyByZXNvbHZlU2NhbGFyIH0gZnJvbSAnLi4vcmVzb2x2ZS9yZXNvbHZlU2NhbGFyLmpzJztcbmltcG9ydCB7IGZvbGRGbG93TGluZXMsIEZPTERfUVVPVEVELCBGT0xEX0ZMT1csIEZPTERfQkxPQ0sgfSBmcm9tICcuL2ZvbGRGbG93TGluZXMuanMnO1xuaW1wb3J0IHsgc3RyT3B0aW9ucyB9IGZyb20gJy4uL3RhZ3Mvb3B0aW9ucy5qcyc7XG5cbmNvbnN0IGdldEZvbGRPcHRpb25zID0gKHtcbiAgaW5kZW50QXRTdGFydFxufSkgPT4gaW5kZW50QXRTdGFydCA/IE9iamVjdC5hc3NpZ24oe1xuICBpbmRlbnRBdFN0YXJ0XG59LCBzdHJPcHRpb25zLmZvbGQpIDogc3RyT3B0aW9ucy5mb2xkOyAvLyBBbHNvIGNoZWNrcyBmb3IgbGluZXMgc3RhcnRpbmcgd2l0aCAlLCBhcyBwYXJzaW5nIHRoZSBvdXRwdXQgYXMgWUFNTCAxLjEgd2lsbFxuLy8gcHJlc3VtZSB0aGF0J3Mgc3RhcnRpbmcgYSBuZXcgZG9jdW1lbnQuXG5cblxuY29uc3QgY29udGFpbnNEb2N1bWVudE1hcmtlciA9IHN0ciA9PiAvXiglfC0tLXxcXC5cXC5cXC4pL20udGVzdChzdHIpO1xuXG5mdW5jdGlvbiBsaW5lTGVuZ3RoT3ZlckxpbWl0KHN0ciwgbGltaXQpIHtcbiAgY29uc3Qgc3RyTGVuID0gc3RyLmxlbmd0aDtcbiAgaWYgKHN0ckxlbiA8PSBsaW1pdCkgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAobGV0IGkgPSAwLCBzdGFydCA9IDA7IGkgPCBzdHJMZW47ICsraSkge1xuICAgIGlmIChzdHJbaV0gPT09ICdcXG4nKSB7XG4gICAgICBpZiAoaSAtIHN0YXJ0ID4gbGltaXQpIHJldHVybiB0cnVlO1xuICAgICAgc3RhcnQgPSBpICsgMTtcbiAgICAgIGlmIChzdHJMZW4gLSBzdGFydCA8PSBsaW1pdCkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBkb3VibGVRdW90ZWRTdHJpbmcodmFsdWUsIGN0eCkge1xuICBjb25zdCB7XG4gICAgaW1wbGljaXRLZXlcbiAgfSA9IGN0eDtcbiAgY29uc3Qge1xuICAgIGpzb25FbmNvZGluZyxcbiAgICBtaW5NdWx0aUxpbmVMZW5ndGhcbiAgfSA9IHN0ck9wdGlvbnMuZG91YmxlUXVvdGVkO1xuICBjb25zdCBqc29uID0gSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xuICBpZiAoanNvbkVuY29kaW5nKSByZXR1cm4ganNvbjtcbiAgY29uc3QgaW5kZW50ID0gY3R4LmluZGVudCB8fCAoY29udGFpbnNEb2N1bWVudE1hcmtlcih2YWx1ZSkgPyAnICAnIDogJycpO1xuICBsZXQgc3RyID0gJyc7XG4gIGxldCBzdGFydCA9IDA7XG5cbiAgZm9yIChsZXQgaSA9IDAsIGNoID0ganNvbltpXTsgY2g7IGNoID0ganNvblsrK2ldKSB7XG4gICAgaWYgKGNoID09PSAnICcgJiYganNvbltpICsgMV0gPT09ICdcXFxcJyAmJiBqc29uW2kgKyAyXSA9PT0gJ24nKSB7XG4gICAgICAvLyBzcGFjZSBiZWZvcmUgbmV3bGluZSBuZWVkcyB0byBiZSBlc2NhcGVkIHRvIG5vdCBiZSBmb2xkZWRcbiAgICAgIHN0ciArPSBqc29uLnNsaWNlKHN0YXJ0LCBpKSArICdcXFxcICc7XG4gICAgICBpICs9IDE7XG4gICAgICBzdGFydCA9IGk7XG4gICAgICBjaCA9ICdcXFxcJztcbiAgICB9XG5cbiAgICBpZiAoY2ggPT09ICdcXFxcJykgc3dpdGNoIChqc29uW2kgKyAxXSkge1xuICAgICAgY2FzZSAndSc6XG4gICAgICAgIHtcbiAgICAgICAgICBzdHIgKz0ganNvbi5zbGljZShzdGFydCwgaSk7XG4gICAgICAgICAgY29uc3QgY29kZSA9IGpzb24uc3Vic3RyKGkgKyAyLCA0KTtcblxuICAgICAgICAgIHN3aXRjaCAoY29kZSkge1xuICAgICAgICAgICAgY2FzZSAnMDAwMCc6XG4gICAgICAgICAgICAgIHN0ciArPSAnXFxcXDAnO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnMDAwNyc6XG4gICAgICAgICAgICAgIHN0ciArPSAnXFxcXGEnO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnMDAwYic6XG4gICAgICAgICAgICAgIHN0ciArPSAnXFxcXHYnO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnMDAxYic6XG4gICAgICAgICAgICAgIHN0ciArPSAnXFxcXGUnO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnMDA4NSc6XG4gICAgICAgICAgICAgIHN0ciArPSAnXFxcXE4nO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnMDBhMCc6XG4gICAgICAgICAgICAgIHN0ciArPSAnXFxcXF8nO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnMjAyOCc6XG4gICAgICAgICAgICAgIHN0ciArPSAnXFxcXEwnO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnMjAyOSc6XG4gICAgICAgICAgICAgIHN0ciArPSAnXFxcXFAnO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgaWYgKGNvZGUuc3Vic3RyKDAsIDIpID09PSAnMDAnKSBzdHIgKz0gJ1xcXFx4JyArIGNvZGUuc3Vic3RyKDIpO2Vsc2Ugc3RyICs9IGpzb24uc3Vic3RyKGksIDYpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGkgKz0gNTtcbiAgICAgICAgICBzdGFydCA9IGkgKyAxO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICduJzpcbiAgICAgICAgaWYgKGltcGxpY2l0S2V5IHx8IGpzb25baSArIDJdID09PSAnXCInIHx8IGpzb24ubGVuZ3RoIDwgbWluTXVsdGlMaW5lTGVuZ3RoKSB7XG4gICAgICAgICAgaSArPSAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGZvbGRpbmcgd2lsbCBlYXQgZmlyc3QgbmV3bGluZVxuICAgICAgICAgIHN0ciArPSBqc29uLnNsaWNlKHN0YXJ0LCBpKSArICdcXG5cXG4nO1xuXG4gICAgICAgICAgd2hpbGUgKGpzb25baSArIDJdID09PSAnXFxcXCcgJiYganNvbltpICsgM10gPT09ICduJyAmJiBqc29uW2kgKyA0XSAhPT0gJ1wiJykge1xuICAgICAgICAgICAgc3RyICs9ICdcXG4nO1xuICAgICAgICAgICAgaSArPSAyO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHN0ciArPSBpbmRlbnQ7IC8vIHNwYWNlIGFmdGVyIG5ld2xpbmUgbmVlZHMgdG8gYmUgZXNjYXBlZCB0byBub3QgYmUgZm9sZGVkXG5cbiAgICAgICAgICBpZiAoanNvbltpICsgMl0gPT09ICcgJykgc3RyICs9ICdcXFxcJztcbiAgICAgICAgICBpICs9IDE7XG4gICAgICAgICAgc3RhcnQgPSBpICsgMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpICs9IDE7XG4gICAgfVxuICB9XG5cbiAgc3RyID0gc3RhcnQgPyBzdHIgKyBqc29uLnNsaWNlKHN0YXJ0KSA6IGpzb247XG4gIHJldHVybiBpbXBsaWNpdEtleSA/IHN0ciA6IGZvbGRGbG93TGluZXMoc3RyLCBpbmRlbnQsIEZPTERfUVVPVEVELCBnZXRGb2xkT3B0aW9ucyhjdHgpKTtcbn1cblxuZnVuY3Rpb24gc2luZ2xlUXVvdGVkU3RyaW5nKHZhbHVlLCBjdHgpIHtcbiAgaWYgKGN0eC5pbXBsaWNpdEtleSkge1xuICAgIGlmICgvXFxuLy50ZXN0KHZhbHVlKSkgcmV0dXJuIGRvdWJsZVF1b3RlZFN0cmluZyh2YWx1ZSwgY3R4KTtcbiAgfSBlbHNlIHtcbiAgICAvLyBzaW5nbGUgcXVvdGVkIHN0cmluZyBjYW4ndCBoYXZlIGxlYWRpbmcgb3IgdHJhaWxpbmcgd2hpdGVzcGFjZSBhcm91bmQgbmV3bGluZVxuICAgIGlmICgvWyBcXHRdXFxufFxcblsgXFx0XS8udGVzdCh2YWx1ZSkpIHJldHVybiBkb3VibGVRdW90ZWRTdHJpbmcodmFsdWUsIGN0eCk7XG4gIH1cblxuICBjb25zdCBpbmRlbnQgPSBjdHguaW5kZW50IHx8IChjb250YWluc0RvY3VtZW50TWFya2VyKHZhbHVlKSA/ICcgICcgOiAnJyk7XG4gIGNvbnN0IHJlcyA9IFwiJ1wiICsgdmFsdWUucmVwbGFjZSgvJy9nLCBcIicnXCIpLnJlcGxhY2UoL1xcbisvZywgXCIkJlxcblwiLmNvbmNhdChpbmRlbnQpKSArIFwiJ1wiO1xuICByZXR1cm4gY3R4LmltcGxpY2l0S2V5ID8gcmVzIDogZm9sZEZsb3dMaW5lcyhyZXMsIGluZGVudCwgRk9MRF9GTE9XLCBnZXRGb2xkT3B0aW9ucyhjdHgpKTtcbn1cblxuZnVuY3Rpb24gYmxvY2tTdHJpbmcoe1xuICBjb21tZW50LFxuICB0eXBlLFxuICB2YWx1ZVxufSwgY3R4LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKSB7XG4gIC8vIDEuIEJsb2NrIGNhbid0IGVuZCBpbiB3aGl0ZXNwYWNlIHVubGVzcyB0aGUgbGFzdCBsaW5lIGlzIG5vbi1lbXB0eS5cbiAgLy8gMi4gU3RyaW5ncyBjb25zaXN0aW5nIG9mIG9ubHkgd2hpdGVzcGFjZSBhcmUgYmVzdCByZW5kZXJlZCBleHBsaWNpdGx5LlxuICBpZiAoL1xcbltcXHQgXSskLy50ZXN0KHZhbHVlKSB8fCAvXlxccyokLy50ZXN0KHZhbHVlKSkge1xuICAgIHJldHVybiBkb3VibGVRdW90ZWRTdHJpbmcodmFsdWUsIGN0eCk7XG4gIH1cblxuICBjb25zdCBpbmRlbnQgPSBjdHguaW5kZW50IHx8IChjdHguZm9yY2VCbG9ja0luZGVudCB8fCBjb250YWluc0RvY3VtZW50TWFya2VyKHZhbHVlKSA/ICcgICcgOiAnJyk7XG4gIGNvbnN0IGluZGVudFNpemUgPSBpbmRlbnQgPyAnMicgOiAnMSc7IC8vIHJvb3QgaXMgYXQgLTFcblxuICBjb25zdCBsaXRlcmFsID0gdHlwZSA9PT0gVHlwZS5CTE9DS19GT0xERUQgPyBmYWxzZSA6IHR5cGUgPT09IFR5cGUuQkxPQ0tfTElURVJBTCA/IHRydWUgOiAhbGluZUxlbmd0aE92ZXJMaW1pdCh2YWx1ZSwgc3RyT3B0aW9ucy5mb2xkLmxpbmVXaWR0aCAtIGluZGVudC5sZW5ndGgpO1xuICBsZXQgaGVhZGVyID0gbGl0ZXJhbCA/ICd8JyA6ICc+JztcbiAgaWYgKCF2YWx1ZSkgcmV0dXJuIGhlYWRlciArICdcXG4nO1xuICBsZXQgd3NTdGFydCA9ICcnO1xuICBsZXQgd3NFbmQgPSAnJztcbiAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9bXFxuXFx0IF0qJC8sIHdzID0+IHtcbiAgICBjb25zdCBuID0gd3MuaW5kZXhPZignXFxuJyk7XG5cbiAgICBpZiAobiA9PT0gLTEpIHtcbiAgICAgIGhlYWRlciArPSAnLSc7IC8vIHN0cmlwXG4gICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gd3MgfHwgbiAhPT0gd3MubGVuZ3RoIC0gMSkge1xuICAgICAgaGVhZGVyICs9ICcrJzsgLy8ga2VlcFxuXG4gICAgICBpZiAob25DaG9tcEtlZXApIG9uQ2hvbXBLZWVwKCk7XG4gICAgfVxuXG4gICAgd3NFbmQgPSB3cy5yZXBsYWNlKC9cXG4kLywgJycpO1xuICAgIHJldHVybiAnJztcbiAgfSkucmVwbGFjZSgvXltcXG4gXSovLCB3cyA9PiB7XG4gICAgaWYgKHdzLmluZGV4T2YoJyAnKSAhPT0gLTEpIGhlYWRlciArPSBpbmRlbnRTaXplO1xuICAgIGNvbnN0IG0gPSB3cy5tYXRjaCgvICskLyk7XG5cbiAgICBpZiAobSkge1xuICAgICAgd3NTdGFydCA9IHdzLnNsaWNlKDAsIC1tWzBdLmxlbmd0aCk7XG4gICAgICByZXR1cm4gbVswXTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3NTdGFydCA9IHdzO1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfSk7XG4gIGlmICh3c0VuZCkgd3NFbmQgPSB3c0VuZC5yZXBsYWNlKC9cXG4rKD8hXFxufCQpL2csIFwiJCZcIi5jb25jYXQoaW5kZW50KSk7XG4gIGlmICh3c1N0YXJ0KSB3c1N0YXJ0ID0gd3NTdGFydC5yZXBsYWNlKC9cXG4rL2csIFwiJCZcIi5jb25jYXQoaW5kZW50KSk7XG5cbiAgaWYgKGNvbW1lbnQpIHtcbiAgICBoZWFkZXIgKz0gJyAjJyArIGNvbW1lbnQucmVwbGFjZSgvID9bXFxyXFxuXSsvZywgJyAnKTtcbiAgICBpZiAob25Db21tZW50KSBvbkNvbW1lbnQoKTtcbiAgfVxuXG4gIGlmICghdmFsdWUpIHJldHVybiBcIlwiLmNvbmNhdChoZWFkZXIpLmNvbmNhdChpbmRlbnRTaXplLCBcIlxcblwiKS5jb25jYXQoaW5kZW50KS5jb25jYXQod3NFbmQpO1xuXG4gIGlmIChsaXRlcmFsKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9cXG4rL2csIFwiJCZcIi5jb25jYXQoaW5kZW50KSk7XG4gICAgcmV0dXJuIFwiXCIuY29uY2F0KGhlYWRlciwgXCJcXG5cIikuY29uY2F0KGluZGVudCkuY29uY2F0KHdzU3RhcnQpLmNvbmNhdCh2YWx1ZSkuY29uY2F0KHdzRW5kKTtcbiAgfVxuXG4gIHZhbHVlID0gdmFsdWUucmVwbGFjZSgvXFxuKy9nLCAnXFxuJCYnKS5yZXBsYWNlKC8oPzpefFxcbikoW1xcdCBdLiopKD86KFtcXG5cXHQgXSopXFxuKD8hW1xcblxcdCBdKSk/L2csICckMSQyJykgLy8gbW9yZS1pbmRlbnRlZCBsaW5lcyBhcmVuJ3QgZm9sZGVkXG4gIC8vICAgICAgICAgXiBpbmQubGluZSAgXiBlbXB0eSAgICAgXiBjYXB0dXJlIG5leHQgZW1wdHkgbGluZXMgb25seSBhdCBlbmQgb2YgaW5kZW50XG4gIC5yZXBsYWNlKC9cXG4rL2csIFwiJCZcIi5jb25jYXQoaW5kZW50KSk7XG4gIGNvbnN0IGJvZHkgPSBmb2xkRmxvd0xpbmVzKFwiXCIuY29uY2F0KHdzU3RhcnQpLmNvbmNhdCh2YWx1ZSkuY29uY2F0KHdzRW5kKSwgaW5kZW50LCBGT0xEX0JMT0NLLCBzdHJPcHRpb25zLmZvbGQpO1xuICByZXR1cm4gXCJcIi5jb25jYXQoaGVhZGVyLCBcIlxcblwiKS5jb25jYXQoaW5kZW50KS5jb25jYXQoYm9keSk7XG59XG5cbmZ1bmN0aW9uIHBsYWluU3RyaW5nKGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCkge1xuICBjb25zdCB7XG4gICAgY29tbWVudCxcbiAgICB0eXBlLFxuICAgIHZhbHVlXG4gIH0gPSBpdGVtO1xuICBjb25zdCB7XG4gICAgYWN0dWFsU3RyaW5nLFxuICAgIGltcGxpY2l0S2V5LFxuICAgIGluZGVudCxcbiAgICBpbkZsb3dcbiAgfSA9IGN0eDtcblxuICBpZiAoaW1wbGljaXRLZXkgJiYgL1tcXG5bXFxde30sXS8udGVzdCh2YWx1ZSkgfHwgaW5GbG93ICYmIC9bW1xcXXt9LF0vLnRlc3QodmFsdWUpKSB7XG4gICAgcmV0dXJuIGRvdWJsZVF1b3RlZFN0cmluZyh2YWx1ZSwgY3R4KTtcbiAgfVxuXG4gIGlmICghdmFsdWUgfHwgL15bXFxuXFx0ICxbXFxde30jJiohfD4nXCIlQGBdfF5bPy1dJHxeWz8tXVsgXFx0XXxbXFxuOl1bIFxcdF18WyBcXHRdXFxufFtcXG5cXHQgXSN8W1xcblxcdCA6XSQvLnRlc3QodmFsdWUpKSB7XG4gICAgY29uc3QgaGFzRG91YmxlID0gdmFsdWUuaW5kZXhPZignXCInKSAhPT0gLTE7XG4gICAgY29uc3QgaGFzU2luZ2xlID0gdmFsdWUuaW5kZXhPZihcIidcIikgIT09IC0xO1xuICAgIGxldCBxdW90ZWRTdHJpbmc7XG5cbiAgICBpZiAoaGFzRG91YmxlICYmICFoYXNTaW5nbGUpIHtcbiAgICAgIHF1b3RlZFN0cmluZyA9IHNpbmdsZVF1b3RlZFN0cmluZztcbiAgICB9IGVsc2UgaWYgKGhhc1NpbmdsZSAmJiAhaGFzRG91YmxlKSB7XG4gICAgICBxdW90ZWRTdHJpbmcgPSBkb3VibGVRdW90ZWRTdHJpbmc7XG4gICAgfSBlbHNlIGlmIChzdHJPcHRpb25zLmRlZmF1bHRRdW90ZVNpbmdsZSkge1xuICAgICAgcXVvdGVkU3RyaW5nID0gc2luZ2xlUXVvdGVkU3RyaW5nO1xuICAgIH0gZWxzZSB7XG4gICAgICBxdW90ZWRTdHJpbmcgPSBkb3VibGVRdW90ZWRTdHJpbmc7XG4gICAgfSAvLyBub3QgYWxsb3dlZDpcbiAgICAvLyAtIGVtcHR5IHN0cmluZywgJy0nIG9yICc/J1xuICAgIC8vIC0gc3RhcnQgd2l0aCBhbiBpbmRpY2F0b3IgY2hhcmFjdGVyIChleGNlcHQgWz86LV0pIG9yIC9bPy1dIC9cbiAgICAvLyAtICdcXG4gJywgJzogJyBvciAnIFxcbicgYW55d2hlcmVcbiAgICAvLyAtICcjJyBub3QgcHJlY2VkZWQgYnkgYSBub24tc3BhY2UgY2hhclxuICAgIC8vIC0gZW5kIHdpdGggJyAnIG9yICc6J1xuXG5cbiAgICByZXR1cm4gaW1wbGljaXRLZXkgfHwgaW5GbG93IHx8IHZhbHVlLmluZGV4T2YoJ1xcbicpID09PSAtMSA/IHF1b3RlZFN0cmluZyh2YWx1ZSwgY3R4KSA6IGJsb2NrU3RyaW5nKGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCk7XG4gIH1cblxuICBpZiAoIWltcGxpY2l0S2V5ICYmICFpbkZsb3cgJiYgdHlwZSAhPT0gVHlwZS5QTEFJTiAmJiB2YWx1ZS5pbmRleE9mKCdcXG4nKSAhPT0gLTEpIHtcbiAgICAvLyBXaGVyZSBhbGxvd2VkICYgdHlwZSBub3Qgc2V0IGV4cGxpY2l0bHksIHByZWZlciBibG9jayBzdHlsZSBmb3IgbXVsdGlsaW5lIHN0cmluZ3NcbiAgICByZXR1cm4gYmxvY2tTdHJpbmcoaXRlbSwgY3R4LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKTtcbiAgfVxuXG4gIGlmIChpbmRlbnQgPT09ICcnICYmIGNvbnRhaW5zRG9jdW1lbnRNYXJrZXIodmFsdWUpKSB7XG4gICAgY3R4LmZvcmNlQmxvY2tJbmRlbnQgPSB0cnVlO1xuICAgIHJldHVybiBibG9ja1N0cmluZyhpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApO1xuICB9XG5cbiAgY29uc3Qgc3RyID0gdmFsdWUucmVwbGFjZSgvXFxuKy9nLCBcIiQmXFxuXCIuY29uY2F0KGluZGVudCkpOyAvLyBWZXJpZnkgdGhhdCBvdXRwdXQgd2lsbCBiZSBwYXJzZWQgYXMgYSBzdHJpbmcsIGFzIGUuZy4gcGxhaW4gbnVtYmVycyBhbmRcbiAgLy8gYm9vbGVhbnMgZ2V0IHBhcnNlZCB3aXRoIHRob3NlIHR5cGVzIGluIHYxLjIgKGUuZy4gJzQyJywgJ3RydWUnICYgJzAuOWUtMycpLFxuICAvLyBhbmQgb3RoZXJzIGluIHYxLjEuXG5cbiAgaWYgKGFjdHVhbFN0cmluZykge1xuICAgIGNvbnN0IHtcbiAgICAgIHRhZ3NcbiAgICB9ID0gY3R4LmRvYy5zY2hlbWE7XG4gICAgY29uc3QgcmVzb2x2ZWQgPSByZXNvbHZlU2NhbGFyKHN0ciwgdGFncykudmFsdWU7XG4gICAgaWYgKHR5cGVvZiByZXNvbHZlZCAhPT0gJ3N0cmluZycpIHJldHVybiBkb3VibGVRdW90ZWRTdHJpbmcodmFsdWUsIGN0eCk7XG4gIH1cblxuICBjb25zdCBib2R5ID0gaW1wbGljaXRLZXkgPyBzdHIgOiBmb2xkRmxvd0xpbmVzKHN0ciwgaW5kZW50LCBGT0xEX0ZMT1csIGdldEZvbGRPcHRpb25zKGN0eCkpO1xuXG4gIGlmIChjb21tZW50ICYmICFpbkZsb3cgJiYgKGJvZHkuaW5kZXhPZignXFxuJykgIT09IC0xIHx8IGNvbW1lbnQuaW5kZXhPZignXFxuJykgIT09IC0xKSkge1xuICAgIGlmIChvbkNvbW1lbnQpIG9uQ29tbWVudCgpO1xuICAgIHJldHVybiBhZGRDb21tZW50QmVmb3JlKGJvZHksIGluZGVudCwgY29tbWVudCk7XG4gIH1cblxuICByZXR1cm4gYm9keTtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5U3RyaW5nKGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCkge1xuICBjb25zdCB7XG4gICAgZGVmYXVsdEtleVR5cGUsXG4gICAgZGVmYXVsdFR5cGVcbiAgfSA9IHN0ck9wdGlvbnM7XG4gIGNvbnN0IHtcbiAgICBpbXBsaWNpdEtleSxcbiAgICBpbkZsb3dcbiAgfSA9IGN0eDtcbiAgbGV0IHtcbiAgICB0eXBlLFxuICAgIHZhbHVlXG4gIH0gPSBpdGVtO1xuXG4gIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgdmFsdWUgPSBTdHJpbmcodmFsdWUpO1xuICAgIGl0ZW0gPSBPYmplY3QuYXNzaWduKHt9LCBpdGVtLCB7XG4gICAgICB2YWx1ZVxuICAgIH0pO1xuICB9XG5cbiAgaWYgKHR5cGUgIT09IFR5cGUuUVVPVEVfRE9VQkxFKSB7XG4gICAgLy8gZm9yY2UgZG91YmxlIHF1b3RlcyBvbiBjb250cm9sIGNoYXJhY3RlcnMgJiB1bnBhaXJlZCBzdXJyb2dhdGVzXG4gICAgaWYgKC9bXFx4MDAtXFx4MDhcXHgwYi1cXHgxZlxceDdmLVxceDlmXFx1e0Q4MDB9LVxcdXtERkZGfV0vdS50ZXN0KHZhbHVlKSkgdHlwZSA9IFR5cGUuUVVPVEVfRE9VQkxFO1xuICB9XG5cbiAgY29uc3QgX3N0cmluZ2lmeSA9IF90eXBlID0+IHtcbiAgICBzd2l0Y2ggKF90eXBlKSB7XG4gICAgICBjYXNlIFR5cGUuQkxPQ0tfRk9MREVEOlxuICAgICAgY2FzZSBUeXBlLkJMT0NLX0xJVEVSQUw6XG4gICAgICAgIHJldHVybiBpbXBsaWNpdEtleSB8fCBpbkZsb3cgPyBkb3VibGVRdW90ZWRTdHJpbmcodmFsdWUsIGN0eCkgLy8gYmxvY2tzIGFyZSBub3QgdmFsaWQgaW5zaWRlIGZsb3cgY29udGFpbmVyc1xuICAgICAgICA6IGJsb2NrU3RyaW5nKGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCk7XG5cbiAgICAgIGNhc2UgVHlwZS5RVU9URV9ET1VCTEU6XG4gICAgICAgIHJldHVybiBkb3VibGVRdW90ZWRTdHJpbmcodmFsdWUsIGN0eCk7XG5cbiAgICAgIGNhc2UgVHlwZS5RVU9URV9TSU5HTEU6XG4gICAgICAgIHJldHVybiBzaW5nbGVRdW90ZWRTdHJpbmcodmFsdWUsIGN0eCk7XG5cbiAgICAgIGNhc2UgVHlwZS5QTEFJTjpcbiAgICAgICAgcmV0dXJuIHBsYWluU3RyaW5nKGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCk7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfTtcblxuICBsZXQgcmVzID0gX3N0cmluZ2lmeSh0eXBlKTtcblxuICBpZiAocmVzID09PSBudWxsKSB7XG4gICAgY29uc3QgdCA9IGltcGxpY2l0S2V5ID8gZGVmYXVsdEtleVR5cGUgOiBkZWZhdWx0VHlwZTtcbiAgICByZXMgPSBfc3RyaW5naWZ5KHQpO1xuICAgIGlmIChyZXMgPT09IG51bGwpIHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGRlZmF1bHQgc3RyaW5nIHR5cGUgXCIuY29uY2F0KHQpKTtcbiAgfVxuXG4gIHJldHVybiByZXM7XG59XG5cbmV4cG9ydCB7IHN0cmluZ2lmeVN0cmluZyB9O1xuIiwiZnVuY3Rpb24gc3RyaW5naWZ5VGFnKGRvYywgdGFnKSB7XG4gIGlmICgoZG9jLnZlcnNpb24gfHwgZG9jLm9wdGlvbnMudmVyc2lvbikgPT09ICcxLjAnKSB7XG4gICAgY29uc3QgcHJpdiA9IHRhZy5tYXRjaCgvXnRhZzpwcml2YXRlXFwueWFtbFxcLm9yZywyMDAyOihbXjovXSspJC8pO1xuICAgIGlmIChwcml2KSByZXR1cm4gJyEnICsgcHJpdlsxXTtcbiAgICBjb25zdCB2b2NhYiA9IHRhZy5tYXRjaCgvXnRhZzooW2EtekEtWjAtOS1dKylcXC55YW1sXFwub3JnLDIwMDI6KC4qKS8pO1xuICAgIHJldHVybiB2b2NhYiA/IFwiIVwiLmNvbmNhdCh2b2NhYlsxXSwgXCIvXCIpLmNvbmNhdCh2b2NhYlsyXSkgOiBcIiFcIi5jb25jYXQodGFnLnJlcGxhY2UoL150YWc6LywgJycpKTtcbiAgfVxuXG4gIGxldCBwID0gZG9jLnRhZ1ByZWZpeGVzLmZpbmQocCA9PiB0YWcuaW5kZXhPZihwLnByZWZpeCkgPT09IDApO1xuXG4gIGlmICghcCkge1xuICAgIGNvbnN0IGR0cCA9IGRvYy5nZXREZWZhdWx0cygpLnRhZ1ByZWZpeGVzO1xuICAgIHAgPSBkdHAgJiYgZHRwLmZpbmQocCA9PiB0YWcuaW5kZXhPZihwLnByZWZpeCkgPT09IDApO1xuICB9XG5cbiAgaWYgKCFwKSByZXR1cm4gdGFnWzBdID09PSAnIScgPyB0YWcgOiBcIiE8XCIuY29uY2F0KHRhZywgXCI+XCIpO1xuICBjb25zdCBzdWZmaXggPSB0YWcuc3Vic3RyKHAucHJlZml4Lmxlbmd0aCkucmVwbGFjZSgvWyEsW1xcXXt9XS9nLCBjaCA9PiAoe1xuICAgICchJzogJyUyMScsXG4gICAgJywnOiAnJTJDJyxcbiAgICAnWyc6ICclNUInLFxuICAgICddJzogJyU1RCcsXG4gICAgJ3snOiAnJTdCJyxcbiAgICAnfSc6ICclN0QnXG4gIH0pW2NoXSk7XG4gIHJldHVybiBwLmhhbmRsZSArIHN1ZmZpeDtcbn1cblxuZXhwb3J0IHsgc3RyaW5naWZ5VGFnIH07XG4iLCJpbXBvcnQgeyBBbGlhcyB9IGZyb20gJy4uL2FzdC9BbGlhcy5qcyc7XG5pbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi4vYXN0L05vZGUuanMnO1xuaW1wb3J0IHsgUGFpciB9IGZyb20gJy4uL2FzdC9QYWlyLmpzJztcbmltcG9ydCB7IFNjYWxhciB9IGZyb20gJy4uL2FzdC9TY2FsYXIuanMnO1xuaW1wb3J0IHsgc3RyaW5naWZ5U3RyaW5nIH0gZnJvbSAnLi9zdHJpbmdpZnlTdHJpbmcuanMnO1xuaW1wb3J0IHsgc3RyaW5naWZ5VGFnIH0gZnJvbSAnLi9zdHJpbmdpZnlUYWcuanMnO1xuXG5mdW5jdGlvbiBnZXRUYWdPYmplY3QodGFncywgaXRlbSkge1xuICBpZiAoaXRlbSBpbnN0YW5jZW9mIEFsaWFzKSByZXR1cm4gQWxpYXM7XG5cbiAgaWYgKGl0ZW0udGFnKSB7XG4gICAgY29uc3QgbWF0Y2ggPSB0YWdzLmZpbHRlcih0ID0+IHQudGFnID09PSBpdGVtLnRhZyk7XG4gICAgaWYgKG1hdGNoLmxlbmd0aCA+IDApIHJldHVybiBtYXRjaC5maW5kKHQgPT4gdC5mb3JtYXQgPT09IGl0ZW0uZm9ybWF0KSB8fCBtYXRjaFswXTtcbiAgfVxuXG4gIGxldCB0YWdPYmosIG9iajtcblxuICBpZiAoaXRlbSBpbnN0YW5jZW9mIFNjYWxhcikge1xuICAgIG9iaiA9IGl0ZW0udmFsdWU7XG4gICAgY29uc3QgbWF0Y2ggPSB0YWdzLmZpbHRlcih0ID0+IHQuaWRlbnRpZnkgJiYgdC5pZGVudGlmeShvYmopKTtcbiAgICB0YWdPYmogPSBtYXRjaC5maW5kKHQgPT4gdC5mb3JtYXQgPT09IGl0ZW0uZm9ybWF0KSB8fCBtYXRjaC5maW5kKHQgPT4gIXQuZm9ybWF0KTtcbiAgfSBlbHNlIHtcbiAgICBvYmogPSBpdGVtO1xuICAgIHRhZ09iaiA9IHRhZ3MuZmluZCh0ID0+IHQubm9kZUNsYXNzICYmIG9iaiBpbnN0YW5jZW9mIHQubm9kZUNsYXNzKTtcbiAgfVxuXG4gIGlmICghdGFnT2JqKSB7XG4gICAgY29uc3QgbmFtZSA9IG9iaiAmJiBvYmouY29uc3RydWN0b3IgPyBvYmouY29uc3RydWN0b3IubmFtZSA6IHR5cGVvZiBvYmo7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGFnIG5vdCByZXNvbHZlZCBmb3IgXCIuY29uY2F0KG5hbWUsIFwiIHZhbHVlXCIpKTtcbiAgfVxuXG4gIHJldHVybiB0YWdPYmo7XG59IC8vIG5lZWRzIHRvIGJlIGNhbGxlZCBiZWZvcmUgdmFsdWUgc3RyaW5naWZpZXIgdG8gYWxsb3cgZm9yIGNpcmN1bGFyIGFuY2hvciByZWZzXG5cblxuZnVuY3Rpb24gc3RyaW5naWZ5UHJvcHMobm9kZSwgdGFnT2JqLCB7XG4gIGFuY2hvcnMsXG4gIGRvY1xufSkge1xuICBjb25zdCBwcm9wcyA9IFtdO1xuICBjb25zdCBhbmNob3IgPSBkb2MuYW5jaG9ycy5nZXROYW1lKG5vZGUpO1xuXG4gIGlmIChhbmNob3IpIHtcbiAgICBhbmNob3JzW2FuY2hvcl0gPSBub2RlO1xuICAgIHByb3BzLnB1c2goXCImXCIuY29uY2F0KGFuY2hvcikpO1xuICB9XG5cbiAgaWYgKG5vZGUudGFnKSB7XG4gICAgcHJvcHMucHVzaChzdHJpbmdpZnlUYWcoZG9jLCBub2RlLnRhZykpO1xuICB9IGVsc2UgaWYgKCF0YWdPYmouZGVmYXVsdCkge1xuICAgIHByb3BzLnB1c2goc3RyaW5naWZ5VGFnKGRvYywgdGFnT2JqLnRhZykpO1xuICB9XG5cbiAgcmV0dXJuIHByb3BzLmpvaW4oJyAnKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5KGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCkge1xuICBjb25zdCB7XG4gICAgc2NoZW1hXG4gIH0gPSBjdHguZG9jO1xuICBsZXQgdGFnT2JqO1xuXG4gIGlmICghKGl0ZW0gaW5zdGFuY2VvZiBOb2RlKSkge1xuICAgIGl0ZW0gPSBjdHguZG9jLmNyZWF0ZU5vZGUoaXRlbSwge1xuICAgICAgb25UYWdPYmo6IG8gPT4gdGFnT2JqID0gbyxcbiAgICAgIHdyYXBTY2FsYXJzOiB0cnVlXG4gICAgfSk7XG4gIH1cblxuICBpZiAoaXRlbSBpbnN0YW5jZW9mIFBhaXIpIHJldHVybiBpdGVtLnRvU3RyaW5nKGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCk7XG4gIGlmICghdGFnT2JqKSB0YWdPYmogPSBnZXRUYWdPYmplY3Qoc2NoZW1hLnRhZ3MsIGl0ZW0pO1xuICBjb25zdCBwcm9wcyA9IHN0cmluZ2lmeVByb3BzKGl0ZW0sIHRhZ09iaiwgY3R4KTtcbiAgaWYgKHByb3BzLmxlbmd0aCA+IDApIGN0eC5pbmRlbnRBdFN0YXJ0ID0gKGN0eC5pbmRlbnRBdFN0YXJ0IHx8IDApICsgcHJvcHMubGVuZ3RoICsgMTtcbiAgY29uc3Qgc3RyID0gdHlwZW9mIHRhZ09iai5zdHJpbmdpZnkgPT09ICdmdW5jdGlvbicgPyB0YWdPYmouc3RyaW5naWZ5KGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCkgOiBpdGVtIGluc3RhbmNlb2YgU2NhbGFyID8gc3RyaW5naWZ5U3RyaW5nKGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCkgOiBpdGVtLnRvU3RyaW5nKGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCk7XG4gIGlmICghcHJvcHMpIHJldHVybiBzdHI7XG4gIHJldHVybiBpdGVtIGluc3RhbmNlb2YgU2NhbGFyIHx8IHN0clswXSA9PT0gJ3snIHx8IHN0clswXSA9PT0gJ1snID8gXCJcIi5jb25jYXQocHJvcHMsIFwiIFwiKS5jb25jYXQoc3RyKSA6IFwiXCIuY29uY2F0KHByb3BzLCBcIlxcblwiKS5jb25jYXQoY3R4LmluZGVudCkuY29uY2F0KHN0cik7XG59XG5cbmV4cG9ydCB7IHN0cmluZ2lmeSB9O1xuIiwiaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBQYWlyIH0gZnJvbSAnLi9QYWlyLmpzJztcbmltcG9ydCB7IFNjYWxhciwgaXNTY2FsYXJWYWx1ZSB9IGZyb20gJy4vU2NhbGFyLmpzJztcblxuZnVuY3Rpb24gZmluZFBhaXIoaXRlbXMsIGtleSkge1xuICBjb25zdCBrID0ga2V5IGluc3RhbmNlb2YgU2NhbGFyID8ga2V5LnZhbHVlIDoga2V5O1xuXG4gIGZvciAoY29uc3QgaXQgb2YgaXRlbXMpIHtcbiAgICBpZiAoaXQgaW5zdGFuY2VvZiBQYWlyKSB7XG4gICAgICBpZiAoaXQua2V5ID09PSBrZXkgfHwgaXQua2V5ID09PSBrKSByZXR1cm4gaXQ7XG4gICAgICBpZiAoaXQua2V5ICYmIGl0LmtleS52YWx1ZSA9PT0gaykgcmV0dXJuIGl0O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5jbGFzcyBZQU1MTWFwIGV4dGVuZHMgQ29sbGVjdGlvbiB7XG4gIGFkZChwYWlyLCBvdmVyd3JpdGUpIHtcbiAgICBpZiAoIXBhaXIpIHBhaXIgPSBuZXcgUGFpcihwYWlyKTtlbHNlIGlmICghKHBhaXIgaW5zdGFuY2VvZiBQYWlyKSkgcGFpciA9IG5ldyBQYWlyKHBhaXIua2V5IHx8IHBhaXIsIHBhaXIudmFsdWUpO1xuICAgIGNvbnN0IHByZXYgPSBmaW5kUGFpcih0aGlzLml0ZW1zLCBwYWlyLmtleSk7XG4gICAgY29uc3Qgc29ydEVudHJpZXMgPSB0aGlzLnNjaGVtYSAmJiB0aGlzLnNjaGVtYS5zb3J0TWFwRW50cmllcztcblxuICAgIGlmIChwcmV2KSB7XG4gICAgICBpZiAoIW92ZXJ3cml0ZSkgdGhyb3cgbmV3IEVycm9yKFwiS2V5IFwiLmNvbmNhdChwYWlyLmtleSwgXCIgYWxyZWFkeSBzZXRcIikpOyAvLyBGb3Igc2NhbGFycywga2VlcCB0aGUgb2xkIG5vZGUgJiBpdHMgY29tbWVudHMgYW5kIGFuY2hvcnNcblxuICAgICAgaWYgKHByZXYudmFsdWUgaW5zdGFuY2VvZiBTY2FsYXIgJiYgaXNTY2FsYXJWYWx1ZShwYWlyLnZhbHVlKSkgcHJldi52YWx1ZS52YWx1ZSA9IHBhaXIudmFsdWU7ZWxzZSBwcmV2LnZhbHVlID0gcGFpci52YWx1ZTtcbiAgICB9IGVsc2UgaWYgKHNvcnRFbnRyaWVzKSB7XG4gICAgICBjb25zdCBpID0gdGhpcy5pdGVtcy5maW5kSW5kZXgoaXRlbSA9PiBzb3J0RW50cmllcyhwYWlyLCBpdGVtKSA8IDApO1xuICAgICAgaWYgKGkgPT09IC0xKSB0aGlzLml0ZW1zLnB1c2gocGFpcik7ZWxzZSB0aGlzLml0ZW1zLnNwbGljZShpLCAwLCBwYWlyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pdGVtcy5wdXNoKHBhaXIpO1xuICAgIH1cbiAgfVxuXG4gIGRlbGV0ZShrZXkpIHtcbiAgICBjb25zdCBpdCA9IGZpbmRQYWlyKHRoaXMuaXRlbXMsIGtleSk7XG4gICAgaWYgKCFpdCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGRlbCA9IHRoaXMuaXRlbXMuc3BsaWNlKHRoaXMuaXRlbXMuaW5kZXhPZihpdCksIDEpO1xuICAgIHJldHVybiBkZWwubGVuZ3RoID4gMDtcbiAgfVxuXG4gIGdldChrZXksIGtlZXBTY2FsYXIpIHtcbiAgICBjb25zdCBpdCA9IGZpbmRQYWlyKHRoaXMuaXRlbXMsIGtleSk7XG4gICAgY29uc3Qgbm9kZSA9IGl0ICYmIGl0LnZhbHVlO1xuICAgIHJldHVybiAha2VlcFNjYWxhciAmJiBub2RlIGluc3RhbmNlb2YgU2NhbGFyID8gbm9kZS52YWx1ZSA6IG5vZGU7XG4gIH1cblxuICBoYXMoa2V5KSB7XG4gICAgcmV0dXJuICEhZmluZFBhaXIodGhpcy5pdGVtcywga2V5KTtcbiAgfVxuXG4gIHNldChrZXksIHZhbHVlKSB7XG4gICAgdGhpcy5hZGQobmV3IFBhaXIoa2V5LCB2YWx1ZSksIHRydWUpO1xuICB9XG4gIC8qKlxuICAgKiBAcGFyYW0gY3R4IC0gQ29udmVyc2lvbiBjb250ZXh0LCBvcmlnaW5hbGx5IHNldCBpbiBEb2N1bWVudCN0b0pTKClcbiAgICogQHBhcmFtIHtDbGFzc30gVHlwZSAtIElmIHNldCwgZm9yY2VzIHRoZSByZXR1cm5lZCBjb2xsZWN0aW9uIHR5cGVcbiAgICogQHJldHVybnMgSW5zdGFuY2Ugb2YgVHlwZSwgTWFwLCBvciBPYmplY3RcbiAgICovXG5cblxuICB0b0pTT04oXywgY3R4LCBUeXBlKSB7XG4gICAgY29uc3QgbWFwID0gVHlwZSA/IG5ldyBUeXBlKCkgOiBjdHggJiYgY3R4Lm1hcEFzTWFwID8gbmV3IE1hcCgpIDoge307XG4gICAgaWYgKGN0eCAmJiBjdHgub25DcmVhdGUpIGN0eC5vbkNyZWF0ZShtYXApO1xuXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuaXRlbXMpIGl0ZW0uYWRkVG9KU01hcChjdHgsIG1hcCk7XG5cbiAgICByZXR1cm4gbWFwO1xuICB9XG5cbiAgdG9TdHJpbmcoY3R4LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKSB7XG4gICAgaWYgKCFjdHgpIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzKTtcblxuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZW1zKSB7XG4gICAgICBpZiAoIShpdGVtIGluc3RhbmNlb2YgUGFpcikpIHRocm93IG5ldyBFcnJvcihcIk1hcCBpdGVtcyBtdXN0IGFsbCBiZSBwYWlyczsgZm91bmQgXCIuY29uY2F0KEpTT04uc3RyaW5naWZ5KGl0ZW0pLCBcIiBpbnN0ZWFkXCIpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3VwZXIudG9TdHJpbmcoY3R4LCB7XG4gICAgICBibG9ja0l0ZW06IG4gPT4gbi5zdHIsXG4gICAgICBmbG93Q2hhcnM6IHtcbiAgICAgICAgc3RhcnQ6ICd7JyxcbiAgICAgICAgZW5kOiAnfSdcbiAgICAgIH0sXG4gICAgICBpc01hcDogdHJ1ZSxcbiAgICAgIGl0ZW1JbmRlbnQ6IGN0eC5pbmRlbnQgfHwgJydcbiAgICB9LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKTtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IFlBTUxNYXAsIGZpbmRQYWlyIH07XG4iLCJpbXBvcnQgeyBQYWlyIH0gZnJvbSAnLi9QYWlyLmpzJztcbmltcG9ydCB7IFNjYWxhciB9IGZyb20gJy4vU2NhbGFyLmpzJztcbmltcG9ydCB7IFlBTUxNYXAgfSBmcm9tICcuL1lBTUxNYXAuanMnO1xuaW1wb3J0IHsgWUFNTFNlcSB9IGZyb20gJy4vWUFNTFNlcS5qcyc7XG5cbmNvbnN0IE1FUkdFX0tFWSA9ICc8PCc7XG5jbGFzcyBNZXJnZSBleHRlbmRzIFBhaXIge1xuICBjb25zdHJ1Y3RvcihwYWlyKSB7XG4gICAgaWYgKHBhaXIgaW5zdGFuY2VvZiBQYWlyKSB7XG4gICAgICBsZXQgc2VxID0gcGFpci52YWx1ZTtcblxuICAgICAgaWYgKCEoc2VxIGluc3RhbmNlb2YgWUFNTFNlcSkpIHtcbiAgICAgICAgc2VxID0gbmV3IFlBTUxTZXEoKTtcbiAgICAgICAgc2VxLml0ZW1zLnB1c2gocGFpci52YWx1ZSk7XG4gICAgICAgIHNlcS5yYW5nZSA9IHBhaXIudmFsdWUucmFuZ2U7XG4gICAgICB9XG5cbiAgICAgIHN1cGVyKHBhaXIua2V5LCBzZXEpO1xuICAgICAgdGhpcy5yYW5nZSA9IHBhaXIucmFuZ2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1cGVyKG5ldyBTY2FsYXIoTUVSR0VfS0VZKSwgbmV3IFlBTUxTZXEoKSk7XG4gICAgfVxuXG4gICAgdGhpcy50eXBlID0gUGFpci5UeXBlLk1FUkdFX1BBSVI7XG4gIH0gLy8gSWYgdGhlIHZhbHVlIGFzc29jaWF0ZWQgd2l0aCBhIG1lcmdlIGtleSBpcyBhIHNpbmdsZSBtYXBwaW5nIG5vZGUsIGVhY2ggb2ZcbiAgLy8gaXRzIGtleS92YWx1ZSBwYWlycyBpcyBpbnNlcnRlZCBpbnRvIHRoZSBjdXJyZW50IG1hcHBpbmcsIHVubGVzcyB0aGUga2V5XG4gIC8vIGFscmVhZHkgZXhpc3RzIGluIGl0LiBJZiB0aGUgdmFsdWUgYXNzb2NpYXRlZCB3aXRoIHRoZSBtZXJnZSBrZXkgaXMgYVxuICAvLyBzZXF1ZW5jZSwgdGhlbiB0aGlzIHNlcXVlbmNlIGlzIGV4cGVjdGVkIHRvIGNvbnRhaW4gbWFwcGluZyBub2RlcyBhbmQgZWFjaFxuICAvLyBvZiB0aGVzZSBub2RlcyBpcyBtZXJnZWQgaW4gdHVybiBhY2NvcmRpbmcgdG8gaXRzIG9yZGVyIGluIHRoZSBzZXF1ZW5jZS5cbiAgLy8gS2V5cyBpbiBtYXBwaW5nIG5vZGVzIGVhcmxpZXIgaW4gdGhlIHNlcXVlbmNlIG92ZXJyaWRlIGtleXMgc3BlY2lmaWVkIGluXG4gIC8vIGxhdGVyIG1hcHBpbmcgbm9kZXMuIC0tIGh0dHA6Ly95YW1sLm9yZy90eXBlL21lcmdlLmh0bWxcblxuXG4gIGFkZFRvSlNNYXAoY3R4LCBtYXApIHtcbiAgICBmb3IgKGNvbnN0IHtcbiAgICAgIHNvdXJjZVxuICAgIH0gb2YgdGhpcy52YWx1ZS5pdGVtcykge1xuICAgICAgaWYgKCEoc291cmNlIGluc3RhbmNlb2YgWUFNTE1hcCkpIHRocm93IG5ldyBFcnJvcignTWVyZ2Ugc291cmNlcyBtdXN0IGJlIG1hcHMnKTtcbiAgICAgIGNvbnN0IHNyY01hcCA9IHNvdXJjZS50b0pTT04obnVsbCwgY3R4LCBNYXApO1xuXG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBzcmNNYXApIHtcbiAgICAgICAgaWYgKG1hcCBpbnN0YW5jZW9mIE1hcCkge1xuICAgICAgICAgIGlmICghbWFwLmhhcyhrZXkpKSBtYXAuc2V0KGtleSwgdmFsdWUpO1xuICAgICAgICB9IGVsc2UgaWYgKG1hcCBpbnN0YW5jZW9mIFNldCkge1xuICAgICAgICAgIG1hcC5hZGQoa2V5KTtcbiAgICAgICAgfSBlbHNlIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG1hcCwga2V5KSkge1xuICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtYXAsIGtleSwge1xuICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtYXA7XG4gIH1cblxuICB0b1N0cmluZyhjdHgsIG9uQ29tbWVudCkge1xuICAgIGNvbnN0IHNlcSA9IHRoaXMudmFsdWU7XG4gICAgaWYgKHNlcS5pdGVtcy5sZW5ndGggPiAxKSByZXR1cm4gc3VwZXIudG9TdHJpbmcoY3R4LCBvbkNvbW1lbnQpO1xuICAgIHRoaXMudmFsdWUgPSBzZXEuaXRlbXNbMF07XG4gICAgY29uc3Qgc3RyID0gc3VwZXIudG9TdHJpbmcoY3R4LCBvbkNvbW1lbnQpO1xuICAgIHRoaXMudmFsdWUgPSBzZXE7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IE1FUkdFX0tFWSwgTWVyZ2UgfTtcbiIsImltcG9ydCB7IGRlZmluZVByb3BlcnR5IGFzIF9kZWZpbmVQcm9wZXJ0eSB9IGZyb20gJy4uL192aXJ0dWFsL19yb2xsdXBQbHVnaW5CYWJlbEhlbHBlcnMuanMnO1xuaW1wb3J0IHsgU2NhbGFyIH0gZnJvbSAnLi4vYXN0L1NjYWxhci5qcyc7XG5pbXBvcnQgeyBZQU1MU2VxIH0gZnJvbSAnLi4vYXN0L1lBTUxTZXEuanMnO1xuaW1wb3J0IHsgWUFNTE1hcCB9IGZyb20gJy4uL2FzdC9ZQU1MTWFwLmpzJztcbmltcG9ydCB7IEFsaWFzIH0gZnJvbSAnLi4vYXN0L0FsaWFzLmpzJztcbmltcG9ydCB7IE1lcmdlIH0gZnJvbSAnLi4vYXN0L01lcmdlLmpzJztcblxuY2xhc3MgQW5jaG9ycyB7XG4gIHN0YXRpYyB2YWxpZEFuY2hvck5vZGUobm9kZSkge1xuICAgIHJldHVybiBub2RlIGluc3RhbmNlb2YgU2NhbGFyIHx8IG5vZGUgaW5zdGFuY2VvZiBZQU1MU2VxIHx8IG5vZGUgaW5zdGFuY2VvZiBZQU1MTWFwO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHJlZml4KSB7XG4gICAgX2RlZmluZVByb3BlcnR5KHRoaXMsIFwibWFwXCIsIE9iamVjdC5jcmVhdGUobnVsbCkpO1xuXG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gIH1cblxuICBjcmVhdGVBbGlhcyhub2RlLCBuYW1lKSB7XG4gICAgdGhpcy5zZXRBbmNob3Iobm9kZSwgbmFtZSk7XG4gICAgcmV0dXJuIG5ldyBBbGlhcyhub2RlKTtcbiAgfVxuXG4gIGNyZWF0ZU1lcmdlUGFpciguLi5zb3VyY2VzKSB7XG4gICAgY29uc3QgbWVyZ2UgPSBuZXcgTWVyZ2UoKTtcbiAgICBtZXJnZS52YWx1ZS5pdGVtcyA9IHNvdXJjZXMubWFwKHMgPT4ge1xuICAgICAgaWYgKHMgaW5zdGFuY2VvZiBBbGlhcykge1xuICAgICAgICBpZiAocy5zb3VyY2UgaW5zdGFuY2VvZiBZQU1MTWFwKSByZXR1cm4gcztcbiAgICAgIH0gZWxzZSBpZiAocyBpbnN0YW5jZW9mIFlBTUxNYXApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlQWxpYXMocyk7XG4gICAgICB9XG5cbiAgICAgIHRocm93IG5ldyBFcnJvcignTWVyZ2Ugc291cmNlcyBtdXN0IGJlIE1hcCBub2RlcyBvciB0aGVpciBBbGlhc2VzJyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG1lcmdlO1xuICB9XG5cbiAgZ2V0TmFtZShub2RlKSB7XG4gICAgY29uc3Qge1xuICAgICAgbWFwXG4gICAgfSA9IHRoaXM7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKG1hcCkuZmluZChhID0+IG1hcFthXSA9PT0gbm9kZSk7XG4gIH1cblxuICBnZXROYW1lcygpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5tYXApO1xuICB9XG5cbiAgZ2V0Tm9kZShuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwW25hbWVdO1xuICB9XG5cbiAgbmV3TmFtZShwcmVmaXgpIHtcbiAgICBpZiAoIXByZWZpeCkgcHJlZml4ID0gdGhpcy5wcmVmaXg7XG4gICAgY29uc3QgbmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1hcCk7XG5cbiAgICBmb3IgKGxldCBpID0gMTsgdHJ1ZTsgKytpKSB7XG4gICAgICBjb25zdCBuYW1lID0gXCJcIi5jb25jYXQocHJlZml4KS5jb25jYXQoaSk7XG4gICAgICBpZiAoIW5hbWVzLmluY2x1ZGVzKG5hbWUpKSByZXR1cm4gbmFtZTtcbiAgICB9XG4gIH0gLy8gRHVyaW5nIHBhcnNpbmcsIG1hcCAmIGFsaWFzZXMgY29udGFpbiBDU1Qgbm9kZXNcblxuXG4gIHJlc29sdmVOb2RlcygpIHtcbiAgICBjb25zdCB7XG4gICAgICBtYXAsXG4gICAgICBfY3N0QWxpYXNlc1xuICAgIH0gPSB0aGlzO1xuICAgIE9iamVjdC5rZXlzKG1hcCkuZm9yRWFjaChhID0+IHtcbiAgICAgIG1hcFthXSA9IG1hcFthXS5yZXNvbHZlZDtcbiAgICB9KTtcblxuICAgIF9jc3RBbGlhc2VzLmZvckVhY2goYSA9PiB7XG4gICAgICBhLnNvdXJjZSA9IGEuc291cmNlLnJlc29sdmVkO1xuICAgIH0pO1xuXG4gICAgZGVsZXRlIHRoaXMuX2NzdEFsaWFzZXM7XG4gIH1cblxuICBzZXRBbmNob3Iobm9kZSwgbmFtZSkge1xuICAgIGlmIChub2RlICE9IG51bGwgJiYgIUFuY2hvcnMudmFsaWRBbmNob3JOb2RlKG5vZGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuY2hvcnMgbWF5IG9ubHkgYmUgc2V0IGZvciBTY2FsYXIsIFNlcSBhbmQgTWFwIG5vZGVzJyk7XG4gICAgfVxuXG4gICAgaWYgKG5hbWUgJiYgL1tcXHgwMC1cXHgxOVxccyxbXFxde31dLy50ZXN0KG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuY2hvciBuYW1lcyBtdXN0IG5vdCBjb250YWluIHdoaXRlc3BhY2Ugb3IgY29udHJvbCBjaGFyYWN0ZXJzJyk7XG4gICAgfVxuXG4gICAgY29uc3Qge1xuICAgICAgbWFwXG4gICAgfSA9IHRoaXM7XG4gICAgY29uc3QgcHJldiA9IG5vZGUgJiYgT2JqZWN0LmtleXMobWFwKS5maW5kKGEgPT4gbWFwW2FdID09PSBub2RlKTtcblxuICAgIGlmIChwcmV2KSB7XG4gICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHByZXY7XG4gICAgICB9IGVsc2UgaWYgKHByZXYgIT09IG5hbWUpIHtcbiAgICAgICAgZGVsZXRlIG1hcFtwcmV2XTtcbiAgICAgICAgbWFwW25hbWVdID0gbm9kZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgIGlmICghbm9kZSkgcmV0dXJuIG51bGw7XG4gICAgICAgIG5hbWUgPSB0aGlzLm5ld05hbWUoKTtcbiAgICAgIH1cblxuICAgICAgbWFwW25hbWVdID0gbm9kZTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IEFuY2hvcnMgfTtcbiIsImZ1bmN0aW9uIHN0cmluZ2lmeU51bWJlcih7XG4gIGZvcm1hdCxcbiAgbWluRnJhY3Rpb25EaWdpdHMsXG4gIHRhZyxcbiAgdmFsdWVcbn0pIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2JpZ2ludCcpIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICBpZiAoIWlzRmluaXRlKHZhbHVlKSkgcmV0dXJuIGlzTmFOKHZhbHVlKSA/ICcubmFuJyA6IHZhbHVlIDwgMCA/ICctLmluZicgOiAnLmluZic7XG4gIGxldCBuID0gSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xuXG4gIGlmICghZm9ybWF0ICYmIG1pbkZyYWN0aW9uRGlnaXRzICYmICghdGFnIHx8IHRhZyA9PT0gJ3RhZzp5YW1sLm9yZywyMDAyOmZsb2F0JykgJiYgL15cXGQvLnRlc3QobikpIHtcbiAgICBsZXQgaSA9IG4uaW5kZXhPZignLicpO1xuXG4gICAgaWYgKGkgPCAwKSB7XG4gICAgICBpID0gbi5sZW5ndGg7XG4gICAgICBuICs9ICcuJztcbiAgICB9XG5cbiAgICBsZXQgZCA9IG1pbkZyYWN0aW9uRGlnaXRzIC0gKG4ubGVuZ3RoIC0gaSAtIDEpO1xuXG4gICAgd2hpbGUgKGQtLSA+IDApIG4gKz0gJzAnO1xuICB9XG5cbiAgcmV0dXJuIG47XG59XG5cbmV4cG9ydCB7IHN0cmluZ2lmeU51bWJlciB9O1xuIiwiaW1wb3J0IHsgY3JlYXRlUGFpciB9IGZyb20gJy4uLy4uL2FzdC9QYWlyLmpzJztcbmltcG9ydCB7IFlBTUxNYXAgfSBmcm9tICcuLi8uLi9hc3QvWUFNTE1hcC5qcyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZU1hcChzY2hlbWEsIG9iaiwgY3R4KSB7XG4gIGNvbnN0IHtcbiAgICBrZWVwVW5kZWZpbmVkLFxuICAgIHJlcGxhY2VyXG4gIH0gPSBjdHg7XG4gIGNvbnN0IG1hcCA9IG5ldyBZQU1MTWFwKHNjaGVtYSk7XG5cbiAgY29uc3QgYWRkID0gKGtleSwgdmFsdWUpID0+IHtcbiAgICBpZiAodHlwZW9mIHJlcGxhY2VyID09PSAnZnVuY3Rpb24nKSB2YWx1ZSA9IHJlcGxhY2VyLmNhbGwob2JqLCBrZXksIHZhbHVlKTtlbHNlIGlmIChBcnJheS5pc0FycmF5KHJlcGxhY2VyKSAmJiAhcmVwbGFjZXIuaW5jbHVkZXMoa2V5KSkgcmV0dXJuO1xuICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkIHx8IGtlZXBVbmRlZmluZWQpIG1hcC5pdGVtcy5wdXNoKGNyZWF0ZVBhaXIoa2V5LCB2YWx1ZSwgY3R4KSk7XG4gIH07XG5cbiAgaWYgKG9iaiBpbnN0YW5jZW9mIE1hcCkge1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIG9iaikgYWRkKGtleSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG9iaikpIGFkZChrZXksIG9ialtrZXldKTtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygc2NoZW1hLnNvcnRNYXBFbnRyaWVzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgbWFwLml0ZW1zLnNvcnQoc2NoZW1hLnNvcnRNYXBFbnRyaWVzKTtcbiAgfVxuXG4gIHJldHVybiBtYXA7XG59XG5cbmNvbnN0IG1hcCA9IHtcbiAgY3JlYXRlTm9kZTogY3JlYXRlTWFwLFxuICBkZWZhdWx0OiB0cnVlLFxuICBub2RlQ2xhc3M6IFlBTUxNYXAsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOm1hcCcsXG4gIHJlc29sdmU6IG1hcCA9PiBtYXBcbn07XG5cbmV4cG9ydCB7IG1hcCB9O1xuIiwiaW1wb3J0IHsgWUFNTFNlcSB9IGZyb20gJy4uLy4uL2FzdC9ZQU1MU2VxLmpzJztcbmltcG9ydCB7IGNyZWF0ZU5vZGUgfSBmcm9tICcuLi8uLi9kb2MvY3JlYXRlTm9kZS5qcyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZVNlcShzY2hlbWEsIG9iaiwgY3R4KSB7XG4gIGNvbnN0IHtcbiAgICByZXBsYWNlclxuICB9ID0gY3R4O1xuICBjb25zdCBzZXEgPSBuZXcgWUFNTFNlcShzY2hlbWEpO1xuXG4gIGlmIChvYmogJiYgb2JqW1N5bWJvbC5pdGVyYXRvcl0pIHtcbiAgICBsZXQgaSA9IDA7XG5cbiAgICBmb3IgKGxldCBpdCBvZiBvYmopIHtcbiAgICAgIGlmICh0eXBlb2YgcmVwbGFjZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY29uc3Qga2V5ID0gb2JqIGluc3RhbmNlb2YgU2V0ID8gaXQgOiBTdHJpbmcoaSsrKTtcbiAgICAgICAgaXQgPSByZXBsYWNlci5jYWxsKG9iaiwga2V5LCBpdCk7XG4gICAgICB9XG5cbiAgICAgIHNlcS5pdGVtcy5wdXNoKGNyZWF0ZU5vZGUoaXQsIG51bGwsIGN0eCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBzZXE7XG59XG5cbmNvbnN0IHNlcSA9IHtcbiAgY3JlYXRlTm9kZTogY3JlYXRlU2VxLFxuICBkZWZhdWx0OiB0cnVlLFxuICBub2RlQ2xhc3M6IFlBTUxTZXEsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOnNlcScsXG4gIHJlc29sdmU6IHNlcSA9PiBzZXFcbn07XG5cbmV4cG9ydCB7IHNlcSB9O1xuIiwiaW1wb3J0IHsgc3RyaW5naWZ5U3RyaW5nIH0gZnJvbSAnLi4vLi4vc3RyaW5naWZ5L3N0cmluZ2lmeVN0cmluZy5qcyc7XG5pbXBvcnQgeyBzdHJPcHRpb25zIH0gZnJvbSAnLi4vb3B0aW9ucy5qcyc7XG5cbmNvbnN0IHN0cmluZyA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOnN0cicsXG4gIHJlc29sdmU6IHN0ciA9PiBzdHIsXG5cbiAgc3RyaW5naWZ5KGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCkge1xuICAgIGN0eCA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgYWN0dWFsU3RyaW5nOiB0cnVlXG4gICAgfSwgY3R4KTtcbiAgICByZXR1cm4gc3RyaW5naWZ5U3RyaW5nKGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCk7XG4gIH0sXG5cbiAgb3B0aW9uczogc3RyT3B0aW9uc1xufTtcblxuZXhwb3J0IHsgc3RyaW5nIH07XG4iLCJpbXBvcnQgeyBtYXAgfSBmcm9tICcuL21hcC5qcyc7XG5pbXBvcnQgeyBzZXEgfSBmcm9tICcuL3NlcS5qcyc7XG5pbXBvcnQgeyBzdHJpbmcgfSBmcm9tICcuL3N0cmluZy5qcyc7XG5cbmNvbnN0IGZhaWxzYWZlID0gW21hcCwgc2VxLCBzdHJpbmddO1xuXG5leHBvcnQgeyBmYWlsc2FmZSB9O1xuIiwiaW1wb3J0IHsgU2NhbGFyIH0gZnJvbSAnLi4vYXN0L1NjYWxhci5qcyc7XG5pbXBvcnQgeyBzdHJpbmdpZnlOdW1iZXIgfSBmcm9tICcuLi9zdHJpbmdpZnkvc3RyaW5naWZ5TnVtYmVyLmpzJztcbmltcG9ydCB7IGZhaWxzYWZlIH0gZnJvbSAnLi9mYWlsc2FmZS9pbmRleC5qcyc7XG5pbXBvcnQgeyBudWxsT3B0aW9ucywgYm9vbE9wdGlvbnMsIGludE9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMuanMnO1xuXG4vKiBnbG9iYWwgQmlnSW50ICovXG5cbmNvbnN0IGludElkZW50aWZ5ID0gdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnYmlnaW50JyB8fCBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKTtcblxuY29uc3QgaW50UmVzb2x2ZSA9IChzcmMsIG9mZnNldCwgcmFkaXgpID0+IGludE9wdGlvbnMuYXNCaWdJbnQgPyBCaWdJbnQoc3JjKSA6IHBhcnNlSW50KHNyYy5zdWJzdHJpbmcob2Zmc2V0KSwgcmFkaXgpO1xuXG5mdW5jdGlvbiBpbnRTdHJpbmdpZnkobm9kZSwgcmFkaXgsIHByZWZpeCkge1xuICBjb25zdCB7XG4gICAgdmFsdWVcbiAgfSA9IG5vZGU7XG4gIGlmIChpbnRJZGVudGlmeSh2YWx1ZSkgJiYgdmFsdWUgPj0gMCkgcmV0dXJuIHByZWZpeCArIHZhbHVlLnRvU3RyaW5nKHJhZGl4KTtcbiAgcmV0dXJuIHN0cmluZ2lmeU51bWJlcihub2RlKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5Qm9vbChub2RlKSB7XG4gIGNvbnN0IHtcbiAgICB2YWx1ZSxcbiAgICBzb3VyY2VTdHJcbiAgfSA9IG5vZGU7XG5cbiAgaWYgKHNvdXJjZVN0cikge1xuICAgIGNvbnN0IG1hdGNoID0gYm9vbE9iai50ZXN0LnRlc3Qoc291cmNlU3RyKTtcbiAgICBpZiAobWF0Y2ggJiYgdmFsdWUgPT09IChzb3VyY2VTdHJbMF0gPT09ICd0JyB8fCBzb3VyY2VTdHJbMF0gPT09ICdUJykpIHJldHVybiBzb3VyY2VTdHI7XG4gIH1cblxuICByZXR1cm4gdmFsdWUgPyBib29sT3B0aW9ucy50cnVlU3RyIDogYm9vbE9wdGlvbnMuZmFsc2VTdHI7XG59XG5cbmNvbnN0IG51bGxPYmogPSB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB2YWx1ZSA9PSBudWxsLFxuICBjcmVhdGVOb2RlOiAoc2NoZW1hLCB2YWx1ZSwgY3R4KSA9PiBjdHgud3JhcFNjYWxhcnMgPyBuZXcgU2NhbGFyKG51bGwpIDogbnVsbCxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6bnVsbCcsXG4gIHRlc3Q6IC9eKD86fnxbTm5ddWxsfE5VTEwpPyQvLFxuICByZXNvbHZlOiBzdHIgPT4ge1xuICAgIGNvbnN0IG5vZGUgPSBuZXcgU2NhbGFyKG51bGwpO1xuICAgIG5vZGUuc291cmNlU3RyID0gc3RyO1xuICAgIHJldHVybiBub2RlO1xuICB9LFxuICBvcHRpb25zOiBudWxsT3B0aW9ucyxcbiAgc3RyaW5naWZ5OiAoe1xuICAgIHNvdXJjZVN0clxuICB9KSA9PiBzb3VyY2VTdHIgIT09IG51bGwgJiYgc291cmNlU3RyICE9PSB2b2lkIDAgPyBzb3VyY2VTdHIgOiBudWxsT3B0aW9ucy5udWxsU3RyXG59O1xuY29uc3QgYm9vbE9iaiA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpib29sJyxcbiAgdGVzdDogL14oPzpbVHRdcnVlfFRSVUV8W0ZmXWFsc2V8RkFMU0UpJC8sXG4gIHJlc29sdmU6IHN0ciA9PiB7XG4gICAgY29uc3Qgbm9kZSA9IG5ldyBTY2FsYXIoc3RyWzBdID09PSAndCcgfHwgc3RyWzBdID09PSAnVCcpO1xuICAgIG5vZGUuc291cmNlU3RyID0gc3RyO1xuICAgIHJldHVybiBub2RlO1xuICB9LFxuICBvcHRpb25zOiBib29sT3B0aW9ucyxcbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlCb29sXG59O1xuY29uc3Qgb2N0T2JqID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gaW50SWRlbnRpZnkodmFsdWUpICYmIHZhbHVlID49IDAsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmludCcsXG4gIGZvcm1hdDogJ09DVCcsXG4gIHRlc3Q6IC9eMG9bMC03XSskLyxcbiAgcmVzb2x2ZTogc3RyID0+IGludFJlc29sdmUoc3RyLCAyLCA4KSxcbiAgb3B0aW9uczogaW50T3B0aW9ucyxcbiAgc3RyaW5naWZ5OiBub2RlID0+IGludFN0cmluZ2lmeShub2RlLCA4LCAnMG8nKVxufTtcbmNvbnN0IGludE9iaiA9IHtcbiAgaWRlbnRpZnk6IGludElkZW50aWZ5LFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjppbnQnLFxuICB0ZXN0OiAvXlstK10/WzAtOV0rJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBpbnRSZXNvbHZlKHN0ciwgMCwgMTApLFxuICBvcHRpb25zOiBpbnRPcHRpb25zLFxuICBzdHJpbmdpZnk6IHN0cmluZ2lmeU51bWJlclxufTtcbmNvbnN0IGhleE9iaiA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IGludElkZW50aWZ5KHZhbHVlKSAmJiB2YWx1ZSA+PSAwLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjppbnQnLFxuICBmb3JtYXQ6ICdIRVgnLFxuICB0ZXN0OiAvXjB4WzAtOWEtZkEtRl0rJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBpbnRSZXNvbHZlKHN0ciwgMiwgMTYpLFxuICBvcHRpb25zOiBpbnRPcHRpb25zLFxuICBzdHJpbmdpZnk6IG5vZGUgPT4gaW50U3RyaW5naWZ5KG5vZGUsIDE2LCAnMHgnKVxufTtcbmNvbnN0IG5hbk9iaiA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmZsb2F0JyxcbiAgdGVzdDogL14oPzpbLStdP1xcLig/OmluZnxJbmZ8SU5GfG5hbnxOYU58TkFOKSkkLyxcbiAgcmVzb2x2ZTogc3RyID0+IHN0ci5zbGljZSgtMykudG9Mb3dlckNhc2UoKSA9PT0gJ25hbicgPyBOYU4gOiBzdHJbMF0gPT09ICctJyA/IE51bWJlci5ORUdBVElWRV9JTkZJTklUWSA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSxcbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlOdW1iZXJcbn07XG5jb25zdCBleHBPYmogPSB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpmbG9hdCcsXG4gIGZvcm1hdDogJ0VYUCcsXG4gIHRlc3Q6IC9eWy0rXT8oPzpcXC5bMC05XSt8WzAtOV0rKD86XFwuWzAtOV0qKT8pW2VFXVstK10/WzAtOV0rJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBwYXJzZUZsb2F0KHN0ciksXG4gIHN0cmluZ2lmeTogKHtcbiAgICB2YWx1ZVxuICB9KSA9PiBOdW1iZXIodmFsdWUpLnRvRXhwb25lbnRpYWwoKVxufTtcbmNvbnN0IGZsb2F0T2JqID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6ZmxvYXQnLFxuICB0ZXN0OiAvXlstK10/KD86XFwuWzAtOV0rfFswLTldK1xcLlswLTldKikkLyxcblxuICByZXNvbHZlKHN0cikge1xuICAgIGNvbnN0IG5vZGUgPSBuZXcgU2NhbGFyKHBhcnNlRmxvYXQoc3RyKSk7XG4gICAgY29uc3QgZG90ID0gc3RyLmluZGV4T2YoJy4nKTtcbiAgICBpZiAoZG90ICE9PSAtMSAmJiBzdHJbc3RyLmxlbmd0aCAtIDFdID09PSAnMCcpIG5vZGUubWluRnJhY3Rpb25EaWdpdHMgPSBzdHIubGVuZ3RoIC0gZG90IC0gMTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfSxcblxuICBzdHJpbmdpZnk6IHN0cmluZ2lmeU51bWJlclxufTtcbmNvbnN0IGNvcmUgPSBmYWlsc2FmZS5jb25jYXQoW251bGxPYmosIGJvb2xPYmosIG9jdE9iaiwgaW50T2JqLCBoZXhPYmosIG5hbk9iaiwgZXhwT2JqLCBmbG9hdE9ial0pO1xuXG5leHBvcnQgeyBib29sT2JqLCBjb3JlLCBleHBPYmosIGZsb2F0T2JqLCBoZXhPYmosIGludE9iaiwgbmFuT2JqLCBudWxsT2JqLCBvY3RPYmogfTtcbiIsImltcG9ydCB7IFNjYWxhciB9IGZyb20gJy4uL2FzdC9TY2FsYXIuanMnO1xuaW1wb3J0IHsgbWFwIH0gZnJvbSAnLi9mYWlsc2FmZS9tYXAuanMnO1xuaW1wb3J0IHsgc2VxIH0gZnJvbSAnLi9mYWlsc2FmZS9zZXEuanMnO1xuaW1wb3J0IHsgaW50T3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucy5qcyc7XG5cbi8qIGdsb2JhbCBCaWdJbnQgKi9cblxuY29uc3QgaW50SWRlbnRpZnkgPSB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdiaWdpbnQnIHx8IE51bWJlci5pc0ludGVnZXIodmFsdWUpO1xuXG5jb25zdCBzdHJpbmdpZnlKU09OID0gKHtcbiAgdmFsdWVcbn0pID0+IEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcblxuY29uc3QganNvbiA9IFttYXAsIHNlcSwge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6c3RyJyxcbiAgcmVzb2x2ZTogc3RyID0+IHN0cixcbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlKU09OXG59LCB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB2YWx1ZSA9PSBudWxsLFxuICBjcmVhdGVOb2RlOiAoc2NoZW1hLCB2YWx1ZSwgY3R4KSA9PiBjdHgud3JhcFNjYWxhcnMgPyBuZXcgU2NhbGFyKG51bGwpIDogbnVsbCxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6bnVsbCcsXG4gIHRlc3Q6IC9ebnVsbCQvLFxuICByZXNvbHZlOiAoKSA9PiBudWxsLFxuICBzdHJpbmdpZnk6IHN0cmluZ2lmeUpTT05cbn0sIHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpib29sJyxcbiAgdGVzdDogL150cnVlfGZhbHNlJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBzdHIgPT09ICd0cnVlJyxcbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlKU09OXG59LCB7XG4gIGlkZW50aWZ5OiBpbnRJZGVudGlmeSxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6aW50JyxcbiAgdGVzdDogL14tPyg/OjB8WzEtOV1bMC05XSopJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBpbnRPcHRpb25zLmFzQmlnSW50ID8gQmlnSW50KHN0cikgOiBwYXJzZUludChzdHIsIDEwKSxcbiAgc3RyaW5naWZ5OiAoe1xuICAgIHZhbHVlXG4gIH0pID0+IGludElkZW50aWZ5KHZhbHVlKSA/IHZhbHVlLnRvU3RyaW5nKCkgOiBKU09OLnN0cmluZ2lmeSh2YWx1ZSlcbn0sIHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmZsb2F0JyxcbiAgdGVzdDogL14tPyg/OjB8WzEtOV1bMC05XSopKD86XFwuWzAtOV0qKT8oPzpbZUVdWy0rXT9bMC05XSspPyQvLFxuICByZXNvbHZlOiBzdHIgPT4gcGFyc2VGbG9hdChzdHIpLFxuICBzdHJpbmdpZnk6IHN0cmluZ2lmeUpTT05cbn0sIHtcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGVzdDogL14vLFxuXG4gIHJlc29sdmUoc3RyLCBvbkVycm9yKSB7XG4gICAgb25FcnJvcihcIlVucmVzb2x2ZWQgcGxhaW4gc2NhbGFyIFwiLmNvbmNhdChKU09OLnN0cmluZ2lmeShzdHIpKSk7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuXG59XTtcblxuZXhwb3J0IHsganNvbiB9O1xuIiwiaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uLy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBzdHJpbmdpZnlTdHJpbmcgfSBmcm9tICcuLi8uLi9zdHJpbmdpZnkvc3RyaW5naWZ5U3RyaW5nLmpzJztcbmltcG9ydCB7IGJpbmFyeU9wdGlvbnMgfSBmcm9tICcuLi9vcHRpb25zLmpzJztcblxuLyogZ2xvYmFsIGF0b2IsIGJ0b2EsIEJ1ZmZlciAqL1xuY29uc3QgYmluYXJ5ID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdmFsdWUgaW5zdGFuY2VvZiBVaW50OEFycmF5LFxuICAvLyBCdWZmZXIgaW5oZXJpdHMgZnJvbSBVaW50OEFycmF5XG4gIGRlZmF1bHQ6IGZhbHNlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpiaW5hcnknLFxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgQnVmZmVyIGluIG5vZGUgYW5kIGFuIFVpbnQ4QXJyYXkgaW4gYnJvd3NlcnNcbiAgICpcbiAgICogVG8gdXNlIHRoZSByZXN1bHRpbmcgYnVmZmVyIGFzIGFuIGltYWdlLCB5b3UnbGwgd2FudCB0byBkbyBzb21ldGhpbmcgbGlrZTpcbiAgICpcbiAgICogICBjb25zdCBibG9iID0gbmV3IEJsb2IoW2J1ZmZlcl0sIHsgdHlwZTogJ2ltYWdlL2pwZWcnIH0pXG4gICAqICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3Bob3RvJykuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKVxuICAgKi9cbiAgcmVzb2x2ZShzcmMsIG9uRXJyb3IpIHtcbiAgICBpZiAodHlwZW9mIEJ1ZmZlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHNyYywgJ2Jhc2U2NCcpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGF0b2IgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIE9uIElFIDExLCBhdG9iKCkgY2FuJ3QgaGFuZGxlIG5ld2xpbmVzXG4gICAgICBjb25zdCBzdHIgPSBhdG9iKHNyYy5yZXBsYWNlKC9bXFxuXFxyXS9nLCAnJykpO1xuICAgICAgY29uc3QgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoc3RyLmxlbmd0aCk7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSBidWZmZXJbaV0gPSBzdHIuY2hhckNvZGVBdChpKTtcblxuICAgICAgcmV0dXJuIGJ1ZmZlcjtcbiAgICB9IGVsc2Uge1xuICAgICAgb25FcnJvcignVGhpcyBlbnZpcm9ubWVudCBkb2VzIG5vdCBzdXBwb3J0IHJlYWRpbmcgYmluYXJ5IHRhZ3M7IGVpdGhlciBCdWZmZXIgb3IgYXRvYiBpcyByZXF1aXJlZCcpO1xuICAgICAgcmV0dXJuIHNyYztcbiAgICB9XG4gIH0sXG5cbiAgb3B0aW9uczogYmluYXJ5T3B0aW9ucyxcbiAgc3RyaW5naWZ5OiAoe1xuICAgIGNvbW1lbnQsXG4gICAgdHlwZSxcbiAgICB2YWx1ZVxuICB9LCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApID0+IHtcbiAgICBsZXQgc3JjO1xuXG4gICAgaWYgKHR5cGVvZiBCdWZmZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHNyYyA9IHZhbHVlIGluc3RhbmNlb2YgQnVmZmVyID8gdmFsdWUudG9TdHJpbmcoJ2Jhc2U2NCcpIDogQnVmZmVyLmZyb20odmFsdWUuYnVmZmVyKS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYnRvYSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgbGV0IHMgPSAnJztcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7ICsraSkgcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHZhbHVlW2ldKTtcblxuICAgICAgc3JjID0gYnRvYShzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGlzIGVudmlyb25tZW50IGRvZXMgbm90IHN1cHBvcnQgd3JpdGluZyBiaW5hcnkgdGFnczsgZWl0aGVyIEJ1ZmZlciBvciBidG9hIGlzIHJlcXVpcmVkJyk7XG4gICAgfVxuXG4gICAgaWYgKCF0eXBlKSB0eXBlID0gYmluYXJ5T3B0aW9ucy5kZWZhdWx0VHlwZTtcblxuICAgIGlmICh0eXBlID09PSBUeXBlLlFVT1RFX0RPVUJMRSkge1xuICAgICAgdmFsdWUgPSBzcmM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbGluZVdpZHRoXG4gICAgICB9ID0gYmluYXJ5T3B0aW9ucztcbiAgICAgIGNvbnN0IG4gPSBNYXRoLmNlaWwoc3JjLmxlbmd0aCAvIGxpbmVXaWR0aCk7XG4gICAgICBjb25zdCBsaW5lcyA9IG5ldyBBcnJheShuKTtcblxuICAgICAgZm9yIChsZXQgaSA9IDAsIG8gPSAwOyBpIDwgbjsgKytpLCBvICs9IGxpbmVXaWR0aCkge1xuICAgICAgICBsaW5lc1tpXSA9IHNyYy5zdWJzdHIobywgbGluZVdpZHRoKTtcbiAgICAgIH1cblxuICAgICAgdmFsdWUgPSBsaW5lcy5qb2luKHR5cGUgPT09IFR5cGUuQkxPQ0tfTElURVJBTCA/ICdcXG4nIDogJyAnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RyaW5naWZ5U3RyaW5nKHtcbiAgICAgIGNvbW1lbnQsXG4gICAgICB0eXBlLFxuICAgICAgdmFsdWVcbiAgICB9LCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApO1xuICB9XG59O1xuXG5leHBvcnQgeyBiaW5hcnkgfTtcbiIsImltcG9ydCB7IFBhaXIsIGNyZWF0ZVBhaXIgfSBmcm9tICcuLi8uLi9hc3QvUGFpci5qcyc7XG5pbXBvcnQgeyBZQU1MTWFwIH0gZnJvbSAnLi4vLi4vYXN0L1lBTUxNYXAuanMnO1xuaW1wb3J0IHsgWUFNTFNlcSB9IGZyb20gJy4uLy4uL2FzdC9ZQU1MU2VxLmpzJztcblxuZnVuY3Rpb24gcGFyc2VQYWlycyhzZXEsIG9uRXJyb3IpIHtcbiAgaWYgKHNlcSBpbnN0YW5jZW9mIFlBTUxTZXEpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlcS5pdGVtcy5sZW5ndGg7ICsraSkge1xuICAgICAgbGV0IGl0ZW0gPSBzZXEuaXRlbXNbaV07XG4gICAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIFBhaXIpIGNvbnRpbnVlO2Vsc2UgaWYgKGl0ZW0gaW5zdGFuY2VvZiBZQU1MTWFwKSB7XG4gICAgICAgIGlmIChpdGVtLml0ZW1zLmxlbmd0aCA+IDEpIG9uRXJyb3IoJ0VhY2ggcGFpciBtdXN0IGhhdmUgaXRzIG93biBzZXF1ZW5jZSBpbmRpY2F0b3InKTtcbiAgICAgICAgY29uc3QgcGFpciA9IGl0ZW0uaXRlbXNbMF0gfHwgbmV3IFBhaXIoKTtcbiAgICAgICAgaWYgKGl0ZW0uY29tbWVudEJlZm9yZSkgcGFpci5jb21tZW50QmVmb3JlID0gcGFpci5jb21tZW50QmVmb3JlID8gXCJcIi5jb25jYXQoaXRlbS5jb21tZW50QmVmb3JlLCBcIlxcblwiKS5jb25jYXQocGFpci5jb21tZW50QmVmb3JlKSA6IGl0ZW0uY29tbWVudEJlZm9yZTtcbiAgICAgICAgaWYgKGl0ZW0uY29tbWVudCkgcGFpci5jb21tZW50ID0gcGFpci5jb21tZW50ID8gXCJcIi5jb25jYXQoaXRlbS5jb21tZW50LCBcIlxcblwiKS5jb25jYXQocGFpci5jb21tZW50KSA6IGl0ZW0uY29tbWVudDtcbiAgICAgICAgaXRlbSA9IHBhaXI7XG4gICAgICB9XG4gICAgICBzZXEuaXRlbXNbaV0gPSBpdGVtIGluc3RhbmNlb2YgUGFpciA/IGl0ZW0gOiBuZXcgUGFpcihpdGVtKTtcbiAgICB9XG4gIH0gZWxzZSBvbkVycm9yKCdFeHBlY3RlZCBhIHNlcXVlbmNlIGZvciB0aGlzIHRhZycpO1xuXG4gIHJldHVybiBzZXE7XG59XG5mdW5jdGlvbiBjcmVhdGVQYWlycyhzY2hlbWEsIGl0ZXJhYmxlLCBjdHgpIHtcbiAgY29uc3Qge1xuICAgIHJlcGxhY2VyXG4gIH0gPSBjdHg7XG4gIGNvbnN0IHBhaXJzID0gbmV3IFlBTUxTZXEoc2NoZW1hKTtcbiAgcGFpcnMudGFnID0gJ3RhZzp5YW1sLm9yZywyMDAyOnBhaXJzJztcbiAgbGV0IGkgPSAwO1xuXG4gIGZvciAobGV0IGl0IG9mIGl0ZXJhYmxlKSB7XG4gICAgaWYgKHR5cGVvZiByZXBsYWNlciA9PT0gJ2Z1bmN0aW9uJykgaXQgPSByZXBsYWNlci5jYWxsKGl0ZXJhYmxlLCBTdHJpbmcoaSsrKSwgaXQpO1xuICAgIGxldCBrZXksIHZhbHVlO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoaXQpKSB7XG4gICAgICBpZiAoaXQubGVuZ3RoID09PSAyKSB7XG4gICAgICAgIGtleSA9IGl0WzBdO1xuICAgICAgICB2YWx1ZSA9IGl0WzFdO1xuICAgICAgfSBlbHNlIHRocm93IG5ldyBUeXBlRXJyb3IoXCJFeHBlY3RlZCBba2V5LCB2YWx1ZV0gdHVwbGU6IFwiLmNvbmNhdChpdCkpO1xuICAgIH0gZWxzZSBpZiAoaXQgJiYgaXQgaW5zdGFuY2VvZiBPYmplY3QpIHtcbiAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhpdCk7XG5cbiAgICAgIGlmIChrZXlzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBrZXkgPSBrZXlzWzBdO1xuICAgICAgICB2YWx1ZSA9IGl0W2tleV07XG4gICAgICB9IGVsc2UgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkV4cGVjdGVkIHsga2V5OiB2YWx1ZSB9IHR1cGxlOiBcIi5jb25jYXQoaXQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAga2V5ID0gaXQ7XG4gICAgfVxuXG4gICAgcGFpcnMuaXRlbXMucHVzaChjcmVhdGVQYWlyKGtleSwgdmFsdWUsIGN0eCkpO1xuICB9XG5cbiAgcmV0dXJuIHBhaXJzO1xufVxuY29uc3QgcGFpcnMgPSB7XG4gIGRlZmF1bHQ6IGZhbHNlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpwYWlycycsXG4gIHJlc29sdmU6IHBhcnNlUGFpcnMsXG4gIGNyZWF0ZU5vZGU6IGNyZWF0ZVBhaXJzXG59O1xuXG5leHBvcnQgeyBjcmVhdGVQYWlycywgcGFpcnMsIHBhcnNlUGFpcnMgfTtcbiIsImltcG9ydCB7IGRlZmluZVByb3BlcnR5IGFzIF9kZWZpbmVQcm9wZXJ0eSB9IGZyb20gJy4uLy4uL192aXJ0dWFsL19yb2xsdXBQbHVnaW5CYWJlbEhlbHBlcnMuanMnO1xuaW1wb3J0IHsgUGFpciB9IGZyb20gJy4uLy4uL2FzdC9QYWlyLmpzJztcbmltcG9ydCB7IFNjYWxhciB9IGZyb20gJy4uLy4uL2FzdC9TY2FsYXIuanMnO1xuaW1wb3J0IHsgWUFNTE1hcCB9IGZyb20gJy4uLy4uL2FzdC9ZQU1MTWFwLmpzJztcbmltcG9ydCB7IFlBTUxTZXEgfSBmcm9tICcuLi8uLi9hc3QvWUFNTFNlcS5qcyc7XG5pbXBvcnQgeyB0b0pTIH0gZnJvbSAnLi4vLi4vYXN0L3RvSlMuanMnO1xuaW1wb3J0IHsgcGFyc2VQYWlycywgY3JlYXRlUGFpcnMgfSBmcm9tICcuL3BhaXJzLmpzJztcblxuY2xhc3MgWUFNTE9NYXAgZXh0ZW5kcyBZQU1MU2VxIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIF9kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImFkZFwiLCBZQU1MTWFwLnByb3RvdHlwZS5hZGQuYmluZCh0aGlzKSk7XG5cbiAgICBfZGVmaW5lUHJvcGVydHkodGhpcywgXCJkZWxldGVcIiwgWUFNTE1hcC5wcm90b3R5cGUuZGVsZXRlLmJpbmQodGhpcykpO1xuXG4gICAgX2RlZmluZVByb3BlcnR5KHRoaXMsIFwiZ2V0XCIsIFlBTUxNYXAucHJvdG90eXBlLmdldC5iaW5kKHRoaXMpKTtcblxuICAgIF9kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImhhc1wiLCBZQU1MTWFwLnByb3RvdHlwZS5oYXMuYmluZCh0aGlzKSk7XG5cbiAgICBfZGVmaW5lUHJvcGVydHkodGhpcywgXCJzZXRcIiwgWUFNTE1hcC5wcm90b3R5cGUuc2V0LmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy50YWcgPSBZQU1MT01hcC50YWc7XG4gIH1cblxuICB0b0pTT04oXywgY3R4KSB7XG4gICAgY29uc3QgbWFwID0gbmV3IE1hcCgpO1xuICAgIGlmIChjdHggJiYgY3R4Lm9uQ3JlYXRlKSBjdHgub25DcmVhdGUobWFwKTtcblxuICAgIGZvciAoY29uc3QgcGFpciBvZiB0aGlzLml0ZW1zKSB7XG4gICAgICBsZXQga2V5LCB2YWx1ZTtcblxuICAgICAgaWYgKHBhaXIgaW5zdGFuY2VvZiBQYWlyKSB7XG4gICAgICAgIGtleSA9IHRvSlMocGFpci5rZXksICcnLCBjdHgpO1xuICAgICAgICB2YWx1ZSA9IHRvSlMocGFpci52YWx1ZSwga2V5LCBjdHgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAga2V5ID0gdG9KUyhwYWlyLCAnJywgY3R4KTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1hcC5oYXMoa2V5KSkgdGhyb3cgbmV3IEVycm9yKCdPcmRlcmVkIG1hcHMgbXVzdCBub3QgaW5jbHVkZSBkdXBsaWNhdGUga2V5cycpO1xuICAgICAgbWFwLnNldChrZXksIHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbWFwO1xuICB9XG5cbn1cblxuX2RlZmluZVByb3BlcnR5KFlBTUxPTWFwLCBcInRhZ1wiLCAndGFnOnlhbWwub3JnLDIwMDI6b21hcCcpO1xuXG5mdW5jdGlvbiBwYXJzZU9NYXAoc2VxLCBvbkVycm9yKSB7XG4gIGNvbnN0IHBhaXJzID0gcGFyc2VQYWlycyhzZXEsIG9uRXJyb3IpO1xuICBjb25zdCBzZWVuS2V5cyA9IFtdO1xuXG4gIGZvciAoY29uc3Qge1xuICAgIGtleVxuICB9IG9mIHBhaXJzLml0ZW1zKSB7XG4gICAgaWYgKGtleSBpbnN0YW5jZW9mIFNjYWxhcikge1xuICAgICAgaWYgKHNlZW5LZXlzLmluY2x1ZGVzKGtleS52YWx1ZSkpIHtcbiAgICAgICAgb25FcnJvcihcIk9yZGVyZWQgbWFwcyBtdXN0IG5vdCBpbmNsdWRlIGR1cGxpY2F0ZSBrZXlzOiBcIi5jb25jYXQoa2V5LnZhbHVlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWVuS2V5cy5wdXNoKGtleS52YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24obmV3IFlBTUxPTWFwKCksIHBhaXJzKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlT01hcChzY2hlbWEsIGl0ZXJhYmxlLCBjdHgpIHtcbiAgY29uc3QgcGFpcnMgPSBjcmVhdGVQYWlycyhzY2hlbWEsIGl0ZXJhYmxlLCBjdHgpO1xuICBjb25zdCBvbWFwID0gbmV3IFlBTUxPTWFwKCk7XG4gIG9tYXAuaXRlbXMgPSBwYWlycy5pdGVtcztcbiAgcmV0dXJuIG9tYXA7XG59XG5cbmNvbnN0IG9tYXAgPSB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB2YWx1ZSBpbnN0YW5jZW9mIE1hcCxcbiAgbm9kZUNsYXNzOiBZQU1MT01hcCxcbiAgZGVmYXVsdDogZmFsc2UsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOm9tYXAnLFxuICByZXNvbHZlOiBwYXJzZU9NYXAsXG4gIGNyZWF0ZU5vZGU6IGNyZWF0ZU9NYXBcbn07XG5cbmV4cG9ydCB7IFlBTUxPTWFwLCBvbWFwIH07XG4iLCJpbXBvcnQgeyBkZWZpbmVQcm9wZXJ0eSBhcyBfZGVmaW5lUHJvcGVydHkgfSBmcm9tICcuLi8uLi9fdmlydHVhbC9fcm9sbHVwUGx1Z2luQmFiZWxIZWxwZXJzLmpzJztcbmltcG9ydCB7IFBhaXIsIGNyZWF0ZVBhaXIgfSBmcm9tICcuLi8uLi9hc3QvUGFpci5qcyc7XG5pbXBvcnQgeyBTY2FsYXIgfSBmcm9tICcuLi8uLi9hc3QvU2NhbGFyLmpzJztcbmltcG9ydCB7IFlBTUxNYXAsIGZpbmRQYWlyIH0gZnJvbSAnLi4vLi4vYXN0L1lBTUxNYXAuanMnO1xuXG5jbGFzcyBZQU1MU2V0IGV4dGVuZHMgWUFNTE1hcCB7XG4gIGNvbnN0cnVjdG9yKHNjaGVtYSkge1xuICAgIHN1cGVyKHNjaGVtYSk7XG4gICAgdGhpcy50YWcgPSBZQU1MU2V0LnRhZztcbiAgfVxuXG4gIGFkZChrZXkpIHtcbiAgICBjb25zdCBwYWlyID0ga2V5IGluc3RhbmNlb2YgUGFpciA/IGtleSA6IG5ldyBQYWlyKGtleSk7XG4gICAgY29uc3QgcHJldiA9IGZpbmRQYWlyKHRoaXMuaXRlbXMsIHBhaXIua2V5KTtcbiAgICBpZiAoIXByZXYpIHRoaXMuaXRlbXMucHVzaChwYWlyKTtcbiAgfVxuXG4gIGdldChrZXksIGtlZXBQYWlyKSB7XG4gICAgY29uc3QgcGFpciA9IGZpbmRQYWlyKHRoaXMuaXRlbXMsIGtleSk7XG4gICAgcmV0dXJuICFrZWVwUGFpciAmJiBwYWlyIGluc3RhbmNlb2YgUGFpciA/IHBhaXIua2V5IGluc3RhbmNlb2YgU2NhbGFyID8gcGFpci5rZXkudmFsdWUgOiBwYWlyLmtleSA6IHBhaXI7XG4gIH1cblxuICBzZXQoa2V5LCB2YWx1ZSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdib29sZWFuJykgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgYm9vbGVhbiB2YWx1ZSBmb3Igc2V0KGtleSwgdmFsdWUpIGluIGEgWUFNTCBzZXQsIG5vdCBcIi5jb25jYXQodHlwZW9mIHZhbHVlKSk7XG4gICAgY29uc3QgcHJldiA9IGZpbmRQYWlyKHRoaXMuaXRlbXMsIGtleSk7XG5cbiAgICBpZiAocHJldiAmJiAhdmFsdWUpIHtcbiAgICAgIHRoaXMuaXRlbXMuc3BsaWNlKHRoaXMuaXRlbXMuaW5kZXhPZihwcmV2KSwgMSk7XG4gICAgfSBlbHNlIGlmICghcHJldiAmJiB2YWx1ZSkge1xuICAgICAgdGhpcy5pdGVtcy5wdXNoKG5ldyBQYWlyKGtleSkpO1xuICAgIH1cbiAgfVxuXG4gIHRvSlNPTihfLCBjdHgpIHtcbiAgICByZXR1cm4gc3VwZXIudG9KU09OKF8sIGN0eCwgU2V0KTtcbiAgfVxuXG4gIHRvU3RyaW5nKGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCkge1xuICAgIGlmICghY3R4KSByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcyk7XG4gICAgaWYgKHRoaXMuaGFzQWxsTnVsbFZhbHVlcygpKSByZXR1cm4gc3VwZXIudG9TdHJpbmcoY3R4LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKTtlbHNlIHRocm93IG5ldyBFcnJvcignU2V0IGl0ZW1zIG11c3QgYWxsIGhhdmUgbnVsbCB2YWx1ZXMnKTtcbiAgfVxuXG59XG5cbl9kZWZpbmVQcm9wZXJ0eShZQU1MU2V0LCBcInRhZ1wiLCAndGFnOnlhbWwub3JnLDIwMDI6c2V0Jyk7XG5cbmZ1bmN0aW9uIHBhcnNlU2V0KG1hcCwgb25FcnJvcikge1xuICBpZiAobWFwIGluc3RhbmNlb2YgWUFNTE1hcCkge1xuICAgIGlmIChtYXAuaGFzQWxsTnVsbFZhbHVlcygpKSByZXR1cm4gT2JqZWN0LmFzc2lnbihuZXcgWUFNTFNldCgpLCBtYXApO2Vsc2Ugb25FcnJvcignU2V0IGl0ZW1zIG11c3QgYWxsIGhhdmUgbnVsbCB2YWx1ZXMnKTtcbiAgfSBlbHNlIG9uRXJyb3IoJ0V4cGVjdGVkIGEgbWFwcGluZyBmb3IgdGhpcyB0YWcnKTtcblxuICByZXR1cm4gbWFwO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTZXQoc2NoZW1hLCBpdGVyYWJsZSwgY3R4KSB7XG4gIGNvbnN0IHtcbiAgICByZXBsYWNlclxuICB9ID0gY3R4O1xuICBjb25zdCBzZXQgPSBuZXcgWUFNTFNldChzY2hlbWEpO1xuXG4gIGZvciAobGV0IHZhbHVlIG9mIGl0ZXJhYmxlKSB7XG4gICAgaWYgKHR5cGVvZiByZXBsYWNlciA9PT0gJ2Z1bmN0aW9uJykgdmFsdWUgPSByZXBsYWNlci5jYWxsKGl0ZXJhYmxlLCB2YWx1ZSwgdmFsdWUpO1xuICAgIHNldC5pdGVtcy5wdXNoKGNyZWF0ZVBhaXIodmFsdWUsIG51bGwsIGN0eCkpO1xuICB9XG5cbiAgcmV0dXJuIHNldDtcbn1cblxuY29uc3Qgc2V0ID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdmFsdWUgaW5zdGFuY2VvZiBTZXQsXG4gIG5vZGVDbGFzczogWUFNTFNldCxcbiAgZGVmYXVsdDogZmFsc2UsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOnNldCcsXG4gIHJlc29sdmU6IHBhcnNlU2V0LFxuICBjcmVhdGVOb2RlOiBjcmVhdGVTZXRcbn07XG5cbmV4cG9ydCB7IFlBTUxTZXQsIHNldCB9O1xuIiwiaW1wb3J0IHsgaW50T3B0aW9ucyB9IGZyb20gJy4uL29wdGlvbnMuanMnO1xuaW1wb3J0IHsgc3RyaW5naWZ5TnVtYmVyIH0gZnJvbSAnLi4vLi4vc3RyaW5naWZ5L3N0cmluZ2lmeU51bWJlci5qcyc7XG5cbi8qIGdsb2JhbCBCaWdJbnQgKi9cblxuY29uc3QgcGFyc2VTZXhhZ2VzaW1hbCA9IChzdHIsIGlzSW50KSA9PiB7XG4gIGNvbnN0IHNpZ24gPSBzdHJbMF07XG4gIGNvbnN0IHBhcnRzID0gc2lnbiA9PT0gJy0nIHx8IHNpZ24gPT09ICcrJyA/IHN0ci5zdWJzdHJpbmcoMSkgOiBzdHI7XG5cbiAgY29uc3QgbnVtID0gbiA9PiBpc0ludCAmJiBpbnRPcHRpb25zLmFzQmlnSW50ID8gQmlnSW50KG4pIDogTnVtYmVyKG4pO1xuXG4gIGNvbnN0IHJlcyA9IHBhcnRzLnJlcGxhY2UoL18vZywgJycpLnNwbGl0KCc6JykucmVkdWNlKChyZXMsIHApID0+IHJlcyAqIG51bSg2MCkgKyBudW0ocCksIG51bSgwKSk7XG4gIHJldHVybiBzaWduID09PSAnLScgPyBudW0oLTEpICogcmVzIDogcmVzO1xufTsgLy8gaGhoaDptbTpzcy5zc3NcblxuXG5jb25zdCBzdHJpbmdpZnlTZXhhZ2VzaW1hbCA9ICh7XG4gIHZhbHVlXG59KSA9PiB7XG4gIGxldCBudW0gPSBuID0+IG47XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2JpZ2ludCcpIG51bSA9IG4gPT4gQmlnSW50KG4pO2Vsc2UgaWYgKGlzTmFOKHZhbHVlKSB8fCAhaXNGaW5pdGUodmFsdWUpKSByZXR1cm4gc3RyaW5naWZ5TnVtYmVyKHZhbHVlKTtcbiAgbGV0IHNpZ24gPSAnJztcblxuICBpZiAodmFsdWUgPCAwKSB7XG4gICAgc2lnbiA9ICctJztcbiAgICB2YWx1ZSAqPSBudW0oLTEpO1xuICB9XG5cbiAgY29uc3QgXzYwID0gbnVtKDYwKTtcblxuICBjb25zdCBwYXJ0cyA9IFt2YWx1ZSAlIF82MF07IC8vIHNlY29uZHMsIGluY2x1ZGluZyBtc1xuXG4gIGlmICh2YWx1ZSA8IDYwKSB7XG4gICAgcGFydHMudW5zaGlmdCgwKTsgLy8gYXQgbGVhc3Qgb25lIDogaXMgcmVxdWlyZWRcbiAgfSBlbHNlIHtcbiAgICB2YWx1ZSA9ICh2YWx1ZSAtIHBhcnRzWzBdKSAvIF82MDtcbiAgICBwYXJ0cy51bnNoaWZ0KHZhbHVlICUgXzYwKTsgLy8gbWludXRlc1xuXG4gICAgaWYgKHZhbHVlID49IDYwKSB7XG4gICAgICB2YWx1ZSA9ICh2YWx1ZSAtIHBhcnRzWzBdKSAvIF82MDtcbiAgICAgIHBhcnRzLnVuc2hpZnQodmFsdWUpOyAvLyBob3Vyc1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBzaWduICsgcGFydHMubWFwKG4gPT4gbiA8IDEwID8gJzAnICsgU3RyaW5nKG4pIDogU3RyaW5nKG4pKS5qb2luKCc6JykucmVwbGFjZSgvMDAwMDAwXFxkKiQvLCAnJykgLy8gJSA2MCBtYXkgaW50cm9kdWNlIGVycm9yXG4gIDtcbn07XG5cbmNvbnN0IGludFRpbWUgPSB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdiaWdpbnQnIHx8IE51bWJlci5pc0ludGVnZXIodmFsdWUpLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjppbnQnLFxuICBmb3JtYXQ6ICdUSU1FJyxcbiAgdGVzdDogL15bLStdP1swLTldWzAtOV9dKig/OjpbMC01XT9bMC05XSkrJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBwYXJzZVNleGFnZXNpbWFsKHN0ciwgdHJ1ZSksXG4gIHN0cmluZ2lmeTogc3RyaW5naWZ5U2V4YWdlc2ltYWxcbn07XG5jb25zdCBmbG9hdFRpbWUgPSB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpmbG9hdCcsXG4gIGZvcm1hdDogJ1RJTUUnLFxuICB0ZXN0OiAvXlstK10/WzAtOV1bMC05X10qKD86OlswLTVdP1swLTldKStcXC5bMC05X10qJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBwYXJzZVNleGFnZXNpbWFsKHN0ciwgZmFsc2UpLFxuICBzdHJpbmdpZnk6IHN0cmluZ2lmeVNleGFnZXNpbWFsXG59O1xuY29uc3QgdGltZXN0YW1wID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdmFsdWUgaW5zdGFuY2VvZiBEYXRlLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjp0aW1lc3RhbXAnLFxuICAvLyBJZiB0aGUgdGltZSB6b25lIGlzIG9taXR0ZWQsIHRoZSB0aW1lc3RhbXAgaXMgYXNzdW1lZCB0byBiZSBzcGVjaWZpZWQgaW4gVVRDLiBUaGUgdGltZSBwYXJ0XG4gIC8vIG1heSBiZSBvbWl0dGVkIGFsdG9nZXRoZXIsIHJlc3VsdGluZyBpbiBhIGRhdGUgZm9ybWF0LiBJbiBzdWNoIGEgY2FzZSwgdGhlIHRpbWUgcGFydCBpc1xuICAvLyBhc3N1bWVkIHRvIGJlIDAwOjAwOjAwWiAoc3RhcnQgb2YgZGF5LCBVVEMpLlxuICB0ZXN0OiBSZWdFeHAoJ14oWzAtOV17NH0pLShbMC05XXsxLDJ9KS0oWzAtOV17MSwyfSknICsgLy8gWVlZWS1NbS1EZFxuICAnKD86JyArIC8vIHRpbWUgaXMgb3B0aW9uYWxcbiAgJyg/OnR8VHxbIFxcXFx0XSspJyArIC8vIHQgfCBUIHwgd2hpdGVzcGFjZVxuICAnKFswLTldezEsMn0pOihbMC05XXsxLDJ9KTooWzAtOV17MSwyfShcXFxcLlswLTldKyk/KScgKyAvLyBIaDpNbTpTcyguc3MpP1xuICAnKD86WyBcXFxcdF0qKFp8Wy0rXVswMTJdP1swLTldKD86OlswLTldezJ9KT8pKT8nICsgLy8gWiB8ICs1IHwgLTAzOjMwXG4gICcpPyQnKSxcblxuICByZXNvbHZlKHN0cikge1xuICAgIGxldCBbLCB5ZWFyLCBtb250aCwgZGF5LCBob3VyLCBtaW51dGUsIHNlY29uZCwgbWlsbGlzZWMsIHR6XSA9IHN0ci5tYXRjaCh0aW1lc3RhbXAudGVzdCk7XG4gICAgaWYgKG1pbGxpc2VjKSBtaWxsaXNlYyA9IChtaWxsaXNlYyArICcwMCcpLnN1YnN0cigxLCAzKTtcbiAgICBsZXQgZGF0ZSA9IERhdGUuVVRDKHllYXIsIG1vbnRoIC0gMSwgZGF5LCBob3VyIHx8IDAsIG1pbnV0ZSB8fCAwLCBzZWNvbmQgfHwgMCwgbWlsbGlzZWMgfHwgMCk7XG5cbiAgICBpZiAodHogJiYgdHogIT09ICdaJykge1xuICAgICAgbGV0IGQgPSBwYXJzZVNleGFnZXNpbWFsKHR6LCBmYWxzZSk7XG4gICAgICBpZiAoTWF0aC5hYnMoZCkgPCAzMCkgZCAqPSA2MDtcbiAgICAgIGRhdGUgLT0gNjAwMDAgKiBkO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgRGF0ZShkYXRlKTtcbiAgfSxcblxuICBzdHJpbmdpZnk6ICh7XG4gICAgdmFsdWVcbiAgfSkgPT4gdmFsdWUudG9JU09TdHJpbmcoKS5yZXBsYWNlKC8oKFQwMDowMCk/OjAwKT9cXC4wMDBaJC8sICcnKVxufTtcblxuZXhwb3J0IHsgZmxvYXRUaW1lLCBpbnRUaW1lLCB0aW1lc3RhbXAgfTtcbiIsImltcG9ydCB7IFNjYWxhciB9IGZyb20gJy4uLy4uL2FzdC9TY2FsYXIuanMnO1xuaW1wb3J0IHsgc3RyaW5naWZ5TnVtYmVyIH0gZnJvbSAnLi4vLi4vc3RyaW5naWZ5L3N0cmluZ2lmeU51bWJlci5qcyc7XG5pbXBvcnQgeyBmYWlsc2FmZSB9IGZyb20gJy4uL2ZhaWxzYWZlL2luZGV4LmpzJztcbmltcG9ydCB7IG51bGxPcHRpb25zLCBib29sT3B0aW9ucywgaW50T3B0aW9ucyB9IGZyb20gJy4uL29wdGlvbnMuanMnO1xuaW1wb3J0IHsgYmluYXJ5IH0gZnJvbSAnLi9iaW5hcnkuanMnO1xuaW1wb3J0IHsgb21hcCB9IGZyb20gJy4vb21hcC5qcyc7XG5pbXBvcnQgeyBwYWlycyB9IGZyb20gJy4vcGFpcnMuanMnO1xuaW1wb3J0IHsgc2V0IH0gZnJvbSAnLi9zZXQuanMnO1xuaW1wb3J0IHsgaW50VGltZSwgZmxvYXRUaW1lLCB0aW1lc3RhbXAgfSBmcm9tICcuL3RpbWVzdGFtcC5qcyc7XG5cbi8qIGdsb2JhbCBCaWdJbnQgKi9cblxuY29uc3QgYm9vbFN0cmluZ2lmeSA9ICh7XG4gIHZhbHVlLFxuICBzb3VyY2VTdHJcbn0pID0+IHtcbiAgY29uc3QgYm9vbE9iaiA9IHZhbHVlID8gdHJ1ZU9iaiA6IGZhbHNlT2JqO1xuICBpZiAoc291cmNlU3RyICYmIGJvb2xPYmoudGVzdC50ZXN0KHNvdXJjZVN0cikpIHJldHVybiBzb3VyY2VTdHI7XG4gIHJldHVybiB2YWx1ZSA/IGJvb2xPcHRpb25zLnRydWVTdHIgOiBib29sT3B0aW9ucy5mYWxzZVN0cjtcbn07XG5cbmNvbnN0IGJvb2xSZXNvbHZlID0gKHZhbHVlLCBzdHIpID0+IHtcbiAgY29uc3Qgbm9kZSA9IG5ldyBTY2FsYXIodmFsdWUpO1xuICBub2RlLnNvdXJjZVN0ciA9IHN0cjtcbiAgcmV0dXJuIG5vZGU7XG59O1xuXG5jb25zdCB0cnVlT2JqID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdmFsdWUgPT09IHRydWUsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmJvb2wnLFxuICB0ZXN0OiAvXig/Oll8eXxbWXldZXN8WUVTfFtUdF1ydWV8VFJVRXxbT29dbnxPTikkLyxcbiAgcmVzb2x2ZTogc3RyID0+IGJvb2xSZXNvbHZlKHRydWUsIHN0ciksXG4gIG9wdGlvbnM6IGJvb2xPcHRpb25zLFxuICBzdHJpbmdpZnk6IGJvb2xTdHJpbmdpZnlcbn07XG5jb25zdCBmYWxzZU9iaiA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHZhbHVlID09PSBmYWxzZSxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6Ym9vbCcsXG4gIHRlc3Q6IC9eKD86TnxufFtObl1vfE5PfFtGZl1hbHNlfEZBTFNFfFtPb11mZnxPRkYpJC9pLFxuICByZXNvbHZlOiBzdHIgPT4gYm9vbFJlc29sdmUoZmFsc2UsIHN0ciksXG4gIG9wdGlvbnM6IGJvb2xPcHRpb25zLFxuICBzdHJpbmdpZnk6IGJvb2xTdHJpbmdpZnlcbn07XG5cbmNvbnN0IGludElkZW50aWZ5ID0gdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnYmlnaW50JyB8fCBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKTtcblxuZnVuY3Rpb24gaW50UmVzb2x2ZShzdHIsIG9mZnNldCwgcmFkaXgpIHtcbiAgY29uc3Qgc2lnbiA9IHN0clswXTtcbiAgaWYgKHNpZ24gPT09ICctJyB8fCBzaWduID09PSAnKycpIG9mZnNldCArPSAxO1xuICBzdHIgPSBzdHIuc3Vic3RyaW5nKG9mZnNldCkucmVwbGFjZSgvXy9nLCAnJyk7XG5cbiAgaWYgKGludE9wdGlvbnMuYXNCaWdJbnQpIHtcbiAgICBzd2l0Y2ggKHJhZGl4KSB7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIHN0ciA9IFwiMGJcIi5jb25jYXQoc3RyKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgODpcbiAgICAgICAgc3RyID0gXCIwb1wiLmNvbmNhdChzdHIpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAxNjpcbiAgICAgICAgc3RyID0gXCIweFwiLmNvbmNhdChzdHIpO1xuICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjb25zdCBuID0gQmlnSW50KHN0cik7XG4gICAgcmV0dXJuIHNpZ24gPT09ICctJyA/IEJpZ0ludCgtMSkgKiBuIDogbjtcbiAgfVxuXG4gIGNvbnN0IG4gPSBwYXJzZUludChzdHIsIHJhZGl4KTtcbiAgcmV0dXJuIHNpZ24gPT09ICctJyA/IC0xICogbiA6IG47XG59XG5cbmZ1bmN0aW9uIGludFN0cmluZ2lmeShub2RlLCByYWRpeCwgcHJlZml4KSB7XG4gIGNvbnN0IHtcbiAgICB2YWx1ZVxuICB9ID0gbm9kZTtcblxuICBpZiAoaW50SWRlbnRpZnkodmFsdWUpKSB7XG4gICAgY29uc3Qgc3RyID0gdmFsdWUudG9TdHJpbmcocmFkaXgpO1xuICAgIHJldHVybiB2YWx1ZSA8IDAgPyAnLScgKyBwcmVmaXggKyBzdHIuc3Vic3RyKDEpIDogcHJlZml4ICsgc3RyO1xuICB9XG5cbiAgcmV0dXJuIHN0cmluZ2lmeU51bWJlcihub2RlKTtcbn1cblxuY29uc3QgeWFtbDExID0gZmFpbHNhZmUuY29uY2F0KFt7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB2YWx1ZSA9PSBudWxsLFxuICBjcmVhdGVOb2RlOiAoc2NoZW1hLCB2YWx1ZSwgY3R4KSA9PiBjdHgud3JhcFNjYWxhcnMgPyBuZXcgU2NhbGFyKG51bGwpIDogbnVsbCxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6bnVsbCcsXG4gIHRlc3Q6IC9eKD86fnxbTm5ddWxsfE5VTEwpPyQvLFxuICByZXNvbHZlOiBzdHIgPT4ge1xuICAgIGNvbnN0IG5vZGUgPSBuZXcgU2NhbGFyKG51bGwpO1xuICAgIG5vZGUuc291cmNlU3RyID0gc3RyO1xuICAgIHJldHVybiBub2RlO1xuICB9LFxuICBvcHRpb25zOiBudWxsT3B0aW9ucyxcbiAgc3RyaW5naWZ5OiAoe1xuICAgIHNvdXJjZVN0clxuICB9KSA9PiBzb3VyY2VTdHIgIT09IG51bGwgJiYgc291cmNlU3RyICE9PSB2b2lkIDAgPyBzb3VyY2VTdHIgOiBudWxsT3B0aW9ucy5udWxsU3RyXG59LCB0cnVlT2JqLCBmYWxzZU9iaiwge1xuICBpZGVudGlmeTogaW50SWRlbnRpZnksXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmludCcsXG4gIGZvcm1hdDogJ0JJTicsXG4gIHRlc3Q6IC9eWy0rXT8wYlswLTFfXSskLyxcbiAgcmVzb2x2ZTogc3RyID0+IGludFJlc29sdmUoc3RyLCAyLCAyKSxcbiAgc3RyaW5naWZ5OiBub2RlID0+IGludFN0cmluZ2lmeShub2RlLCAyLCAnMGInKVxufSwge1xuICBpZGVudGlmeTogaW50SWRlbnRpZnksXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmludCcsXG4gIGZvcm1hdDogJ09DVCcsXG4gIHRlc3Q6IC9eWy0rXT8wWzAtN19dKyQvLFxuICByZXNvbHZlOiBzdHIgPT4gaW50UmVzb2x2ZShzdHIsIDEsIDgpLFxuICBzdHJpbmdpZnk6IG5vZGUgPT4gaW50U3RyaW5naWZ5KG5vZGUsIDgsICcwJylcbn0sIHtcbiAgaWRlbnRpZnk6IGludElkZW50aWZ5LFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjppbnQnLFxuICB0ZXN0OiAvXlstK10/WzAtOV1bMC05X10qJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBpbnRSZXNvbHZlKHN0ciwgMCwgMTApLFxuICBzdHJpbmdpZnk6IHN0cmluZ2lmeU51bWJlclxufSwge1xuICBpZGVudGlmeTogaW50SWRlbnRpZnksXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmludCcsXG4gIGZvcm1hdDogJ0hFWCcsXG4gIHRlc3Q6IC9eWy0rXT8weFswLTlhLWZBLUZfXSskLyxcbiAgcmVzb2x2ZTogc3RyID0+IGludFJlc29sdmUoc3RyLCAyLCAxNiksXG4gIHN0cmluZ2lmeTogbm9kZSA9PiBpbnRTdHJpbmdpZnkobm9kZSwgMTYsICcweCcpXG59LCB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpmbG9hdCcsXG4gIHRlc3Q6IC9eWy0rXT9cXC4oPzppbmZ8SW5mfElORnxuYW58TmFOfE5BTikkLyxcbiAgcmVzb2x2ZTogc3RyID0+IHN0ci5zbGljZSgtMykudG9Mb3dlckNhc2UoKSA9PT0gJ25hbicgPyBOYU4gOiBzdHJbMF0gPT09ICctJyA/IE51bWJlci5ORUdBVElWRV9JTkZJTklUWSA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSxcbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlOdW1iZXJcbn0sIHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmZsb2F0JyxcbiAgZm9ybWF0OiAnRVhQJyxcbiAgdGVzdDogL15bLStdPyg/OlswLTldWzAtOV9dKik/KD86XFwuWzAtOV9dKik/W2VFXVstK10/WzAtOV0rJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBwYXJzZUZsb2F0KHN0ci5yZXBsYWNlKC9fL2csICcnKSksXG4gIHN0cmluZ2lmeTogKHtcbiAgICB2YWx1ZVxuICB9KSA9PiBOdW1iZXIodmFsdWUpLnRvRXhwb25lbnRpYWwoKVxufSwge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6ZmxvYXQnLFxuICB0ZXN0OiAvXlstK10/KD86WzAtOV1bMC05X10qKT9cXC5bMC05X10qJC8sXG5cbiAgcmVzb2x2ZShzdHIpIHtcbiAgICBjb25zdCBub2RlID0gbmV3IFNjYWxhcihwYXJzZUZsb2F0KHN0ci5yZXBsYWNlKC9fL2csICcnKSkpO1xuICAgIGNvbnN0IGRvdCA9IHN0ci5pbmRleE9mKCcuJyk7XG5cbiAgICBpZiAoZG90ICE9PSAtMSkge1xuICAgICAgY29uc3QgZiA9IHN0ci5zdWJzdHJpbmcoZG90ICsgMSkucmVwbGFjZSgvXy9nLCAnJyk7XG4gICAgICBpZiAoZltmLmxlbmd0aCAtIDFdID09PSAnMCcpIG5vZGUubWluRnJhY3Rpb25EaWdpdHMgPSBmLmxlbmd0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZTtcbiAgfSxcblxuICBzdHJpbmdpZnk6IHN0cmluZ2lmeU51bWJlclxufV0sIGJpbmFyeSwgb21hcCwgcGFpcnMsIHNldCwgaW50VGltZSwgZmxvYXRUaW1lLCB0aW1lc3RhbXApO1xuXG5leHBvcnQgeyB5YW1sMTEgfTtcbiIsImltcG9ydCB7IGJvb2xPYmosIGZsb2F0T2JqLCBleHBPYmosIG5hbk9iaiwgaW50T2JqLCBoZXhPYmosIG9jdE9iaiwgbnVsbE9iaiwgY29yZSB9IGZyb20gJy4vY29yZS5qcyc7XG5pbXBvcnQgeyBmYWlsc2FmZSB9IGZyb20gJy4vZmFpbHNhZmUvaW5kZXguanMnO1xuaW1wb3J0IHsganNvbiB9IGZyb20gJy4vanNvbi5qcyc7XG5pbXBvcnQgeyB5YW1sMTEgfSBmcm9tICcuL3lhbWwtMS4xL2luZGV4LmpzJztcbmltcG9ydCB7IG1hcCB9IGZyb20gJy4vZmFpbHNhZmUvbWFwLmpzJztcbmltcG9ydCB7IHNlcSB9IGZyb20gJy4vZmFpbHNhZmUvc2VxLmpzJztcbmltcG9ydCB7IGJpbmFyeSB9IGZyb20gJy4veWFtbC0xLjEvYmluYXJ5LmpzJztcbmltcG9ydCB7IG9tYXAgfSBmcm9tICcuL3lhbWwtMS4xL29tYXAuanMnO1xuaW1wb3J0IHsgcGFpcnMgfSBmcm9tICcuL3lhbWwtMS4xL3BhaXJzLmpzJztcbmltcG9ydCB7IHNldCB9IGZyb20gJy4veWFtbC0xLjEvc2V0LmpzJztcbmltcG9ydCB7IGZsb2F0VGltZSwgaW50VGltZSwgdGltZXN0YW1wIH0gZnJvbSAnLi95YW1sLTEuMS90aW1lc3RhbXAuanMnO1xuXG5jb25zdCBzY2hlbWFzID0ge1xuICBjb3JlLFxuICBmYWlsc2FmZSxcbiAganNvbixcbiAgeWFtbDExXG59O1xuY29uc3QgdGFncyA9IHtcbiAgYmluYXJ5LFxuICBib29sOiBib29sT2JqLFxuICBmbG9hdDogZmxvYXRPYmosXG4gIGZsb2F0RXhwOiBleHBPYmosXG4gIGZsb2F0TmFOOiBuYW5PYmosXG4gIGZsb2F0VGltZSxcbiAgaW50OiBpbnRPYmosXG4gIGludEhleDogaGV4T2JqLFxuICBpbnRPY3Q6IG9jdE9iaixcbiAgaW50VGltZSxcbiAgbWFwLFxuICBudWxsOiBudWxsT2JqLFxuICBvbWFwLFxuICBwYWlycyxcbiAgc2VxLFxuICBzZXQsXG4gIHRpbWVzdGFtcFxufTtcblxuZXhwb3J0IHsgc2NoZW1hcywgdGFncyB9O1xuIiwiZnVuY3Rpb24gZ2V0U2NoZW1hVGFncyhzY2hlbWFzLCBrbm93blRhZ3MsIGN1c3RvbVRhZ3MsIHNjaGVtYUlkKSB7XG4gIGxldCB0YWdzID0gc2NoZW1hc1tzY2hlbWFJZC5yZXBsYWNlKC9cXFcvZywgJycpXTsgLy8gJ3lhbWwtMS4xJyAtPiAneWFtbDExJ1xuXG4gIGlmICghdGFncykge1xuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhzY2hlbWFzKS5tYXAoa2V5ID0+IEpTT04uc3RyaW5naWZ5KGtleSkpLmpvaW4oJywgJyk7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBzY2hlbWEgXFxcIlwiLmNvbmNhdChzY2hlbWFJZCwgXCJcXFwiOyB1c2Ugb25lIG9mIFwiKS5jb25jYXQoa2V5cykpO1xuICB9XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkoY3VzdG9tVGFncykpIHtcbiAgICBmb3IgKGNvbnN0IHRhZyBvZiBjdXN0b21UYWdzKSB0YWdzID0gdGFncy5jb25jYXQodGFnKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgY3VzdG9tVGFncyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRhZ3MgPSBjdXN0b21UYWdzKHRhZ3Muc2xpY2UoKSk7XG4gIH1cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHRhZ3MubGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCB0YWcgPSB0YWdzW2ldO1xuXG4gICAgaWYgKHR5cGVvZiB0YWcgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCB0YWdPYmogPSBrbm93blRhZ3NbdGFnXTtcblxuICAgICAgaWYgKCF0YWdPYmopIHtcbiAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGtub3duVGFncykubWFwKGtleSA9PiBKU09OLnN0cmluZ2lmeShrZXkpKS5qb2luKCcsICcpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIGN1c3RvbSB0YWcgXFxcIlwiLmNvbmNhdCh0YWcsIFwiXFxcIjsgdXNlIG9uZSBvZiBcIikuY29uY2F0KGtleXMpKTtcbiAgICAgIH1cblxuICAgICAgdGFnc1tpXSA9IHRhZ09iajtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGFncztcbn1cblxuZXhwb3J0IHsgZ2V0U2NoZW1hVGFncyB9O1xuIiwiaW1wb3J0IHsgdGFncywgc2NoZW1hcyB9IGZyb20gJy4uL3RhZ3MvaW5kZXguanMnO1xuaW1wb3J0IHsgZ2V0U2NoZW1hVGFncyB9IGZyb20gJy4vZ2V0U2NoZW1hVGFncy5qcyc7XG5cbmNvbnN0IHNvcnRNYXBFbnRyaWVzQnlLZXkgPSAoYSwgYikgPT4gYS5rZXkgPCBiLmtleSA/IC0xIDogYS5rZXkgPiBiLmtleSA/IDEgOiAwO1xuXG5jb25zdCBjb3JlS25vd25UYWdzID0ge1xuICAndGFnOnlhbWwub3JnLDIwMDI6YmluYXJ5JzogdGFncy5iaW5hcnksXG4gICd0YWc6eWFtbC5vcmcsMjAwMjpvbWFwJzogdGFncy5vbWFwLFxuICAndGFnOnlhbWwub3JnLDIwMDI6cGFpcnMnOiB0YWdzLnBhaXJzLFxuICAndGFnOnlhbWwub3JnLDIwMDI6c2V0JzogdGFncy5zZXQsXG4gICd0YWc6eWFtbC5vcmcsMjAwMjp0aW1lc3RhbXAnOiB0YWdzLnRpbWVzdGFtcFxufTtcbmNsYXNzIFNjaGVtYSB7XG4gIGNvbnN0cnVjdG9yKHtcbiAgICBjdXN0b21UYWdzLFxuICAgIG1lcmdlLFxuICAgIHJlc29sdmVLbm93blRhZ3MsXG4gICAgc2NoZW1hLFxuICAgIHNvcnRNYXBFbnRyaWVzXG4gIH0pIHtcbiAgICB0aGlzLm1lcmdlID0gISFtZXJnZTtcbiAgICB0aGlzLm5hbWUgPSBzY2hlbWE7XG4gICAgdGhpcy5rbm93blRhZ3MgPSByZXNvbHZlS25vd25UYWdzID8gY29yZUtub3duVGFncyA6IHt9O1xuICAgIHRoaXMudGFncyA9IGdldFNjaGVtYVRhZ3Moc2NoZW1hcywgdGFncywgY3VzdG9tVGFncywgc2NoZW1hKTsgLy8gVXNlZCBieSBjcmVhdGVOb2RlKCksIHRvIGF2b2lkIGNpcmN1bGFyIGRlcGVuZGVuY2llc1xuXG4gICAgdGhpcy5tYXAgPSB0YWdzLm1hcDtcbiAgICB0aGlzLnNlcSA9IHRhZ3Muc2VxOyAvLyBVc2VkIGJ5IGNyZWF0ZU1hcCgpXG5cbiAgICB0aGlzLnNvcnRNYXBFbnRyaWVzID0gc29ydE1hcEVudHJpZXMgPT09IHRydWUgPyBzb3J0TWFwRW50cmllc0J5S2V5IDogc29ydE1hcEVudHJpZXMgfHwgbnVsbDtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IFNjaGVtYSB9O1xuIiwiLyoqXG4gKiBBcHBsaWVzIHRoZSBKU09OLnBhcnNlIHJldml2ZXIgYWxnb3JpdGhtIGFzIGRlZmluZWQgaW4gdGhlIEVDTUEtMjYyIHNwZWMsXG4gKiBpbiBzZWN0aW9uIDI0LjUuMS4xIFwiUnVudGltZSBTZW1hbnRpY3M6IEludGVybmFsaXplSlNPTlByb3BlcnR5XCIgb2YgdGhlXG4gKiAyMDIxIGVkaXRpb246IGh0dHBzOi8vdGMzOS5lcy9lY21hMjYyLyNzZWMtanNvbi5wYXJzZVxuICpcbiAqIEluY2x1ZGVzIGV4dGVuc2lvbnMgZm9yIGhhbmRsaW5nIE1hcCBhbmQgU2V0IG9iamVjdHMuXG4gKi9cbmZ1bmN0aW9uIGFwcGx5UmV2aXZlcihyZXZpdmVyLCBvYmosIGtleSwgdmFsKSB7XG4gIGlmICh2YWwgJiYgdHlwZW9mIHZhbCA9PT0gJ29iamVjdCcpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWwpKSB7XG4gICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdmFsLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIGNvbnN0IHYwID0gdmFsW2ldO1xuICAgICAgICBjb25zdCB2MSA9IGFwcGx5UmV2aXZlcihyZXZpdmVyLCB2YWwsIFN0cmluZyhpKSwgdjApO1xuICAgICAgICBpZiAodjEgPT09IHVuZGVmaW5lZCkgZGVsZXRlIHZhbFtpXTtlbHNlIGlmICh2MSAhPT0gdjApIHZhbFtpXSA9IHYxO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodmFsIGluc3RhbmNlb2YgTWFwKSB7XG4gICAgICBmb3IgKGNvbnN0IGsgb2YgQXJyYXkuZnJvbSh2YWwua2V5cygpKSkge1xuICAgICAgICBjb25zdCB2MCA9IHZhbC5nZXQoayk7XG4gICAgICAgIGNvbnN0IHYxID0gYXBwbHlSZXZpdmVyKHJldml2ZXIsIHZhbCwgaywgdjApO1xuICAgICAgICBpZiAodjEgPT09IHVuZGVmaW5lZCkgdmFsLmRlbGV0ZShrKTtlbHNlIGlmICh2MSAhPT0gdjApIHZhbC5zZXQoaywgdjEpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodmFsIGluc3RhbmNlb2YgU2V0KSB7XG4gICAgICBmb3IgKGNvbnN0IHYwIG9mIEFycmF5LmZyb20odmFsKSkge1xuICAgICAgICBjb25zdCB2MSA9IGFwcGx5UmV2aXZlcihyZXZpdmVyLCB2YWwsIHYwLCB2MCk7XG4gICAgICAgIGlmICh2MSA9PT0gdW5kZWZpbmVkKSB2YWwuZGVsZXRlKHYwKTtlbHNlIGlmICh2MSAhPT0gdjApIHtcbiAgICAgICAgICB2YWwuZGVsZXRlKHYwKTtcbiAgICAgICAgICB2YWwuYWRkKHYxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGNvbnN0IFtrLCB2MF0gb2YgT2JqZWN0LmVudHJpZXModmFsKSkge1xuICAgICAgICBjb25zdCB2MSA9IGFwcGx5UmV2aXZlcihyZXZpdmVyLCB2YWwsIGssIHYwKTtcbiAgICAgICAgaWYgKHYxID09PSB1bmRlZmluZWQpIGRlbGV0ZSB2YWxba107ZWxzZSBpZiAodjEgIT09IHYwKSB2YWxba10gPSB2MTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmV2aXZlci5jYWxsKG9iaiwga2V5LCB2YWwpO1xufVxuXG5leHBvcnQgeyBhcHBseVJldml2ZXIgfTtcbiIsImltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuLi9hc3QvQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBQYWlyIH0gZnJvbSAnLi4vYXN0L1BhaXIuanMnO1xuaW1wb3J0IHsgU2NhbGFyIH0gZnJvbSAnLi4vYXN0L1NjYWxhci5qcyc7XG5cbmNvbnN0IHZpc2l0ID0gKG5vZGUsIHRhZ3MpID0+IHtcbiAgaWYgKG5vZGUgJiYgdHlwZW9mIG5vZGUgPT09ICdvYmplY3QnKSB7XG4gICAgY29uc3Qge1xuICAgICAgdGFnXG4gICAgfSA9IG5vZGU7XG5cbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIENvbGxlY3Rpb24pIHtcbiAgICAgIGlmICh0YWcpIHRhZ3NbdGFnXSA9IHRydWU7XG4gICAgICBub2RlLml0ZW1zLmZvckVhY2gobiA9PiB2aXNpdChuLCB0YWdzKSk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgUGFpcikge1xuICAgICAgdmlzaXQobm9kZS5rZXksIHRhZ3MpO1xuICAgICAgdmlzaXQobm9kZS52YWx1ZSwgdGFncyk7XG4gICAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgU2NhbGFyKSB7XG4gICAgICBpZiAodGFnKSB0YWdzW3RhZ10gPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0YWdzO1xufTtcblxuY29uc3QgbGlzdFRhZ05hbWVzID0gbm9kZSA9PiBPYmplY3Qua2V5cyh2aXNpdChub2RlLCB7fSkpO1xuXG5leHBvcnQgeyBsaXN0VGFnTmFtZXMgfTtcbiIsImltcG9ydCB7IFR5cGUsIGRlZmF1bHRUYWdzIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFlBTUxTZW1hbnRpY0Vycm9yLCBZQU1MV2FybmluZyB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5cbmZ1bmN0aW9uIHJlc29sdmVUYWdIYW5kbGUoZG9jLCBub2RlKSB7XG4gIGNvbnN0IHtcbiAgICBoYW5kbGUsXG4gICAgc3VmZml4XG4gIH0gPSBub2RlLnRhZztcbiAgbGV0IHByZWZpeCA9IGRvYy50YWdQcmVmaXhlcy5maW5kKHAgPT4gcC5oYW5kbGUgPT09IGhhbmRsZSk7XG5cbiAgaWYgKCFwcmVmaXgpIHtcbiAgICBjb25zdCBkdHAgPSBkb2MuZ2V0RGVmYXVsdHMoKS50YWdQcmVmaXhlcztcbiAgICBpZiAoZHRwKSBwcmVmaXggPSBkdHAuZmluZChwID0+IHAuaGFuZGxlID09PSBoYW5kbGUpO1xuICAgIGlmICghcHJlZml4KSB0aHJvdyBuZXcgWUFNTFNlbWFudGljRXJyb3Iobm9kZSwgXCJUaGUgXCIuY29uY2F0KGhhbmRsZSwgXCIgdGFnIGhhbmRsZSBpcyBub24tZGVmYXVsdCBhbmQgd2FzIG5vdCBkZWNsYXJlZC5cIikpO1xuICB9XG5cbiAgaWYgKCFzdWZmaXgpIHRocm93IG5ldyBZQU1MU2VtYW50aWNFcnJvcihub2RlLCBcIlRoZSBcIi5jb25jYXQoaGFuZGxlLCBcIiB0YWcgaGFzIG5vIHN1ZmZpeC5cIikpO1xuXG4gIGlmIChoYW5kbGUgPT09ICchJyAmJiAoZG9jLnZlcnNpb24gfHwgZG9jLm9wdGlvbnMudmVyc2lvbikgPT09ICcxLjAnKSB7XG4gICAgaWYgKHN1ZmZpeFswXSA9PT0gJ14nKSB7XG4gICAgICBkb2Mud2FybmluZ3MucHVzaChuZXcgWUFNTFdhcm5pbmcobm9kZSwgJ1lBTUwgMS4wIF4gdGFnIGV4cGFuc2lvbiBpcyBub3Qgc3VwcG9ydGVkJykpO1xuICAgICAgcmV0dXJuIHN1ZmZpeDtcbiAgICB9XG5cbiAgICBpZiAoL1s6L10vLnRlc3Qoc3VmZml4KSkge1xuICAgICAgLy8gd29yZC9mb28gLT4gdGFnOndvcmQueWFtbC5vcmcsMjAwMjpmb29cbiAgICAgIGNvbnN0IHZvY2FiID0gc3VmZml4Lm1hdGNoKC9eKFthLXowLTktXSspXFwvKC4qKS9pKTtcbiAgICAgIHJldHVybiB2b2NhYiA/IFwidGFnOlwiLmNvbmNhdCh2b2NhYlsxXSwgXCIueWFtbC5vcmcsMjAwMjpcIikuY29uY2F0KHZvY2FiWzJdKSA6IFwidGFnOlwiLmNvbmNhdChzdWZmaXgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwcmVmaXgucHJlZml4ICsgZGVjb2RlVVJJQ29tcG9uZW50KHN1ZmZpeCk7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVUYWdOYW1lKGRvYywgbm9kZSkge1xuICBjb25zdCB7XG4gICAgdGFnLFxuICAgIHR5cGVcbiAgfSA9IG5vZGU7XG4gIGxldCBub25TcGVjaWZpYyA9IGZhbHNlO1xuXG4gIGlmICh0YWcpIHtcbiAgICBjb25zdCB7XG4gICAgICBoYW5kbGUsXG4gICAgICBzdWZmaXgsXG4gICAgICB2ZXJiYXRpbVxuICAgIH0gPSB0YWc7XG5cbiAgICBpZiAodmVyYmF0aW0pIHtcbiAgICAgIGlmICh2ZXJiYXRpbSAhPT0gJyEnICYmIHZlcmJhdGltICE9PSAnISEnKSByZXR1cm4gdmVyYmF0aW07XG4gICAgICBjb25zdCBtc2cgPSBcIlZlcmJhdGltIHRhZ3MgYXJlbid0IHJlc29sdmVkLCBzbyBcIi5jb25jYXQodmVyYmF0aW0sIFwiIGlzIGludmFsaWQuXCIpO1xuICAgICAgZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihub2RlLCBtc2cpKTtcbiAgICB9IGVsc2UgaWYgKGhhbmRsZSA9PT0gJyEnICYmICFzdWZmaXgpIHtcbiAgICAgIG5vblNwZWNpZmljID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHJlc29sdmVUYWdIYW5kbGUoZG9jLCBub2RlKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGRvYy5lcnJvcnMucHVzaChlcnJvcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBUeXBlLkJMT0NLX0ZPTERFRDpcbiAgICBjYXNlIFR5cGUuQkxPQ0tfTElURVJBTDpcbiAgICBjYXNlIFR5cGUuUVVPVEVfRE9VQkxFOlxuICAgIGNhc2UgVHlwZS5RVU9URV9TSU5HTEU6XG4gICAgICByZXR1cm4gZGVmYXVsdFRhZ3MuU1RSO1xuXG4gICAgY2FzZSBUeXBlLkZMT1dfTUFQOlxuICAgIGNhc2UgVHlwZS5NQVA6XG4gICAgICByZXR1cm4gZGVmYXVsdFRhZ3MuTUFQO1xuXG4gICAgY2FzZSBUeXBlLkZMT1dfU0VROlxuICAgIGNhc2UgVHlwZS5TRVE6XG4gICAgICByZXR1cm4gZGVmYXVsdFRhZ3MuU0VRO1xuXG4gICAgY2FzZSBUeXBlLlBMQUlOOlxuICAgICAgcmV0dXJuIG5vblNwZWNpZmljID8gZGVmYXVsdFRhZ3MuU1RSIDogbnVsbDtcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgeyByZXNvbHZlVGFnTmFtZSB9O1xuIiwiaW1wb3J0IHsgWUFNTFNlbWFudGljRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5cbmZ1bmN0aW9uIGNoZWNrRmxvd0NvbGxlY3Rpb25FbmQoZXJyb3JzLCBjc3QpIHtcbiAgbGV0IGNoYXIsIG5hbWU7XG5cbiAgc3dpdGNoIChjc3QudHlwZSkge1xuICAgIGNhc2UgVHlwZS5GTE9XX01BUDpcbiAgICAgIGNoYXIgPSAnfSc7XG4gICAgICBuYW1lID0gJ2Zsb3cgbWFwJztcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSBUeXBlLkZMT1dfU0VROlxuICAgICAgY2hhciA9ICddJztcbiAgICAgIG5hbWUgPSAnZmxvdyBzZXF1ZW5jZSc7XG4gICAgICBicmVhaztcblxuICAgIGRlZmF1bHQ6XG4gICAgICBlcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3IoY3N0LCAnTm90IGEgZmxvdyBjb2xsZWN0aW9uIT8nKSk7XG4gICAgICByZXR1cm47XG4gIH1cblxuICBsZXQgbGFzdEl0ZW07XG5cbiAgZm9yIChsZXQgaSA9IGNzdC5pdGVtcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgIGNvbnN0IGl0ZW0gPSBjc3QuaXRlbXNbaV07XG5cbiAgICBpZiAoIWl0ZW0gfHwgaXRlbS50eXBlICE9PSBUeXBlLkNPTU1FTlQpIHtcbiAgICAgIGxhc3RJdGVtID0gaXRlbTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmIChsYXN0SXRlbSAmJiBsYXN0SXRlbS5jaGFyICE9PSBjaGFyKSB7XG4gICAgY29uc3QgbXNnID0gXCJFeHBlY3RlZCBcIi5jb25jYXQobmFtZSwgXCIgdG8gZW5kIHdpdGggXCIpLmNvbmNhdChjaGFyKTtcbiAgICBsZXQgZXJyO1xuXG4gICAgaWYgKHR5cGVvZiBsYXN0SXRlbS5vZmZzZXQgPT09ICdudW1iZXInKSB7XG4gICAgICBlcnIgPSBuZXcgWUFNTFNlbWFudGljRXJyb3IoY3N0LCBtc2cpO1xuICAgICAgZXJyLm9mZnNldCA9IGxhc3RJdGVtLm9mZnNldCArIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVyciA9IG5ldyBZQU1MU2VtYW50aWNFcnJvcihsYXN0SXRlbSwgbXNnKTtcbiAgICAgIGlmIChsYXN0SXRlbS5yYW5nZSAmJiBsYXN0SXRlbS5yYW5nZS5lbmQpIGVyci5vZmZzZXQgPSBsYXN0SXRlbS5yYW5nZS5lbmQgLSBsYXN0SXRlbS5yYW5nZS5zdGFydDtcbiAgICB9XG5cbiAgICBlcnJvcnMucHVzaChlcnIpO1xuICB9XG59XG5mdW5jdGlvbiBjaGVja0Zsb3dDb21tZW50U3BhY2UoZXJyb3JzLCBjb21tZW50KSB7XG4gIGNvbnN0IHByZXYgPSBjb21tZW50LmNvbnRleHQuc3JjW2NvbW1lbnQucmFuZ2Uuc3RhcnQgLSAxXTtcblxuICBpZiAocHJldiAhPT0gJ1xcbicgJiYgcHJldiAhPT0gJ1xcdCcgJiYgcHJldiAhPT0gJyAnKSB7XG4gICAgY29uc3QgbXNnID0gJ0NvbW1lbnRzIG11c3QgYmUgc2VwYXJhdGVkIGZyb20gb3RoZXIgdG9rZW5zIGJ5IHdoaXRlIHNwYWNlIGNoYXJhY3RlcnMnO1xuICAgIGVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihjb21tZW50LCBtc2cpKTtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0TG9uZ0tleUVycm9yKHNvdXJjZSwga2V5KSB7XG4gIGNvbnN0IHNrID0gU3RyaW5nKGtleSk7XG4gIGNvbnN0IGsgPSBzay5zdWJzdHIoMCwgOCkgKyAnLi4uJyArIHNrLnN1YnN0cigtOCk7XG4gIHJldHVybiBuZXcgWUFNTFNlbWFudGljRXJyb3Ioc291cmNlLCBcIlRoZSBcXFwiXCIuY29uY2F0KGssIFwiXFxcIiBrZXkgaXMgdG9vIGxvbmdcIikpO1xufVxuZnVuY3Rpb24gcmVzb2x2ZUNvbW1lbnRzKGNvbGxlY3Rpb24sIGNvbW1lbnRzKSB7XG4gIGZvciAoY29uc3Qge1xuICAgIGFmdGVyS2V5LFxuICAgIGJlZm9yZSxcbiAgICBjb21tZW50XG4gIH0gb2YgY29tbWVudHMpIHtcbiAgICBsZXQgaXRlbSA9IGNvbGxlY3Rpb24uaXRlbXNbYmVmb3JlXTtcblxuICAgIGlmICghaXRlbSkge1xuICAgICAgaWYgKGNvbW1lbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoY29sbGVjdGlvbi5jb21tZW50KSBjb2xsZWN0aW9uLmNvbW1lbnQgKz0gJ1xcbicgKyBjb21tZW50O2Vsc2UgY29sbGVjdGlvbi5jb21tZW50ID0gY29tbWVudDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGFmdGVyS2V5ICYmIGl0ZW0udmFsdWUpIGl0ZW0gPSBpdGVtLnZhbHVlO1xuXG4gICAgICBpZiAoY29tbWVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChhZnRlcktleSB8fCAhaXRlbS5jb21tZW50QmVmb3JlKSBpdGVtLnNwYWNlQmVmb3JlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpdGVtLmNvbW1lbnRCZWZvcmUpIGl0ZW0uY29tbWVudEJlZm9yZSArPSAnXFxuJyArIGNvbW1lbnQ7ZWxzZSBpdGVtLmNvbW1lbnRCZWZvcmUgPSBjb21tZW50O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgeyBjaGVja0Zsb3dDb2xsZWN0aW9uRW5kLCBjaGVja0Zsb3dDb21tZW50U3BhY2UsIGdldExvbmdLZXlFcnJvciwgcmVzb2x2ZUNvbW1lbnRzIH07XG4iLCJpbXBvcnQgeyBBbGlhcyB9IGZyb20gJy4uL2FzdC9BbGlhcy5qcyc7XG5pbXBvcnQgeyBNRVJHRV9LRVksIE1lcmdlIH0gZnJvbSAnLi4vYXN0L01lcmdlLmpzJztcbmltcG9ydCB7IFBhaXIgfSBmcm9tICcuLi9hc3QvUGFpci5qcyc7XG5pbXBvcnQgeyBZQU1MTWFwIH0gZnJvbSAnLi4vYXN0L1lBTUxNYXAuanMnO1xuaW1wb3J0IHsgVHlwZSwgQ2hhciB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBQbGFpblZhbHVlIH0gZnJvbSAnLi4vY3N0L1BsYWluVmFsdWUuanMnO1xuaW1wb3J0IHsgWUFNTFNlbWFudGljRXJyb3IsIFlBTUxTeW50YXhFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyByZXNvbHZlQ29tbWVudHMsIGdldExvbmdLZXlFcnJvciwgY2hlY2tGbG93Q29tbWVudFNwYWNlLCBjaGVja0Zsb3dDb2xsZWN0aW9uRW5kIH0gZnJvbSAnLi9jb2xsZWN0aW9uLXV0aWxzLmpzJztcbmltcG9ydCB7IHJlc29sdmVOb2RlIH0gZnJvbSAnLi9yZXNvbHZlTm9kZS5qcyc7XG5cbmZ1bmN0aW9uIHJlc29sdmVNYXAoZG9jLCBjc3QpIHtcbiAgY29uc3Qge1xuICAgIGNvbW1lbnRzLFxuICAgIGl0ZW1zXG4gIH0gPSBjc3QudHlwZSA9PT0gVHlwZS5GTE9XX01BUCA/IHJlc29sdmVGbG93TWFwSXRlbXMoZG9jLCBjc3QpIDogcmVzb2x2ZUJsb2NrTWFwSXRlbXMoZG9jLCBjc3QpO1xuICBjb25zdCBtYXAgPSBuZXcgWUFNTE1hcChkb2Muc2NoZW1hKTtcbiAgbWFwLml0ZW1zID0gaXRlbXM7XG4gIHJlc29sdmVDb21tZW50cyhtYXAsIGNvbW1lbnRzKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGl0ZW1zLmxlbmd0aDsgKytpKSB7XG4gICAgY29uc3Qge1xuICAgICAga2V5OiBpS2V5XG4gICAgfSA9IGl0ZW1zW2ldO1xuXG4gICAgaWYgKGRvYy5zY2hlbWEubWVyZ2UgJiYgaUtleSAmJiBpS2V5LnZhbHVlID09PSBNRVJHRV9LRVkpIHtcbiAgICAgIGl0ZW1zW2ldID0gbmV3IE1lcmdlKGl0ZW1zW2ldKTtcbiAgICAgIGNvbnN0IHNvdXJjZXMgPSBpdGVtc1tpXS52YWx1ZS5pdGVtcztcbiAgICAgIGxldCBlcnJvciA9IG51bGw7XG4gICAgICBzb3VyY2VzLnNvbWUobm9kZSA9PiB7XG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgQWxpYXMpIHtcbiAgICAgICAgICAvLyBEdXJpbmcgcGFyc2luZywgYWxpYXMgc291cmNlcyBhcmUgQ1NUIG5vZGVzOyB0byBhY2NvdW50IGZvclxuICAgICAgICAgIC8vIGNpcmN1bGFyIHJlZmVyZW5jZXMgdGhlaXIgcmVzb2x2ZWQgdmFsdWVzIGNhbid0IGJlIHVzZWQgaGVyZS5cbiAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICB0eXBlXG4gICAgICAgICAgfSA9IG5vZGUuc291cmNlO1xuICAgICAgICAgIGlmICh0eXBlID09PSBUeXBlLk1BUCB8fCB0eXBlID09PSBUeXBlLkZMT1dfTUFQKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuIGVycm9yID0gJ01lcmdlIG5vZGVzIGFsaWFzZXMgY2FuIG9ubHkgcG9pbnQgdG8gbWFwcyc7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXJyb3IgPSAnTWVyZ2Ugbm9kZXMgY2FuIG9ubHkgaGF2ZSBBbGlhcyBub2RlcyBhcyB2YWx1ZXMnO1xuICAgICAgfSk7XG4gICAgICBpZiAoZXJyb3IpIGRvYy5lcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3IoY3N0LCBlcnJvcikpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBpdGVtcy5sZW5ndGg7ICsraikge1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAga2V5OiBqS2V5XG4gICAgICAgIH0gPSBpdGVtc1tqXTtcblxuICAgICAgICBpZiAoaUtleSA9PT0gaktleSB8fCBpS2V5ICYmIGpLZXkgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGlLZXksICd2YWx1ZScpICYmIGlLZXkudmFsdWUgPT09IGpLZXkudmFsdWUpIHtcbiAgICAgICAgICBjb25zdCBtc2cgPSBcIk1hcCBrZXlzIG11c3QgYmUgdW5pcXVlOyBcXFwiXCIuY29uY2F0KGlLZXksIFwiXFxcIiBpcyByZXBlYXRlZFwiKTtcbiAgICAgICAgICBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGNzdCwgbXNnKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjc3QucmVzb2x2ZWQgPSBtYXA7XG4gIHJldHVybiBtYXA7XG59XG5cbmNvbnN0IHZhbHVlSGFzUGFpckNvbW1lbnQgPSAoe1xuICBjb250ZXh0OiB7XG4gICAgbGluZVN0YXJ0LFxuICAgIG5vZGUsXG4gICAgc3JjXG4gIH0sXG4gIHByb3BzXG59KSA9PiB7XG4gIGlmIChwcm9wcy5sZW5ndGggPT09IDApIHJldHVybiBmYWxzZTtcbiAgY29uc3Qge1xuICAgIHN0YXJ0XG4gIH0gPSBwcm9wc1swXTtcbiAgaWYgKG5vZGUgJiYgc3RhcnQgPiBub2RlLnZhbHVlUmFuZ2Uuc3RhcnQpIHJldHVybiBmYWxzZTtcbiAgaWYgKHNyY1tzdGFydF0gIT09IENoYXIuQ09NTUVOVCkgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAobGV0IGkgPSBsaW5lU3RhcnQ7IGkgPCBzdGFydDsgKytpKSBpZiAoc3JjW2ldID09PSAnXFxuJykgcmV0dXJuIGZhbHNlO1xuXG4gIHJldHVybiB0cnVlO1xufTtcblxuZnVuY3Rpb24gcmVzb2x2ZVBhaXJDb21tZW50KGl0ZW0sIHBhaXIpIHtcbiAgaWYgKCF2YWx1ZUhhc1BhaXJDb21tZW50KGl0ZW0pKSByZXR1cm47XG4gIGNvbnN0IGNvbW1lbnQgPSBpdGVtLmdldFByb3BWYWx1ZSgwLCBDaGFyLkNPTU1FTlQsIHRydWUpO1xuICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgY29uc3QgY2IgPSBwYWlyLnZhbHVlLmNvbW1lbnRCZWZvcmU7XG5cbiAgaWYgKGNiICYmIGNiLnN0YXJ0c1dpdGgoY29tbWVudCkpIHtcbiAgICBwYWlyLnZhbHVlLmNvbW1lbnRCZWZvcmUgPSBjYi5zdWJzdHIoY29tbWVudC5sZW5ndGggKyAxKTtcbiAgICBmb3VuZCA9IHRydWU7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY2MgPSBwYWlyLnZhbHVlLmNvbW1lbnQ7XG5cbiAgICBpZiAoIWl0ZW0ubm9kZSAmJiBjYyAmJiBjYy5zdGFydHNXaXRoKGNvbW1lbnQpKSB7XG4gICAgICBwYWlyLnZhbHVlLmNvbW1lbnQgPSBjYy5zdWJzdHIoY29tbWVudC5sZW5ndGggKyAxKTtcbiAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBpZiAoZm91bmQpIHBhaXIuY29tbWVudCA9IGNvbW1lbnQ7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCbG9ja01hcEl0ZW1zKGRvYywgY3N0KSB7XG4gIGNvbnN0IGNvbW1lbnRzID0gW107XG4gIGNvbnN0IGl0ZW1zID0gW107XG4gIGxldCBrZXkgPSB1bmRlZmluZWQ7XG4gIGxldCBrZXlTdGFydCA9IG51bGw7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjc3QuaXRlbXMubGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCBpdGVtID0gY3N0Lml0ZW1zW2ldO1xuXG4gICAgc3dpdGNoIChpdGVtLnR5cGUpIHtcbiAgICAgIGNhc2UgVHlwZS5CTEFOS19MSU5FOlxuICAgICAgICBjb21tZW50cy5wdXNoKHtcbiAgICAgICAgICBhZnRlcktleTogISFrZXksXG4gICAgICAgICAgYmVmb3JlOiBpdGVtcy5sZW5ndGhcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFR5cGUuQ09NTUVOVDpcbiAgICAgICAgY29tbWVudHMucHVzaCh7XG4gICAgICAgICAgYWZ0ZXJLZXk6ICEha2V5LFxuICAgICAgICAgIGJlZm9yZTogaXRlbXMubGVuZ3RoLFxuICAgICAgICAgIGNvbW1lbnQ6IGl0ZW0uY29tbWVudFxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgVHlwZS5NQVBfS0VZOlxuICAgICAgICBpZiAoa2V5ICE9PSB1bmRlZmluZWQpIGl0ZW1zLnB1c2gobmV3IFBhaXIoa2V5KSk7XG4gICAgICAgIGlmIChpdGVtLmVycm9yKSBkb2MuZXJyb3JzLnB1c2goaXRlbS5lcnJvcik7XG4gICAgICAgIGtleSA9IHJlc29sdmVOb2RlKGRvYywgaXRlbS5ub2RlKTtcbiAgICAgICAga2V5U3RhcnQgPSBudWxsO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBUeXBlLk1BUF9WQUxVRTpcbiAgICAgICAge1xuICAgICAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZCkga2V5ID0gbnVsbDtcbiAgICAgICAgICBpZiAoaXRlbS5lcnJvcikgZG9jLmVycm9ycy5wdXNoKGl0ZW0uZXJyb3IpO1xuXG4gICAgICAgICAgaWYgKCFpdGVtLmNvbnRleHQuYXRMaW5lU3RhcnQgJiYgaXRlbS5ub2RlICYmIGl0ZW0ubm9kZS50eXBlID09PSBUeXBlLk1BUCAmJiAhaXRlbS5ub2RlLmNvbnRleHQuYXRMaW5lU3RhcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IG1zZyA9ICdOZXN0ZWQgbWFwcGluZ3MgYXJlIG5vdCBhbGxvd2VkIGluIGNvbXBhY3QgbWFwcGluZ3MnO1xuICAgICAgICAgICAgZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihpdGVtLm5vZGUsIG1zZykpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCB2YWx1ZU5vZGUgPSBpdGVtLm5vZGU7XG5cbiAgICAgICAgICBpZiAoIXZhbHVlTm9kZSAmJiBpdGVtLnByb3BzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIENvbW1lbnRzIG9uIGFuIGVtcHR5IG1hcHBpbmcgdmFsdWUgbmVlZCB0byBiZSBwcmVzZXJ2ZWQsIHNvIHdlXG4gICAgICAgICAgICAvLyBuZWVkIHRvIGNvbnN0cnVjdCBhIG1pbmltYWwgZW1wdHkgbm9kZSBoZXJlIHRvIHVzZSBpbnN0ZWFkIG9mIHRoZVxuICAgICAgICAgICAgLy8gbWlzc2luZyBgaXRlbS5ub2RlYC4gLS0gZWVtZWxpL3lhbWwjMTlcbiAgICAgICAgICAgIHZhbHVlTm9kZSA9IG5ldyBQbGFpblZhbHVlKFR5cGUuUExBSU4sIFtdKTtcbiAgICAgICAgICAgIHZhbHVlTm9kZS5jb250ZXh0ID0ge1xuICAgICAgICAgICAgICBwYXJlbnQ6IGl0ZW0sXG4gICAgICAgICAgICAgIHNyYzogaXRlbS5jb250ZXh0LnNyY1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvbnN0IHBvcyA9IGl0ZW0ucmFuZ2Uuc3RhcnQgKyAxO1xuICAgICAgICAgICAgdmFsdWVOb2RlLnJhbmdlID0ge1xuICAgICAgICAgICAgICBzdGFydDogcG9zLFxuICAgICAgICAgICAgICBlbmQ6IHBvc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHZhbHVlTm9kZS52YWx1ZVJhbmdlID0ge1xuICAgICAgICAgICAgICBzdGFydDogcG9zLFxuICAgICAgICAgICAgICBlbmQ6IHBvc1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBpdGVtLnJhbmdlLm9yaWdTdGFydCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgY29uc3Qgb3JpZ1BvcyA9IGl0ZW0ucmFuZ2Uub3JpZ1N0YXJ0ICsgMTtcbiAgICAgICAgICAgICAgdmFsdWVOb2RlLnJhbmdlLm9yaWdTdGFydCA9IHZhbHVlTm9kZS5yYW5nZS5vcmlnRW5kID0gb3JpZ1BvcztcbiAgICAgICAgICAgICAgdmFsdWVOb2RlLnZhbHVlUmFuZ2Uub3JpZ1N0YXJ0ID0gdmFsdWVOb2RlLnZhbHVlUmFuZ2Uub3JpZ0VuZCA9IG9yaWdQb3M7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcGFpciA9IG5ldyBQYWlyKGtleSwgcmVzb2x2ZU5vZGUoZG9jLCB2YWx1ZU5vZGUpKTtcbiAgICAgICAgICByZXNvbHZlUGFpckNvbW1lbnQoaXRlbSwgcGFpcik7XG4gICAgICAgICAgaXRlbXMucHVzaChwYWlyKTtcblxuICAgICAgICAgIGlmIChrZXkgJiYgdHlwZW9mIGtleVN0YXJ0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgaWYgKGl0ZW0ucmFuZ2Uuc3RhcnQgPiBrZXlTdGFydCArIDEwMjQpIGRvYy5lcnJvcnMucHVzaChnZXRMb25nS2V5RXJyb3IoY3N0LCBrZXkpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgICAgICAga2V5U3RhcnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAoa2V5ICE9PSB1bmRlZmluZWQpIGl0ZW1zLnB1c2gobmV3IFBhaXIoa2V5KSk7XG4gICAgICAgIGtleSA9IHJlc29sdmVOb2RlKGRvYywgaXRlbSk7XG4gICAgICAgIGtleVN0YXJ0ID0gaXRlbS5yYW5nZS5zdGFydDtcbiAgICAgICAgaWYgKGl0ZW0uZXJyb3IpIGRvYy5lcnJvcnMucHVzaChpdGVtLmVycm9yKTtcblxuICAgICAgICBuZXh0OiBmb3IgKGxldCBqID0gaSArIDE7OyArK2opIHtcbiAgICAgICAgICBjb25zdCBuZXh0SXRlbSA9IGNzdC5pdGVtc1tqXTtcblxuICAgICAgICAgIHN3aXRjaCAobmV4dEl0ZW0gJiYgbmV4dEl0ZW0udHlwZSkge1xuICAgICAgICAgICAgY2FzZSBUeXBlLkJMQU5LX0xJTkU6XG4gICAgICAgICAgICBjYXNlIFR5cGUuQ09NTUVOVDpcbiAgICAgICAgICAgICAgY29udGludWUgbmV4dDtcblxuICAgICAgICAgICAgY2FzZSBUeXBlLk1BUF9WQUxVRTpcbiAgICAgICAgICAgICAgYnJlYWsgbmV4dDtcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1zZyA9ICdJbXBsaWNpdCBtYXAga2V5cyBuZWVkIHRvIGJlIGZvbGxvd2VkIGJ5IG1hcCB2YWx1ZXMnO1xuICAgICAgICAgICAgICAgIGRvYy5lcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3IoaXRlbSwgbXNnKSk7XG4gICAgICAgICAgICAgICAgYnJlYWsgbmV4dDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnZhbHVlUmFuZ2VDb250YWluc05ld2xpbmUpIHtcbiAgICAgICAgICBjb25zdCBtc2cgPSAnSW1wbGljaXQgbWFwIGtleXMgbmVlZCB0byBiZSBvbiBhIHNpbmdsZSBsaW5lJztcbiAgICAgICAgICBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGl0ZW0sIG1zZykpO1xuICAgICAgICB9XG5cbiAgICB9XG4gIH1cblxuICBpZiAoa2V5ICE9PSB1bmRlZmluZWQpIGl0ZW1zLnB1c2gobmV3IFBhaXIoa2V5KSk7XG4gIHJldHVybiB7XG4gICAgY29tbWVudHMsXG4gICAgaXRlbXNcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZsb3dNYXBJdGVtcyhkb2MsIGNzdCkge1xuICBjb25zdCBjb21tZW50cyA9IFtdO1xuICBjb25zdCBpdGVtcyA9IFtdO1xuICBsZXQga2V5ID0gdW5kZWZpbmVkO1xuICBsZXQgZXhwbGljaXRLZXkgPSBmYWxzZTtcbiAgbGV0IG5leHQgPSAneyc7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjc3QuaXRlbXMubGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCBpdGVtID0gY3N0Lml0ZW1zW2ldO1xuXG4gICAgaWYgKHR5cGVvZiBpdGVtLmNoYXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIGNoYXIsXG4gICAgICAgIG9mZnNldFxuICAgICAgfSA9IGl0ZW07XG5cbiAgICAgIGlmIChjaGFyID09PSAnPycgJiYga2V5ID09PSB1bmRlZmluZWQgJiYgIWV4cGxpY2l0S2V5KSB7XG4gICAgICAgIGV4cGxpY2l0S2V5ID0gdHJ1ZTtcbiAgICAgICAgbmV4dCA9ICc6JztcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFyID09PSAnOicpIHtcbiAgICAgICAgaWYgKGtleSA9PT0gdW5kZWZpbmVkKSBrZXkgPSBudWxsO1xuXG4gICAgICAgIGlmIChuZXh0ID09PSAnOicpIHtcbiAgICAgICAgICBuZXh0ID0gJywnO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoZXhwbGljaXRLZXkpIHtcbiAgICAgICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQgJiYgY2hhciAhPT0gJywnKSBrZXkgPSBudWxsO1xuICAgICAgICAgIGV4cGxpY2l0S2V5ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpdGVtcy5wdXNoKG5ldyBQYWlyKGtleSkpO1xuICAgICAgICAgIGtleSA9IHVuZGVmaW5lZDtcblxuICAgICAgICAgIGlmIChjaGFyID09PSAnLCcpIHtcbiAgICAgICAgICAgIG5leHQgPSAnOic7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNoYXIgPT09ICd9Jykge1xuICAgICAgICBpZiAoaSA9PT0gY3N0Lml0ZW1zLmxlbmd0aCAtIDEpIGNvbnRpbnVlO1xuICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBuZXh0KSB7XG4gICAgICAgIG5leHQgPSAnOic7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtc2cgPSBcIkZsb3cgbWFwIGNvbnRhaW5zIGFuIHVuZXhwZWN0ZWQgXCIuY29uY2F0KGNoYXIpO1xuICAgICAgY29uc3QgZXJyID0gbmV3IFlBTUxTeW50YXhFcnJvcihjc3QsIG1zZyk7XG4gICAgICBlcnIub2Zmc2V0ID0gb2Zmc2V0O1xuICAgICAgZG9jLmVycm9ycy5wdXNoKGVycik7XG4gICAgfSBlbHNlIGlmIChpdGVtLnR5cGUgPT09IFR5cGUuQkxBTktfTElORSkge1xuICAgICAgY29tbWVudHMucHVzaCh7XG4gICAgICAgIGFmdGVyS2V5OiAhIWtleSxcbiAgICAgICAgYmVmb3JlOiBpdGVtcy5sZW5ndGhcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoaXRlbS50eXBlID09PSBUeXBlLkNPTU1FTlQpIHtcbiAgICAgIGNoZWNrRmxvd0NvbW1lbnRTcGFjZShkb2MuZXJyb3JzLCBpdGVtKTtcbiAgICAgIGNvbW1lbnRzLnB1c2goe1xuICAgICAgICBhZnRlcktleTogISFrZXksXG4gICAgICAgIGJlZm9yZTogaXRlbXMubGVuZ3RoLFxuICAgICAgICBjb21tZW50OiBpdGVtLmNvbW1lbnRcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoa2V5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChuZXh0ID09PSAnLCcpIGRvYy5lcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3IoaXRlbSwgJ1NlcGFyYXRvciAsIG1pc3NpbmcgaW4gZmxvdyBtYXAnKSk7XG4gICAgICBrZXkgPSByZXNvbHZlTm9kZShkb2MsIGl0ZW0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobmV4dCAhPT0gJywnKSBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGl0ZW0sICdJbmRpY2F0b3IgOiBtaXNzaW5nIGluIGZsb3cgbWFwIGVudHJ5JykpO1xuICAgICAgaXRlbXMucHVzaChuZXcgUGFpcihrZXksIHJlc29sdmVOb2RlKGRvYywgaXRlbSkpKTtcbiAgICAgIGtleSA9IHVuZGVmaW5lZDtcbiAgICAgIGV4cGxpY2l0S2V5ID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgY2hlY2tGbG93Q29sbGVjdGlvbkVuZChkb2MuZXJyb3JzLCBjc3QpO1xuICBpZiAoa2V5ICE9PSB1bmRlZmluZWQpIGl0ZW1zLnB1c2gobmV3IFBhaXIoa2V5KSk7XG4gIHJldHVybiB7XG4gICAgY29tbWVudHMsXG4gICAgaXRlbXNcbiAgfTtcbn1cblxuZXhwb3J0IHsgcmVzb2x2ZU1hcCB9O1xuIiwiaW1wb3J0IHsgUGFpciB9IGZyb20gJy4uL2FzdC9QYWlyLmpzJztcbmltcG9ydCB7IFlBTUxTZXEgfSBmcm9tICcuLi9hc3QvWUFNTFNlcS5qcyc7XG5pbXBvcnQgeyBUeXBlIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFlBTUxTeW50YXhFcnJvciwgWUFNTFNlbWFudGljRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZUNvbW1lbnRzLCBnZXRMb25nS2V5RXJyb3IsIGNoZWNrRmxvd0NvbW1lbnRTcGFjZSwgY2hlY2tGbG93Q29sbGVjdGlvbkVuZCB9IGZyb20gJy4vY29sbGVjdGlvbi11dGlscy5qcyc7XG5pbXBvcnQgeyByZXNvbHZlTm9kZSB9IGZyb20gJy4vcmVzb2x2ZU5vZGUuanMnO1xuXG5mdW5jdGlvbiByZXNvbHZlU2VxKGRvYywgY3N0KSB7XG4gIGNvbnN0IHtcbiAgICBjb21tZW50cyxcbiAgICBpdGVtc1xuICB9ID0gY3N0LnR5cGUgPT09IFR5cGUuRkxPV19TRVEgPyByZXNvbHZlRmxvd1NlcUl0ZW1zKGRvYywgY3N0KSA6IHJlc29sdmVCbG9ja1NlcUl0ZW1zKGRvYywgY3N0KTtcbiAgY29uc3Qgc2VxID0gbmV3IFlBTUxTZXEoZG9jLnNjaGVtYSk7XG4gIHNlcS5pdGVtcyA9IGl0ZW1zO1xuICByZXNvbHZlQ29tbWVudHMoc2VxLCBjb21tZW50cyk7XG4gIGNzdC5yZXNvbHZlZCA9IHNlcTtcbiAgcmV0dXJuIHNlcTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJsb2NrU2VxSXRlbXMoZG9jLCBjc3QpIHtcbiAgY29uc3QgY29tbWVudHMgPSBbXTtcbiAgY29uc3QgaXRlbXMgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGNzdC5pdGVtcy5sZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IGl0ZW0gPSBjc3QuaXRlbXNbaV07XG5cbiAgICBzd2l0Y2ggKGl0ZW0udHlwZSkge1xuICAgICAgY2FzZSBUeXBlLkJMQU5LX0xJTkU6XG4gICAgICAgIGNvbW1lbnRzLnB1c2goe1xuICAgICAgICAgIGJlZm9yZTogaXRlbXMubGVuZ3RoXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBUeXBlLkNPTU1FTlQ6XG4gICAgICAgIGNvbW1lbnRzLnB1c2goe1xuICAgICAgICAgIGNvbW1lbnQ6IGl0ZW0uY29tbWVudCxcbiAgICAgICAgICBiZWZvcmU6IGl0ZW1zLmxlbmd0aFxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgVHlwZS5TRVFfSVRFTTpcbiAgICAgICAgaWYgKGl0ZW0uZXJyb3IpIGRvYy5lcnJvcnMucHVzaChpdGVtLmVycm9yKTtcbiAgICAgICAgaXRlbXMucHVzaChyZXNvbHZlTm9kZShkb2MsIGl0ZW0ubm9kZSkpO1xuXG4gICAgICAgIGlmIChpdGVtLmhhc1Byb3BzKSB7XG4gICAgICAgICAgY29uc3QgbXNnID0gJ1NlcXVlbmNlIGl0ZW1zIGNhbm5vdCBoYXZlIHRhZ3Mgb3IgYW5jaG9ycyBiZWZvcmUgdGhlIC0gaW5kaWNhdG9yJztcbiAgICAgICAgICBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGl0ZW0sIG1zZykpO1xuICAgICAgICB9XG5cbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChpdGVtLmVycm9yKSBkb2MuZXJyb3JzLnB1c2goaXRlbS5lcnJvcik7XG4gICAgICAgIGRvYy5lcnJvcnMucHVzaChuZXcgWUFNTFN5bnRheEVycm9yKGl0ZW0sIFwiVW5leHBlY3RlZCBcIi5jb25jYXQoaXRlbS50eXBlLCBcIiBub2RlIGluIHNlcXVlbmNlXCIpKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBjb21tZW50cyxcbiAgICBpdGVtc1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlRmxvd1NlcUl0ZW1zKGRvYywgY3N0KSB7XG4gIGNvbnN0IGNvbW1lbnRzID0gW107XG4gIGNvbnN0IGl0ZW1zID0gW107XG4gIGxldCBleHBsaWNpdEtleSA9IGZhbHNlO1xuICBsZXQga2V5ID0gdW5kZWZpbmVkO1xuICBsZXQga2V5U3RhcnQgPSBudWxsO1xuICBsZXQgbmV4dCA9ICdbJztcbiAgbGV0IHByZXZJdGVtID0gbnVsbDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGNzdC5pdGVtcy5sZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IGl0ZW0gPSBjc3QuaXRlbXNbaV07XG5cbiAgICBpZiAodHlwZW9mIGl0ZW0uY2hhciA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgY2hhcixcbiAgICAgICAgb2Zmc2V0XG4gICAgICB9ID0gaXRlbTtcblxuICAgICAgaWYgKGNoYXIgIT09ICc6JyAmJiAoZXhwbGljaXRLZXkgfHwga2V5ICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICAgIGlmIChleHBsaWNpdEtleSAmJiBrZXkgPT09IHVuZGVmaW5lZCkga2V5ID0gbmV4dCA/IGl0ZW1zLnBvcCgpIDogbnVsbDtcbiAgICAgICAgaXRlbXMucHVzaChuZXcgUGFpcihrZXkpKTtcbiAgICAgICAgZXhwbGljaXRLZXkgPSBmYWxzZTtcbiAgICAgICAga2V5ID0gdW5kZWZpbmVkO1xuICAgICAgICBrZXlTdGFydCA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFyID09PSBuZXh0KSB7XG4gICAgICAgIG5leHQgPSBudWxsO1xuICAgICAgfSBlbHNlIGlmICghbmV4dCAmJiBjaGFyID09PSAnPycpIHtcbiAgICAgICAgZXhwbGljaXRLZXkgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChuZXh0ICE9PSAnWycgJiYgY2hhciA9PT0gJzonICYmIGtleSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChuZXh0ID09PSAnLCcpIHtcbiAgICAgICAgICBrZXkgPSBpdGVtcy5wb3AoKTtcblxuICAgICAgICAgIGlmIChrZXkgaW5zdGFuY2VvZiBQYWlyKSB7XG4gICAgICAgICAgICBjb25zdCBtc2cgPSAnQ2hhaW5pbmcgZmxvdyBzZXF1ZW5jZSBwYWlycyBpcyBpbnZhbGlkJztcbiAgICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBZQU1MU2VtYW50aWNFcnJvcihjc3QsIG1zZyk7XG4gICAgICAgICAgICBlcnIub2Zmc2V0ID0gb2Zmc2V0O1xuICAgICAgICAgICAgZG9jLmVycm9ycy5wdXNoKGVycik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFleHBsaWNpdEtleSAmJiB0eXBlb2Yga2V5U3RhcnQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBjb25zdCBrZXlFbmQgPSBpdGVtLnJhbmdlID8gaXRlbS5yYW5nZS5zdGFydCA6IGl0ZW0ub2Zmc2V0O1xuICAgICAgICAgICAgaWYgKGtleUVuZCA+IGtleVN0YXJ0ICsgMTAyNCkgZG9jLmVycm9ycy5wdXNoKGdldExvbmdLZXlFcnJvcihjc3QsIGtleSkpO1xuICAgICAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgICBzcmNcbiAgICAgICAgICAgIH0gPSBwcmV2SXRlbS5jb250ZXh0O1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0ga2V5U3RhcnQ7IGkgPCBrZXlFbmQ7ICsraSkgaWYgKHNyY1tpXSA9PT0gJ1xcbicpIHtcbiAgICAgICAgICAgICAgY29uc3QgbXNnID0gJ0ltcGxpY2l0IGtleXMgb2YgZmxvdyBzZXF1ZW5jZSBwYWlycyBuZWVkIHRvIGJlIG9uIGEgc2luZ2xlIGxpbmUnO1xuICAgICAgICAgICAgICBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKHByZXZJdGVtLCBtc2cpKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGtleSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBrZXlTdGFydCA9IG51bGw7XG4gICAgICAgIGV4cGxpY2l0S2V5ID0gZmFsc2U7XG4gICAgICAgIG5leHQgPSBudWxsO1xuICAgICAgfSBlbHNlIGlmIChuZXh0ID09PSAnWycgfHwgY2hhciAhPT0gJ10nIHx8IGkgPCBjc3QuaXRlbXMubGVuZ3RoIC0gMSkge1xuICAgICAgICBjb25zdCBtc2cgPSBcIkZsb3cgc2VxdWVuY2UgY29udGFpbnMgYW4gdW5leHBlY3RlZCBcIi5jb25jYXQoY2hhcik7XG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBZQU1MU3ludGF4RXJyb3IoY3N0LCBtc2cpO1xuICAgICAgICBlcnIub2Zmc2V0ID0gb2Zmc2V0O1xuICAgICAgICBkb2MuZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGl0ZW0udHlwZSA9PT0gVHlwZS5CTEFOS19MSU5FKSB7XG4gICAgICBjb21tZW50cy5wdXNoKHtcbiAgICAgICAgYmVmb3JlOiBpdGVtcy5sZW5ndGhcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoaXRlbS50eXBlID09PSBUeXBlLkNPTU1FTlQpIHtcbiAgICAgIGNoZWNrRmxvd0NvbW1lbnRTcGFjZShkb2MuZXJyb3JzLCBpdGVtKTtcbiAgICAgIGNvbW1lbnRzLnB1c2goe1xuICAgICAgICBjb21tZW50OiBpdGVtLmNvbW1lbnQsXG4gICAgICAgIGJlZm9yZTogaXRlbXMubGVuZ3RoXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgY29uc3QgbXNnID0gXCJFeHBlY3RlZCBhIFwiLmNvbmNhdChuZXh0LCBcIiBpbiBmbG93IHNlcXVlbmNlXCIpO1xuICAgICAgICBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGl0ZW0sIG1zZykpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB2YWx1ZSA9IHJlc29sdmVOb2RlKGRvYywgaXRlbSk7XG5cbiAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpdGVtcy5wdXNoKHZhbHVlKTtcbiAgICAgICAgcHJldkl0ZW0gPSBpdGVtO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaXRlbXMucHVzaChuZXcgUGFpcihrZXksIHZhbHVlKSk7XG4gICAgICAgIGtleSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAga2V5U3RhcnQgPSBpdGVtLnJhbmdlLnN0YXJ0O1xuICAgICAgbmV4dCA9ICcsJztcbiAgICB9XG4gIH1cblxuICBjaGVja0Zsb3dDb2xsZWN0aW9uRW5kKGRvYy5lcnJvcnMsIGNzdCk7XG4gIGlmIChrZXkgIT09IHVuZGVmaW5lZCkgaXRlbXMucHVzaChuZXcgUGFpcihrZXkpKTtcbiAgcmV0dXJuIHtcbiAgICBjb21tZW50cyxcbiAgICBpdGVtc1xuICB9O1xufVxuXG5leHBvcnQgeyByZXNvbHZlU2VxIH07XG4iLCJpbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi4vYXN0L0NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgU2NhbGFyIH0gZnJvbSAnLi4vYXN0L1NjYWxhci5qcyc7XG5pbXBvcnQgeyBUeXBlLCBkZWZhdWx0VGFncyB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MU2VtYW50aWNFcnJvciwgWUFNTFdhcm5pbmcsIFlBTUxSZWZlcmVuY2VFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyByZXNvbHZlTWFwIH0gZnJvbSAnLi9yZXNvbHZlTWFwLmpzJztcbmltcG9ydCB7IHJlc29sdmVTY2FsYXIgfSBmcm9tICcuL3Jlc29sdmVTY2FsYXIuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZVNlcSB9IGZyb20gJy4vcmVzb2x2ZVNlcS5qcyc7XG5cbmZ1bmN0aW9uIHJlc29sdmVCeVRhZ05hbWUoe1xuICBrbm93blRhZ3MsXG4gIHRhZ3Ncbn0sIHRhZ05hbWUsIHZhbHVlLCBvbkVycm9yKSB7XG4gIGNvbnN0IG1hdGNoV2l0aFRlc3QgPSBbXTtcblxuICBmb3IgKGNvbnN0IHRhZyBvZiB0YWdzKSB7XG4gICAgaWYgKHRhZy50YWcgPT09IHRhZ05hbWUpIHtcbiAgICAgIGlmICh0YWcudGVzdCkge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgbWF0Y2hXaXRoVGVzdC5wdXNoKHRhZyk7ZWxzZSBvbkVycm9yKFwiVGhlIHRhZyBcIi5jb25jYXQodGFnTmFtZSwgXCIgY2Fubm90IGJlIGFwcGxpZWQgdG8gYSBjb2xsZWN0aW9uXCIpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IHRhZy5yZXNvbHZlKHZhbHVlLCBvbkVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlcyBpbnN0YW5jZW9mIENvbGxlY3Rpb24gPyByZXMgOiBuZXcgU2NhbGFyKHJlcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKG1hdGNoV2l0aFRlc3QubGVuZ3RoID4gMCkgcmV0dXJuIHJlc29sdmVTY2FsYXIodmFsdWUsIG1hdGNoV2l0aFRlc3QpO1xuICBjb25zdCBrdCA9IGtub3duVGFnc1t0YWdOYW1lXTtcblxuICBpZiAoa3QpIHtcbiAgICB0YWdzLnB1c2goT2JqZWN0LmFzc2lnbih7fSwga3QsIHtcbiAgICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgICAgdGVzdDogdW5kZWZpbmVkXG4gICAgfSkpO1xuICAgIGNvbnN0IHJlcyA9IGt0LnJlc29sdmUodmFsdWUsIG9uRXJyb3IpO1xuICAgIHJldHVybiByZXMgaW5zdGFuY2VvZiBDb2xsZWN0aW9uID8gcmVzIDogbmV3IFNjYWxhcihyZXMpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVUYWcoZG9jLCBub2RlLCB0YWdOYW1lKSB7XG4gIGNvbnN0IHtcbiAgICBNQVAsXG4gICAgU0VRLFxuICAgIFNUUlxuICB9ID0gZGVmYXVsdFRhZ3M7XG4gIGxldCB2YWx1ZSwgZmFsbGJhY2s7XG5cbiAgY29uc3Qgb25FcnJvciA9IG1lc3NhZ2UgPT4gZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihub2RlLCBtZXNzYWdlKSk7XG5cbiAgdHJ5IHtcbiAgICBzd2l0Y2ggKG5vZGUudHlwZSkge1xuICAgICAgY2FzZSBUeXBlLkZMT1dfTUFQOlxuICAgICAgY2FzZSBUeXBlLk1BUDpcbiAgICAgICAgdmFsdWUgPSByZXNvbHZlTWFwKGRvYywgbm9kZSk7XG4gICAgICAgIGZhbGxiYWNrID0gTUFQO1xuICAgICAgICBpZiAodGFnTmFtZSA9PT0gU0VRIHx8IHRhZ05hbWUgPT09IFNUUikgb25FcnJvcihcIlRoZSB0YWcgXCIuY29uY2F0KHRhZ05hbWUsIFwiIGNhbm5vdCBiZSBhcHBsaWVkIHRvIGEgbWFwcGluZ1wiKSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFR5cGUuRkxPV19TRVE6XG4gICAgICBjYXNlIFR5cGUuU0VROlxuICAgICAgICB2YWx1ZSA9IHJlc29sdmVTZXEoZG9jLCBub2RlKTtcbiAgICAgICAgZmFsbGJhY2sgPSBTRVE7XG4gICAgICAgIGlmICh0YWdOYW1lID09PSBNQVAgfHwgdGFnTmFtZSA9PT0gU1RSKSBvbkVycm9yKFwiVGhlIHRhZyBcIi5jb25jYXQodGFnTmFtZSwgXCIgY2Fubm90IGJlIGFwcGxpZWQgdG8gYSBzZXF1ZW5jZVwiKSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB2YWx1ZSA9IG5vZGUuc3RyVmFsdWUgfHwgJyc7XG5cbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB2YWx1ZS5lcnJvcnMuZm9yRWFjaChlcnJvciA9PiBkb2MuZXJyb3JzLnB1c2goZXJyb3IpKTtcbiAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnN0cjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0YWdOYW1lID09PSBNQVAgfHwgdGFnTmFtZSA9PT0gU0VRKSBvbkVycm9yKFwiVGhlIHRhZyBcIi5jb25jYXQodGFnTmFtZSwgXCIgY2Fubm90IGJlIGFwcGxpZWQgdG8gYSBzY2FsYXJcIikpO1xuICAgICAgICBmYWxsYmFjayA9IFNUUjtcbiAgICB9XG5cbiAgICBjb25zdCByZXMgPSByZXNvbHZlQnlUYWdOYW1lKGRvYy5zY2hlbWEsIHRhZ05hbWUsIHZhbHVlLCBvbkVycm9yKTtcblxuICAgIGlmIChyZXMpIHtcbiAgICAgIGlmICh0YWdOYW1lICYmIG5vZGUudGFnKSByZXMudGFnID0gdGFnTmFtZTtcbiAgICAgIHJldHVybiByZXM7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmICghZXJyb3Iuc291cmNlKSBlcnJvci5zb3VyY2UgPSBub2RlO1xuICAgIGRvYy5lcnJvcnMucHVzaChlcnJvcik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB0cnkge1xuICAgIGlmICghZmFsbGJhY2spIHRocm93IG5ldyBFcnJvcihcIlRoZSB0YWcgXCIuY29uY2F0KHRhZ05hbWUsIFwiIGlzIHVuYXZhaWxhYmxlXCIpKTtcbiAgICBjb25zdCBtc2cgPSBcIlRoZSB0YWcgXCIuY29uY2F0KHRhZ05hbWUsIFwiIGlzIHVuYXZhaWxhYmxlLCBmYWxsaW5nIGJhY2sgdG8gXCIpLmNvbmNhdChmYWxsYmFjayk7XG4gICAgZG9jLndhcm5pbmdzLnB1c2gobmV3IFlBTUxXYXJuaW5nKG5vZGUsIG1zZykpO1xuICAgIGNvbnN0IHJlcyA9IHJlc29sdmVCeVRhZ05hbWUoZG9jLnNjaGVtYSwgZmFsbGJhY2ssIHZhbHVlLCBvbkVycm9yKTtcbiAgICByZXMudGFnID0gdGFnTmFtZTtcbiAgICByZXR1cm4gcmVzO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnN0IHJlZkVycm9yID0gbmV3IFlBTUxSZWZlcmVuY2VFcnJvcihub2RlLCBlcnJvci5tZXNzYWdlKTtcbiAgICByZWZFcnJvci5zdGFjayA9IGVycm9yLnN0YWNrO1xuICAgIGRvYy5lcnJvcnMucHVzaChyZWZFcnJvcik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IHsgcmVzb2x2ZVRhZyB9O1xuIiwiaW1wb3J0IHsgQWxpYXMgfSBmcm9tICcuLi9hc3QvQWxpYXMuanMnO1xuaW1wb3J0IHsgVHlwZSwgQ2hhciB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MU2VtYW50aWNFcnJvciwgWUFNTFJlZmVyZW5jZUVycm9yLCBZQU1MU3ludGF4RXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZVNjYWxhciB9IGZyb20gJy4vcmVzb2x2ZVNjYWxhci5qcyc7XG5pbXBvcnQgeyByZXNvbHZlVGFnTmFtZSB9IGZyb20gJy4vcmVzb2x2ZVRhZ05hbWUuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZVRhZyB9IGZyb20gJy4vcmVzb2x2ZVRhZy5qcyc7XG5cbmNvbnN0IGlzQ29sbGVjdGlvbkl0ZW0gPSBub2RlID0+IHtcbiAgaWYgKCFub2RlKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHtcbiAgICB0eXBlXG4gIH0gPSBub2RlO1xuICByZXR1cm4gdHlwZSA9PT0gVHlwZS5NQVBfS0VZIHx8IHR5cGUgPT09IFR5cGUuTUFQX1ZBTFVFIHx8IHR5cGUgPT09IFR5cGUuU0VRX0lURU07XG59O1xuXG5mdW5jdGlvbiByZXNvbHZlTm9kZVByb3BzKGVycm9ycywgbm9kZSkge1xuICBjb25zdCBjb21tZW50cyA9IHtcbiAgICBiZWZvcmU6IFtdLFxuICAgIGFmdGVyOiBbXVxuICB9O1xuICBsZXQgaGFzQW5jaG9yID0gZmFsc2U7XG4gIGxldCBoYXNUYWcgPSBmYWxzZTtcbiAgY29uc3QgcHJvcHMgPSBpc0NvbGxlY3Rpb25JdGVtKG5vZGUuY29udGV4dC5wYXJlbnQpID8gbm9kZS5jb250ZXh0LnBhcmVudC5wcm9wcy5jb25jYXQobm9kZS5wcm9wcykgOiBub2RlLnByb3BzO1xuXG4gIGZvciAoY29uc3Qge1xuICAgIHN0YXJ0LFxuICAgIGVuZFxuICB9IG9mIHByb3BzKSB7XG4gICAgc3dpdGNoIChub2RlLmNvbnRleHQuc3JjW3N0YXJ0XSkge1xuICAgICAgY2FzZSBDaGFyLkNPTU1FTlQ6XG4gICAgICAgIHtcbiAgICAgICAgICBpZiAoIW5vZGUuY29tbWVudEhhc1JlcXVpcmVkV2hpdGVzcGFjZShzdGFydCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1zZyA9ICdDb21tZW50cyBtdXN0IGJlIHNlcGFyYXRlZCBmcm9tIG90aGVyIHRva2VucyBieSB3aGl0ZSBzcGFjZSBjaGFyYWN0ZXJzJztcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihub2RlLCBtc2cpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBoZWFkZXIsXG4gICAgICAgICAgICB2YWx1ZVJhbmdlXG4gICAgICAgICAgfSA9IG5vZGU7XG4gICAgICAgICAgY29uc3QgY2MgPSB2YWx1ZVJhbmdlICYmIChzdGFydCA+IHZhbHVlUmFuZ2Uuc3RhcnQgfHwgaGVhZGVyICYmIHN0YXJ0ID4gaGVhZGVyLnN0YXJ0KSA/IGNvbW1lbnRzLmFmdGVyIDogY29tbWVudHMuYmVmb3JlO1xuICAgICAgICAgIGNjLnB1c2gobm9kZS5jb250ZXh0LnNyYy5zbGljZShzdGFydCArIDEsIGVuZCkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAvLyBBY3R1YWwgYW5jaG9yICYgdGFnIHJlc29sdXRpb24gaXMgaGFuZGxlZCBieSBzY2hlbWEsIGhlcmUgd2UganVzdCBjb21wbGFpblxuXG4gICAgICBjYXNlIENoYXIuQU5DSE9SOlxuICAgICAgICBpZiAoaGFzQW5jaG9yKSB7XG4gICAgICAgICAgY29uc3QgbXNnID0gJ0Egbm9kZSBjYW4gaGF2ZSBhdCBtb3N0IG9uZSBhbmNob3InO1xuICAgICAgICAgIGVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihub2RlLCBtc2cpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGhhc0FuY2hvciA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIENoYXIuVEFHOlxuICAgICAgICBpZiAoaGFzVGFnKSB7XG4gICAgICAgICAgY29uc3QgbXNnID0gJ0Egbm9kZSBjYW4gaGF2ZSBhdCBtb3N0IG9uZSB0YWcnO1xuICAgICAgICAgIGVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihub2RlLCBtc2cpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGhhc1RhZyA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY29tbWVudHMsXG4gICAgaGFzQW5jaG9yLFxuICAgIGhhc1RhZ1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTm9kZVZhbHVlKGRvYywgbm9kZSkge1xuICBjb25zdCB7XG4gICAgYW5jaG9ycyxcbiAgICBlcnJvcnMsXG4gICAgc2NoZW1hXG4gIH0gPSBkb2M7XG5cbiAgaWYgKG5vZGUudHlwZSA9PT0gVHlwZS5BTElBUykge1xuICAgIGNvbnN0IG5hbWUgPSBub2RlLnJhd1ZhbHVlO1xuICAgIGNvbnN0IHNyYyA9IGFuY2hvcnMuZ2V0Tm9kZShuYW1lKTtcblxuICAgIGlmICghc3JjKSB7XG4gICAgICBjb25zdCBtc2cgPSBcIkFsaWFzZWQgYW5jaG9yIG5vdCBmb3VuZDogXCIuY29uY2F0KG5hbWUpO1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFlBTUxSZWZlcmVuY2VFcnJvcihub2RlLCBtc2cpKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gLy8gTGF6eSByZXNvbHV0aW9uIGZvciBjaXJjdWxhciByZWZlcmVuY2VzXG5cblxuICAgIGNvbnN0IHJlcyA9IG5ldyBBbGlhcyhzcmMpO1xuXG4gICAgYW5jaG9ycy5fY3N0QWxpYXNlcy5wdXNoKHJlcyk7XG5cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgY29uc3QgdGFnTmFtZSA9IHJlc29sdmVUYWdOYW1lKGRvYywgbm9kZSk7XG4gIGlmICh0YWdOYW1lKSByZXR1cm4gcmVzb2x2ZVRhZyhkb2MsIG5vZGUsIHRhZ05hbWUpO1xuXG4gIGlmIChub2RlLnR5cGUgIT09IFR5cGUuUExBSU4pIHtcbiAgICBjb25zdCBtc2cgPSBcIkZhaWxlZCB0byByZXNvbHZlIFwiLmNvbmNhdChub2RlLnR5cGUsIFwiIG5vZGUgaGVyZVwiKTtcbiAgICBlcnJvcnMucHVzaChuZXcgWUFNTFN5bnRheEVycm9yKG5vZGUsIG1zZykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBsZXQgc3RyID0gbm9kZS5zdHJWYWx1ZSB8fCAnJztcblxuICAgIGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykge1xuICAgICAgc3RyLmVycm9ycy5mb3JFYWNoKGVycm9yID0+IGRvYy5lcnJvcnMucHVzaChlcnJvcikpO1xuICAgICAgc3RyID0gc3RyLnN0cjtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzb2x2ZVNjYWxhcihzdHIsIHNjaGVtYS50YWdzKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoIWVycm9yLnNvdXJjZSkgZXJyb3Iuc291cmNlID0gbm9kZTtcbiAgICBlcnJvcnMucHVzaChlcnJvcik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn0gLy8gc2V0cyBub2RlLnJlc29sdmVkIG9uIHN1Y2Nlc3NcblxuXG5mdW5jdGlvbiByZXNvbHZlTm9kZShkb2MsIG5vZGUpIHtcbiAgaWYgKCFub2RlKSByZXR1cm4gbnVsbDtcbiAgaWYgKG5vZGUuZXJyb3IpIGRvYy5lcnJvcnMucHVzaChub2RlLmVycm9yKTtcbiAgY29uc3Qge1xuICAgIGNvbW1lbnRzLFxuICAgIGhhc0FuY2hvcixcbiAgICBoYXNUYWdcbiAgfSA9IHJlc29sdmVOb2RlUHJvcHMoZG9jLmVycm9ycywgbm9kZSk7XG5cbiAgaWYgKGhhc0FuY2hvcikge1xuICAgIGNvbnN0IHtcbiAgICAgIGFuY2hvcnNcbiAgICB9ID0gZG9jO1xuICAgIGNvbnN0IG5hbWUgPSBub2RlLmFuY2hvcjtcbiAgICBjb25zdCBwcmV2ID0gYW5jaG9ycy5nZXROb2RlKG5hbWUpOyAvLyBBdCB0aGlzIHBvaW50LCBhbGlhc2VzIGZvciBhbnkgcHJlY2VkaW5nIG5vZGUgd2l0aCB0aGUgc2FtZSBhbmNob3JcbiAgICAvLyBuYW1lIGhhdmUgYWxyZWFkeSBiZWVuIHJlc29sdmVkLCBzbyBpdCBtYXkgc2FmZWx5IGJlIHJlbmFtZWQuXG5cbiAgICBpZiAocHJldikgYW5jaG9ycy5tYXBbYW5jaG9ycy5uZXdOYW1lKG5hbWUpXSA9IHByZXY7IC8vIER1cmluZyBwYXJzaW5nLCB3ZSBuZWVkIHRvIHN0b3JlIHRoZSBDU1Qgbm9kZSBpbiBhbmNob3JzLm1hcCBhc1xuICAgIC8vIGFuY2hvcnMgbmVlZCB0byBiZSBhdmFpbGFibGUgZHVyaW5nIHJlc29sdXRpb24gdG8gYWxsb3cgZm9yXG4gICAgLy8gY2lyY3VsYXIgcmVmZXJlbmNlcy5cblxuICAgIGFuY2hvcnMubWFwW25hbWVdID0gbm9kZTtcbiAgfVxuXG4gIGlmIChub2RlLnR5cGUgPT09IFR5cGUuQUxJQVMgJiYgKGhhc0FuY2hvciB8fCBoYXNUYWcpKSB7XG4gICAgY29uc3QgbXNnID0gJ0FuIGFsaWFzIG5vZGUgbXVzdCBub3Qgc3BlY2lmeSBhbnkgcHJvcGVydGllcyc7XG4gICAgZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihub2RlLCBtc2cpKTtcbiAgfVxuXG4gIGNvbnN0IHJlcyA9IHJlc29sdmVOb2RlVmFsdWUoZG9jLCBub2RlKTtcblxuICBpZiAocmVzKSB7XG4gICAgcmVzLnJhbmdlID0gW25vZGUucmFuZ2Uuc3RhcnQsIG5vZGUucmFuZ2UuZW5kXTtcbiAgICBpZiAoZG9jLm9wdGlvbnMua2VlcENzdE5vZGVzKSByZXMuY3N0Tm9kZSA9IG5vZGU7XG4gICAgaWYgKGRvYy5vcHRpb25zLmtlZXBOb2RlVHlwZXMpIHJlcy50eXBlID0gbm9kZS50eXBlO1xuICAgIGNvbnN0IGNiID0gY29tbWVudHMuYmVmb3JlLmpvaW4oJ1xcbicpO1xuXG4gICAgaWYgKGNiKSB7XG4gICAgICByZXMuY29tbWVudEJlZm9yZSA9IHJlcy5jb21tZW50QmVmb3JlID8gXCJcIi5jb25jYXQocmVzLmNvbW1lbnRCZWZvcmUsIFwiXFxuXCIpLmNvbmNhdChjYikgOiBjYjtcbiAgICB9XG5cbiAgICBjb25zdCBjYSA9IGNvbW1lbnRzLmFmdGVyLmpvaW4oJ1xcbicpO1xuICAgIGlmIChjYSkgcmVzLmNvbW1lbnQgPSByZXMuY29tbWVudCA/IFwiXCIuY29uY2F0KHJlcy5jb21tZW50LCBcIlxcblwiKS5jb25jYXQoY2EpIDogY2E7XG4gIH1cblxuICByZXR1cm4gbm9kZS5yZXNvbHZlZCA9IHJlcztcbn1cblxuZXhwb3J0IHsgcmVzb2x2ZU5vZGUgfTtcbiIsImltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWUFNTFN5bnRheEVycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IHJlc29sdmVOb2RlIH0gZnJvbSAnLi4vcmVzb2x2ZS9yZXNvbHZlTm9kZS5qcyc7XG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi4vYXN0L0NvbGxlY3Rpb24uanMnO1xuXG5mdW5jdGlvbiBwYXJzZUNvbnRlbnRzKGRvYywgY29udGVudHMpIHtcbiAgY29uc3QgY29tbWVudHMgPSB7XG4gICAgYmVmb3JlOiBbXSxcbiAgICBhZnRlcjogW11cbiAgfTtcbiAgbGV0IGJvZHkgPSB1bmRlZmluZWQ7XG4gIGxldCBzcGFjZUJlZm9yZSA9IGZhbHNlO1xuXG4gIGZvciAoY29uc3Qgbm9kZSBvZiBjb250ZW50cykge1xuICAgIGlmIChub2RlLnZhbHVlUmFuZ2UpIHtcbiAgICAgIGlmIChib2R5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgbXNnID0gJ0RvY3VtZW50IGNvbnRhaW5zIHRyYWlsaW5nIGNvbnRlbnQgbm90IHNlcGFyYXRlZCBieSBhIC4uLiBvciAtLS0gbGluZSc7XG4gICAgICAgIGRvYy5lcnJvcnMucHVzaChuZXcgWUFNTFN5bnRheEVycm9yKG5vZGUsIG1zZykpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzID0gcmVzb2x2ZU5vZGUoZG9jLCBub2RlKTtcblxuICAgICAgaWYgKHNwYWNlQmVmb3JlKSB7XG4gICAgICAgIHJlcy5zcGFjZUJlZm9yZSA9IHRydWU7XG4gICAgICAgIHNwYWNlQmVmb3JlID0gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGJvZHkgPSByZXM7XG4gICAgfSBlbHNlIGlmIChub2RlLmNvbW1lbnQgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGNjID0gYm9keSA9PT0gdW5kZWZpbmVkID8gY29tbWVudHMuYmVmb3JlIDogY29tbWVudHMuYWZ0ZXI7XG4gICAgICBjYy5wdXNoKG5vZGUuY29tbWVudCk7XG4gICAgfSBlbHNlIGlmIChub2RlLnR5cGUgPT09IFR5cGUuQkxBTktfTElORSkge1xuICAgICAgc3BhY2VCZWZvcmUgPSB0cnVlO1xuXG4gICAgICBpZiAoYm9keSA9PT0gdW5kZWZpbmVkICYmIGNvbW1lbnRzLmJlZm9yZS5sZW5ndGggPiAwICYmICFkb2MuY29tbWVudEJlZm9yZSkge1xuICAgICAgICAvLyBzcGFjZS1zZXBhcmF0ZWQgY29tbWVudHMgYXQgc3RhcnQgYXJlIHBhcnNlZCBhcyBkb2N1bWVudCBjb21tZW50c1xuICAgICAgICBkb2MuY29tbWVudEJlZm9yZSA9IGNvbW1lbnRzLmJlZm9yZS5qb2luKCdcXG4nKTtcbiAgICAgICAgY29tbWVudHMuYmVmb3JlID0gW107XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZG9jLmNvbnRlbnRzID0gYm9keSB8fCBudWxsO1xuXG4gIGlmICghYm9keSkge1xuICAgIGRvYy5jb21tZW50ID0gY29tbWVudHMuYmVmb3JlLmNvbmNhdChjb21tZW50cy5hZnRlcikuam9pbignXFxuJykgfHwgbnVsbDtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBjYiA9IGNvbW1lbnRzLmJlZm9yZS5qb2luKCdcXG4nKTtcblxuICAgIGlmIChjYikge1xuICAgICAgY29uc3QgY2JOb2RlID0gYm9keSBpbnN0YW5jZW9mIENvbGxlY3Rpb24gJiYgYm9keS5pdGVtc1swXSA/IGJvZHkuaXRlbXNbMF0gOiBib2R5O1xuICAgICAgY2JOb2RlLmNvbW1lbnRCZWZvcmUgPSBjYk5vZGUuY29tbWVudEJlZm9yZSA/IFwiXCIuY29uY2F0KGNiLCBcIlxcblwiKS5jb25jYXQoY2JOb2RlLmNvbW1lbnRCZWZvcmUpIDogY2I7XG4gICAgfVxuXG4gICAgZG9jLmNvbW1lbnQgPSBjb21tZW50cy5hZnRlci5qb2luKCdcXG4nKSB8fCBudWxsO1xuICB9XG59XG5cbmV4cG9ydCB7IHBhcnNlQ29udGVudHMgfTtcbiIsImltcG9ydCB7IFlBTUxXYXJuaW5nLCBZQU1MU2VtYW50aWNFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBkb2N1bWVudE9wdGlvbnMgfSBmcm9tICcuLi9vcHRpb25zLmpzJztcblxuZnVuY3Rpb24gcmVzb2x2ZVRhZ0RpcmVjdGl2ZSh7XG4gIHRhZ1ByZWZpeGVzXG59LCBkaXJlY3RpdmUpIHtcbiAgY29uc3QgW2hhbmRsZSwgcHJlZml4XSA9IGRpcmVjdGl2ZS5wYXJhbWV0ZXJzO1xuXG4gIGlmICghaGFuZGxlIHx8ICFwcmVmaXgpIHtcbiAgICBjb25zdCBtc2cgPSAnSW5zdWZmaWNpZW50IHBhcmFtZXRlcnMgZ2l2ZW4gZm9yICVUQUcgZGlyZWN0aXZlJztcbiAgICB0aHJvdyBuZXcgWUFNTFNlbWFudGljRXJyb3IoZGlyZWN0aXZlLCBtc2cpO1xuICB9XG5cbiAgaWYgKHRhZ1ByZWZpeGVzLnNvbWUocCA9PiBwLmhhbmRsZSA9PT0gaGFuZGxlKSkge1xuICAgIGNvbnN0IG1zZyA9ICdUaGUgJVRBRyBkaXJlY3RpdmUgbXVzdCBvbmx5IGJlIGdpdmVuIGF0IG1vc3Qgb25jZSBwZXIgaGFuZGxlIGluIHRoZSBzYW1lIGRvY3VtZW50Lic7XG4gICAgdGhyb3cgbmV3IFlBTUxTZW1hbnRpY0Vycm9yKGRpcmVjdGl2ZSwgbXNnKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgaGFuZGxlLFxuICAgIHByZWZpeFxuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlWWFtbERpcmVjdGl2ZShkb2MsIGRpcmVjdGl2ZSkge1xuICBsZXQgW3ZlcnNpb25dID0gZGlyZWN0aXZlLnBhcmFtZXRlcnM7XG4gIGlmIChkaXJlY3RpdmUubmFtZSA9PT0gJ1lBTUw6MS4wJykgdmVyc2lvbiA9ICcxLjAnO1xuXG4gIGlmICghdmVyc2lvbikge1xuICAgIGNvbnN0IG1zZyA9ICdJbnN1ZmZpY2llbnQgcGFyYW1ldGVycyBnaXZlbiBmb3IgJVlBTUwgZGlyZWN0aXZlJztcbiAgICB0aHJvdyBuZXcgWUFNTFNlbWFudGljRXJyb3IoZGlyZWN0aXZlLCBtc2cpO1xuICB9XG5cbiAgaWYgKCFkb2N1bWVudE9wdGlvbnNbdmVyc2lvbl0pIHtcbiAgICBjb25zdCB2MCA9IGRvYy52ZXJzaW9uIHx8IGRvYy5vcHRpb25zLnZlcnNpb247XG4gICAgY29uc3QgbXNnID0gXCJEb2N1bWVudCB3aWxsIGJlIHBhcnNlZCBhcyBZQU1MIFwiLmNvbmNhdCh2MCwgXCIgcmF0aGVyIHRoYW4gWUFNTCBcIikuY29uY2F0KHZlcnNpb24pO1xuICAgIGRvYy53YXJuaW5ncy5wdXNoKG5ldyBZQU1MV2FybmluZyhkaXJlY3RpdmUsIG1zZykpO1xuICB9XG5cbiAgcmV0dXJuIHZlcnNpb247XG59XG5cbmZ1bmN0aW9uIHBhcnNlRGlyZWN0aXZlcyhkb2MsIGRpcmVjdGl2ZXMsIHByZXZEb2MpIHtcbiAgY29uc3QgZGlyZWN0aXZlQ29tbWVudHMgPSBbXTtcbiAgbGV0IGhhc0RpcmVjdGl2ZXMgPSBmYWxzZTtcblxuICBmb3IgKGNvbnN0IGRpcmVjdGl2ZSBvZiBkaXJlY3RpdmVzKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29tbWVudCxcbiAgICAgIG5hbWVcbiAgICB9ID0gZGlyZWN0aXZlO1xuXG4gICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICBjYXNlICdUQUcnOlxuICAgICAgICB0cnkge1xuICAgICAgICAgIGRvYy50YWdQcmVmaXhlcy5wdXNoKHJlc29sdmVUYWdEaXJlY3RpdmUoZG9jLCBkaXJlY3RpdmUpKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBkb2MuZXJyb3JzLnB1c2goZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgaGFzRGlyZWN0aXZlcyA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdZQU1MJzpcbiAgICAgIGNhc2UgJ1lBTUw6MS4wJzpcbiAgICAgICAgaWYgKGRvYy52ZXJzaW9uKSB7XG4gICAgICAgICAgY29uc3QgbXNnID0gJ1RoZSAlWUFNTCBkaXJlY3RpdmUgbXVzdCBvbmx5IGJlIGdpdmVuIGF0IG1vc3Qgb25jZSBwZXIgZG9jdW1lbnQuJztcbiAgICAgICAgICBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGRpcmVjdGl2ZSwgbXNnKSk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGRvYy52ZXJzaW9uID0gcmVzb2x2ZVlhbWxEaXJlY3RpdmUoZG9jLCBkaXJlY3RpdmUpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGRvYy5lcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBoYXNEaXJlY3RpdmVzID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgY29uc3QgbXNnID0gXCJZQU1MIG9ubHkgc3VwcG9ydHMgJVRBRyBhbmQgJVlBTUwgZGlyZWN0aXZlcywgYW5kIG5vdCAlXCIuY29uY2F0KG5hbWUpO1xuICAgICAgICAgIGRvYy53YXJuaW5ncy5wdXNoKG5ldyBZQU1MV2FybmluZyhkaXJlY3RpdmUsIG1zZykpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBpZiAoY29tbWVudCkgZGlyZWN0aXZlQ29tbWVudHMucHVzaChjb21tZW50KTtcbiAgfVxuXG4gIGlmIChwcmV2RG9jICYmICFoYXNEaXJlY3RpdmVzICYmICcxLjEnID09PSAoZG9jLnZlcnNpb24gfHwgcHJldkRvYy52ZXJzaW9uIHx8IGRvYy5vcHRpb25zLnZlcnNpb24pKSB7XG4gICAgY29uc3QgY29weVRhZ1ByZWZpeCA9ICh7XG4gICAgICBoYW5kbGUsXG4gICAgICBwcmVmaXhcbiAgICB9KSA9PiAoe1xuICAgICAgaGFuZGxlLFxuICAgICAgcHJlZml4XG4gICAgfSk7XG5cbiAgICBkb2MudGFnUHJlZml4ZXMgPSBwcmV2RG9jLnRhZ1ByZWZpeGVzLm1hcChjb3B5VGFnUHJlZml4KTtcbiAgICBkb2MudmVyc2lvbiA9IHByZXZEb2MudmVyc2lvbjtcbiAgfVxuXG4gIGRvYy5jb21tZW50QmVmb3JlID0gZGlyZWN0aXZlQ29tbWVudHMuam9pbignXFxuJykgfHwgbnVsbDtcbn1cblxuZXhwb3J0IHsgcGFyc2VEaXJlY3RpdmVzIH07XG4iLCJpbXBvcnQgeyBkZWZpbmVQcm9wZXJ0eSBhcyBfZGVmaW5lUHJvcGVydHkgfSBmcm9tICcuLi9fdmlydHVhbC9fcm9sbHVwUGx1Z2luQmFiZWxIZWxwZXJzLmpzJztcbmltcG9ydCB7IERvY3VtZW50IGFzIERvY3VtZW50JDEgfSBmcm9tICcuLi9jc3QvRG9jdW1lbnQuanMnO1xuaW1wb3J0IHsgZGVmYXVsdFRhZ1ByZWZpeCB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgZGVmYXVsdE9wdGlvbnMsIGRvY3VtZW50T3B0aW9ucyB9IGZyb20gJy4uL29wdGlvbnMuanMnO1xuaW1wb3J0IHsgYWRkQ29tbWVudCB9IGZyb20gJy4uL3N0cmluZ2lmeS9hZGRDb21tZW50LmpzJztcbmltcG9ydCB7IHN0cmluZ2lmeSB9IGZyb20gJy4uL3N0cmluZ2lmeS9zdHJpbmdpZnkuanMnO1xuaW1wb3J0IHsgQW5jaG9ycyB9IGZyb20gJy4vQW5jaG9ycy5qcyc7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tICcuL1NjaGVtYS5qcyc7XG5pbXBvcnQgeyBhcHBseVJldml2ZXIgfSBmcm9tICcuL2FwcGx5UmV2aXZlci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVOb2RlIH0gZnJvbSAnLi9jcmVhdGVOb2RlLmpzJztcbmltcG9ydCB7IGxpc3RUYWdOYW1lcyB9IGZyb20gJy4vbGlzdFRhZ05hbWVzLmpzJztcbmltcG9ydCB7IHBhcnNlQ29udGVudHMgfSBmcm9tICcuL3BhcnNlQ29udGVudHMuanMnO1xuaW1wb3J0IHsgcGFyc2VEaXJlY3RpdmVzIH0gZnJvbSAnLi9wYXJzZURpcmVjdGl2ZXMuanMnO1xuaW1wb3J0IHsgUGFpciB9IGZyb20gJy4uL2FzdC9QYWlyLmpzJztcbmltcG9ydCB7IGlzRW1wdHlQYXRoLCBDb2xsZWN0aW9uLCBjb2xsZWN0aW9uRnJvbVBhdGggfSBmcm9tICcuLi9hc3QvQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBTY2FsYXIgfSBmcm9tICcuLi9hc3QvU2NhbGFyLmpzJztcbmltcG9ydCB7IHRvSlMgfSBmcm9tICcuLi9hc3QvdG9KUy5qcyc7XG5pbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi4vYXN0L05vZGUuanMnO1xuaW1wb3J0IHsgQWxpYXMgfSBmcm9tICcuLi9hc3QvQWxpYXMuanMnO1xuXG5mdW5jdGlvbiBhc3NlcnRDb2xsZWN0aW9uKGNvbnRlbnRzKSB7XG4gIGlmIChjb250ZW50cyBpbnN0YW5jZW9mIENvbGxlY3Rpb24pIHJldHVybiB0cnVlO1xuICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGEgWUFNTCBjb2xsZWN0aW9uIGFzIGRvY3VtZW50IGNvbnRlbnRzJyk7XG59XG5cbmNsYXNzIERvY3VtZW50IHtcbiAgY29uc3RydWN0b3IodmFsdWUsIHJlcGxhY2VyLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZCAmJiByZXBsYWNlciAmJiB0eXBlb2YgcmVwbGFjZXIgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHJlcGxhY2VyKSkge1xuICAgICAgb3B0aW9ucyA9IHJlcGxhY2VyO1xuICAgICAgcmVwbGFjZXIgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgdGhpcy5vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdGlvbnMpO1xuICAgIHRoaXMuYW5jaG9ycyA9IG5ldyBBbmNob3JzKHRoaXMub3B0aW9ucy5hbmNob3JQcmVmaXgpO1xuICAgIHRoaXMuY29tbWVudEJlZm9yZSA9IG51bGw7XG4gICAgdGhpcy5jb21tZW50ID0gbnVsbDtcbiAgICB0aGlzLmRpcmVjdGl2ZXNFbmRNYXJrZXIgPSBudWxsO1xuICAgIHRoaXMuZXJyb3JzID0gW107XG4gICAgdGhpcy5zY2hlbWEgPSBudWxsO1xuICAgIHRoaXMudGFnUHJlZml4ZXMgPSBbXTtcbiAgICB0aGlzLnZlcnNpb24gPSBudWxsO1xuICAgIHRoaXMud2FybmluZ3MgPSBbXTtcblxuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBub3RlIHRoYXQgdGhpcy5zY2hlbWEgaXMgbGVmdCBhcyBudWxsIGhlcmVcbiAgICAgIHRoaXMuY29udGVudHMgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEb2N1bWVudCQxKSB7XG4gICAgICB0aGlzLnBhcnNlKHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jb250ZW50cyA9IHRoaXMuY3JlYXRlTm9kZSh2YWx1ZSwge1xuICAgICAgICByZXBsYWNlclxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgYWRkKHZhbHVlKSB7XG4gICAgYXNzZXJ0Q29sbGVjdGlvbih0aGlzLmNvbnRlbnRzKTtcbiAgICByZXR1cm4gdGhpcy5jb250ZW50cy5hZGQodmFsdWUpO1xuICB9XG5cbiAgYWRkSW4ocGF0aCwgdmFsdWUpIHtcbiAgICBhc3NlcnRDb2xsZWN0aW9uKHRoaXMuY29udGVudHMpO1xuICAgIHRoaXMuY29udGVudHMuYWRkSW4ocGF0aCwgdmFsdWUpO1xuICB9XG5cbiAgY3JlYXRlTm9kZSh2YWx1ZSwge1xuICAgIGtlZXBVbmRlZmluZWQsXG4gICAgb25UYWdPYmosXG4gICAgcmVwbGFjZXIsXG4gICAgdGFnLFxuICAgIHdyYXBTY2FsYXJzXG4gIH0gPSB7fSkge1xuICAgIHRoaXMuc2V0U2NoZW1hKCk7XG4gICAgaWYgKHR5cGVvZiByZXBsYWNlciA9PT0gJ2Z1bmN0aW9uJykgdmFsdWUgPSByZXBsYWNlci5jYWxsKHtcbiAgICAgICcnOiB2YWx1ZVxuICAgIH0sICcnLCB2YWx1ZSk7ZWxzZSBpZiAoQXJyYXkuaXNBcnJheShyZXBsYWNlcikpIHtcbiAgICAgIGNvbnN0IGtleVRvU3RyID0gdiA9PiB0eXBlb2YgdiA9PT0gJ251bWJlcicgfHwgdiBpbnN0YW5jZW9mIFN0cmluZyB8fCB2IGluc3RhbmNlb2YgTnVtYmVyO1xuXG4gICAgICBjb25zdCBhc1N0ciA9IHJlcGxhY2VyLmZpbHRlcihrZXlUb1N0cikubWFwKFN0cmluZyk7XG4gICAgICBpZiAoYXNTdHIubGVuZ3RoID4gMCkgcmVwbGFjZXIgPSByZXBsYWNlci5jb25jYXQoYXNTdHIpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGtlZXBVbmRlZmluZWQgIT09ICdib29sZWFuJykga2VlcFVuZGVmaW5lZCA9ICEhdGhpcy5vcHRpb25zLmtlZXBVbmRlZmluZWQ7XG4gICAgY29uc3QgYWxpYXNOb2RlcyA9IFtdO1xuICAgIGNvbnN0IGN0eCA9IHtcbiAgICAgIGtlZXBVbmRlZmluZWQsXG5cbiAgICAgIG9uQWxpYXMoc291cmNlKSB7XG4gICAgICAgIGNvbnN0IGFsaWFzID0gbmV3IEFsaWFzKHNvdXJjZSk7XG4gICAgICAgIGFsaWFzTm9kZXMucHVzaChhbGlhcyk7XG4gICAgICAgIHJldHVybiBhbGlhcztcbiAgICAgIH0sXG5cbiAgICAgIG9uVGFnT2JqLFxuICAgICAgcHJldk9iamVjdHM6IG5ldyBNYXAoKSxcbiAgICAgIHJlcGxhY2VyLFxuICAgICAgc2NoZW1hOiB0aGlzLnNjaGVtYSxcbiAgICAgIHdyYXBTY2FsYXJzOiB3cmFwU2NhbGFycyAhPT0gZmFsc2VcbiAgICB9O1xuICAgIGNvbnN0IG5vZGUgPSBjcmVhdGVOb2RlKHZhbHVlLCB0YWcsIGN0eCk7XG5cbiAgICBmb3IgKGNvbnN0IGFsaWFzIG9mIGFsaWFzTm9kZXMpIHtcbiAgICAgIC8vIFdpdGggY2lyY3VsYXIgcmVmZXJlbmNlcywgdGhlIHNvdXJjZSBub2RlIGlzIG9ubHkgcmVzb2x2ZWQgYWZ0ZXIgYWxsIG9mXG4gICAgICAvLyBpdHMgY2hpbGQgbm9kZXMgYXJlLiBUaGlzIGlzIHdoeSBhbmNob3JzIGFyZSBzZXQgb25seSBhZnRlciBhbGwgb2YgdGhlXG4gICAgICAvLyBub2RlcyBoYXZlIGJlZW4gY3JlYXRlZC5cbiAgICAgIGFsaWFzLnNvdXJjZSA9IGFsaWFzLnNvdXJjZS5ub2RlO1xuICAgICAgbGV0IG5hbWUgPSB0aGlzLmFuY2hvcnMuZ2V0TmFtZShhbGlhcy5zb3VyY2UpO1xuXG4gICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgbmFtZSA9IHRoaXMuYW5jaG9ycy5uZXdOYW1lKCk7XG4gICAgICAgIHRoaXMuYW5jaG9ycy5tYXBbbmFtZV0gPSBhbGlhcy5zb3VyY2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICBjcmVhdGVQYWlyKGtleSwgdmFsdWUsIG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IGsgPSB0aGlzLmNyZWF0ZU5vZGUoa2V5LCBvcHRpb25zKTtcbiAgICBjb25zdCB2ID0gdGhpcy5jcmVhdGVOb2RlKHZhbHVlLCBvcHRpb25zKTtcbiAgICByZXR1cm4gbmV3IFBhaXIoaywgdik7XG4gIH1cblxuICBkZWxldGUoa2V5KSB7XG4gICAgYXNzZXJ0Q29sbGVjdGlvbih0aGlzLmNvbnRlbnRzKTtcbiAgICByZXR1cm4gdGhpcy5jb250ZW50cy5kZWxldGUoa2V5KTtcbiAgfVxuXG4gIGRlbGV0ZUluKHBhdGgpIHtcbiAgICBpZiAoaXNFbXB0eVBhdGgocGF0aCkpIHtcbiAgICAgIGlmICh0aGlzLmNvbnRlbnRzID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICAgIHRoaXMuY29udGVudHMgPSBudWxsO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgYXNzZXJ0Q29sbGVjdGlvbih0aGlzLmNvbnRlbnRzKTtcbiAgICByZXR1cm4gdGhpcy5jb250ZW50cy5kZWxldGVJbihwYXRoKTtcbiAgfVxuXG4gIGdldERlZmF1bHRzKCkge1xuICAgIHJldHVybiBEb2N1bWVudC5kZWZhdWx0c1t0aGlzLnZlcnNpb25dIHx8IERvY3VtZW50LmRlZmF1bHRzW3RoaXMub3B0aW9ucy52ZXJzaW9uXSB8fCB7fTtcbiAgfVxuXG4gIGdldChrZXksIGtlZXBTY2FsYXIpIHtcbiAgICByZXR1cm4gdGhpcy5jb250ZW50cyBpbnN0YW5jZW9mIENvbGxlY3Rpb24gPyB0aGlzLmNvbnRlbnRzLmdldChrZXksIGtlZXBTY2FsYXIpIDogdW5kZWZpbmVkO1xuICB9XG5cbiAgZ2V0SW4ocGF0aCwga2VlcFNjYWxhcikge1xuICAgIGlmIChpc0VtcHR5UGF0aChwYXRoKSkgcmV0dXJuICFrZWVwU2NhbGFyICYmIHRoaXMuY29udGVudHMgaW5zdGFuY2VvZiBTY2FsYXIgPyB0aGlzLmNvbnRlbnRzLnZhbHVlIDogdGhpcy5jb250ZW50cztcbiAgICByZXR1cm4gdGhpcy5jb250ZW50cyBpbnN0YW5jZW9mIENvbGxlY3Rpb24gPyB0aGlzLmNvbnRlbnRzLmdldEluKHBhdGgsIGtlZXBTY2FsYXIpIDogdW5kZWZpbmVkO1xuICB9XG5cbiAgaGFzKGtleSkge1xuICAgIHJldHVybiB0aGlzLmNvbnRlbnRzIGluc3RhbmNlb2YgQ29sbGVjdGlvbiA/IHRoaXMuY29udGVudHMuaGFzKGtleSkgOiBmYWxzZTtcbiAgfVxuXG4gIGhhc0luKHBhdGgpIHtcbiAgICBpZiAoaXNFbXB0eVBhdGgocGF0aCkpIHJldHVybiB0aGlzLmNvbnRlbnRzICE9PSB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIHRoaXMuY29udGVudHMgaW5zdGFuY2VvZiBDb2xsZWN0aW9uID8gdGhpcy5jb250ZW50cy5oYXNJbihwYXRoKSA6IGZhbHNlO1xuICB9XG5cbiAgc2V0KGtleSwgdmFsdWUpIHtcbiAgICBpZiAodGhpcy5jb250ZW50cyA9PSBudWxsKSB7XG4gICAgICB0aGlzLnNldFNjaGVtYSgpO1xuICAgICAgdGhpcy5jb250ZW50cyA9IGNvbGxlY3Rpb25Gcm9tUGF0aCh0aGlzLnNjaGVtYSwgW2tleV0sIHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXNzZXJ0Q29sbGVjdGlvbih0aGlzLmNvbnRlbnRzKTtcbiAgICAgIHRoaXMuY29udGVudHMuc2V0KGtleSwgdmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHNldEluKHBhdGgsIHZhbHVlKSB7XG4gICAgaWYgKGlzRW1wdHlQYXRoKHBhdGgpKSB0aGlzLmNvbnRlbnRzID0gdmFsdWU7ZWxzZSBpZiAodGhpcy5jb250ZW50cyA9PSBudWxsKSB7XG4gICAgICB0aGlzLnNldFNjaGVtYSgpO1xuICAgICAgdGhpcy5jb250ZW50cyA9IGNvbGxlY3Rpb25Gcm9tUGF0aCh0aGlzLnNjaGVtYSwgcGF0aCwgdmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhc3NlcnRDb2xsZWN0aW9uKHRoaXMuY29udGVudHMpO1xuICAgICAgdGhpcy5jb250ZW50cy5zZXRJbihwYXRoLCB2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgc2V0U2NoZW1hKGlkLCBjdXN0b21UYWdzKSB7XG4gICAgaWYgKCFpZCAmJiAhY3VzdG9tVGFncyAmJiB0aGlzLnNjaGVtYSkgcmV0dXJuO1xuICAgIGlmICh0eXBlb2YgaWQgPT09ICdudW1iZXInKSBpZCA9IGlkLnRvRml4ZWQoMSk7XG5cbiAgICBpZiAoaWQgPT09ICcxLjAnIHx8IGlkID09PSAnMS4xJyB8fCBpZCA9PT0gJzEuMicpIHtcbiAgICAgIGlmICh0aGlzLnZlcnNpb24pIHRoaXMudmVyc2lvbiA9IGlkO2Vsc2UgdGhpcy5vcHRpb25zLnZlcnNpb24gPSBpZDtcbiAgICAgIGRlbGV0ZSB0aGlzLm9wdGlvbnMuc2NoZW1hO1xuICAgIH0gZWxzZSBpZiAoaWQgJiYgdHlwZW9mIGlkID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5vcHRpb25zLnNjaGVtYSA9IGlkO1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KGN1c3RvbVRhZ3MpKSB0aGlzLm9wdGlvbnMuY3VzdG9tVGFncyA9IGN1c3RvbVRhZ3M7XG4gICAgY29uc3Qgb3B0ID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5nZXREZWZhdWx0cygpLCB0aGlzLm9wdGlvbnMpO1xuICAgIHRoaXMuc2NoZW1hID0gbmV3IFNjaGVtYShvcHQpO1xuICB9XG5cbiAgcGFyc2Uobm9kZSwgcHJldkRvYykge1xuICAgIGlmICh0aGlzLm9wdGlvbnMua2VlcENzdE5vZGVzKSB0aGlzLmNzdE5vZGUgPSBub2RlO1xuICAgIGlmICh0aGlzLm9wdGlvbnMua2VlcE5vZGVUeXBlcykgdGhpcy50eXBlID0gJ0RPQ1VNRU5UJztcbiAgICBjb25zdCB7XG4gICAgICBkaXJlY3RpdmVzID0gW10sXG4gICAgICBjb250ZW50cyA9IFtdLFxuICAgICAgZGlyZWN0aXZlc0VuZE1hcmtlcixcbiAgICAgIGVycm9yLFxuICAgICAgdmFsdWVSYW5nZVxuICAgIH0gPSBub2RlO1xuXG4gICAgaWYgKGVycm9yKSB7XG4gICAgICBpZiAoIWVycm9yLnNvdXJjZSkgZXJyb3Iuc291cmNlID0gdGhpcztcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goZXJyb3IpO1xuICAgIH1cblxuICAgIHBhcnNlRGlyZWN0aXZlcyh0aGlzLCBkaXJlY3RpdmVzLCBwcmV2RG9jKTtcbiAgICBpZiAoZGlyZWN0aXZlc0VuZE1hcmtlcikgdGhpcy5kaXJlY3RpdmVzRW5kTWFya2VyID0gdHJ1ZTtcbiAgICB0aGlzLnJhbmdlID0gdmFsdWVSYW5nZSA/IFt2YWx1ZVJhbmdlLnN0YXJ0LCB2YWx1ZVJhbmdlLmVuZF0gOiBudWxsO1xuICAgIHRoaXMuc2V0U2NoZW1hKCk7XG4gICAgdGhpcy5hbmNob3JzLl9jc3RBbGlhc2VzID0gW107XG4gICAgcGFyc2VDb250ZW50cyh0aGlzLCBjb250ZW50cyk7XG4gICAgdGhpcy5hbmNob3JzLnJlc29sdmVOb2RlcygpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5wcmV0dHlFcnJvcnMpIHtcbiAgICAgIGZvciAoY29uc3QgZXJyb3Igb2YgdGhpcy5lcnJvcnMpIGlmIChlcnJvciBpbnN0YW5jZW9mIFlBTUxFcnJvcikgZXJyb3IubWFrZVByZXR0eSgpO1xuXG4gICAgICBmb3IgKGNvbnN0IHdhcm4gb2YgdGhpcy53YXJuaW5ncykgaWYgKHdhcm4gaW5zdGFuY2VvZiBZQU1MRXJyb3IpIHdhcm4ubWFrZVByZXR0eSgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdE5vbkRlZmF1bHRUYWdzKCkge1xuICAgIHJldHVybiBsaXN0VGFnTmFtZXModGhpcy5jb250ZW50cykuZmlsdGVyKHQgPT4gdC5pbmRleE9mKGRlZmF1bHRUYWdQcmVmaXgpICE9PSAwKTtcbiAgfVxuXG4gIHNldFRhZ1ByZWZpeChoYW5kbGUsIHByZWZpeCkge1xuICAgIGlmIChoYW5kbGVbMF0gIT09ICchJyB8fCBoYW5kbGVbaGFuZGxlLmxlbmd0aCAtIDFdICE9PSAnIScpIHRocm93IG5ldyBFcnJvcignSGFuZGxlIG11c3Qgc3RhcnQgYW5kIGVuZCB3aXRoICEnKTtcblxuICAgIGlmIChwcmVmaXgpIHtcbiAgICAgIGNvbnN0IHByZXYgPSB0aGlzLnRhZ1ByZWZpeGVzLmZpbmQocCA9PiBwLmhhbmRsZSA9PT0gaGFuZGxlKTtcbiAgICAgIGlmIChwcmV2KSBwcmV2LnByZWZpeCA9IHByZWZpeDtlbHNlIHRoaXMudGFnUHJlZml4ZXMucHVzaCh7XG4gICAgICAgIGhhbmRsZSxcbiAgICAgICAgcHJlZml4XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy50YWdQcmVmaXhlcyA9IHRoaXMudGFnUHJlZml4ZXMuZmlsdGVyKHAgPT4gcC5oYW5kbGUgIT09IGhhbmRsZSk7XG4gICAgfVxuICB9XG5cbiAgdG9KUyh7XG4gICAganNvbixcbiAgICBqc29uQXJnLFxuICAgIG1hcEFzTWFwLFxuICAgIG9uQW5jaG9yLFxuICAgIHJldml2ZXJcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgYW5jaG9yTm9kZXMgPSBPYmplY3QudmFsdWVzKHRoaXMuYW5jaG9ycy5tYXApLm1hcChub2RlID0+IFtub2RlLCB7XG4gICAgICBhbGlhczogW10sXG4gICAgICBhbGlhc0NvdW50OiAwLFxuICAgICAgY291bnQ6IDFcbiAgICB9XSk7XG4gICAgY29uc3QgYW5jaG9ycyA9IGFuY2hvck5vZGVzLmxlbmd0aCA+IDAgPyBuZXcgTWFwKGFuY2hvck5vZGVzKSA6IG51bGw7XG4gICAgY29uc3QgY3R4ID0ge1xuICAgICAgYW5jaG9ycyxcbiAgICAgIGRvYzogdGhpcyxcbiAgICAgIGluZGVudFN0ZXA6ICcgICcsXG4gICAgICBrZWVwOiAhanNvbixcbiAgICAgIG1hcEFzTWFwOiB0eXBlb2YgbWFwQXNNYXAgPT09ICdib29sZWFuJyA/IG1hcEFzTWFwIDogISF0aGlzLm9wdGlvbnMubWFwQXNNYXAsXG4gICAgICBtYXBLZXlXYXJuZWQ6IGZhbHNlLFxuICAgICAgbWF4QWxpYXNDb3VudDogdGhpcy5vcHRpb25zLm1heEFsaWFzQ291bnQsXG4gICAgICBzdHJpbmdpZnkgLy8gUmVxdWlyaW5nIGRpcmVjdGx5IGluIFBhaXIgd291bGQgY3JlYXRlIGNpcmN1bGFyIGRlcGVuZGVuY2llc1xuXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSB0b0pTKHRoaXMuY29udGVudHMsIGpzb25BcmcgfHwgJycsIGN0eCk7XG4gICAgaWYgKHR5cGVvZiBvbkFuY2hvciA9PT0gJ2Z1bmN0aW9uJyAmJiBhbmNob3JzKSBmb3IgKGNvbnN0IHtcbiAgICAgIGNvdW50LFxuICAgICAgcmVzXG4gICAgfSBvZiBhbmNob3JzLnZhbHVlcygpKSBvbkFuY2hvcihyZXMsIGNvdW50KTtcbiAgICByZXR1cm4gdHlwZW9mIHJldml2ZXIgPT09ICdmdW5jdGlvbicgPyBhcHBseVJldml2ZXIocmV2aXZlciwge1xuICAgICAgJyc6IHJlc1xuICAgIH0sICcnLCByZXMpIDogcmVzO1xuICB9XG5cbiAgdG9KU09OKGpzb25BcmcsIG9uQW5jaG9yKSB7XG4gICAgcmV0dXJuIHRoaXMudG9KUyh7XG4gICAgICBqc29uOiB0cnVlLFxuICAgICAganNvbkFyZyxcbiAgICAgIG1hcEFzTWFwOiBmYWxzZSxcbiAgICAgIG9uQW5jaG9yXG4gICAgfSk7XG4gIH1cblxuICB0b1N0cmluZygpIHtcbiAgICBpZiAodGhpcy5lcnJvcnMubGVuZ3RoID4gMCkgdGhyb3cgbmV3IEVycm9yKCdEb2N1bWVudCB3aXRoIGVycm9ycyBjYW5ub3QgYmUgc3RyaW5naWZpZWQnKTtcbiAgICBjb25zdCBpbmRlbnRTaXplID0gdGhpcy5vcHRpb25zLmluZGVudDtcblxuICAgIGlmICghTnVtYmVyLmlzSW50ZWdlcihpbmRlbnRTaXplKSB8fCBpbmRlbnRTaXplIDw9IDApIHtcbiAgICAgIGNvbnN0IHMgPSBKU09OLnN0cmluZ2lmeShpbmRlbnRTaXplKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlxcXCJpbmRlbnRcXFwiIG9wdGlvbiBtdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlciwgbm90IFwiLmNvbmNhdChzKSk7XG4gICAgfVxuXG4gICAgdGhpcy5zZXRTY2hlbWEoKTtcbiAgICBjb25zdCBsaW5lcyA9IFtdO1xuICAgIGxldCBoYXNEaXJlY3RpdmVzID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy52ZXJzaW9uKSB7XG4gICAgICBsZXQgdmQgPSAnJVlBTUwgMS4yJztcblxuICAgICAgaWYgKHRoaXMuc2NoZW1hLm5hbWUgPT09ICd5YW1sLTEuMScpIHtcbiAgICAgICAgaWYgKHRoaXMudmVyc2lvbiA9PT0gJzEuMCcpIHZkID0gJyVZQU1MOjEuMCc7ZWxzZSBpZiAodGhpcy52ZXJzaW9uID09PSAnMS4xJykgdmQgPSAnJVlBTUwgMS4xJztcbiAgICAgIH1cblxuICAgICAgbGluZXMucHVzaCh2ZCk7XG4gICAgICBoYXNEaXJlY3RpdmVzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdOYW1lcyA9IHRoaXMubGlzdE5vbkRlZmF1bHRUYWdzKCk7XG4gICAgdGhpcy50YWdQcmVmaXhlcy5mb3JFYWNoKCh7XG4gICAgICBoYW5kbGUsXG4gICAgICBwcmVmaXhcbiAgICB9KSA9PiB7XG4gICAgICBpZiAodGFnTmFtZXMuc29tZSh0ID0+IHQuaW5kZXhPZihwcmVmaXgpID09PSAwKSkge1xuICAgICAgICBsaW5lcy5wdXNoKFwiJVRBRyBcIi5jb25jYXQoaGFuZGxlLCBcIiBcIikuY29uY2F0KHByZWZpeCkpO1xuICAgICAgICBoYXNEaXJlY3RpdmVzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoaGFzRGlyZWN0aXZlcyB8fCB0aGlzLmRpcmVjdGl2ZXNFbmRNYXJrZXIpIGxpbmVzLnB1c2goJy0tLScpO1xuXG4gICAgaWYgKHRoaXMuY29tbWVudEJlZm9yZSkge1xuICAgICAgaWYgKGhhc0RpcmVjdGl2ZXMgfHwgIXRoaXMuZGlyZWN0aXZlc0VuZE1hcmtlcikgbGluZXMudW5zaGlmdCgnJyk7XG4gICAgICBsaW5lcy51bnNoaWZ0KHRoaXMuY29tbWVudEJlZm9yZS5yZXBsYWNlKC9eL2dtLCAnIycpKTtcbiAgICB9XG5cbiAgICBjb25zdCBjdHggPSB7XG4gICAgICBhbmNob3JzOiBPYmplY3QuY3JlYXRlKG51bGwpLFxuICAgICAgZG9jOiB0aGlzLFxuICAgICAgaW5kZW50OiAnJyxcbiAgICAgIGluZGVudFN0ZXA6ICcgJy5yZXBlYXQoaW5kZW50U2l6ZSksXG4gICAgICBzdHJpbmdpZnkgLy8gUmVxdWlyaW5nIGRpcmVjdGx5IGluIG5vZGVzIHdvdWxkIGNyZWF0ZSBjaXJjdWxhciBkZXBlbmRlbmNpZXNcblxuICAgIH07XG4gICAgbGV0IGNob21wS2VlcCA9IGZhbHNlO1xuICAgIGxldCBjb250ZW50Q29tbWVudCA9IG51bGw7XG5cbiAgICBpZiAodGhpcy5jb250ZW50cykge1xuICAgICAgaWYgKHRoaXMuY29udGVudHMgaW5zdGFuY2VvZiBOb2RlKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnRlbnRzLnNwYWNlQmVmb3JlICYmIChoYXNEaXJlY3RpdmVzIHx8IHRoaXMuZGlyZWN0aXZlc0VuZE1hcmtlcikpIGxpbmVzLnB1c2goJycpO1xuICAgICAgICBpZiAodGhpcy5jb250ZW50cy5jb21tZW50QmVmb3JlKSBsaW5lcy5wdXNoKHRoaXMuY29udGVudHMuY29tbWVudEJlZm9yZS5yZXBsYWNlKC9eL2dtLCAnIycpKTsgLy8gdG9wLWxldmVsIGJsb2NrIHNjYWxhcnMgbmVlZCB0byBiZSBpbmRlbnRlZCBpZiBmb2xsb3dlZCBieSBhIGNvbW1lbnRcblxuICAgICAgICBjdHguZm9yY2VCbG9ja0luZGVudCA9ICEhdGhpcy5jb21tZW50O1xuICAgICAgICBjb250ZW50Q29tbWVudCA9IHRoaXMuY29udGVudHMuY29tbWVudDtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb25DaG9tcEtlZXAgPSBjb250ZW50Q29tbWVudCA/IG51bGwgOiAoKSA9PiBjaG9tcEtlZXAgPSB0cnVlO1xuICAgICAgY29uc3QgYm9keSA9IHN0cmluZ2lmeSh0aGlzLmNvbnRlbnRzLCBjdHgsICgpID0+IGNvbnRlbnRDb21tZW50ID0gbnVsbCwgb25DaG9tcEtlZXApO1xuICAgICAgbGluZXMucHVzaChhZGRDb21tZW50KGJvZHksICcnLCBjb250ZW50Q29tbWVudCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaW5lcy5wdXNoKHN0cmluZ2lmeSh0aGlzLmNvbnRlbnRzLCBjdHgpKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb21tZW50KSB7XG4gICAgICBpZiAoKCFjaG9tcEtlZXAgfHwgY29udGVudENvbW1lbnQpICYmIGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdICE9PSAnJykgbGluZXMucHVzaCgnJyk7XG4gICAgICBsaW5lcy5wdXNoKHRoaXMuY29tbWVudC5yZXBsYWNlKC9eL2dtLCAnIycpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXMuam9pbignXFxuJykgKyAnXFxuJztcbiAgfVxuXG59XG5cbl9kZWZpbmVQcm9wZXJ0eShEb2N1bWVudCwgXCJkZWZhdWx0c1wiLCBkb2N1bWVudE9wdGlvbnMpO1xuXG5leHBvcnQgeyBEb2N1bWVudCB9O1xuIiwiaW1wb3J0IHsgTG9nTGV2ZWwgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBwYXJzZSBhcyBwYXJzZSQxIH0gZnJvbSAnLi9jc3QvcGFyc2UuanMnO1xuZXhwb3J0IHsgcGFyc2UgYXMgcGFyc2VDU1QgfSBmcm9tICcuL2NzdC9wYXJzZS5qcyc7XG5pbXBvcnQgeyBEb2N1bWVudCB9IGZyb20gJy4vZG9jL0RvY3VtZW50LmpzJztcbmV4cG9ydCB7IERvY3VtZW50IH0gZnJvbSAnLi9kb2MvRG9jdW1lbnQuanMnO1xuaW1wb3J0IHsgWUFNTFNlbWFudGljRXJyb3IgfSBmcm9tICcuL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyB3YXJuIH0gZnJvbSAnLi9sb2cuanMnO1xuZXhwb3J0IHsgZGVmYXVsdE9wdGlvbnMsIHNjYWxhck9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMuanMnO1xuZXhwb3J0IHsgdmlzaXQgfSBmcm9tICcuL3Zpc2l0LmpzJztcblxuZnVuY3Rpb24gcGFyc2VBbGxEb2N1bWVudHMoc3JjLCBvcHRpb25zKSB7XG4gIGNvbnN0IHN0cmVhbSA9IFtdO1xuICBsZXQgcHJldjtcblxuICBmb3IgKGNvbnN0IGNzdERvYyBvZiBwYXJzZSQxKHNyYykpIHtcbiAgICBjb25zdCBkb2MgPSBuZXcgRG9jdW1lbnQodW5kZWZpbmVkLCBudWxsLCBvcHRpb25zKTtcbiAgICBkb2MucGFyc2UoY3N0RG9jLCBwcmV2KTtcbiAgICBzdHJlYW0ucHVzaChkb2MpO1xuICAgIHByZXYgPSBkb2M7XG4gIH1cblxuICByZXR1cm4gc3RyZWFtO1xufVxuZnVuY3Rpb24gcGFyc2VEb2N1bWVudChzcmMsIG9wdGlvbnMpIHtcbiAgY29uc3QgY3N0ID0gcGFyc2UkMShzcmMpO1xuICBjb25zdCBkb2MgPSBuZXcgRG9jdW1lbnQoY3N0WzBdLCBudWxsLCBvcHRpb25zKTtcblxuICBpZiAoY3N0Lmxlbmd0aCA+IDEgJiYgTG9nTGV2ZWwuaW5kZXhPZihkb2Mub3B0aW9ucy5sb2dMZXZlbCkgPj0gTG9nTGV2ZWwuRVJST1IpIHtcbiAgICBjb25zdCBlcnJNc2cgPSAnU291cmNlIGNvbnRhaW5zIG11bHRpcGxlIGRvY3VtZW50czsgcGxlYXNlIHVzZSBZQU1MLnBhcnNlQWxsRG9jdW1lbnRzKCknO1xuICAgIGRvYy5lcnJvcnMudW5zaGlmdChuZXcgWUFNTFNlbWFudGljRXJyb3IoY3N0WzFdLCBlcnJNc2cpKTtcbiAgfVxuXG4gIHJldHVybiBkb2M7XG59XG5mdW5jdGlvbiBwYXJzZShzcmMsIHJldml2ZXIsIG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZCAmJiByZXZpdmVyICYmIHR5cGVvZiByZXZpdmVyID09PSAnb2JqZWN0Jykge1xuICAgIG9wdGlvbnMgPSByZXZpdmVyO1xuICAgIHJldml2ZXIgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBjb25zdCBkb2MgPSBwYXJzZURvY3VtZW50KHNyYywgb3B0aW9ucyk7XG4gIGRvYy53YXJuaW5ncy5mb3JFYWNoKHdhcm5pbmcgPT4gd2Fybihkb2Mub3B0aW9ucy5sb2dMZXZlbCwgd2FybmluZykpO1xuXG4gIGlmIChkb2MuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICBpZiAoTG9nTGV2ZWwuaW5kZXhPZihkb2Mub3B0aW9ucy5sb2dMZXZlbCkgPj0gTG9nTGV2ZWwuRVJST1IpIHRocm93IGRvYy5lcnJvcnNbMF07ZWxzZSBkb2MuZXJyb3JzID0gW107XG4gIH1cblxuICByZXR1cm4gZG9jLnRvSlMoe1xuICAgIHJldml2ZXJcbiAgfSk7XG59XG5mdW5jdGlvbiBzdHJpbmdpZnkodmFsdWUsIHJlcGxhY2VyLCBvcHRpb25zKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycpIG9wdGlvbnMgPSBvcHRpb25zLmxlbmd0aDtcblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdudW1iZXInKSB7XG4gICAgY29uc3QgaW5kZW50ID0gTWF0aC5yb3VuZChvcHRpb25zKTtcbiAgICBvcHRpb25zID0gaW5kZW50IDwgMSA/IHVuZGVmaW5lZCA6IGluZGVudCA+IDggPyB7XG4gICAgICBpbmRlbnQ6IDhcbiAgICB9IDoge1xuICAgICAgaW5kZW50XG4gICAgfTtcbiAgfVxuXG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3Qge1xuICAgICAga2VlcFVuZGVmaW5lZFxuICAgIH0gPSBvcHRpb25zIHx8IHJlcGxhY2VyIHx8IHt9O1xuICAgIGlmICgha2VlcFVuZGVmaW5lZCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIHJldHVybiBuZXcgRG9jdW1lbnQodmFsdWUsIHJlcGxhY2VyLCBvcHRpb25zKS50b1N0cmluZygpO1xufVxuXG5leHBvcnQgeyBwYXJzZSwgcGFyc2VBbGxEb2N1bWVudHMsIHBhcnNlRG9jdW1lbnQsIHN0cmluZ2lmeSB9O1xuIiwiaW1wb3J0IHsgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBwYXJzZURvY3VtZW50IH0gZnJvbSBcInlhbWxcIjtcbmltcG9ydCB7IFJlcGxhY2VtZW50IH0gZnJvbSBcIi4vVGFnXCI7XG5cbmV4cG9ydCBjbGFzcyBGaWxlIHtcblxuICAgIGNvbnN0cnVjdG9yKGFwcCwgZmlsZW5hbWUsIHRhZ1Bvc2l0aW9ucywgaGFzRnJvbnRNYXR0ZXIpIHtcbiAgICAgICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgICAgIHRoaXMuZmlsZW5hbWUgPSBmaWxlbmFtZTtcbiAgICAgICAgdGhpcy5iYXNlbmFtZSA9IGZpbGVuYW1lLnNwbGl0KFwiL1wiKS5wb3AoKTtcbiAgICAgICAgdGhpcy50YWdQb3NpdGlvbnMgPSB0YWdQb3NpdGlvbnM7XG4gICAgICAgIHRoaXMuaGFzRnJvbnRNYXR0ZXIgPSAhIWhhc0Zyb250TWF0dGVyO1xuICAgIH1cblxuICAgIC8qKiBAcGFyYW0ge1JlcGxhY2VtZW50fSByZXBsYWNlICovXG4gICAgYXN5bmMgcmVuYW1lZChyZXBsYWNlKSB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGhpcy5maWxlbmFtZSk7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgbGV0IHRleHQgPSBvcmlnaW5hbDtcblxuICAgICAgICBmb3IgKGNvbnN0IHsgcG9zaXRpb246IHsgc3RhcnQsIGVuZCB9LCB0YWcgfSBvZiB0aGlzLnRhZ1Bvc2l0aW9ucykge1xuICAgICAgICAgICAgaWYgKHRleHQuc2xpY2Uoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSAhPT0gdGFnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbXNnID0gYEZpbGUgJHt0aGlzLmZpbGVuYW1lfSBoYXMgY2hhbmdlZDsgc2tpcHBpbmdgO1xuICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UobXNnKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKG1zZyk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5kZWJ1Zyh0ZXh0LnNsaWNlKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksIHRhZyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGV4dCA9IHJlcGxhY2UuaW5TdHJpbmcodGV4dCwgc3RhcnQub2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmhhc0Zyb250TWF0dGVyKVxuICAgICAgICAgICAgdGV4dCA9IHRoaXMucmVwbGFjZUluRnJvbnRNYXR0ZXIodGV4dCwgcmVwbGFjZSk7XG5cbiAgICAgICAgaWYgKHRleHQgIT09IG9yaWdpbmFsKSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZmlsZSwgdGV4dCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcGFyYW0ge1JlcGxhY2VtZW50fSByZXBsYWNlICovXG4gICAgcmVwbGFjZUluRnJvbnRNYXR0ZXIodGV4dCwgcmVwbGFjZSkge1xuICAgICAgICBjb25zdCBbZW1wdHksIGZyb250TWF0dGVyXSA9IHRleHQuc3BsaXQoL14tLS1cXHI/JFxcbj8vbSwgMik7XG5cbiAgICAgICAgLy8gQ2hlY2sgZm9yIHZhbGlkLCBub24tZW1wdHksIHByb3Blcmx5IHRlcm1pbmF0ZWQgZnJvbnQgbWF0dGVyXG4gICAgICAgIGlmIChlbXB0eSAhPT0gXCJcIiB8fCAhZnJvbnRNYXR0ZXIudHJpbSgpIHx8ICFmcm9udE1hdHRlci5lbmRzV2l0aChcIlxcblwiKSlcbiAgICAgICAgICAgIHJldHVybiB0ZXh0O1xuXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlRG9jdW1lbnQoZnJvbnRNYXR0ZXIpO1xuICAgICAgICBpZiAocGFyc2VkLmVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gYFlBTUwgaXNzdWUgd2l0aCAke3RoaXMuZmlsZW5hbWV9OiAke3BhcnNlZC5lcnJvcnNbMF19YDtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpOyBuZXcgTm90aWNlKGVycm9yICsgXCI7IHNraXBwaW5nIGZyb250bWF0dGVyXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcbiAgICAgICAgZm9yIChjb25zdCB7a2V5OiB7dmFsdWU6cHJvcH19IG9mIHBhcnNlZC5jb250ZW50cy5pdGVtcykge1xuICAgICAgICAgICAgaWYgKCEvXnRhZ3M/JC9pLnRlc3QocHJvcCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHBhcnNlZC5nZXQocHJvcCwgdHJ1ZSk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgZmllbGQgPSBub2RlLnRvSlNPTigpO1xuICAgICAgICAgICAgaWYgKCFmaWVsZCB8fCAhZmllbGQubGVuZ3RoKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmllbGQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGZpZWxkLnNwbGl0KC8oXFxzKixcXHMqfF5cXHMrfFxccyskKS8pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFmdGVyID0gcmVwbGFjZS5pbkFycmF5KHBhcnRzLCB0cnVlKS5qb2luKFwiXCIpO1xuICAgICAgICAgICAgICAgIGlmIChmaWVsZCAhPSBhZnRlcikgeyBwYXJzZWQuc2V0KHByb3AsIGFmdGVyKTsgY2hhbmdlZCA9IHRydWU7IH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShmaWVsZCkpIHtcbiAgICAgICAgICAgICAgICByZXBsYWNlLmluQXJyYXkoZmllbGQpLmZvckVhY2goKHYsIGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpZWxkW2ldICE9PSB2KVxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZS5zZXQoaSwgdik7IGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaGFuZ2VkID8gdGV4dC5yZXBsYWNlKGZyb250TWF0dGVyLCBwYXJzZWQudG9TdHJpbmcoKSkgOiB0ZXh0O1xuICAgIH1cbn1cbiIsImltcG9ydCB7Y29uZmlybX0gZnJvbSBcInNtYWxsdGFsa1wiO1xuaW1wb3J0IHtQcm9ncmVzc30gZnJvbSBcIi4vcHJvZ3Jlc3NcIjtcbmltcG9ydCB7dmFsaWRhdGVkSW5wdXR9IGZyb20gXCIuL3ZhbGlkYXRpb25cIjtcbmltcG9ydCB7Tm90aWNlLCBwYXJzZUZyb250TWF0dGVyVGFnc30gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQge1RhZywgUmVwbGFjZW1lbnR9IGZyb20gXCIuL1RhZ1wiO1xuaW1wb3J0IHtGaWxlfSBmcm9tIFwiLi9GaWxlXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZW5hbWVUYWcoYXBwLCB0YWdOYW1lKSB7XG4gICAgY29uc3QgbmV3TmFtZSA9IGF3YWl0IHByb21wdEZvck5ld05hbWUodGFnTmFtZSk7XG4gICAgaWYgKG5ld05hbWUgPT09IGZhbHNlKSByZXR1cm47ICAvLyBhYm9ydGVkXG5cbiAgICBpZiAoIW5ld05hbWUgfHwgbmV3TmFtZSA9PT0gdGFnTmFtZSkge1xuICAgICAgICByZXR1cm4gbmV3IE5vdGljZShcIlVuY2hhbmdlZCBvciBlbXB0eSB0YWc6IE5vIGNoYW5nZXMgbWFkZS5cIik7XG4gICAgfVxuXG4gICAgY29uc3RcbiAgICAgICAgb2xkVGFnICA9IG5ldyBUYWcodGFnTmFtZSksXG4gICAgICAgIG5ld1RhZyAgPSBuZXcgVGFnKG5ld05hbWUpLFxuICAgICAgICByZXBsYWNlID0gbmV3IFJlcGxhY2VtZW50KG9sZFRhZywgbmV3VGFnKSxcbiAgICAgICAgY2xhc2hpbmcgPSByZXBsYWNlLndpbGxNZXJnZVRhZ3MoXG4gICAgICAgICAgICBhbGxUYWdzKGFwcCkucmV2ZXJzZSgpICAgLy8gZmluZCBsb25nZXN0IGNsYXNoIGZpcnN0XG4gICAgICAgICksXG4gICAgICAgIHNob3VsZEFib3J0ID0gY2xhc2hpbmcgJiZcbiAgICAgICAgICAgIGF3YWl0IHNob3VsZEFib3J0RHVlVG9DbGFzaChjbGFzaGluZywgb2xkVGFnLCBuZXdUYWcpXG4gICAgICAgIDtcblxuICAgIGlmIChzaG91bGRBYm9ydCkgcmV0dXJuO1xuXG4gICAgY29uc3QgdGFyZ2V0cyA9IGF3YWl0IGZpbmRUYXJnZXRzKGFwcCwgb2xkVGFnKTtcbiAgICBpZiAoIXRhcmdldHMpIHJldHVybjtcblxuICAgIGNvbnN0IHByb2dyZXNzID0gbmV3IFByb2dyZXNzKGBSZW5hbWluZyB0byAjJHtuZXdOYW1lfS8qYCwgXCJQcm9jZXNzaW5nIGZpbGVzLi4uXCIpO1xuICAgIGxldCByZW5hbWVkID0gMDtcbiAgICBhd2FpdCBwcm9ncmVzcy5mb3JFYWNoKHRhcmdldHMsIGFzeW5jICh0YXJnZXQpID0+IHtcbiAgICAgICAgcHJvZ3Jlc3MubWVzc2FnZSA9IFwiUHJvY2Vzc2luZyBcIiArIHRhcmdldC5iYXNlbmFtZTtcbiAgICAgICAgaWYgKGF3YWl0IHRhcmdldC5yZW5hbWVkKHJlcGxhY2UpKSByZW5hbWVkKys7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbmV3IE5vdGljZShgT3BlcmF0aW9uICR7cHJvZ3Jlc3MuYWJvcnRlZCA/IFwiY2FuY2VsbGVkXCIgOiBcImNvbXBsZXRlXCJ9OiAke3JlbmFtZWR9IGZpbGUocykgdXBkYXRlZGApO1xufVxuXG5mdW5jdGlvbiBhbGxUYWdzKGFwcCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhhcHAubWV0YWRhdGFDYWNoZS5nZXRUYWdzKCkpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmluZFRhcmdldHMoYXBwLCB0YWcpIHtcbiAgICBjb25zdCB0YXJnZXRzID0gW107XG4gICAgY29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MoYFNlYXJjaGluZyBmb3IgJHt0YWd9LypgLCBcIk1hdGNoaW5nIGZpbGVzLi4uXCIpO1xuICAgIGF3YWl0IHByb2dyZXNzLmZvckVhY2goXG4gICAgICAgIGFwcC5tZXRhZGF0YUNhY2hlLmdldENhY2hlZEZpbGVzKCksXG4gICAgICAgIGZpbGVuYW1lID0+IHtcbiAgICAgICAgICAgIGxldCB7IGZyb250bWF0dGVyLCB0YWdzIH0gPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRDYWNoZShmaWxlbmFtZSkgfHwge307XG4gICAgICAgICAgICB0YWdzID0gKHRhZ3MgfHwgW10pLmZpbHRlcih0ID0+IHQudGFnICYmIHRhZy5tYXRjaGVzKHQudGFnKSkucmV2ZXJzZSgpOyAvLyBsYXN0IHBvc2l0aW9ucyBmaXJzdFxuICAgICAgICAgICAgY29uc3QgZm10YWdzID0gKHBhcnNlRnJvbnRNYXR0ZXJUYWdzKGZyb250bWF0dGVyKSB8fCBbXSkuZmlsdGVyKHRhZy5tYXRjaGVzKTtcbiAgICAgICAgICAgIGlmICh0YWdzLmxlbmd0aCB8fCBmbXRhZ3MubGVuZ3RoKVxuICAgICAgICAgICAgICAgIHRhcmdldHMucHVzaChuZXcgRmlsZShhcHAsIGZpbGVuYW1lLCB0YWdzLCBmbXRhZ3MubGVuZ3RoKSk7XG4gICAgICAgIH1cbiAgICApO1xuICAgIGlmICghcHJvZ3Jlc3MuYWJvcnRlZClcbiAgICAgICAgcmV0dXJuIHRhcmdldHM7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHByb21wdEZvck5ld05hbWUodGFnTmFtZSkge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBhd2FpdCB2YWxpZGF0ZWRJbnB1dChcbiAgICAgICAgICAgIGBSZW5hbWluZyAjJHt0YWdOYW1lfSAoYW5kIGFueSBzdWItdGFncylgLCBcIkVudGVyIG5ldyBuYW1lIChtdXN0IGJlIGEgdmFsaWQgT2JzaWRpYW4gdGFnKTpcXG5cIixcbiAgICAgICAgICAgIHRhZ05hbWUsXG4gICAgICAgICAgICBcIlteXFx1MjAwMC1cXHUyMDZGXFx1MkUwMC1cXHUyRTdGJyFcXFwiIyQlJigpKissLjo7PD0+P0BeYHt8fX5cXFxcW1xcXFxdXFxcXFxcXFxcXFxcc10rXCIsXG4gICAgICAgICAgICBcIk9ic2lkaWFuIHRhZyBuYW1lXCJcbiAgICAgICAgKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAgLy8gdXNlciBjYW5jZWxsZWRcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNob3VsZEFib3J0RHVlVG9DbGFzaChbb3JpZ2luLCBjbGFzaF0sIG9sZFRhZywgbmV3VGFnKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgY29uZmlybShcbiAgICAgICAgICAgIFwiV0FSTklORzogTm8gVW5kbyFcIixcbiAgICAgICAgICAgIGBSZW5hbWluZyA8Y29kZT4ke29sZFRhZ308L2NvZGU+IHRvIDxjb2RlPiR7bmV3VGFnfTwvY29kZT4gd2lsbCBtZXJnZSAke1xuICAgICAgICAgICAgICAgIChvcmlnaW4uY2Fub25pY2FsID09PSBvbGRUYWcuY2Fub25pY2FsKSA/XG4gICAgICAgICAgICAgICAgICAgIGB0aGVzZSB0YWdzYCA6IGBtdWx0aXBsZSB0YWdzXG4gICAgICAgICAgICAgICAgICAgIGludG8gZXhpc3RpbmcgdGFncyAoc3VjaCBhcyA8Y29kZT4ke29yaWdpbn08L2NvZGU+XG4gICAgICAgICAgICAgICAgICAgIG1lcmdpbmcgd2l0aCA8Y29kZT4ke2NsYXNofTwvY29kZT4pYFxuICAgICAgICAgICAgfS5cblxuICAgICAgICAgICAgVGhpcyA8Yj5jYW5ub3Q8L2I+IGJlIHVuZG9uZS4gIERvIHlvdSB3aXNoIHRvIHByb2NlZWQ/YFxuICAgICAgICApO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG59XG4iLCJpbXBvcnQge01lbnUsIE5vdGljZSwgUGx1Z2luLCBTY29wZX0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQge3JlbmFtZVRhZywgZmluZFRhcmdldHN9IGZyb20gXCIuL3JlbmFtaW5nXCI7XG5pbXBvcnQge1RhZ30gZnJvbSBcIi4vVGFnXCI7XG5cbmZ1bmN0aW9uIG9uRWxlbWVudChlbCwgZXZlbnQsIHNlbGVjdG9yLCBjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGVsLm9uKGV2ZW50LCBzZWxlY3RvciwgY2FsbGJhY2ssIG9wdGlvbnMpXG4gICAgcmV0dXJuICgpID0+IGVsLm9mZihldmVudCwgc2VsZWN0b3IsIGNhbGxiYWNrLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGFnV3JhbmdsZXIgZXh0ZW5kcyBQbHVnaW4ge1xuICAgIG9ubG9hZCgpe1xuICAgICAgICB0aGlzLnJlZ2lzdGVyKFxuICAgICAgICAgICAgb25FbGVtZW50KGRvY3VtZW50LCBcImNvbnRleHRtZW51XCIsIFwiLnRhZy1wYW5lLXRhZ1wiLCB0aGlzLm9uTWVudS5iaW5kKHRoaXMpLCB7Y2FwdHVyZTogdHJ1ZX0pXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgb25NZW51KGUsIHRhZ0VsKSB7XG4gICAgICAgIGlmICghZS5vYnNpZGlhbl9jb250ZXh0bWVudSkge1xuICAgICAgICAgICAgZS5vYnNpZGlhbl9jb250ZXh0bWVudSA9IG5ldyBNZW51KHRoaXMuYXBwKTtcbiAgICAgICAgICAgIHNldEltbWVkaWF0ZSgoKSA9PiBtZW51LnNob3dBdFBvc2l0aW9uKHt4OiBlLnBhZ2VYLCB5OiBlLnBhZ2VZfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3RcbiAgICAgICAgICAgIHRhZ05hbWUgPSB0YWdFbC5maW5kKFwiLnRhZy1wYW5lLXRhZy10ZXh0XCIpLnRleHRDb250ZW50LFxuICAgICAgICAgICAgaXNIaWVyYXJjaHkgPSB0YWdFbC5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQuZmluZChcIi5jb2xsYXBzZS1pY29uXCIpLFxuICAgICAgICAgICAgc2VhcmNoUGx1Z2luID0gdGhpcy5hcHAuaW50ZXJuYWxQbHVnaW5zLmdldFBsdWdpbkJ5SWQoXCJnbG9iYWwtc2VhcmNoXCIpLFxuICAgICAgICAgICAgc2VhcmNoID0gc2VhcmNoUGx1Z2luICYmIHNlYXJjaFBsdWdpbi5pbnN0YW5jZSxcbiAgICAgICAgICAgIHF1ZXJ5ID0gc2VhcmNoICYmIHNlYXJjaC5nZXRHbG9iYWxTZWFyY2hRdWVyeSgpLFxuICAgICAgICAgICAgcmFuZG9tID0gdGhpcy5hcHAucGx1Z2lucy5wbHVnaW5zW1wic21hcnQtcmFuZG9tLW5vdGVcIl0sXG4gICAgICAgICAgICBtZW51ID0gZS5vYnNpZGlhbl9jb250ZXh0bWVudS5hZGRJdGVtKGl0ZW0oXCJwZW5jaWxcIiwgXCJSZW5hbWUgI1wiK3RhZ05hbWUsICgpID0+IHRoaXMucmVuYW1lKHRhZ05hbWUpKSk7XG5cbiAgICAgICAgbWVudS5yZWdpc3RlcihcbiAgICAgICAgICAgIG9uRWxlbWVudChkb2N1bWVudCwgXCJrZXlkb3duXCIsIFwiKlwiLCBlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZS5rZXk9PT1cIkVzY2FwZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgbWVudS5oaWRlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwge2NhcHR1cmU6IHRydWV9KVxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChzZWFyY2gpIHtcbiAgICAgICAgICAgIG1lbnUuYWRkU2VwYXJhdG9yKCkuYWRkSXRlbShcbiAgICAgICAgICAgICAgICBpdGVtKFwibWFnbmlmeWluZy1nbGFzc1wiLCBcIk5ldyBzZWFyY2ggZm9yICNcIit0YWdOYW1lLCAoKSA9PiBzZWFyY2gub3Blbkdsb2JhbFNlYXJjaChcInRhZzpcIiArIHRhZ05hbWUpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICAgICAgICAgIG1lbnUuYWRkSXRlbShcbiAgICAgICAgICAgICAgICAgICAgaXRlbShcInNoZWV0cy1pbi1ib3hcIiwgXCJSZXF1aXJlICNcIit0YWdOYW1lK1wiIGluIHNlYXJjaFwiICAsICgpID0+IHNlYXJjaC5vcGVuR2xvYmFsU2VhcmNoKHF1ZXJ5K1wiIHRhZzpcIiAgKyB0YWdOYW1lKSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWVudS5hZGRJdGVtKFxuICAgICAgICAgICAgICAgIGl0ZW0oXCJjcm9zc2VkLXN0YXJcIiAsIFwiRXhjbHVkZSAjXCIrdGFnTmFtZStcIiBmcm9tIHNlYXJjaFwiLCAoKSA9PiBzZWFyY2gub3Blbkdsb2JhbFNlYXJjaChxdWVyeStcIiAtdGFnOlwiICsgdGFnTmFtZSkpXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJhbmRvbSkge1xuICAgICAgICAgICAgbWVudS5hZGRTZXBhcmF0b3IoKS5hZGRJdGVtKFxuICAgICAgICAgICAgICAgIGl0ZW0oXCJkaWNlXCIsIFwiT3BlbiByYW5kb20gbm90ZVwiLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldHMgPSBhd2FpdCBmaW5kVGFyZ2V0cyh0aGlzLmFwcCwgbmV3IFRhZyh0YWdOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgIHJhbmRvbS5vcGVuUmFuZG9tTm90ZSh0YXJnZXRzLm1hcChmPT5mLmZpbGVuYW1lKSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UudHJpZ2dlcihcInRhZy13cmFuZ2xlcjpjb250ZXh0bWVudVwiLCBtZW51LCB0YWdOYW1lLCB7c2VhcmNoLCBxdWVyeSwgaXNIaWVyYXJjaHl9KTtcblxuICAgICAgICBpZiAoaXNIaWVyYXJjaHkpIHtcbiAgICAgICAgICAgIGNvbnN0XG4gICAgICAgICAgICAgICAgdGFnUGFyZW50ID0gdGFnTmFtZS5zcGxpdChcIi9cIikuc2xpY2UoMCwgLTEpLmpvaW4oXCIvXCIpLFxuICAgICAgICAgICAgICAgIHRhZ1ZpZXcgPSB0aGlzLmxlYWZWaWV3KHRhZ0VsLm1hdGNoUGFyZW50KFwiLndvcmtzcGFjZS1sZWFmXCIpKSxcbiAgICAgICAgICAgICAgICB0YWdDb250YWluZXIgPSB0YWdQYXJlbnQgPyB0YWdWaWV3LnRhZ0RvbXNbXCIjXCIgKyB0YWdQYXJlbnQudG9Mb3dlckNhc2UoKV06IHRhZ1ZpZXcucm9vdFxuICAgICAgICAgICAgO1xuICAgICAgICAgICAgZnVuY3Rpb24gdG9nZ2xlKGNvbGxhcHNlKSB7XG4gICAgICAgICAgICAgICAgZm9yKGNvbnN0IHRhZyBvZiB0YWdDb250YWluZXIuY2hpbGRyZW4pIHRhZy5zZXRDb2xsYXBzZWQoY29sbGFwc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWVudS5hZGRTZXBhcmF0b3IoKVxuICAgICAgICAgICAgLmFkZEl0ZW0oaXRlbShcInZlcnRpY2FsLXRocmVlLWRvdHNcIiwgXCJDb2xsYXBzZSB0YWdzIGF0IHRoaXMgbGV2ZWxcIiwgKCkgPT4gdG9nZ2xlKHRydWUgKSkpXG4gICAgICAgICAgICAuYWRkSXRlbShpdGVtKFwiZXhwYW5kLXZlcnRpY2FsbHlcIiAgLCBcIkV4cGFuZCB0YWdzIGF0IHRoaXMgbGV2ZWxcIiAgLCAoKSA9PiB0b2dnbGUoZmFsc2UpKSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxlYWZWaWV3KGNvbnRhaW5lckVsKSB7XG4gICAgICAgIGxldCB2aWV3O1xuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuaXRlcmF0ZUFsbExlYXZlcygobGVhZikgPT4ge1xuICAgICAgICAgICAgaWYgKGxlYWYuY29udGFpbmVyRWwgPT09IGNvbnRhaW5lckVsKSB7IHZpZXcgPSBsZWFmLnZpZXc7IHJldHVybiB0cnVlOyB9XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiB2aWV3O1xuICAgIH1cblxuXG4gICAgYXN5bmMgcmVuYW1lKHRhZ05hbWUpIHtcbiAgICAgICAgY29uc3Qgc2NvcGUgPSBuZXcgU2NvcGU7XG4gICAgICAgIHRoaXMuYXBwLmtleW1hcC5wdXNoU2NvcGUoc2NvcGUpO1xuICAgICAgICB0cnkgeyBhd2FpdCByZW5hbWVUYWcodGhpcy5hcHAsIHRhZ05hbWUpOyB9XG4gICAgICAgIGNhdGNoIChlKSB7IGNvbnNvbGUuZXJyb3IoZSk7IG5ldyBOb3RpY2UoXCJlcnJvcjogXCIgKyBlKTsgfVxuICAgICAgICB0aGlzLmFwcC5rZXltYXAucG9wU2NvcGUoc2NvcGUpO1xuICAgIH1cblxufVxuXG5mdW5jdGlvbiBpdGVtKGljb24sIHRpdGxlLCBjbGljaykge1xuICAgIHJldHVybiBpID0+IGkuc2V0SWNvbihpY29uKS5zZXRUaXRsZSh0aXRsZSkub25DbGljayhjbGljayk7XG59XG5cbiJdLCJuYW1lcyI6WyJjdXJyaWZ5Iiwic3RvcmUiLCJxdWVyeSIsIk5vdGljZSIsIk5vZGUiLCJDb2xsZWN0aW9uIiwiQWxpYXMiLCJpbnRJZGVudGlmeSIsInNldCIsImludFJlc29sdmUiLCJpbnRTdHJpbmdpZnkiLCJEb2N1bWVudCIsIkRvY3VtZW50JDEiLCJwYXJzZSQxIiwicGFyc2VGcm9udE1hdHRlclRhZ3MiLCJQbHVnaW4iLCJNZW51IiwiU2NvcGUiXSwibWFwcGluZ3MiOiI7Ozs7QUFFQSxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSztBQUNsQjtBQUNBLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDM0MsSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDOUMsSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQ2pELElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7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QUFLLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLGlCQUFpQixDQUFDLElBQUksRUFBRSxtRUFBbUUsQ0FBQyxDQUFDLENBQUM7QUFDakksT0FBTyxNQUFNLElBQUksRUFBRSxLQUFLLElBQUksRUFBRTtBQUM5QixRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDZjtBQUNBLFFBQVEsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLFVBQVUsS0FBSyxHQUFHO0FBQ2xCLFlBQVksR0FBRyxJQUFJLElBQUksQ0FBQztBQUN4QixZQUFZLE1BQU07QUFDbEI7QUFDQTtBQUNBLFVBQVUsS0FBSyxHQUFHO0FBQ2xCLFlBQVksR0FBRyxJQUFJLE1BQU0sQ0FBQztBQUMxQixZQUFZLE1BQU07QUFDbEI7QUFDQTtBQUNBLFVBQVUsS0FBSyxHQUFHO0FBQ2xCLFlBQVksR0FBRyxJQUFJLElBQUksQ0FBQztBQUN4QixZQUFZLE1BQU07QUFDbEI7QUFDQTtBQUNBLFVBQVUsS0FBSyxHQUFHO0FBQ2xCLFlBQVksR0FBRyxJQUFJLE1BQU0sQ0FBQztBQUMxQixZQUFZLE1BQU07QUFDbEI7QUFDQTtBQUNBLFVBQVUsS0FBSyxHQUFHO0FBQ2xCLFlBQVksR0FBRyxJQUFJLElBQUksQ0FBQztBQUN4QixZQUFZLE1BQU07QUFDbEI7QUFDQTtBQUNBLFVBQVUsS0FBSyxHQUFHO0FBQ2xCLFlBQVksR0FBRyxJQUFJLElBQUksQ0FBQztBQUN4QixZQUFZLE1BQU07QUFDbEI7QUFDQTtBQUNBLFVBQVUsS0FBSyxHQUFHO0FBQ2xCLFlBQVksR0FBRyxJQUFJLElBQUksQ0FBQztBQUN4QixZQUFZLE1BQU07QUFDbEI7QUFDQTtBQUNBLFVBQVUsS0FBSyxHQUFHO0FBQ2xCLFlBQVksR0FBRyxJQUFJLElBQUksQ0FBQztBQUN4QixZQUFZLE1BQU07QUFDbEI7QUFDQTtBQUNBLFVBQVUsS0FBSyxHQUFHO0FBQ2xCLFlBQVksR0FBRyxJQUFJLElBQUksQ0FBQztBQUN4QixZQUFZLE1BQU07QUFDbEI7QUFDQTtBQUNBLFVB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QU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzVLOztBQ1BBLE1BQU1DLE1BQUksQ0FBQzs7QUNBWDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMsSUFBSSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFO0FBQy9CLEVBQUUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNoRjtBQUNBLEVBQUUsSUFBSSxLQUFLLElBQUksT0FBTyxLQUFLLENBQUMsTUFBTSxLQUFLLFVBQVUsRUFBRTtBQUNuRCxJQUFJLE1BQU0sTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2hFLElBQUksSUFBSSxNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsR0FBRyxHQUFHLElBQUk7QUFDdEMsTUFBTSxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUN2QixNQUFNLE9BQU8sR0FBRyxDQUFDLFFBQVEsQ0FBQztBQUMxQixLQUFLLENBQUM7QUFDTixJQUFJLE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxN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QUFDO0FBQzFFLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzdFLEtBQUssTUFBTTtBQUNYLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDNUIsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRTtBQUNkLElBQUksTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDekMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLE9BQU8sS0FBSyxDQUFDO0FBQzFCLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDN0QsSUFBSSxPQUFPLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQzFCLEdBQUc7QUFDSDtBQUNBLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxVQUFVLEVBQUU7QUFDdkIsSUFBSSxNQUFNLEVBQUUsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN6QyxJQUFJLE1BQU0sSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDO0FBQ2hDLElBQUksT0FBTyxDQUFDLFVBQVUsSUFBSSxJQUFJLFlBQVksTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO0FBQ3JFLEdBQUc7QUFDSDtBQUNBLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRTtBQUNYLElBQUksT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdkMsR0FBRztBQUNIO0FBQ0EsRUFBRSxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRTtBQUNsQixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3pDLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUUsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFO0FBQ3ZCLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFDekUsSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDL0M7QUFDQSxJQUFJLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUM3RDtBQUNBLElBQUksT0FBTyxHQUFHLENBQUM7QUFDZixHQUFHO0FBQ0g7QUFDQSxFQUFFLFFBQVEsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRTtBQUN4QyxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFDO0FBQ0EsSUFBSSxLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7QUFDbkMsTUFBTSxJQUFJLEVBQUUsSUFBSSxZQUFZLElBQUksQ0FBQyxFQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FB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LFFBQVEsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFCLFFBQVEsTUFBTSxFQUFFLEdBQUcsWUFBWSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQzdELFFBQVEsSUFBSSxFQUFFLEtBQUssU0FBUyxFQUFFLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDNUUsT0FBTztBQUNQLEtBQUssTUFBTSxJQUFJLEdBQUcsWUFBWSxHQUFHLEVBQUU7QUFDbkMsTUFBTSxLQUFLLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUU7QUFDOUMsUUFBUSxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlCLFFBQVEsTUFBTSxFQUFFLEdBQUcsWUFBWSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3JELFFBQVEsSUFBSSxFQUFFLEtBQUssU0FBUyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDL0UsT0FBTztBQUNQLEtBQUssTUFBTSxJQUFJLEdBQUcsWUFBWSxHQUFHLEVBQUU7QUFDbkMsTUFBTSxLQUFLLE1BQU0sRUFBRSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDeEMsUUFBUSxNQUFNLEVBQUUsR0FBRyxZQUFZLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDdEQsUUFB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
