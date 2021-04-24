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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLnlhcm4vY2FjaGUvY3VycmlmeS1ucG0tNC4wLjAtYjkyZWUzYTRlYi04MjViNjgxODQxLnppcC9ub2RlX21vZHVsZXMvY3VycmlmeS9saWIvY3VycmlmeS5qcyIsIi55YXJuL2NhY2hlL2Z1bGxzdG9yZS1ucG0tMy4wLjAtYzQ4NTY0NGE2NS02ZDM5OTNjN2JmLnppcC9ub2RlX21vZHVsZXMvZnVsbHN0b3JlL2xpYi9mdWxsc3RvcmUuanMiLCIueWFybi9jYWNoZS9AY2xvdWRjbWQtY3JlYXRlLWVsZW1lbnQtbnBtLTIuMC4yLTE5NzY5NTlhNmMtMTk2ZDA5YjJkMi56aXAvbm9kZV9tb2R1bGVzL0BjbG91ZGNtZC9jcmVhdGUtZWxlbWVudC9saWIvY3JlYXRlLWVsZW1lbnQuanMiLCIueWFybi9jYWNoZS9zbWFsbHRhbGstbnBtLTQuMC43LTgyMzM5ZjY2NzItZDY3MzZmMzI0Yy56aXAvbm9kZV9tb2R1bGVzL3NtYWxsdGFsay9saWIvc21hbGx0YWxrLmpzIiwic3JjL3Byb2dyZXNzLmpzIiwic3JjL3ZhbGlkYXRpb24uanMiLCJzcmMvVGFnLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9jb25zdGFudHMuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9zb3VyY2UtdXRpbHMuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9SYW5nZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L05vZGUuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2Vycm9ycy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L0JsYW5rTGluZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L0NvbGxlY3Rpb25JdGVtLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9jc3QvQ29tbWVudC5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L0NvbGxlY3Rpb24uanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9EaXJlY3RpdmUuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9Eb2N1bWVudC5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvX3ZpcnR1YWwvX3JvbGx1cFBsdWdpbkJhYmVsSGVscGVycy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L0FsaWFzLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9jc3QvQmxvY2tWYWx1ZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L0Zsb3dDb2xsZWN0aW9uLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9jc3QvUGxhaW5WYWx1ZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvY3N0L1F1b3RlRG91YmxlLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9jc3QvUXVvdGVTaW5nbGUuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9QYXJzZUNvbnRleHQuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2NzdC9wYXJzZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvdGFncy9vcHRpb25zLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9vcHRpb25zLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9zdHJpbmdpZnkvYWRkQ29tbWVudC5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvYXN0L05vZGUuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2FzdC90b0pTLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9hc3QvU2NhbGFyLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9kb2MvY3JlYXRlTm9kZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvYXN0L0NvbGxlY3Rpb24uanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2xvZy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvYXN0L1lBTUxTZXEuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2FzdC9QYWlyLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9hc3QvQWxpYXMuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3Jlc29sdmUvcmVzb2x2ZVNjYWxhci5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3Qvc3RyaW5naWZ5L2ZvbGRGbG93TGluZXMuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3N0cmluZ2lmeS9zdHJpbmdpZnlTdHJpbmcuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3N0cmluZ2lmeS9zdHJpbmdpZnlUYWcuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3N0cmluZ2lmeS9zdHJpbmdpZnkuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2FzdC9ZQU1MTWFwLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9hc3QvTWVyZ2UuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L2RvYy9BbmNob3JzLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9zdHJpbmdpZnkvc3RyaW5naWZ5TnVtYmVyLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC90YWdzL2ZhaWxzYWZlL21hcC5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvdGFncy9mYWlsc2FmZS9zZXEuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3RhZ3MvZmFpbHNhZmUvc3RyaW5nLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC90YWdzL2ZhaWxzYWZlL2luZGV4LmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC90YWdzL2NvcmUuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3RhZ3MvanNvbi5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvdGFncy95YW1sLTEuMS9iaW5hcnkuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3RhZ3MveWFtbC0xLjEvcGFpcnMuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3RhZ3MveWFtbC0xLjEvb21hcC5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvdGFncy95YW1sLTEuMS9zZXQuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3RhZ3MveWFtbC0xLjEvdGltZXN0YW1wLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC90YWdzL3lhbWwtMS4xL2luZGV4LmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC90YWdzL2luZGV4LmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9kb2MvZ2V0U2NoZW1hVGFncy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvZG9jL1NjaGVtYS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvZG9jL2FwcGx5UmV2aXZlci5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvZG9jL2xpc3RUYWdOYW1lcy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvcmVzb2x2ZS9yZXNvbHZlVGFnTmFtZS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvcmVzb2x2ZS9jb2xsZWN0aW9uLXV0aWxzLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9yZXNvbHZlL3Jlc29sdmVNYXAuanMiLCIueWFybi9jYWNoZS95YW1sLW5wbS0yLjAuMC0zLTMxNzY4ZTgyN2QtZmMxNDIyNzA3OS56aXAvbm9kZV9tb2R1bGVzL3lhbWwvYnJvd3Nlci9kaXN0L3Jlc29sdmUvcmVzb2x2ZVNlcS5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvcmVzb2x2ZS9yZXNvbHZlVGFnLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9yZXNvbHZlL3Jlc29sdmVOb2RlLmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9kb2MvcGFyc2VDb250ZW50cy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvZG9jL3BhcnNlRGlyZWN0aXZlcy5qcyIsIi55YXJuL2NhY2hlL3lhbWwtbnBtLTIuMC4wLTMtMzE3NjhlODI3ZC1mYzE0MjI3MDc5LnppcC9ub2RlX21vZHVsZXMveWFtbC9icm93c2VyL2Rpc3QvZG9jL0RvY3VtZW50LmpzIiwiLnlhcm4vY2FjaGUveWFtbC1ucG0tMi4wLjAtMy0zMTc2OGU4MjdkLWZjMTQyMjcwNzkuemlwL25vZGVfbW9kdWxlcy95YW1sL2Jyb3dzZXIvZGlzdC9pbmRleC5qcyIsInNyYy9GaWxlLmpzIiwic3JjL3JlbmFtaW5nLmpzIiwic3JjL3BsdWdpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGYgPSAoZm4pID0+IFtcbiAgICAvKmVzbGludCBuby11bnVzZWQtdmFyczogMCovXG4gICAgZnVuY3Rpb24gKGEpIHtyZXR1cm4gZm4oLi4uYXJndW1lbnRzKTt9LFxuICAgIGZ1bmN0aW9uIChhLCBiKSB7cmV0dXJuIGZuKC4uLmFyZ3VtZW50cyk7fSxcbiAgICBmdW5jdGlvbiAoYSwgYiwgYykge3JldHVybiBmbiguLi5hcmd1bWVudHMpO30sXG4gICAgZnVuY3Rpb24gKGEsIGIsIGMsIGQpIHtyZXR1cm4gZm4oLi4uYXJndW1lbnRzKTt9LFxuICAgIGZ1bmN0aW9uIChhLCBiLCBjLCBkLCBlKSB7cmV0dXJuIGZuKC4uLmFyZ3VtZW50cyk7fSxcbl07XG5cbmNvbnN0IGN1cnJpZnkgPSAoZm4sIC4uLmFyZ3MpID0+IHtcbiAgICBjaGVjayhmbik7XG4gICAgXG4gICAgaWYgKGFyZ3MubGVuZ3RoID49IGZuLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIFxuICAgIGNvbnN0IGFnYWluID0gKC4uLmFyZ3MyKSA9PiB7XG4gICAgICAgIHJldHVybiBjdXJyaWZ5KGZuLCAuLi5bLi4uYXJncywgLi4uYXJnczJdKTtcbiAgICB9O1xuICAgIFxuICAgIGNvbnN0IGNvdW50ID0gZm4ubGVuZ3RoIC0gYXJncy5sZW5ndGggLSAxO1xuICAgIGNvbnN0IGZ1bmMgPSBmKGFnYWluKVtjb3VudF07XG4gICAgXG4gICAgcmV0dXJuIGZ1bmMgfHwgYWdhaW47XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGN1cnJpZnk7XG5cbmZ1bmN0aW9uIGNoZWNrKGZuKSB7XG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgdGhyb3cgRXJyb3IoJ2ZuIHNob3VsZCBiZSBmdW5jdGlvbiEnKTtcbn1cblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9ICh2YWx1ZSkgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgIHZhbHVlLFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSBhcmdzO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFhcmdzLmxlbmd0aClcbiAgICAgICAgICAgIHJldHVybiBkYXRhLnZhbHVlO1xuICAgICAgICBcbiAgICAgICAgZGF0YS52YWx1ZSA9IHZhbHVlO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGN1cnJpZnkgPSByZXF1aXJlKCdjdXJyaWZ5Jyk7XG5jb25zdCBxdWVyeSA9IChhKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBbZGF0YS1uYW1lPVwiJHthfVwiXWApO1xuXG5jb25zdCBzZXRBdHRyaWJ1dGUgPSBjdXJyaWZ5KChlbCwgb2JqLCBuYW1lKSA9PiBlbC5zZXRBdHRyaWJ1dGUobmFtZSwgb2JqW25hbWVdKSk7XG5jb25zdCBzZXQgPSBjdXJyaWZ5KChlbCwgb2JqLCBuYW1lKSA9PiBlbFtuYW1lXSA9IG9ialtuYW1lXSk7XG5jb25zdCBub3QgPSBjdXJyaWZ5KChmLCBhKSA9PiAhZihhKSk7XG5jb25zdCBpc0NhbWVsQ2FzZSA9IChhKSA9PiBhICE9IGEudG9Mb3dlckNhc2UoKTtcblxubW9kdWxlLmV4cG9ydHMgPSAobmFtZSwgb3B0aW9ucyA9IHt9KSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgICBkYXRhTmFtZSxcbiAgICAgICAgbm90QXBwZW5kLFxuICAgICAgICBwYXJlbnQgPSBkb2N1bWVudC5ib2R5LFxuICAgICAgICB1bmlxID0gdHJ1ZSxcbiAgICAgICAgLi4ucmVzdE9wdGlvbnNcbiAgICB9ID0gb3B0aW9ucztcbiAgICBcbiAgICBjb25zdCBlbEZvdW5kID0gaXNFbGVtZW50UHJlc2VudChkYXRhTmFtZSk7XG4gICAgXG4gICAgaWYgKHVuaXEgJiYgZWxGb3VuZClcbiAgICAgICAgcmV0dXJuIGVsRm91bmQ7XG4gICAgXG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KG5hbWUpO1xuICAgIFxuICAgIGlmIChkYXRhTmFtZSlcbiAgICAgICAgZWwuZGF0YXNldC5uYW1lID0gZGF0YU5hbWU7XG4gICAgXG4gICAgT2JqZWN0LmtleXMocmVzdE9wdGlvbnMpXG4gICAgICAgIC5maWx0ZXIoaXNDYW1lbENhc2UpXG4gICAgICAgIC5tYXAoc2V0KGVsLCBvcHRpb25zKSk7XG4gICAgXG4gICAgT2JqZWN0LmtleXMocmVzdE9wdGlvbnMpXG4gICAgICAgIC5maWx0ZXIobm90KGlzQ2FtZWxDYXNlKSlcbiAgICAgICAgLm1hcChzZXRBdHRyaWJ1dGUoZWwsIG9wdGlvbnMpKTtcbiAgICBcbiAgICBpZiAoIW5vdEFwcGVuZClcbiAgICAgICAgcGFyZW50LmFwcGVuZENoaWxkKGVsKTtcbiAgICBcbiAgICByZXR1cm4gZWw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5pc0VsZW1lbnRQcmVzZW50ID0gaXNFbGVtZW50UHJlc2VudDtcblxuZnVuY3Rpb24gaXNFbGVtZW50UHJlc2VudChkYXRhTmFtZSkge1xuICAgIGlmICghZGF0YU5hbWUpXG4gICAgICAgIHJldHVybjtcbiAgICBcbiAgICByZXR1cm4gcXVlcnkoZGF0YU5hbWUpO1xufVxuXG4iLCIndXNlIHN0cmljdCc7XG5cbnJlcXVpcmUoJy4uL2Nzcy9zbWFsbHRhbGsuY3NzJyk7XG5cbmNvbnN0IGN1cnJpZnkgPSByZXF1aXJlKCdjdXJyaWZ5Jyk7XG5jb25zdCBzdG9yZSA9IHJlcXVpcmUoJ2Z1bGxzdG9yZScpO1xuY29uc3QgY3JlYXRlRWxlbWVudCA9IHJlcXVpcmUoJ0BjbG91ZGNtZC9jcmVhdGUtZWxlbWVudCcpO1xuXG5jb25zdCBrZXlEb3duID0gY3VycmlmeShrZXlEb3duXyk7XG5cbmNvbnN0IEJVVFRPTl9PSyA9IHtcbiAgICBvazogJ09LJyxcbn07XG5cbmNvbnN0IEJVVFRPTl9PS19DQU5DRUwgPSB7XG4gICAgb2s6ICdPSycsXG4gICAgY2FuY2VsOiAnQ2FuY2VsJyxcbn07XG5cbmNvbnN0IHpJbmRleCA9IHN0b3JlKDEwMCk7XG5cbmV4cG9ydHMuYWxlcnQgPSAodGl0bGUsIG1zZywgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IGJ1dHRvbnMgPSBnZXRCdXR0b25zKG9wdGlvbnMpIHx8IEJVVFRPTl9PSztcbiAgICByZXR1cm4gc2hvd0RpYWxvZyh0aXRsZSwgbXNnLCAnJywgYnV0dG9ucywgb3B0aW9ucyk7XG59O1xuXG5leHBvcnRzLnByb21wdCA9ICh0aXRsZSwgbXNnLCB2YWx1ZSA9ICcnLCBvcHRpb25zKSA9PiB7XG4gICAgY29uc3QgdHlwZSA9IGdldFR5cGUob3B0aW9ucyk7XG4gICAgY29uc3QgdmFsID0gU3RyaW5nKHZhbHVlKVxuICAgICAgICAucmVwbGFjZSgvXCIvZywgJyZxdW90OycpO1xuICAgIFxuICAgIGNvbnN0IHZhbHVlU3RyID0gYDxpbnB1dCB0eXBlPVwiJHsgdHlwZSB9XCIgdmFsdWU9XCIkeyB2YWwgfVwiIGRhdGEtbmFtZT1cImpzLWlucHV0XCI+YDtcbiAgICBjb25zdCBidXR0b25zID0gZ2V0QnV0dG9ucyhvcHRpb25zKSB8fCBCVVRUT05fT0tfQ0FOQ0VMO1xuICAgIFxuICAgIHJldHVybiBzaG93RGlhbG9nKHRpdGxlLCBtc2csIHZhbHVlU3RyLCBidXR0b25zLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydHMuY29uZmlybSA9ICh0aXRsZSwgbXNnLCBvcHRpb25zKSA9PiB7XG4gICAgY29uc3QgYnV0dG9ucyA9IGdldEJ1dHRvbnMob3B0aW9ucykgfHwgQlVUVE9OX09LX0NBTkNFTDtcbiAgICBcbiAgICByZXR1cm4gc2hvd0RpYWxvZyh0aXRsZSwgbXNnLCAnJywgYnV0dG9ucywgb3B0aW9ucyk7XG59O1xuXG5leHBvcnRzLnByb2dyZXNzID0gKHRpdGxlLCBtZXNzYWdlLCBvcHRpb25zKSA9PiB7XG4gICAgY29uc3QgdmFsdWVTdHIgPSBgXG4gICAgICAgIDxwcm9ncmVzcyB2YWx1ZT1cIjBcIiBkYXRhLW5hbWU9XCJqcy1wcm9ncmVzc1wiIGNsYXNzPVwicHJvZ3Jlc3NcIiBtYXg9XCIxMDBcIj48L3Byb2dyZXNzPlxuICAgICAgICA8c3BhbiBkYXRhLW5hbWU9XCJqcy1jb3VudGVyXCI+MCU8L3NwYW4+XG4gICAgYDtcbiAgICBcbiAgICBjb25zdCBidXR0b25zID0ge1xuICAgICAgICBjYW5jZWw6ICdBYm9ydCcsXG4gICAgfTtcbiAgICBcbiAgICBjb25zdCBwcm9taXNlID0gc2hvd0RpYWxvZyh0aXRsZSwgbWVzc2FnZSwgdmFsdWVTdHIsIGJ1dHRvbnMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHtvaywgZGlhbG9nfSA9IHByb21pc2U7XG4gICAgY29uc3QgcmVzb2x2ZSA9IG9rKCk7XG4gICAgXG4gICAgZmluZChkaWFsb2csIFsnY2FuY2VsJ10pLm1hcCgoZWwpID0+IHtcbiAgICAgICAgZWwuZm9jdXMoKTtcbiAgICB9KTtcbiAgICBcbiAgICBPYmplY3QuYXNzaWduKHByb21pc2UsIHtcbiAgICAgICAgc2V0UHJvZ3Jlc3MoY291bnQpIHtcbiAgICAgICAgICAgIGNvbnN0IFtlbFByb2dyZXNzXSA9IGZpbmQoZGlhbG9nLCBbJ3Byb2dyZXNzJ10pO1xuICAgICAgICAgICAgY29uc3QgW2VsQ291bnRlcl0gPSBmaW5kKGRpYWxvZywgWydjb3VudGVyJ10pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBlbFByb2dyZXNzLnZhbHVlID0gY291bnQ7XG4gICAgICAgICAgICBlbENvdW50ZXIudGV4dENvbnRlbnQgPSBgJHtjb3VudH0lYDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGNvdW50ID09PSAxMDApIHtcbiAgICAgICAgICAgICAgICByZW1vdmUoZGlhbG9nKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIFxuICAgICAgICByZW1vdmUoKSB7XG4gICAgICAgICAgICByZW1vdmUoZGlhbG9nKTtcbiAgICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbmZ1bmN0aW9uIGdldEJ1dHRvbnMob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qge2J1dHRvbnN9ID0gb3B0aW9ucztcbiAgICBcbiAgICBpZiAoIWJ1dHRvbnMpXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIFxuICAgIHJldHVybiBidXR0b25zO1xufVxuXG5mdW5jdGlvbiBnZXRUeXBlKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHt0eXBlfSA9IG9wdGlvbnM7XG4gICAgXG4gICAgaWYgKHR5cGUgPT09ICdwYXNzd29yZCcpXG4gICAgICAgIHJldHVybiAncGFzc3dvcmQnO1xuICAgIFxuICAgIHJldHVybiAndGV4dCc7XG59XG5cbmZ1bmN0aW9uIGdldFRlbXBsYXRlKHRpdGxlLCBtc2csIHZhbHVlLCBidXR0b25zKSB7XG4gICAgY29uc3QgZW5jb2RlZE1zZyA9IG1zZy5yZXBsYWNlKC9cXG4vZywgJzxicj4nKTtcbiAgICBcbiAgICByZXR1cm4gYDxkaXYgY2xhc3M9XCJwYWdlXCI+XG4gICAgICAgIDxkaXYgZGF0YS1uYW1lPVwianMtY2xvc2VcIiBjbGFzcz1cImNsb3NlLWJ1dHRvblwiPjwvZGl2PlxuICAgICAgICA8aGVhZGVyPiR7IHRpdGxlIH08L2hlYWRlcj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRlbnQtYXJlYVwiPiR7IGVuY29kZWRNc2cgfSR7IHZhbHVlIH08L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1hcmVhXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnV0dG9uLXN0cmlwXCI+XG4gICAgICAgICAgICAgICAgJHtwYXJzZUJ1dHRvbnMoYnV0dG9ucyl9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gcGFyc2VCdXR0b25zKGJ1dHRvbnMpIHtcbiAgICBjb25zdCBuYW1lcyA9IE9iamVjdC5rZXlzKGJ1dHRvbnMpO1xuICAgIGNvbnN0IHBhcnNlID0gY3VycmlmeSgoYnV0dG9ucywgbmFtZSwgaSkgPT4gYDxidXR0b25cbiAgICAgICAgICAgIHRhYmluZGV4PSR7aX1cbiAgICAgICAgICAgIGRhdGEtbmFtZT1cImpzLSR7bmFtZS50b0xvd2VyQ2FzZSgpfVwiPlxuICAgICAgICAgICAgJHtidXR0b25zW25hbWVdfVxuICAgICAgICA8L2J1dHRvbj5gKTtcbiAgICBcbiAgICByZXR1cm4gbmFtZXNcbiAgICAgICAgLm1hcChwYXJzZShidXR0b25zKSlcbiAgICAgICAgLmpvaW4oJycpO1xufVxuXG5mdW5jdGlvbiBzaG93RGlhbG9nKHRpdGxlLCBtc2csIHZhbHVlLCBidXR0b25zLCBvcHRpb25zKSB7XG4gICAgY29uc3Qgb2sgPSBzdG9yZSgpO1xuICAgIGNvbnN0IGNhbmNlbCA9IHN0b3JlKCk7XG4gICAgXG4gICAgY29uc3QgY2xvc2VCdXR0b25zID0gW1xuICAgICAgICAnY2FuY2VsJyxcbiAgICAgICAgJ2Nsb3NlJyxcbiAgICAgICAgJ29rJyxcbiAgICBdO1xuICAgIFxuICAgIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IG5vQ2FuY2VsID0gb3B0aW9ucyAmJiBvcHRpb25zLmNhbmNlbCA9PT0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGVtcHR5ID0gKCkgPT4ge307XG4gICAgICAgIGNvbnN0IHJlamVjdEVycm9yID0gKCkgPT4gcmVqZWN0KEVycm9yKCkpO1xuICAgICAgICBcbiAgICAgICAgb2socmVzb2x2ZSk7XG4gICAgICAgIGNhbmNlbChub0NhbmNlbCA/IGVtcHR5IDogcmVqZWN0RXJyb3IpO1xuICAgIH0pO1xuICAgIFxuICAgIGNvbnN0IGlubmVySFRNTCA9IGdldFRlbXBsYXRlKHRpdGxlLCBtc2csIHZhbHVlLCBidXR0b25zKTtcbiAgICBcbiAgICBjb25zdCBkaWFsb2cgPSBjcmVhdGVFbGVtZW50KCdkaXYnLCB7XG4gICAgICAgIGlubmVySFRNTCxcbiAgICAgICAgY2xhc3NOYW1lOiAnc21hbGx0YWxrJyxcbiAgICAgICAgc3R5bGU6IGB6LWluZGV4OiAke3pJbmRleCh6SW5kZXgoKSArIDEpfWAsXG4gICAgfSk7XG4gICAgXG4gICAgZm9yIChjb25zdCBlbCBvZiBmaW5kKGRpYWxvZywgWydvaycsICdpbnB1dCddKSlcbiAgICAgICAgZWwuZm9jdXMoKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGVsIG9mIGZpbmQoZGlhbG9nLCBbJ2lucHV0J10pKSB7XG4gICAgICAgIGVsLnNldFNlbGVjdGlvblJhbmdlKDAsIHZhbHVlLmxlbmd0aCk7XG4gICAgfVxuICAgIFxuICAgIGFkZExpc3RlbmVyQWxsKCdjbGljaycsIGRpYWxvZywgY2xvc2VCdXR0b25zLCAoZXZlbnQpID0+IHtcbiAgICAgICAgY2xvc2VEaWFsb2coZXZlbnQudGFyZ2V0LCBkaWFsb2csIG9rKCksIGNhbmNlbCgpKTtcbiAgICB9KTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGV2ZW50IG9mIFsnY2xpY2snLCAnY29udGV4dG1lbnUnXSlcbiAgICAgICAgZGlhbG9nLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIChlKSA9PiB7XG4gICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBlbCBvZiBmaW5kKGRpYWxvZywgWydvaycsICdpbnB1dCddKSlcbiAgICAgICAgICAgICAgICBlbC5mb2N1cygpO1xuICAgICAgICB9KTtcbiAgICBcbiAgICBkaWFsb2cuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGtleURvd24oZGlhbG9nLCBvaygpLCBjYW5jZWwoKSkpO1xuICAgIFxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb21pc2UsIHtcbiAgICAgICAgZGlhbG9nLFxuICAgICAgICBvayxcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24ga2V5RG93bl8oZGlhbG9nLCBvaywgY2FuY2VsLCBldmVudCkge1xuICAgIGNvbnN0IEtFWSA9IHtcbiAgICAgICAgRU5URVIgOiAxMyxcbiAgICAgICAgRVNDICAgOiAyNyxcbiAgICAgICAgVEFCICAgOiA5LFxuICAgICAgICBMRUZUICA6IDM3LFxuICAgICAgICBVUCAgICA6IDM4LFxuICAgICAgICBSSUdIVCA6IDM5LFxuICAgICAgICBET1dOICA6IDQwLFxuICAgIH07XG4gICAgXG4gICAgY29uc3Qge2tleUNvZGV9ID0gZXZlbnQ7XG4gICAgY29uc3QgZWwgPSBldmVudC50YXJnZXQ7XG4gICAgXG4gICAgY29uc3QgbmFtZXNBbGwgPSBbJ29rJywgJ2NhbmNlbCcsICdpbnB1dCddO1xuICAgIGNvbnN0IG5hbWVzID0gZmluZChkaWFsb2csIG5hbWVzQWxsKVxuICAgICAgICAubWFwKGdldERhdGFOYW1lKTtcbiAgICBcbiAgICBzd2l0Y2goa2V5Q29kZSkge1xuICAgIGNhc2UgS0VZLkVOVEVSOlxuICAgICAgICBjbG9zZURpYWxvZyhlbCwgZGlhbG9nLCBvaywgY2FuY2VsKTtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgXG4gICAgY2FzZSBLRVkuRVNDOlxuICAgICAgICByZW1vdmUoZGlhbG9nKTtcbiAgICAgICAgY2FuY2VsKCk7XG4gICAgICAgIGJyZWFrO1xuICAgIFxuICAgIGNhc2UgS0VZLlRBQjpcbiAgICAgICAgaWYgKGV2ZW50LnNoaWZ0S2V5KVxuICAgICAgICAgICAgdGFiKGRpYWxvZywgbmFtZXMpO1xuICAgICAgICBcbiAgICAgICAgdGFiKGRpYWxvZywgbmFtZXMpO1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBicmVhaztcbiAgICBcbiAgICBkZWZhdWx0OlxuICAgICAgICBbJ2xlZnQnLCAncmlnaHQnLCAndXAnLCAnZG93biddLmZpbHRlcigobmFtZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGtleUNvZGUgPT09IEtFWVtuYW1lLnRvVXBwZXJDYXNlKCldO1xuICAgICAgICB9KS5mb3JFYWNoKCgpID0+IHtcbiAgICAgICAgICAgIGNoYW5nZUJ1dHRvbkZvY3VzKGRpYWxvZywgbmFtZXMpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbn1cblxuZnVuY3Rpb24gZ2V0RGF0YU5hbWUoZWwpIHtcbiAgICByZXR1cm4gZWxcbiAgICAgICAgLmdldEF0dHJpYnV0ZSgnZGF0YS1uYW1lJylcbiAgICAgICAgLnJlcGxhY2UoJ2pzLScsICcnKTtcbn1cblxuY29uc3QgZ2V0TmFtZSA9IChhY3RpdmVOYW1lKSA9PiB7XG4gICAgaWYgKGFjdGl2ZU5hbWUgPT09ICdjYW5jZWwnKVxuICAgICAgICByZXR1cm4gJ29rJztcbiAgICBcbiAgICByZXR1cm4gJ2NhbmNlbCc7XG59O1xuXG5mdW5jdGlvbiBjaGFuZ2VCdXR0b25Gb2N1cyhkaWFsb2csIG5hbWVzKSB7XG4gICAgY29uc3QgYWN0aXZlID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgICBjb25zdCBhY3RpdmVOYW1lID0gZ2V0RGF0YU5hbWUoYWN0aXZlKTtcbiAgICBjb25zdCBpc0J1dHRvbiA9IC9va3xjYW5jZWwvLnRlc3QoYWN0aXZlTmFtZSk7XG4gICAgY29uc3QgY291bnQgPSBuYW1lcy5sZW5ndGggLSAxO1xuICAgIFxuICAgIGlmIChhY3RpdmVOYW1lID09PSAnaW5wdXQnIHx8ICFjb3VudCB8fCAhaXNCdXR0b24pXG4gICAgICAgIHJldHVybjtcbiAgICBcbiAgICBjb25zdCBuYW1lID0gZ2V0TmFtZShhY3RpdmVOYW1lKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGVsIG9mIGZpbmQoZGlhbG9nLCBbbmFtZV0pKSB7XG4gICAgICAgIGVsLmZvY3VzKCk7XG4gICAgfVxufVxuXG5jb25zdCBnZXRJbmRleCA9IChjb3VudCwgaW5kZXgpID0+IHtcbiAgICBpZiAoaW5kZXggPT09IGNvdW50KVxuICAgICAgICByZXR1cm4gMDtcbiAgICBcbiAgICByZXR1cm4gaW5kZXggKyAxO1xufTtcblxuZnVuY3Rpb24gdGFiKGRpYWxvZywgbmFtZXMpIHtcbiAgICBjb25zdCBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICAgIGNvbnN0IGFjdGl2ZU5hbWUgPSBnZXREYXRhTmFtZShhY3RpdmUpO1xuICAgIGNvbnN0IGNvdW50ID0gbmFtZXMubGVuZ3RoIC0gMTtcbiAgICBcbiAgICBjb25zdCBhY3RpdmVJbmRleCA9IG5hbWVzLmluZGV4T2YoYWN0aXZlTmFtZSk7XG4gICAgY29uc3QgaW5kZXggPSBnZXRJbmRleChjb3VudCwgYWN0aXZlSW5kZXgpO1xuICAgIFxuICAgIGNvbnN0IG5hbWUgPSBuYW1lc1tpbmRleF07XG4gICAgXG4gICAgZm9yIChjb25zdCBlbCBvZiBmaW5kKGRpYWxvZywgW25hbWVdKSlcbiAgICAgICAgZWwuZm9jdXMoKTtcbn1cblxuZnVuY3Rpb24gY2xvc2VEaWFsb2coZWwsIGRpYWxvZywgb2ssIGNhbmNlbCkge1xuICAgIGNvbnN0IG5hbWUgPSBlbFxuICAgICAgICAuZ2V0QXR0cmlidXRlKCdkYXRhLW5hbWUnKVxuICAgICAgICAucmVwbGFjZSgnanMtJywgJycpO1xuICAgIFxuICAgIGlmICgvY2xvc2V8Y2FuY2VsLy50ZXN0KG5hbWUpKSB7XG4gICAgICAgIGNhbmNlbCgpO1xuICAgICAgICByZW1vdmUoZGlhbG9nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB2YWx1ZSA9IGZpbmQoZGlhbG9nLCBbJ2lucHV0J10pXG4gICAgICAgIC5yZWR1Y2UoKHZhbHVlLCBlbCkgPT4gZWwudmFsdWUsIG51bGwpO1xuICAgIFxuICAgIG9rKHZhbHVlKTtcbiAgICByZW1vdmUoZGlhbG9nKTtcbn1cblxuY29uc3QgcXVlcnkgPSBjdXJyaWZ5KChlbGVtZW50LCBuYW1lKSA9PiBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYFtkYXRhLW5hbWU9XCJqcy0keyBuYW1lIH1cIl1gKSk7XG5cbmZ1bmN0aW9uIGZpbmQoZWxlbWVudCwgbmFtZXMpIHtcbiAgICBjb25zdCBlbGVtZW50cyA9IG5hbWVzXG4gICAgICAgIC5tYXAocXVlcnkoZWxlbWVudCkpXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG4gICAgXG4gICAgcmV0dXJuIGVsZW1lbnRzO1xufVxuXG5mdW5jdGlvbiBhZGRMaXN0ZW5lckFsbChldmVudCwgcGFyZW50LCBlbGVtZW50cywgZm4pIHtcbiAgICBmb3IgKGNvbnN0IGVsIG9mIGZpbmQocGFyZW50LCBlbGVtZW50cykpIHtcbiAgICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZm4pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlKGRpYWxvZykge1xuICAgIGNvbnN0IHtwYXJlbnRFbGVtZW50fSA9IGRpYWxvZztcbiAgICBcbiAgICBpZiAocGFyZW50RWxlbWVudClcbiAgICAgICAgcGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChkaWFsb2cpO1xufVxuXG4iLCJpbXBvcnQgeyBwcm9ncmVzcyB9IGZyb20gXCJzbWFsbHRhbGtcIjtcblxuZXhwb3J0IGNsYXNzIFByb2dyZXNzIHtcblxuICAgIGNvbnN0cnVjdG9yKHRpdGxlLCBtZXNzYWdlKSB7XG4gICAgICAgIHRoaXMucHJvZ3Jlc3MgPSBwcm9ncmVzcyh0aXRsZSwgbWVzc2FnZSk7XG4gICAgICAgIHRoaXMucHJvZ3Jlc3MuY2F0Y2goZSA9PiB7XG4gICAgICAgICAgICB0aGlzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKGUgJiYgKGUuY29uc3RydWN0b3IgIT09IEVycm9yIHx8IGUubWVzc2FnZSAhPT0gXCJcIikpIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmRpYWxvZyA9IHRoaXMucHJvZ3Jlc3MuZGlhbG9nO1xuICAgICAgICB0aGlzLmFib3J0ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBhc3luYyBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmFib3J0ZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgbGV0IHByb2Nlc3NlZCA9IDAsIHJhbmdlID0gY29sbGVjdGlvbi5sZW5ndGgsIGFjY3VtID0gMCwgcGN0ID0gMDtcbiAgICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgZnVuYyhpdGVtLCBwcm9jZXNzZWQrKywgY29sbGVjdGlvbiwgdGhpcyk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYWJvcnRlZClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGFjY3VtICs9IDEwMDtcbiAgICAgICAgICAgICAgICBpZiAoYWNjdW0gPiByYW5nZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1haW5kZXIgPSBhY2N1bSAlIHJhbmdlLCBzdGVwID0gKGFjY3VtIC0gcmVtYWluZGVyKSAvIHJhbmdlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2dyZXNzLnNldFByb2dyZXNzKHBjdCArPSBzdGVwKTtcbiAgICAgICAgICAgICAgICAgICAgYWNjdW0gPSByZW1haW5kZXI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBjdCA8IDEwMClcbiAgICAgICAgICAgICAgICB0aGlzLnByb2dyZXNzLnNldFByb2dyZXNzKDEwMCk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMucHJvZ3Jlc3MucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXQgdGl0bGUodGV4dCkgeyB0aGlzLmRpYWxvZy5xdWVyeVNlbGVjdG9yKFwiaGVhZGVyXCIpLnRleHRDb250ZW50ID0gdGV4dDsgfVxuICAgIGdldCB0aXRsZSgpIHsgcmV0dXJuIHRoaXMuZGlhbG9nLnF1ZXJ5U2VsZWN0b3IoXCJoZWFkZXJcIikudGV4dENvbnRlbnQ7IH1cblxuICAgIHNldCBtZXNzYWdlKHRleHQpIHtcbiAgICAgICAgY29uc3QgYXJlYSA9IHRoaXMuZGlhbG9nLnF1ZXJ5U2VsZWN0b3IoXCIuY29udGVudC1hcmVhXCIpLmNoaWxkTm9kZXNbMF0udGV4dENvbnRlbnQgPSB0ZXh0O1xuICAgIH1cblxuICAgIGdldCBtZXNzYWdlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kaWFsb2cucXVlcnlTZWxlY3RvcihcIi5jb250ZW50LWFyZWFcIikuY2hpbGROb2Rlc1swXS50ZXh0Q29udGVudDtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBOb3RpY2UgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IHByb21wdCB9IGZyb20gXCJzbWFsbHRhbGtcIjtcblxuaW1wb3J0IFwiLi92YWxpZGF0aW9uLnNjc3NcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZhbGlkYXRlZElucHV0KHRpdGxlLCBtZXNzYWdlLCB2YWx1ZSA9IFwiXCIsIHJlZ2V4ID0gXCIuKlwiLCB3aGF0ID0gXCJlbnRyeVwiKSB7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29uc3QgaW5wdXQgPSBwcm9tcHQodGl0bGUsIG1lc3NhZ2UsIHZhbHVlKTtcbiAgICAgICAgY29uc3QgaW5wdXRGaWVsZCA9IGlucHV0LmRpYWxvZy5maW5kKFwiaW5wdXRcIik7XG4gICAgICAgIGNvbnN0IGlzVmFsaWQgPSAodCkgPT4gbmV3IFJlZ0V4cChgXiR7cmVnZXh9JGApLnRlc3QodCk7XG5cbiAgICAgICAgaW5wdXRGaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSh2YWx1ZS5sZW5ndGgsIHZhbHVlLmxlbmd0aCk7XG4gICAgICAgIGlucHV0RmllbGQucGF0dGVybiA9IHJlZ2V4O1xuICAgICAgICBpbnB1dEZpZWxkLm9uaW5wdXQgPSAoKSA9PiBpbnB1dEZpZWxkLnNldEF0dHJpYnV0ZShcImFyaWEtaW52YWxpZFwiLCAhaXNWYWxpZChpbnB1dEZpZWxkLnZhbHVlKSk7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaW5wdXQ7XG4gICAgICAgIGlmIChpc1ZhbGlkKHJlc3VsdCkpIHJldHVybiByZXN1bHQ7XG5cbiAgICAgICAgbmV3IE5vdGljZShgXCIke3Jlc3VsdH1cIiBpcyBub3QgYSB2YWxpZCAke3doYXR9YCk7XG4gICAgfVxufVxuIiwiZXhwb3J0IGNsYXNzIFRhZyB7XG4gICAgY29uc3RydWN0b3IobmFtZSkge1xuICAgICAgICB3aGlsZSAobmFtZS5zdGFydHNXaXRoKFwiI1wiKSkgbmFtZSA9IG5hbWUuc2xpY2UoMSk7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIGNvbnN0XG4gICAgICAgICAgICBoYXNoZWQgPSB0aGlzLnRhZyA9IFwiI1wiICsgbmFtZSxcbiAgICAgICAgICAgIGNhbm9uaWNhbCA9IHRoaXMuY2Fub25pY2FsID0gaGFzaGVkLnRvTG93ZXJDYXNlKCksXG4gICAgICAgICAgICBjYW5vbmljYWxfcHJlZml4ID0gdGhpcy5jYW5vbmljYWxfcHJlZml4ID0gY2Fub25pY2FsICsgXCIvXCI7XG4gICAgICAgIHRoaXMubWF0Y2hlcyA9IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgICAgICB0ZXh0ID0gdGV4dC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgcmV0dXJuIHRleHQgPT0gY2Fub25pY2FsIHx8IHRleHQuc3RhcnRzV2l0aChjYW5vbmljYWxfcHJlZml4KTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgdG9TdHJpbmcoKSB7IHJldHVybiB0aGlzLnRhZzsgfVxufVxuXG5leHBvcnQgY2xhc3MgUmVwbGFjZW1lbnQge1xuXG4gICAgY29uc3RydWN0b3IoZnJvbVRhZywgdG9UYWcpIHtcbiAgICAgICAgY29uc3QgY2FjaGUgPSAgT2JqZWN0LmFzc2lnbihcbiAgICAgICAgICAgIE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgICAgICAgICAgICAgICBbZnJvbVRhZy50YWddOiAgdG9UYWcudGFnLFxuICAgICAgICAgICAgICAgIFtmcm9tVGFnLm5hbWVdOiB0b1RhZy5uYW1lLFxuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuaW5TdHJpbmcgPSBmdW5jdGlvbih0ZXh0LCBwb3MgPSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGV4dC5zbGljZSgwLCBwb3MpICsgdG9UYWcudGFnICsgdGV4dC5zbGljZShwb3MgKyBmcm9tVGFnLnRhZy5sZW5ndGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pbkFycmF5ID0gKHRhZ3MsIHNraXBPZGQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0YWdzLm1hcCgodCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChza2lwT2RkICYmIChpICYgMSkpIHJldHVybiB0OyAgIC8vIGxlYXZlIG9kZCBlbnRyaWVzIChzZXBhcmF0b3JzKSBhbG9uZVxuICAgICAgICAgICAgICAgIGlmIChjYWNoZVt0XSkgcmV0dXJuIGNhY2hlW3RdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxjID0gdC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIGlmIChjYWNoZVtsY10pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhY2hlW3RdID0gY2FjaGVbbGNdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGMuc3RhcnRzV2l0aChmcm9tVGFnLmNhbm9uaWNhbF9wcmVmaXgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWNoZVt0XSA9IGNhY2hlW2xjXSA9IHRoaXMuaW5TdHJpbmcodCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICgoXCIjXCIgKyBsYykuc3RhcnRzV2l0aChmcm9tVGFnLmNhbm9uaWNhbF9wcmVmaXgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWNoZVt0XSA9IGNhY2hlW2xjXSA9IHRoaXMuaW5TdHJpbmcoXCIjXCIgKyB0KS5zbGljZSgxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhY2hlW3RdID0gY2FjaGVbbGNdID0gdDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMud2lsbE1lcmdlVGFncyA9IGZ1bmN0aW9uICh0YWdOYW1lcykge1xuICAgICAgICAgICAgLy8gUmVuYW1pbmcgdG8gY2hhbmdlIGNhc2UgZG9lc24ndCBsb3NlIGluZm8sIHNvIGlnbm9yZSBpdFxuICAgICAgICAgICAgaWYgKGZyb21UYWcuY2Fub25pY2FsID09PSB0b1RhZy5jYW5vbmljYWwpIHJldHVybjtcblxuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBuZXcgU2V0KHRhZ05hbWVzLm1hcChzID0+IHMudG9Mb3dlckNhc2UoKSkpO1xuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRhZ05hbWUgb2YgdGFnTmFtZXMuZmlsdGVyKGZyb21UYWcubWF0Y2hlcykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGFuZ2VkID0gdGhpcy5pblN0cmluZyh0YWdOYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoZXhpc3RpbmcuaGFzKGNoYW5nZWQudG9Mb3dlckNhc2UoKSkpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbbmV3IFRhZyh0YWdOYW1lKSwgbmV3IFRhZyhjaGFuZ2VkKV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4iLCJjb25zdCBDaGFyID0ge1xuICBBTkNIT1I6ICcmJyxcbiAgQ09NTUVOVDogJyMnLFxuICBUQUc6ICchJyxcbiAgRElSRUNUSVZFU19FTkQ6ICctJyxcbiAgRE9DVU1FTlRfRU5EOiAnLidcbn07XG5jb25zdCBMb2dMZXZlbCA9IE9iamVjdC5hc3NpZ24oWydzaWxlbnQnLCAnZXJyb3InLCAnd2FybicsICdkZWJ1ZyddLCB7XG4gIFNJTEVOVDogMCxcbiAgRVJST1I6IDEsXG4gIFdBUk46IDIsXG4gIERFQlVHOiAzXG59KTtcbmNvbnN0IFR5cGUgPSB7XG4gIEFMSUFTOiAnQUxJQVMnLFxuICBCTEFOS19MSU5FOiAnQkxBTktfTElORScsXG4gIEJMT0NLX0ZPTERFRDogJ0JMT0NLX0ZPTERFRCcsXG4gIEJMT0NLX0xJVEVSQUw6ICdCTE9DS19MSVRFUkFMJyxcbiAgQ09NTUVOVDogJ0NPTU1FTlQnLFxuICBESVJFQ1RJVkU6ICdESVJFQ1RJVkUnLFxuICBET0NVTUVOVDogJ0RPQ1VNRU5UJyxcbiAgRkxPV19NQVA6ICdGTE9XX01BUCcsXG4gIEZMT1dfU0VROiAnRkxPV19TRVEnLFxuICBNQVA6ICdNQVAnLFxuICBNQVBfS0VZOiAnTUFQX0tFWScsXG4gIE1BUF9WQUxVRTogJ01BUF9WQUxVRScsXG4gIFBMQUlOOiAnUExBSU4nLFxuICBRVU9URV9ET1VCTEU6ICdRVU9URV9ET1VCTEUnLFxuICBRVU9URV9TSU5HTEU6ICdRVU9URV9TSU5HTEUnLFxuICBTRVE6ICdTRVEnLFxuICBTRVFfSVRFTTogJ1NFUV9JVEVNJ1xufTtcbmNvbnN0IGRlZmF1bHRUYWdQcmVmaXggPSAndGFnOnlhbWwub3JnLDIwMDI6JztcbmNvbnN0IGRlZmF1bHRUYWdzID0ge1xuICBNQVA6ICd0YWc6eWFtbC5vcmcsMjAwMjptYXAnLFxuICBTRVE6ICd0YWc6eWFtbC5vcmcsMjAwMjpzZXEnLFxuICBTVFI6ICd0YWc6eWFtbC5vcmcsMjAwMjpzdHInXG59O1xuXG5leHBvcnQgeyBDaGFyLCBMb2dMZXZlbCwgVHlwZSwgZGVmYXVsdFRhZ1ByZWZpeCwgZGVmYXVsdFRhZ3MgfTtcbiIsImZ1bmN0aW9uIGZpbmRMaW5lU3RhcnRzKHNyYykge1xuICBjb25zdCBscyA9IFswXTtcbiAgbGV0IG9mZnNldCA9IHNyYy5pbmRleE9mKCdcXG4nKTtcblxuICB3aGlsZSAob2Zmc2V0ICE9PSAtMSkge1xuICAgIG9mZnNldCArPSAxO1xuICAgIGxzLnB1c2gob2Zmc2V0KTtcbiAgICBvZmZzZXQgPSBzcmMuaW5kZXhPZignXFxuJywgb2Zmc2V0KTtcbiAgfVxuXG4gIHJldHVybiBscztcbn1cblxuZnVuY3Rpb24gZ2V0U3JjSW5mbyhjc3QpIHtcbiAgbGV0IGxpbmVTdGFydHMsIHNyYztcblxuICBpZiAodHlwZW9mIGNzdCA9PT0gJ3N0cmluZycpIHtcbiAgICBsaW5lU3RhcnRzID0gZmluZExpbmVTdGFydHMoY3N0KTtcbiAgICBzcmMgPSBjc3Q7XG4gIH0gZWxzZSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoY3N0KSkgY3N0ID0gY3N0WzBdO1xuXG4gICAgaWYgKGNzdCAmJiBjc3QuY29udGV4dCkge1xuICAgICAgaWYgKCFjc3QubGluZVN0YXJ0cykgY3N0LmxpbmVTdGFydHMgPSBmaW5kTGluZVN0YXJ0cyhjc3QuY29udGV4dC5zcmMpO1xuICAgICAgbGluZVN0YXJ0cyA9IGNzdC5saW5lU3RhcnRzO1xuICAgICAgc3JjID0gY3N0LmNvbnRleHQuc3JjO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbGluZVN0YXJ0cyxcbiAgICBzcmNcbiAgfTtcbn1cbi8qKlxuICogQHR5cGVkZWYge09iamVjdH0gTGluZVBvcyAtIE9uZS1pbmRleGVkIHBvc2l0aW9uIGluIHRoZSBzb3VyY2VcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBsaW5lXG4gKiBAcHJvcGVydHkge251bWJlcn0gY29sXG4gKi9cblxuLyoqXG4gKiBEZXRlcm1pbmUgdGhlIGxpbmUvY29sIHBvc2l0aW9uIG1hdGNoaW5nIGEgY2hhcmFjdGVyIG9mZnNldC5cbiAqXG4gKiBBY2NlcHRzIGEgc291cmNlIHN0cmluZyBvciBhIENTVCBkb2N1bWVudCBhcyB0aGUgc2Vjb25kIHBhcmFtZXRlci4gV2l0aFxuICogdGhlIGxhdHRlciwgc3RhcnRpbmcgaW5kaWNlcyBmb3IgbGluZXMgYXJlIGNhY2hlZCBpbiB0aGUgZG9jdW1lbnQgYXNcbiAqIGBsaW5lU3RhcnRzOiBudW1iZXJbXWAuXG4gKlxuICogUmV0dXJucyBhIG9uZS1pbmRleGVkIGB7IGxpbmUsIGNvbCB9YCBsb2NhdGlvbiBpZiBmb3VuZCwgb3JcbiAqIGB1bmRlZmluZWRgIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge251bWJlcn0gb2Zmc2V0XG4gKiBAcGFyYW0ge3N0cmluZ3xEb2N1bWVudHxEb2N1bWVudFtdfSBjc3RcbiAqIEByZXR1cm5zIHs/TGluZVBvc31cbiAqL1xuXG5cbmZ1bmN0aW9uIGdldExpbmVQb3Mob2Zmc2V0LCBjc3QpIHtcbiAgaWYgKHR5cGVvZiBvZmZzZXQgIT09ICdudW1iZXInIHx8IG9mZnNldCA8IDApIHJldHVybiBudWxsO1xuICBjb25zdCB7XG4gICAgbGluZVN0YXJ0cyxcbiAgICBzcmNcbiAgfSA9IGdldFNyY0luZm8oY3N0KTtcbiAgaWYgKCFsaW5lU3RhcnRzIHx8ICFzcmMgfHwgb2Zmc2V0ID4gc3JjLmxlbmd0aCkgcmV0dXJuIG51bGw7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lU3RhcnRzLmxlbmd0aDsgKytpKSB7XG4gICAgY29uc3Qgc3RhcnQgPSBsaW5lU3RhcnRzW2ldO1xuXG4gICAgaWYgKG9mZnNldCA8IHN0YXJ0KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBsaW5lOiBpLFxuICAgICAgICBjb2w6IG9mZnNldCAtIGxpbmVTdGFydHNbaSAtIDFdICsgMVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAob2Zmc2V0ID09PSBzdGFydCkgcmV0dXJuIHtcbiAgICAgIGxpbmU6IGkgKyAxLFxuICAgICAgY29sOiAxXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGxpbmUgPSBsaW5lU3RhcnRzLmxlbmd0aDtcbiAgcmV0dXJuIHtcbiAgICBsaW5lLFxuICAgIGNvbDogb2Zmc2V0IC0gbGluZVN0YXJ0c1tsaW5lIC0gMV0gKyAxXG4gIH07XG59XG4vKipcbiAqIEdldCBhIHNwZWNpZmllZCBsaW5lIGZyb20gdGhlIHNvdXJjZS5cbiAqXG4gKiBBY2NlcHRzIGEgc291cmNlIHN0cmluZyBvciBhIENTVCBkb2N1bWVudCBhcyB0aGUgc2Vjb25kIHBhcmFtZXRlci4gV2l0aFxuICogdGhlIGxhdHRlciwgc3RhcnRpbmcgaW5kaWNlcyBmb3IgbGluZXMgYXJlIGNhY2hlZCBpbiB0aGUgZG9jdW1lbnQgYXNcbiAqIGBsaW5lU3RhcnRzOiBudW1iZXJbXWAuXG4gKlxuICogUmV0dXJucyB0aGUgbGluZSBhcyBhIHN0cmluZyBpZiBmb3VuZCwgb3IgYG51bGxgIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge251bWJlcn0gbGluZSBPbmUtaW5kZXhlZCBsaW5lIG51bWJlclxuICogQHBhcmFtIHtzdHJpbmd8RG9jdW1lbnR8RG9jdW1lbnRbXX0gY3N0XG4gKiBAcmV0dXJucyB7P3N0cmluZ31cbiAqL1xuXG5mdW5jdGlvbiBnZXRMaW5lKGxpbmUsIGNzdCkge1xuICBjb25zdCB7XG4gICAgbGluZVN0YXJ0cyxcbiAgICBzcmNcbiAgfSA9IGdldFNyY0luZm8oY3N0KTtcbiAgaWYgKCFsaW5lU3RhcnRzIHx8ICEobGluZSA+PSAxKSB8fCBsaW5lID4gbGluZVN0YXJ0cy5sZW5ndGgpIHJldHVybiBudWxsO1xuICBjb25zdCBzdGFydCA9IGxpbmVTdGFydHNbbGluZSAtIDFdO1xuICBsZXQgZW5kID0gbGluZVN0YXJ0c1tsaW5lXTsgLy8gdW5kZWZpbmVkIGZvciBsYXN0IGxpbmU7IHRoYXQncyBvayBmb3Igc2xpY2UoKVxuXG4gIHdoaWxlIChlbmQgJiYgZW5kID4gc3RhcnQgJiYgc3JjW2VuZCAtIDFdID09PSAnXFxuJykgLS1lbmQ7XG5cbiAgcmV0dXJuIHNyYy5zbGljZShzdGFydCwgZW5kKTtcbn1cbi8qKlxuICogUHJldHR5LXByaW50IHRoZSBzdGFydGluZyBsaW5lIGZyb20gdGhlIHNvdXJjZSBpbmRpY2F0ZWQgYnkgdGhlIHJhbmdlIGBwb3NgXG4gKlxuICogVHJpbXMgb3V0cHV0IHRvIGBtYXhXaWR0aGAgY2hhcnMgd2hpbGUga2VlcGluZyB0aGUgc3RhcnRpbmcgY29sdW1uIHZpc2libGUsXG4gKiB1c2luZyBg4oCmYCBhdCBlaXRoZXIgZW5kIHRvIGluZGljYXRlIGRyb3BwZWQgY2hhcmFjdGVycy5cbiAqXG4gKiBSZXR1cm5zIGEgdHdvLWxpbmUgc3RyaW5nIChvciBgbnVsbGApIHdpdGggYFxcbmAgYXMgc2VwYXJhdG9yOyB0aGUgc2Vjb25kIGxpbmVcbiAqIHdpbGwgaG9sZCBhcHByb3ByaWF0ZWx5IGluZGVudGVkIGBeYCBtYXJrcyBpbmRpY2F0aW5nIHRoZSBjb2x1bW4gcmFuZ2UuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHBvc1xuICogQHBhcmFtIHtMaW5lUG9zfSBwb3Muc3RhcnRcbiAqIEBwYXJhbSB7TGluZVBvc30gW3Bvcy5lbmRdXG4gKiBAcGFyYW0ge3N0cmluZ3xEb2N1bWVudHxEb2N1bWVudFtdKn0gY3N0XG4gKiBAcGFyYW0ge251bWJlcn0gW21heFdpZHRoPTgwXVxuICogQHJldHVybnMgez9zdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gZ2V0UHJldHR5Q29udGV4dCh7XG4gIHN0YXJ0LFxuICBlbmRcbn0sIGNzdCwgbWF4V2lkdGggPSA4MCkge1xuICBsZXQgc3JjID0gZ2V0TGluZShzdGFydC5saW5lLCBjc3QpO1xuICBpZiAoIXNyYykgcmV0dXJuIG51bGw7XG4gIGxldCB7XG4gICAgY29sXG4gIH0gPSBzdGFydDtcblxuICBpZiAoc3JjLmxlbmd0aCA+IG1heFdpZHRoKSB7XG4gICAgaWYgKGNvbCA8PSBtYXhXaWR0aCAtIDEwKSB7XG4gICAgICBzcmMgPSBzcmMuc3Vic3RyKDAsIG1heFdpZHRoIC0gMSkgKyAn4oCmJztcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaGFsZldpZHRoID0gTWF0aC5yb3VuZChtYXhXaWR0aCAvIDIpO1xuICAgICAgaWYgKHNyYy5sZW5ndGggPiBjb2wgKyBoYWxmV2lkdGgpIHNyYyA9IHNyYy5zdWJzdHIoMCwgY29sICsgaGFsZldpZHRoIC0gMSkgKyAn4oCmJztcbiAgICAgIGNvbCAtPSBzcmMubGVuZ3RoIC0gbWF4V2lkdGg7XG4gICAgICBzcmMgPSAn4oCmJyArIHNyYy5zdWJzdHIoMSAtIG1heFdpZHRoKTtcbiAgICB9XG4gIH1cblxuICBsZXQgZXJyTGVuID0gMTtcbiAgbGV0IGVyckVuZCA9ICcnO1xuXG4gIGlmIChlbmQpIHtcbiAgICBpZiAoZW5kLmxpbmUgPT09IHN0YXJ0LmxpbmUgJiYgY29sICsgKGVuZC5jb2wgLSBzdGFydC5jb2wpIDw9IG1heFdpZHRoICsgMSkge1xuICAgICAgZXJyTGVuID0gZW5kLmNvbCAtIHN0YXJ0LmNvbDtcbiAgICB9IGVsc2Uge1xuICAgICAgZXJyTGVuID0gTWF0aC5taW4oc3JjLmxlbmd0aCArIDEsIG1heFdpZHRoKSAtIGNvbDtcbiAgICAgIGVyckVuZCA9ICfigKYnO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IG9mZnNldCA9IGNvbCA+IDEgPyAnICcucmVwZWF0KGNvbCAtIDEpIDogJyc7XG4gIGNvbnN0IGVyciA9ICdeJy5yZXBlYXQoZXJyTGVuKTtcbiAgcmV0dXJuIFwiXCIuY29uY2F0KHNyYywgXCJcXG5cIikuY29uY2F0KG9mZnNldCkuY29uY2F0KGVycikuY29uY2F0KGVyckVuZCk7XG59XG5cbmV4cG9ydCB7IGdldExpbmUsIGdldExpbmVQb3MsIGdldFByZXR0eUNvbnRleHQgfTtcbiIsImNsYXNzIFJhbmdlIHtcbiAgc3RhdGljIGNvcHkob3JpZykge1xuICAgIHJldHVybiBuZXcgUmFuZ2Uob3JpZy5zdGFydCwgb3JpZy5lbmQpO1xuICB9XG5cbiAgY29uc3RydWN0b3Ioc3RhcnQsIGVuZCkge1xuICAgIHRoaXMuc3RhcnQgPSBzdGFydDtcbiAgICB0aGlzLmVuZCA9IGVuZCB8fCBzdGFydDtcbiAgfVxuXG4gIGlzRW1wdHkoKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB0aGlzLnN0YXJ0ICE9PSAnbnVtYmVyJyB8fCAhdGhpcy5lbmQgfHwgdGhpcy5lbmQgPD0gdGhpcy5zdGFydDtcbiAgfVxuICAvKipcbiAgICogU2V0IGBvcmlnU3RhcnRgIGFuZCBgb3JpZ0VuZGAgdG8gcG9pbnQgdG8gdGhlIG9yaWdpbmFsIHNvdXJjZSByYW5nZSBmb3JcbiAgICogdGhpcyBub2RlLCB3aGljaCBtYXkgZGlmZmVyIGR1ZSB0byBkcm9wcGVkIENSIGNoYXJhY3RlcnMuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyW119IGNyIC0gUG9zaXRpb25zIG9mIGRyb3BwZWQgQ1IgY2hhcmFjdGVyc1xuICAgKiBAcGFyYW0ge251bWJlcn0gb2Zmc2V0IC0gU3RhcnRpbmcgaW5kZXggb2YgYGNyYCBmcm9tIHRoZSBsYXN0IGNhbGxcbiAgICogQHJldHVybnMge251bWJlcn0gLSBUaGUgbmV4dCBvZmZzZXQsIG1hdGNoaW5nIHRoZSBvbmUgZm91bmQgZm9yIGBvcmlnU3RhcnRgXG4gICAqL1xuXG5cbiAgc2V0T3JpZ1JhbmdlKGNyLCBvZmZzZXQpIHtcbiAgICBjb25zdCB7XG4gICAgICBzdGFydCxcbiAgICAgIGVuZFxuICAgIH0gPSB0aGlzO1xuXG4gICAgaWYgKGNyLmxlbmd0aCA9PT0gMCB8fCBlbmQgPD0gY3JbMF0pIHtcbiAgICAgIHRoaXMub3JpZ1N0YXJ0ID0gc3RhcnQ7XG4gICAgICB0aGlzLm9yaWdFbmQgPSBlbmQ7XG4gICAgICByZXR1cm4gb2Zmc2V0O1xuICAgIH1cblxuICAgIGxldCBpID0gb2Zmc2V0O1xuXG4gICAgd2hpbGUgKGkgPCBjci5sZW5ndGgpIHtcbiAgICAgIGlmIChjcltpXSA+IHN0YXJ0KSBicmVhaztlbHNlICsraTtcbiAgICB9XG5cbiAgICB0aGlzLm9yaWdTdGFydCA9IHN0YXJ0ICsgaTtcbiAgICBjb25zdCBuZXh0T2Zmc2V0ID0gaTtcblxuICAgIHdoaWxlIChpIDwgY3IubGVuZ3RoKSB7XG4gICAgICAvLyBpZiBlbmQgd2FzIGF0IFxcbiwgaXQgc2hvdWxkIG5vdyBiZSBhdCBcXHJcbiAgICAgIGlmIChjcltpXSA+PSBlbmQpIGJyZWFrO2Vsc2UgKytpO1xuICAgIH1cblxuICAgIHRoaXMub3JpZ0VuZCA9IGVuZCArIGk7XG4gICAgcmV0dXJuIG5leHRPZmZzZXQ7XG4gIH1cblxufVxuXG5leHBvcnQgeyBSYW5nZSB9O1xuIiwiaW1wb3J0IHsgQ2hhciwgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBnZXRMaW5lUG9zIH0gZnJvbSAnLi9zb3VyY2UtdXRpbHMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL1JhbmdlLmpzJztcblxuLyoqIFJvb3QgY2xhc3Mgb2YgYWxsIG5vZGVzICovXG5cbmNsYXNzIE5vZGUge1xuICBzdGF0aWMgYWRkU3RyaW5nVGVybWluYXRvcihzcmMsIG9mZnNldCwgc3RyKSB7XG4gICAgaWYgKHN0cltzdHIubGVuZ3RoIC0gMV0gPT09ICdcXG4nKSByZXR1cm4gc3RyO1xuICAgIGNvbnN0IG5leHQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIG9mZnNldCk7XG4gICAgcmV0dXJuIG5leHQgPj0gc3JjLmxlbmd0aCB8fCBzcmNbbmV4dF0gPT09ICdcXG4nID8gc3RyICsgJ1xcbicgOiBzdHI7XG4gIH0gLy8gXigtLS18Li4uKVxuXG5cbiAgc3RhdGljIGF0RG9jdW1lbnRCb3VuZGFyeShzcmMsIG9mZnNldCwgc2VwKSB7XG4gICAgY29uc3QgY2gwID0gc3JjW29mZnNldF07XG4gICAgaWYgKCFjaDApIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHByZXYgPSBzcmNbb2Zmc2V0IC0gMV07XG4gICAgaWYgKHByZXYgJiYgcHJldiAhPT0gJ1xcbicpIHJldHVybiBmYWxzZTtcblxuICAgIGlmIChzZXApIHtcbiAgICAgIGlmIChjaDAgIT09IHNlcCkgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY2gwICE9PSBDaGFyLkRJUkVDVElWRVNfRU5EICYmIGNoMCAhPT0gQ2hhci5ET0NVTUVOVF9FTkQpIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBjaDEgPSBzcmNbb2Zmc2V0ICsgMV07XG4gICAgY29uc3QgY2gyID0gc3JjW29mZnNldCArIDJdO1xuICAgIGlmIChjaDEgIT09IGNoMCB8fCBjaDIgIT09IGNoMCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGNoMyA9IHNyY1tvZmZzZXQgKyAzXTtcbiAgICByZXR1cm4gIWNoMyB8fCBjaDMgPT09ICdcXG4nIHx8IGNoMyA9PT0gJ1xcdCcgfHwgY2gzID09PSAnICc7XG4gIH1cblxuICBzdGF0aWMgZW5kT2ZJZGVudGlmaWVyKHNyYywgb2Zmc2V0KSB7XG4gICAgbGV0IGNoID0gc3JjW29mZnNldF07XG4gICAgY29uc3QgaXNWZXJiYXRpbSA9IGNoID09PSAnPCc7XG4gICAgY29uc3Qgbm90T2sgPSBpc1ZlcmJhdGltID8gWydcXG4nLCAnXFx0JywgJyAnLCAnPiddIDogWydcXG4nLCAnXFx0JywgJyAnLCAnWycsICddJywgJ3snLCAnfScsICcsJ107XG5cbiAgICB3aGlsZSAoY2ggJiYgbm90T2suaW5kZXhPZihjaCkgPT09IC0xKSBjaCA9IHNyY1tvZmZzZXQgKz0gMV07XG5cbiAgICBpZiAoaXNWZXJiYXRpbSAmJiBjaCA9PT0gJz4nKSBvZmZzZXQgKz0gMTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgc3RhdGljIGVuZE9mSW5kZW50KHNyYywgb2Zmc2V0KSB7XG4gICAgbGV0IGNoID0gc3JjW29mZnNldF07XG5cbiAgICB3aGlsZSAoY2ggPT09ICcgJykgY2ggPSBzcmNbb2Zmc2V0ICs9IDFdO1xuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIHN0YXRpYyBlbmRPZkxpbmUoc3JjLCBvZmZzZXQpIHtcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0XTtcblxuICAgIHdoaWxlIChjaCAmJiBjaCAhPT0gJ1xcbicpIGNoID0gc3JjW29mZnNldCArPSAxXTtcblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBzdGF0aWMgZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0KSB7XG4gICAgbGV0IGNoID0gc3JjW29mZnNldF07XG5cbiAgICB3aGlsZSAoY2ggPT09ICdcXHQnIHx8IGNoID09PSAnICcpIGNoID0gc3JjW29mZnNldCArPSAxXTtcblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBzdGF0aWMgc3RhcnRPZkxpbmUoc3JjLCBvZmZzZXQpIHtcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0IC0gMV07XG4gICAgaWYgKGNoID09PSAnXFxuJykgcmV0dXJuIG9mZnNldDtcblxuICAgIHdoaWxlIChjaCAmJiBjaCAhPT0gJ1xcbicpIGNoID0gc3JjW29mZnNldCAtPSAxXTtcblxuICAgIHJldHVybiBvZmZzZXQgKyAxO1xuICB9XG4gIC8qKlxuICAgKiBFbmQgb2YgaW5kZW50YXRpb24sIG9yIG51bGwgaWYgdGhlIGxpbmUncyBpbmRlbnQgbGV2ZWwgaXMgbm90IG1vcmVcbiAgICogdGhhbiBgaW5kZW50YFxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gc3JjXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRlbnRcbiAgICogQHBhcmFtIHtudW1iZXJ9IGxpbmVTdGFydFxuICAgKiBAcmV0dXJucyB7P251bWJlcn1cbiAgICovXG5cblxuICBzdGF0aWMgZW5kT2ZCbG9ja0luZGVudChzcmMsIGluZGVudCwgbGluZVN0YXJ0KSB7XG4gICAgY29uc3QgaW5FbmQgPSBOb2RlLmVuZE9mSW5kZW50KHNyYywgbGluZVN0YXJ0KTtcblxuICAgIGlmIChpbkVuZCA+IGxpbmVTdGFydCArIGluZGVudCkge1xuICAgICAgcmV0dXJuIGluRW5kO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB3c0VuZCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgaW5FbmQpO1xuICAgICAgY29uc3QgY2ggPSBzcmNbd3NFbmRdO1xuICAgICAgaWYgKCFjaCB8fCBjaCA9PT0gJ1xcbicpIHJldHVybiB3c0VuZDtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHN0YXRpYyBhdEJsYW5rKHNyYywgb2Zmc2V0LCBlbmRBc0JsYW5rKSB7XG4gICAgY29uc3QgY2ggPSBzcmNbb2Zmc2V0XTtcbiAgICByZXR1cm4gY2ggPT09ICdcXG4nIHx8IGNoID09PSAnXFx0JyB8fCBjaCA9PT0gJyAnIHx8IGVuZEFzQmxhbmsgJiYgIWNoO1xuICB9XG5cbiAgc3RhdGljIG5leHROb2RlSXNJbmRlbnRlZChjaCwgaW5kZW50RGlmZiwgaW5kaWNhdG9yQXNJbmRlbnQpIHtcbiAgICBpZiAoIWNoIHx8IGluZGVudERpZmYgPCAwKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGluZGVudERpZmYgPiAwKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gaW5kaWNhdG9yQXNJbmRlbnQgJiYgY2ggPT09ICctJztcbiAgfSAvLyBzaG91bGQgYmUgYXQgbGluZSBvciBzdHJpbmcgZW5kLCBvciBhdCBuZXh0IG5vbi13aGl0ZXNwYWNlIGNoYXJcblxuXG4gIHN0YXRpYyBub3JtYWxpemVPZmZzZXQoc3JjLCBvZmZzZXQpIHtcbiAgICBjb25zdCBjaCA9IHNyY1tvZmZzZXRdO1xuICAgIHJldHVybiAhY2ggPyBvZmZzZXQgOiBjaCAhPT0gJ1xcbicgJiYgc3JjW29mZnNldCAtIDFdID09PSAnXFxuJyA/IG9mZnNldCAtIDEgOiBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIG9mZnNldCk7XG4gIH0gLy8gZm9sZCBzaW5nbGUgbmV3bGluZSBpbnRvIHNwYWNlLCBtdWx0aXBsZSBuZXdsaW5lcyB0byBOIC0gMSBuZXdsaW5lc1xuICAvLyBwcmVzdW1lcyBzcmNbb2Zmc2V0XSA9PT0gJ1xcbidcblxuXG4gIHN0YXRpYyBmb2xkTmV3bGluZShzcmMsIG9mZnNldCwgaW5kZW50KSB7XG4gICAgbGV0IGluQ291bnQgPSAwO1xuICAgIGxldCBlcnJvciA9IGZhbHNlO1xuICAgIGxldCBmb2xkID0gJyc7XG4gICAgbGV0IGNoID0gc3JjW29mZnNldCArIDFdO1xuXG4gICAgd2hpbGUgKGNoID09PSAnICcgfHwgY2ggPT09ICdcXHQnIHx8IGNoID09PSAnXFxuJykge1xuICAgICAgc3dpdGNoIChjaCkge1xuICAgICAgICBjYXNlICdcXG4nOlxuICAgICAgICAgIGluQ291bnQgPSAwO1xuICAgICAgICAgIG9mZnNldCArPSAxO1xuICAgICAgICAgIGZvbGQgKz0gJ1xcbic7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnXFx0JzpcbiAgICAgICAgICBpZiAoaW5Db3VudCA8PSBpbmRlbnQpIGVycm9yID0gdHJ1ZTtcbiAgICAgICAgICBvZmZzZXQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIG9mZnNldCArIDIpIC0gMTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICcgJzpcbiAgICAgICAgICBpbkNvdW50ICs9IDE7XG4gICAgICAgICAgb2Zmc2V0ICs9IDE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNoID0gc3JjW29mZnNldCArIDFdO1xuICAgIH1cblxuICAgIGlmICghZm9sZCkgZm9sZCA9ICcgJztcbiAgICBpZiAoY2ggJiYgaW5Db3VudCA8PSBpbmRlbnQpIGVycm9yID0gdHJ1ZTtcbiAgICByZXR1cm4ge1xuICAgICAgZm9sZCxcbiAgICAgIG9mZnNldCxcbiAgICAgIGVycm9yXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHR5cGUsIHByb3BzLCBjb250ZXh0KSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdjb250ZXh0Jywge1xuICAgICAgdmFsdWU6IGNvbnRleHQgfHwgbnVsbCxcbiAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgdGhpcy5lcnJvciA9IG51bGw7XG4gICAgdGhpcy5yYW5nZSA9IG51bGw7XG4gICAgdGhpcy52YWx1ZVJhbmdlID0gbnVsbDtcbiAgICB0aGlzLnByb3BzID0gcHJvcHMgfHwgW107XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLnZhbHVlID0gbnVsbDtcbiAgfVxuXG4gIGdldFByb3BWYWx1ZShpZHgsIGtleSwgc2tpcEtleSkge1xuICAgIGlmICghdGhpcy5jb250ZXh0KSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCB7XG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGNvbnN0IHByb3AgPSB0aGlzLnByb3BzW2lkeF07XG4gICAgcmV0dXJuIHByb3AgJiYgc3JjW3Byb3Auc3RhcnRdID09PSBrZXkgPyBzcmMuc2xpY2UocHJvcC5zdGFydCArIChza2lwS2V5ID8gMSA6IDApLCBwcm9wLmVuZCkgOiBudWxsO1xuICB9XG5cbiAgZ2V0IGFuY2hvcigpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucHJvcHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IGFuY2hvciA9IHRoaXMuZ2V0UHJvcFZhbHVlKGksIENoYXIuQU5DSE9SLCB0cnVlKTtcbiAgICAgIGlmIChhbmNob3IgIT0gbnVsbCkgcmV0dXJuIGFuY2hvcjtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBjb21tZW50KCkge1xuICAgIGNvbnN0IGNvbW1lbnRzID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucHJvcHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IGNvbW1lbnQgPSB0aGlzLmdldFByb3BWYWx1ZShpLCBDaGFyLkNPTU1FTlQsIHRydWUpO1xuICAgICAgaWYgKGNvbW1lbnQgIT0gbnVsbCkgY29tbWVudHMucHVzaChjb21tZW50KTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29tbWVudHMubGVuZ3RoID4gMCA/IGNvbW1lbnRzLmpvaW4oJ1xcbicpIDogbnVsbDtcbiAgfVxuXG4gIGNvbW1lbnRIYXNSZXF1aXJlZFdoaXRlc3BhY2Uoc3RhcnQpIHtcbiAgICBjb25zdCB7XG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGlmICh0aGlzLmhlYWRlciAmJiBzdGFydCA9PT0gdGhpcy5oZWFkZXIuZW5kKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCF0aGlzLnZhbHVlUmFuZ2UpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCB7XG4gICAgICBlbmRcbiAgICB9ID0gdGhpcy52YWx1ZVJhbmdlO1xuICAgIHJldHVybiBzdGFydCAhPT0gZW5kIHx8IE5vZGUuYXRCbGFuayhzcmMsIGVuZCAtIDEpO1xuICB9XG5cbiAgZ2V0IGhhc0NvbW1lbnQoKSB7XG4gICAgaWYgKHRoaXMuY29udGV4dCkge1xuICAgICAgY29uc3Qge1xuICAgICAgICBzcmNcbiAgICAgIH0gPSB0aGlzLmNvbnRleHQ7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wcm9wcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBpZiAoc3JjW3RoaXMucHJvcHNbaV0uc3RhcnRdID09PSBDaGFyLkNPTU1FTlQpIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGdldCBoYXNQcm9wcygpIHtcbiAgICBpZiAodGhpcy5jb250ZXh0KSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIHNyY1xuICAgICAgfSA9IHRoaXMuY29udGV4dDtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnByb3BzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmIChzcmNbdGhpcy5wcm9wc1tpXS5zdGFydF0gIT09IENoYXIuQ09NTUVOVCkgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZ2V0IGluY2x1ZGVzVHJhaWxpbmdMaW5lcygpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBnZXQganNvbkxpa2UoKSB7XG4gICAgY29uc3QganNvbkxpa2VUeXBlcyA9IFtUeXBlLkZMT1dfTUFQLCBUeXBlLkZMT1dfU0VRLCBUeXBlLlFVT1RFX0RPVUJMRSwgVHlwZS5RVU9URV9TSU5HTEVdO1xuICAgIHJldHVybiBqc29uTGlrZVR5cGVzLmluZGV4T2YodGhpcy50eXBlKSAhPT0gLTE7XG4gIH1cblxuICBnZXQgcmFuZ2VBc0xpbmVQb3MoKSB7XG4gICAgaWYgKCF0aGlzLnJhbmdlIHx8ICF0aGlzLmNvbnRleHQpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgY29uc3Qgc3RhcnQgPSBnZXRMaW5lUG9zKHRoaXMucmFuZ2Uuc3RhcnQsIHRoaXMuY29udGV4dC5yb290KTtcbiAgICBpZiAoIXN0YXJ0KSByZXR1cm4gdW5kZWZpbmVkO1xuICAgIGNvbnN0IGVuZCA9IGdldExpbmVQb3ModGhpcy5yYW5nZS5lbmQsIHRoaXMuY29udGV4dC5yb290KTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhcnQsXG4gICAgICBlbmRcbiAgICB9O1xuICB9XG5cbiAgZ2V0IHJhd1ZhbHVlKCkge1xuICAgIGlmICghdGhpcy52YWx1ZVJhbmdlIHx8ICF0aGlzLmNvbnRleHQpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHtcbiAgICAgIHN0YXJ0LFxuICAgICAgZW5kXG4gICAgfSA9IHRoaXMudmFsdWVSYW5nZTtcbiAgICByZXR1cm4gdGhpcy5jb250ZXh0LnNyYy5zbGljZShzdGFydCwgZW5kKTtcbiAgfVxuXG4gIGdldCB0YWcoKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnByb3BzLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCB0YWcgPSB0aGlzLmdldFByb3BWYWx1ZShpLCBDaGFyLlRBRywgZmFsc2UpO1xuXG4gICAgICBpZiAodGFnICE9IG51bGwpIHtcbiAgICAgICAgaWYgKHRhZ1sxXSA9PT0gJzwnKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHZlcmJhdGltOiB0YWcuc2xpY2UoMiwgLTEpXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICAgICAgICBjb25zdCBbXywgaGFuZGxlLCBzdWZmaXhdID0gdGFnLm1hdGNoKC9eKC4qISkoW14hXSopJC8pO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBoYW5kbGUsXG4gICAgICAgICAgICBzdWZmaXhcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgdmFsdWVSYW5nZUNvbnRhaW5zTmV3bGluZSgpIHtcbiAgICBpZiAoIXRoaXMudmFsdWVSYW5nZSB8fCAhdGhpcy5jb250ZXh0KSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3Qge1xuICAgICAgc3RhcnQsXG4gICAgICBlbmRcbiAgICB9ID0gdGhpcy52YWx1ZVJhbmdlO1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzLmNvbnRleHQ7XG5cbiAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgICAgaWYgKHNyY1tpXSA9PT0gJ1xcbicpIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHBhcnNlQ29tbWVudChzdGFydCkge1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzLmNvbnRleHQ7XG5cbiAgICBpZiAoc3JjW3N0YXJ0XSA9PT0gQ2hhci5DT01NRU5UKSB7XG4gICAgICBjb25zdCBlbmQgPSBOb2RlLmVuZE9mTGluZShzcmMsIHN0YXJ0ICsgMSk7XG4gICAgICBjb25zdCBjb21tZW50UmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIGVuZCk7XG4gICAgICB0aGlzLnByb3BzLnB1c2goY29tbWVudFJhbmdlKTtcbiAgICAgIHJldHVybiBlbmQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXJ0O1xuICB9XG4gIC8qKlxuICAgKiBQb3B1bGF0ZXMgdGhlIGBvcmlnU3RhcnRgIGFuZCBgb3JpZ0VuZGAgdmFsdWVzIG9mIGFsbCByYW5nZXMgZm9yIHRoaXNcbiAgICogbm9kZS4gRXh0ZW5kZWQgYnkgY2hpbGQgY2xhc3NlcyB0byBoYW5kbGUgZGVzY2VuZGFudCBub2Rlcy5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJbXX0gY3IgLSBQb3NpdGlvbnMgb2YgZHJvcHBlZCBDUiBjaGFyYWN0ZXJzXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBvZmZzZXQgLSBTdGFydGluZyBpbmRleCBvZiBgY3JgIGZyb20gdGhlIGxhc3QgY2FsbFxuICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIFRoZSBuZXh0IG9mZnNldCwgbWF0Y2hpbmcgdGhlIG9uZSBmb3VuZCBmb3IgYG9yaWdTdGFydGBcbiAgICovXG5cblxuICBzZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpIHtcbiAgICBpZiAodGhpcy5yYW5nZSkgb2Zmc2V0ID0gdGhpcy5yYW5nZS5zZXRPcmlnUmFuZ2UoY3IsIG9mZnNldCk7XG4gICAgaWYgKHRoaXMudmFsdWVSYW5nZSkgdGhpcy52YWx1ZVJhbmdlLnNldE9yaWdSYW5nZShjciwgb2Zmc2V0KTtcbiAgICB0aGlzLnByb3BzLmZvckVhY2gocHJvcCA9PiBwcm9wLnNldE9yaWdSYW5nZShjciwgb2Zmc2V0KSk7XG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIHRvU3RyaW5nKCkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbnRleHQ6IHtcbiAgICAgICAgc3JjXG4gICAgICB9LFxuICAgICAgcmFuZ2UsXG4gICAgICB2YWx1ZVxuICAgIH0gPSB0aGlzO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKSByZXR1cm4gdmFsdWU7XG4gICAgY29uc3Qgc3RyID0gc3JjLnNsaWNlKHJhbmdlLnN0YXJ0LCByYW5nZS5lbmQpO1xuICAgIHJldHVybiBOb2RlLmFkZFN0cmluZ1Rlcm1pbmF0b3Ioc3JjLCByYW5nZS5lbmQsIHN0cik7XG4gIH1cblxufVxuXG5leHBvcnQgeyBOb2RlIH07XG4iLCJpbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi9jc3QvTm9kZS5qcyc7XG5pbXBvcnQgeyBnZXRMaW5lUG9zLCBnZXRQcmV0dHlDb250ZXh0IH0gZnJvbSAnLi9jc3Qvc291cmNlLXV0aWxzLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi9jc3QvUmFuZ2UuanMnO1xuXG5jbGFzcyBZQU1MRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG5hbWUsIHNvdXJjZSwgbWVzc2FnZSkge1xuICAgIGlmICghbWVzc2FnZSB8fCAhKHNvdXJjZSBpbnN0YW5jZW9mIE5vZGUpKSB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGFyZ3VtZW50cyBmb3IgbmV3IFwiLmNvbmNhdChuYW1lKSk7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgdGhpcy5zb3VyY2UgPSBzb3VyY2U7XG4gIH1cblxuICBtYWtlUHJldHR5KCkge1xuICAgIGlmICghdGhpcy5zb3VyY2UpIHJldHVybjtcbiAgICB0aGlzLm5vZGVUeXBlID0gdGhpcy5zb3VyY2UudHlwZTtcbiAgICBjb25zdCBjc3QgPSB0aGlzLnNvdXJjZS5jb250ZXh0ICYmIHRoaXMuc291cmNlLmNvbnRleHQucm9vdDtcblxuICAgIGlmICh0eXBlb2YgdGhpcy5vZmZzZXQgPT09ICdudW1iZXInKSB7XG4gICAgICB0aGlzLnJhbmdlID0gbmV3IFJhbmdlKHRoaXMub2Zmc2V0LCB0aGlzLm9mZnNldCArIDEpO1xuICAgICAgY29uc3Qgc3RhcnQgPSBjc3QgJiYgZ2V0TGluZVBvcyh0aGlzLm9mZnNldCwgY3N0KTtcblxuICAgICAgaWYgKHN0YXJ0KSB7XG4gICAgICAgIGNvbnN0IGVuZCA9IHtcbiAgICAgICAgICBsaW5lOiBzdGFydC5saW5lLFxuICAgICAgICAgIGNvbDogc3RhcnQuY29sICsgMVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmxpbmVQb3MgPSB7XG4gICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgZW5kXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIGRlbGV0ZSB0aGlzLm9mZnNldDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yYW5nZSA9IHRoaXMuc291cmNlLnJhbmdlO1xuICAgICAgdGhpcy5saW5lUG9zID0gdGhpcy5zb3VyY2UucmFuZ2VBc0xpbmVQb3M7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubGluZVBvcykge1xuICAgICAgY29uc3Qge1xuICAgICAgICBsaW5lLFxuICAgICAgICBjb2xcbiAgICAgIH0gPSB0aGlzLmxpbmVQb3Muc3RhcnQ7XG4gICAgICB0aGlzLm1lc3NhZ2UgKz0gXCIgYXQgbGluZSBcIi5jb25jYXQobGluZSwgXCIsIGNvbHVtbiBcIikuY29uY2F0KGNvbCk7XG4gICAgICBjb25zdCBjdHggPSBjc3QgJiYgZ2V0UHJldHR5Q29udGV4dCh0aGlzLmxpbmVQb3MsIGNzdCk7XG4gICAgICBpZiAoY3R4KSB0aGlzLm1lc3NhZ2UgKz0gXCI6XFxuXFxuXCIuY29uY2F0KGN0eCwgXCJcXG5cIik7XG4gICAgfVxuXG4gICAgZGVsZXRlIHRoaXMuc291cmNlO1xuICB9XG5cbn1cbmNsYXNzIFlBTUxSZWZlcmVuY2VFcnJvciBleHRlbmRzIFlBTUxFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHNvdXJjZSwgbWVzc2FnZSkge1xuICAgIHN1cGVyKCdZQU1MUmVmZXJlbmNlRXJyb3InLCBzb3VyY2UsIG1lc3NhZ2UpO1xuICB9XG5cbn1cbmNsYXNzIFlBTUxTZW1hbnRpY0Vycm9yIGV4dGVuZHMgWUFNTEVycm9yIHtcbiAgY29uc3RydWN0b3Ioc291cmNlLCBtZXNzYWdlKSB7XG4gICAgc3VwZXIoJ1lBTUxTZW1hbnRpY0Vycm9yJywgc291cmNlLCBtZXNzYWdlKTtcbiAgfVxuXG59XG5jbGFzcyBZQU1MU3ludGF4RXJyb3IgZXh0ZW5kcyBZQU1MRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcihzb3VyY2UsIG1lc3NhZ2UpIHtcbiAgICBzdXBlcignWUFNTFN5bnRheEVycm9yJywgc291cmNlLCBtZXNzYWdlKTtcbiAgfVxuXG59XG5jbGFzcyBZQU1MV2FybmluZyBleHRlbmRzIFlBTUxFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHNvdXJjZSwgbWVzc2FnZSkge1xuICAgIHN1cGVyKCdZQU1MV2FybmluZycsIHNvdXJjZSwgbWVzc2FnZSk7XG4gIH1cblxufVxuXG5leHBvcnQgeyBZQU1MRXJyb3IsIFlBTUxSZWZlcmVuY2VFcnJvciwgWUFNTFNlbWFudGljRXJyb3IsIFlBTUxTeW50YXhFcnJvciwgWUFNTFdhcm5pbmcgfTtcbiIsImltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5jbGFzcyBCbGFua0xpbmUgZXh0ZW5kcyBOb2RlIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoVHlwZS5CTEFOS19MSU5FKTtcbiAgfVxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG5cbiAgZ2V0IGluY2x1ZGVzVHJhaWxpbmdMaW5lcygpIHtcbiAgICAvLyBUaGlzIGlzIG5ldmVyIGNhbGxlZCBmcm9tIGFueXdoZXJlLCBidXQgaWYgaXQgd2VyZSxcbiAgICAvLyB0aGlzIGlzIHRoZSB2YWx1ZSBpdCBzaG91bGQgcmV0dXJuLlxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIC8qKlxuICAgKiBQYXJzZXMgYSBibGFuayBsaW5lIGZyb20gdGhlIHNvdXJjZVxuICAgKlxuICAgKiBAcGFyYW0ge1BhcnNlQ29udGV4dH0gY29udGV4dFxuICAgKiBAcGFyYW0ge251bWJlcn0gc3RhcnQgLSBJbmRleCBvZiBmaXJzdCBcXG4gY2hhcmFjdGVyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gSW5kZXggb2YgdGhlIGNoYXJhY3RlciBhZnRlciB0aGlzXG4gICAqL1xuXG5cbiAgcGFyc2UoY29udGV4dCwgc3RhcnQpIHtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIHRoaXMucmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIHN0YXJ0ICsgMSk7XG4gICAgcmV0dXJuIHN0YXJ0ICsgMTtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IEJsYW5rTGluZSB9O1xuIiwiaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MU2VtYW50aWNFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBCbGFua0xpbmUgfSBmcm9tICcuL0JsYW5rTGluZS5qcyc7XG5pbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi9SYW5nZS5qcyc7XG5cbmNsYXNzIENvbGxlY3Rpb25JdGVtIGV4dGVuZHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKHR5cGUsIHByb3BzKSB7XG4gICAgc3VwZXIodHlwZSwgcHJvcHMpO1xuICAgIHRoaXMubm9kZSA9IG51bGw7XG4gIH1cblxuICBnZXQgaW5jbHVkZXNUcmFpbGluZ0xpbmVzKCkge1xuICAgIHJldHVybiAhIXRoaXMubm9kZSAmJiB0aGlzLm5vZGUuaW5jbHVkZXNUcmFpbGluZ0xpbmVzO1xuICB9XG4gIC8qKlxuICAgKiBAcGFyYW0ge1BhcnNlQ29udGV4dH0gY29udGV4dFxuICAgKiBAcGFyYW0ge251bWJlcn0gc3RhcnQgLSBJbmRleCBvZiBmaXJzdCBjaGFyYWN0ZXJcbiAgICogQHJldHVybnMge251bWJlcn0gLSBJbmRleCBvZiB0aGUgY2hhcmFjdGVyIGFmdGVyIHRoaXNcbiAgICovXG5cblxuICBwYXJzZShjb250ZXh0LCBzdGFydCkge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgY29uc3Qge1xuICAgICAgcGFyc2VOb2RlLFxuICAgICAgc3JjXG4gICAgfSA9IGNvbnRleHQ7XG4gICAgbGV0IHtcbiAgICAgIGF0TGluZVN0YXJ0LFxuICAgICAgbGluZVN0YXJ0XG4gICAgfSA9IGNvbnRleHQ7XG4gICAgaWYgKCFhdExpbmVTdGFydCAmJiB0aGlzLnR5cGUgPT09IFR5cGUuU0VRX0lURU0pIHRoaXMuZXJyb3IgPSBuZXcgWUFNTFNlbWFudGljRXJyb3IodGhpcywgJ1NlcXVlbmNlIGl0ZW1zIG11c3Qgbm90IGhhdmUgcHJlY2VkaW5nIGNvbnRlbnQgb24gdGhlIHNhbWUgbGluZScpO1xuICAgIGNvbnN0IGluZGVudCA9IGF0TGluZVN0YXJ0ID8gc3RhcnQgLSBsaW5lU3RhcnQgOiBjb250ZXh0LmluZGVudDtcbiAgICBsZXQgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBzdGFydCArIDEpO1xuICAgIGxldCBjaCA9IHNyY1tvZmZzZXRdO1xuICAgIGNvbnN0IGlubGluZUNvbW1lbnQgPSBjaCA9PT0gJyMnO1xuICAgIGNvbnN0IGNvbW1lbnRzID0gW107XG4gICAgbGV0IGJsYW5rTGluZSA9IG51bGw7XG5cbiAgICB3aGlsZSAoY2ggPT09ICdcXG4nIHx8IGNoID09PSAnIycpIHtcbiAgICAgIGlmIChjaCA9PT0gJyMnKSB7XG4gICAgICAgIGNvbnN0IGVuZCA9IE5vZGUuZW5kT2ZMaW5lKHNyYywgb2Zmc2V0ICsgMSk7XG4gICAgICAgIGNvbW1lbnRzLnB1c2gobmV3IFJhbmdlKG9mZnNldCwgZW5kKSk7XG4gICAgICAgIG9mZnNldCA9IGVuZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0TGluZVN0YXJ0ID0gdHJ1ZTtcbiAgICAgICAgbGluZVN0YXJ0ID0gb2Zmc2V0ICsgMTtcbiAgICAgICAgY29uc3Qgd3NFbmQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIGxpbmVTdGFydCk7XG5cbiAgICAgICAgaWYgKHNyY1t3c0VuZF0gPT09ICdcXG4nICYmIGNvbW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGJsYW5rTGluZSA9IG5ldyBCbGFua0xpbmUoKTtcbiAgICAgICAgICBsaW5lU3RhcnQgPSBibGFua0xpbmUucGFyc2Uoe1xuICAgICAgICAgICAgc3JjXG4gICAgICAgICAgfSwgbGluZVN0YXJ0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9mZnNldCA9IE5vZGUuZW5kT2ZJbmRlbnQoc3JjLCBsaW5lU3RhcnQpO1xuICAgICAgfVxuXG4gICAgICBjaCA9IHNyY1tvZmZzZXRdO1xuICAgIH1cblxuICAgIGlmIChOb2RlLm5leHROb2RlSXNJbmRlbnRlZChjaCwgb2Zmc2V0IC0gKGxpbmVTdGFydCArIGluZGVudCksIHRoaXMudHlwZSAhPT0gVHlwZS5TRVFfSVRFTSkpIHtcbiAgICAgIHRoaXMubm9kZSA9IHBhcnNlTm9kZSh7XG4gICAgICAgIGF0TGluZVN0YXJ0LFxuICAgICAgICBpbkNvbGxlY3Rpb246IGZhbHNlLFxuICAgICAgICBpbmRlbnQsXG4gICAgICAgIGxpbmVTdGFydCxcbiAgICAgICAgcGFyZW50OiB0aGlzXG4gICAgICB9LCBvZmZzZXQpO1xuICAgIH0gZWxzZSBpZiAoY2ggJiYgbGluZVN0YXJ0ID4gc3RhcnQgKyAxKSB7XG4gICAgICBvZmZzZXQgPSBsaW5lU3RhcnQgLSAxO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm5vZGUpIHtcbiAgICAgIGlmIChibGFua0xpbmUpIHtcbiAgICAgICAgLy8gT25seSBibGFuayBsaW5lcyBwcmVjZWRpbmcgbm9uLWVtcHR5IG5vZGVzIGFyZSBjYXB0dXJlZC4gTm90ZSB0aGF0XG4gICAgICAgIC8vIHRoaXMgbWVhbnMgdGhhdCBjb2xsZWN0aW9uIGl0ZW0gcmFuZ2Ugc3RhcnQgaW5kaWNlcyBkbyBub3QgYWx3YXlzXG4gICAgICAgIC8vIGluY3JlYXNlIG1vbm90b25pY2FsbHkuIC0tIGVlbWVsaS95YW1sIzEyNlxuICAgICAgICBjb25zdCBpdGVtcyA9IGNvbnRleHQucGFyZW50Lml0ZW1zIHx8IGNvbnRleHQucGFyZW50LmNvbnRlbnRzO1xuICAgICAgICBpZiAoaXRlbXMpIGl0ZW1zLnB1c2goYmxhbmtMaW5lKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbW1lbnRzLmxlbmd0aCkgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkodGhpcy5wcm9wcywgY29tbWVudHMpO1xuICAgICAgb2Zmc2V0ID0gdGhpcy5ub2RlLnJhbmdlLmVuZDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGlubGluZUNvbW1lbnQpIHtcbiAgICAgICAgY29uc3QgYyA9IGNvbW1lbnRzWzBdO1xuICAgICAgICB0aGlzLnByb3BzLnB1c2goYyk7XG4gICAgICAgIG9mZnNldCA9IGMuZW5kO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2Zmc2V0ID0gTm9kZS5lbmRPZkxpbmUoc3JjLCBzdGFydCArIDEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGVuZCA9IHRoaXMubm9kZSA/IHRoaXMubm9kZS52YWx1ZVJhbmdlLmVuZCA6IG9mZnNldDtcbiAgICB0aGlzLnZhbHVlUmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIGVuZCk7XG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIHNldE9yaWdSYW5nZXMoY3IsIG9mZnNldCkge1xuICAgIG9mZnNldCA9IHN1cGVyLnNldE9yaWdSYW5nZXMoY3IsIG9mZnNldCk7XG4gICAgcmV0dXJuIHRoaXMubm9kZSA/IHRoaXMubm9kZS5zZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpIDogb2Zmc2V0O1xuICB9XG5cbiAgdG9TdHJpbmcoKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29udGV4dDoge1xuICAgICAgICBzcmNcbiAgICAgIH0sXG4gICAgICBub2RlLFxuICAgICAgcmFuZ2UsXG4gICAgICB2YWx1ZVxuICAgIH0gPSB0aGlzO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKSByZXR1cm4gdmFsdWU7XG4gICAgY29uc3Qgc3RyID0gbm9kZSA/IHNyYy5zbGljZShyYW5nZS5zdGFydCwgbm9kZS5yYW5nZS5zdGFydCkgKyBTdHJpbmcobm9kZSkgOiBzcmMuc2xpY2UocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCk7XG4gICAgcmV0dXJuIE5vZGUuYWRkU3RyaW5nVGVybWluYXRvcihzcmMsIHJhbmdlLmVuZCwgc3RyKTtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IENvbGxlY3Rpb25JdGVtIH07XG4iLCJpbXBvcnQgeyBUeXBlIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL1JhbmdlLmpzJztcblxuY2xhc3MgQ29tbWVudCBleHRlbmRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihUeXBlLkNPTU1FTlQpO1xuICB9XG4gIC8qKlxuICAgKiBQYXJzZXMgYSBjb21tZW50IGxpbmUgZnJvbSB0aGUgc291cmNlXG4gICAqXG4gICAqIEBwYXJhbSB7UGFyc2VDb250ZXh0fSBjb250ZXh0XG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydCAtIEluZGV4IG9mIGZpcnN0IGNoYXJhY3RlclxuICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIEluZGV4IG9mIHRoZSBjaGFyYWN0ZXIgYWZ0ZXIgdGhpcyBzY2FsYXJcbiAgICovXG5cblxuICBwYXJzZShjb250ZXh0LCBzdGFydCkge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgY29uc3Qgb2Zmc2V0ID0gdGhpcy5wYXJzZUNvbW1lbnQoc3RhcnQpO1xuICAgIHRoaXMucmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIG9mZnNldCk7XG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG59XG5cbmV4cG9ydCB7IENvbW1lbnQgfTtcbiIsImltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWUFNTFN5bnRheEVycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IEJsYW5rTGluZSB9IGZyb20gJy4vQmxhbmtMaW5lLmpzJztcbmltcG9ydCB7IENvbGxlY3Rpb25JdGVtIH0gZnJvbSAnLi9Db2xsZWN0aW9uSXRlbS5qcyc7XG5pbXBvcnQgeyBDb21tZW50IH0gZnJvbSAnLi9Db21tZW50LmpzJztcbmltcG9ydCB7IE5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL1JhbmdlLmpzJztcblxuZnVuY3Rpb24gZ3JhYkNvbGxlY3Rpb25FbmRDb21tZW50cyhub2RlKSB7XG4gIGxldCBjbm9kZSA9IG5vZGU7XG5cbiAgd2hpbGUgKGNub2RlIGluc3RhbmNlb2YgQ29sbGVjdGlvbkl0ZW0pIGNub2RlID0gY25vZGUubm9kZTtcblxuICBpZiAoIShjbm9kZSBpbnN0YW5jZW9mIENvbGxlY3Rpb24pKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbGVuID0gY25vZGUuaXRlbXMubGVuZ3RoO1xuICBsZXQgY2kgPSAtMTtcblxuICBmb3IgKGxldCBpID0gbGVuIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICBjb25zdCBuID0gY25vZGUuaXRlbXNbaV07XG5cbiAgICBpZiAobi50eXBlID09PSBUeXBlLkNPTU1FTlQpIHtcbiAgICAgIC8vIEtlZXAgc3VmZmljaWVudGx5IGluZGVudGVkIGNvbW1lbnRzIHdpdGggcHJlY2VkaW5nIG5vZGVcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgaW5kZW50LFxuICAgICAgICBsaW5lU3RhcnRcbiAgICAgIH0gPSBuLmNvbnRleHQ7XG4gICAgICBpZiAoaW5kZW50ID4gMCAmJiBuLnJhbmdlLnN0YXJ0ID49IGxpbmVTdGFydCArIGluZGVudCkgYnJlYWs7XG4gICAgICBjaSA9IGk7XG4gICAgfSBlbHNlIGlmIChuLnR5cGUgPT09IFR5cGUuQkxBTktfTElORSkgY2kgPSBpO2Vsc2UgYnJlYWs7XG4gIH1cblxuICBpZiAoY2kgPT09IC0xKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgY2EgPSBjbm9kZS5pdGVtcy5zcGxpY2UoY2ksIGxlbiAtIGNpKTtcbiAgY29uc3QgcHJldkVuZCA9IGNhWzBdLnJhbmdlLnN0YXJ0O1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY25vZGUucmFuZ2UuZW5kID0gcHJldkVuZDtcbiAgICBpZiAoY25vZGUudmFsdWVSYW5nZSAmJiBjbm9kZS52YWx1ZVJhbmdlLmVuZCA+IHByZXZFbmQpIGNub2RlLnZhbHVlUmFuZ2UuZW5kID0gcHJldkVuZDtcbiAgICBpZiAoY25vZGUgPT09IG5vZGUpIGJyZWFrO1xuICAgIGNub2RlID0gY25vZGUuY29udGV4dC5wYXJlbnQ7XG4gIH1cblxuICByZXR1cm4gY2E7XG59XG5jbGFzcyBDb2xsZWN0aW9uIGV4dGVuZHMgTm9kZSB7XG4gIHN0YXRpYyBuZXh0Q29udGVudEhhc0luZGVudChzcmMsIG9mZnNldCwgaW5kZW50KSB7XG4gICAgY29uc3QgbGluZVN0YXJ0ID0gTm9kZS5lbmRPZkxpbmUoc3JjLCBvZmZzZXQpICsgMTtcbiAgICBvZmZzZXQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIGxpbmVTdGFydCk7XG4gICAgY29uc3QgY2ggPSBzcmNbb2Zmc2V0XTtcbiAgICBpZiAoIWNoKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKG9mZnNldCA+PSBsaW5lU3RhcnQgKyBpbmRlbnQpIHJldHVybiB0cnVlO1xuICAgIGlmIChjaCAhPT0gJyMnICYmIGNoICE9PSAnXFxuJykgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiBDb2xsZWN0aW9uLm5leHRDb250ZW50SGFzSW5kZW50KHNyYywgb2Zmc2V0LCBpbmRlbnQpO1xuICB9XG5cbiAgY29uc3RydWN0b3IoZmlyc3RJdGVtKSB7XG4gICAgc3VwZXIoZmlyc3RJdGVtLnR5cGUgPT09IFR5cGUuU0VRX0lURU0gPyBUeXBlLlNFUSA6IFR5cGUuTUFQKTtcblxuICAgIGZvciAobGV0IGkgPSBmaXJzdEl0ZW0ucHJvcHMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgIGlmIChmaXJzdEl0ZW0ucHJvcHNbaV0uc3RhcnQgPCBmaXJzdEl0ZW0uY29udGV4dC5saW5lU3RhcnQpIHtcbiAgICAgICAgLy8gcHJvcHMgb24gcHJldmlvdXMgbGluZSBhcmUgYXNzdW1lZCBieSB0aGUgY29sbGVjdGlvblxuICAgICAgICB0aGlzLnByb3BzID0gZmlyc3RJdGVtLnByb3BzLnNsaWNlKDAsIGkgKyAxKTtcbiAgICAgICAgZmlyc3RJdGVtLnByb3BzID0gZmlyc3RJdGVtLnByb3BzLnNsaWNlKGkgKyAxKTtcbiAgICAgICAgY29uc3QgaXRlbVJhbmdlID0gZmlyc3RJdGVtLnByb3BzWzBdIHx8IGZpcnN0SXRlbS52YWx1ZVJhbmdlO1xuICAgICAgICBmaXJzdEl0ZW0ucmFuZ2Uuc3RhcnQgPSBpdGVtUmFuZ2Uuc3RhcnQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuaXRlbXMgPSBbZmlyc3RJdGVtXTtcbiAgICBjb25zdCBlYyA9IGdyYWJDb2xsZWN0aW9uRW5kQ29tbWVudHMoZmlyc3RJdGVtKTtcbiAgICBpZiAoZWMpIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHRoaXMuaXRlbXMsIGVjKTtcbiAgfVxuXG4gIGdldCBpbmNsdWRlc1RyYWlsaW5nTGluZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuaXRlbXMubGVuZ3RoID4gMDtcbiAgfVxuICAvKipcbiAgICogQHBhcmFtIHtQYXJzZUNvbnRleHR9IGNvbnRleHRcbiAgICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IC0gSW5kZXggb2YgZmlyc3QgY2hhcmFjdGVyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gSW5kZXggb2YgdGhlIGNoYXJhY3RlciBhZnRlciB0aGlzXG4gICAqL1xuXG5cbiAgcGFyc2UoY29udGV4dCwgc3RhcnQpIHtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIGNvbnN0IHtcbiAgICAgIHBhcnNlTm9kZSxcbiAgICAgIHNyY1xuICAgIH0gPSBjb250ZXh0OyAvLyBJdCdzIGVhc2llciB0byByZWNhbGN1bGF0ZSBsaW5lU3RhcnQgaGVyZSByYXRoZXIgdGhhbiB0cmFja2luZyBkb3duIHRoZVxuICAgIC8vIGxhc3QgY29udGV4dCBmcm9tIHdoaWNoIHRvIHJlYWQgaXQgLS0gZWVtZWxpL3lhbWwjMlxuXG4gICAgbGV0IGxpbmVTdGFydCA9IE5vZGUuc3RhcnRPZkxpbmUoc3JjLCBzdGFydCk7XG4gICAgY29uc3QgZmlyc3RJdGVtID0gdGhpcy5pdGVtc1swXTsgLy8gRmlyc3QtaXRlbSBjb250ZXh0IG5lZWRzIHRvIGJlIGNvcnJlY3QgZm9yIGxhdGVyIGNvbW1lbnQgaGFuZGxpbmdcbiAgICAvLyAtLSBlZW1lbGkveWFtbCMxN1xuXG4gICAgZmlyc3RJdGVtLmNvbnRleHQucGFyZW50ID0gdGhpcztcbiAgICB0aGlzLnZhbHVlUmFuZ2UgPSBSYW5nZS5jb3B5KGZpcnN0SXRlbS52YWx1ZVJhbmdlKTtcbiAgICBjb25zdCBpbmRlbnQgPSBmaXJzdEl0ZW0ucmFuZ2Uuc3RhcnQgLSBmaXJzdEl0ZW0uY29udGV4dC5saW5lU3RhcnQ7XG4gICAgbGV0IG9mZnNldCA9IHN0YXJ0O1xuICAgIG9mZnNldCA9IE5vZGUubm9ybWFsaXplT2Zmc2V0KHNyYywgb2Zmc2V0KTtcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0XTtcbiAgICBsZXQgYXRMaW5lU3RhcnQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIGxpbmVTdGFydCkgPT09IG9mZnNldDtcbiAgICBsZXQgcHJldkluY2x1ZGVzVHJhaWxpbmdMaW5lcyA9IGZhbHNlO1xuXG4gICAgd2hpbGUgKGNoKSB7XG4gICAgICB3aGlsZSAoY2ggPT09ICdcXG4nIHx8IGNoID09PSAnIycpIHtcbiAgICAgICAgaWYgKGF0TGluZVN0YXJ0ICYmIGNoID09PSAnXFxuJyAmJiAhcHJldkluY2x1ZGVzVHJhaWxpbmdMaW5lcykge1xuICAgICAgICAgIGNvbnN0IGJsYW5rTGluZSA9IG5ldyBCbGFua0xpbmUoKTtcbiAgICAgICAgICBvZmZzZXQgPSBibGFua0xpbmUucGFyc2Uoe1xuICAgICAgICAgICAgc3JjXG4gICAgICAgICAgfSwgb2Zmc2V0KTtcbiAgICAgICAgICB0aGlzLnZhbHVlUmFuZ2UuZW5kID0gb2Zmc2V0O1xuXG4gICAgICAgICAgaWYgKG9mZnNldCA+PSBzcmMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjaCA9IG51bGw7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLml0ZW1zLnB1c2goYmxhbmtMaW5lKTtcbiAgICAgICAgICBvZmZzZXQgLT0gMTsgLy8gYmxhbmtMaW5lLnBhcnNlKCkgY29uc3VtZXMgdGVybWluYWwgbmV3bGluZVxuICAgICAgICB9IGVsc2UgaWYgKGNoID09PSAnIycpIHtcbiAgICAgICAgICBpZiAob2Zmc2V0IDwgbGluZVN0YXJ0ICsgaW5kZW50ICYmICFDb2xsZWN0aW9uLm5leHRDb250ZW50SGFzSW5kZW50KHNyYywgb2Zmc2V0LCBpbmRlbnQpKSB7XG4gICAgICAgICAgICByZXR1cm4gb2Zmc2V0O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNvbW1lbnQgPSBuZXcgQ29tbWVudCgpO1xuICAgICAgICAgIG9mZnNldCA9IGNvbW1lbnQucGFyc2Uoe1xuICAgICAgICAgICAgaW5kZW50LFxuICAgICAgICAgICAgbGluZVN0YXJ0LFxuICAgICAgICAgICAgc3JjXG4gICAgICAgICAgfSwgb2Zmc2V0KTtcbiAgICAgICAgICB0aGlzLml0ZW1zLnB1c2goY29tbWVudCk7XG4gICAgICAgICAgdGhpcy52YWx1ZVJhbmdlLmVuZCA9IG9mZnNldDtcblxuICAgICAgICAgIGlmIChvZmZzZXQgPj0gc3JjLmxlbmd0aCkge1xuICAgICAgICAgICAgY2ggPSBudWxsO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGluZVN0YXJ0ID0gb2Zmc2V0ICsgMTtcbiAgICAgICAgb2Zmc2V0ID0gTm9kZS5lbmRPZkluZGVudChzcmMsIGxpbmVTdGFydCk7XG5cbiAgICAgICAgaWYgKE5vZGUuYXRCbGFuayhzcmMsIG9mZnNldCkpIHtcbiAgICAgICAgICBjb25zdCB3c0VuZCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0KTtcbiAgICAgICAgICBjb25zdCBuZXh0ID0gc3JjW3dzRW5kXTtcblxuICAgICAgICAgIGlmICghbmV4dCB8fCBuZXh0ID09PSAnXFxuJyB8fCBuZXh0ID09PSAnIycpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IHdzRW5kO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNoID0gc3JjW29mZnNldF07XG4gICAgICAgIGF0TGluZVN0YXJ0ID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFjaCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgaWYgKG9mZnNldCAhPT0gbGluZVN0YXJ0ICsgaW5kZW50ICYmIChhdExpbmVTdGFydCB8fCBjaCAhPT0gJzonKSkge1xuICAgICAgICBpZiAob2Zmc2V0IDwgbGluZVN0YXJ0ICsgaW5kZW50KSB7XG4gICAgICAgICAgaWYgKGxpbmVTdGFydCA+IHN0YXJ0KSBvZmZzZXQgPSBsaW5lU3RhcnQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuZXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBtc2cgPSAnQWxsIGNvbGxlY3Rpb24gaXRlbXMgbXVzdCBzdGFydCBhdCB0aGUgc2FtZSBjb2x1bW4nO1xuICAgICAgICAgIHRoaXMuZXJyb3IgPSBuZXcgWUFNTFN5bnRheEVycm9yKHRoaXMsIG1zZyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGZpcnN0SXRlbS50eXBlID09PSBUeXBlLlNFUV9JVEVNKSB7XG4gICAgICAgIGlmIChjaCAhPT0gJy0nKSB7XG4gICAgICAgICAgaWYgKGxpbmVTdGFydCA+IHN0YXJ0KSBvZmZzZXQgPSBsaW5lU3RhcnQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoY2ggPT09ICctJyAmJiAhdGhpcy5lcnJvcikge1xuICAgICAgICAvLyBtYXAga2V5IG1heSBzdGFydCB3aXRoIC0sIGFzIGxvbmcgYXMgaXQncyBmb2xsb3dlZCBieSBhIG5vbi13aGl0ZXNwYWNlIGNoYXJcbiAgICAgICAgY29uc3QgbmV4dCA9IHNyY1tvZmZzZXQgKyAxXTtcblxuICAgICAgICBpZiAoIW5leHQgfHwgbmV4dCA9PT0gJ1xcbicgfHwgbmV4dCA9PT0gJ1xcdCcgfHwgbmV4dCA9PT0gJyAnKSB7XG4gICAgICAgICAgY29uc3QgbXNnID0gJ0EgY29sbGVjdGlvbiBjYW5ub3QgYmUgYm90aCBhIG1hcHBpbmcgYW5kIGEgc2VxdWVuY2UnO1xuICAgICAgICAgIHRoaXMuZXJyb3IgPSBuZXcgWUFNTFN5bnRheEVycm9yKHRoaXMsIG1zZyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3Qgbm9kZSA9IHBhcnNlTm9kZSh7XG4gICAgICAgIGF0TGluZVN0YXJ0LFxuICAgICAgICBpbkNvbGxlY3Rpb246IHRydWUsXG4gICAgICAgIGluZGVudCxcbiAgICAgICAgbGluZVN0YXJ0LFxuICAgICAgICBwYXJlbnQ6IHRoaXNcbiAgICAgIH0sIG9mZnNldCk7XG4gICAgICBpZiAoIW5vZGUpIHJldHVybiBvZmZzZXQ7IC8vIGF0IG5leHQgZG9jdW1lbnQgc3RhcnRcblxuICAgICAgdGhpcy5pdGVtcy5wdXNoKG5vZGUpO1xuICAgICAgdGhpcy52YWx1ZVJhbmdlLmVuZCA9IG5vZGUudmFsdWVSYW5nZS5lbmQ7XG4gICAgICBvZmZzZXQgPSBOb2RlLm5vcm1hbGl6ZU9mZnNldChzcmMsIG5vZGUucmFuZ2UuZW5kKTtcbiAgICAgIGNoID0gc3JjW29mZnNldF07XG4gICAgICBhdExpbmVTdGFydCA9IGZhbHNlO1xuICAgICAgcHJldkluY2x1ZGVzVHJhaWxpbmdMaW5lcyA9IG5vZGUuaW5jbHVkZXNUcmFpbGluZ0xpbmVzOyAvLyBOZWVkIHRvIHJlc2V0IGxpbmVTdGFydCBhbmQgYXRMaW5lU3RhcnQgaGVyZSBpZiBwcmVjZWRpbmcgbm9kZSdzIHJhbmdlXG4gICAgICAvLyBoYXMgYWR2YW5jZWQgdG8gY2hlY2sgdGhlIGN1cnJlbnQgbGluZSdzIGluZGVudGF0aW9uIGxldmVsXG4gICAgICAvLyAtLSBlZW1lbGkveWFtbCMxMCAmIGVlbWVsaS95YW1sIzM4XG5cbiAgICAgIGlmIChjaCkge1xuICAgICAgICBsZXQgbHMgPSBvZmZzZXQgLSAxO1xuICAgICAgICBsZXQgcHJldiA9IHNyY1tsc107XG5cbiAgICAgICAgd2hpbGUgKHByZXYgPT09ICcgJyB8fCBwcmV2ID09PSAnXFx0JykgcHJldiA9IHNyY1stLWxzXTtcblxuICAgICAgICBpZiAocHJldiA9PT0gJ1xcbicpIHtcbiAgICAgICAgICBsaW5lU3RhcnQgPSBscyArIDE7XG4gICAgICAgICAgYXRMaW5lU3RhcnQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVjID0gZ3JhYkNvbGxlY3Rpb25FbmRDb21tZW50cyhub2RlKTtcbiAgICAgIGlmIChlYykgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkodGhpcy5pdGVtcywgZWMpO1xuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBzZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBzdXBlci5zZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpO1xuICAgIHRoaXMuaXRlbXMuZm9yRWFjaChub2RlID0+IHtcbiAgICAgIG9mZnNldCA9IG5vZGUuc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KTtcbiAgICB9KTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgdG9TdHJpbmcoKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29udGV4dDoge1xuICAgICAgICBzcmNcbiAgICAgIH0sXG4gICAgICBpdGVtcyxcbiAgICAgIHJhbmdlLFxuICAgICAgdmFsdWVcbiAgICB9ID0gdGhpcztcbiAgICBpZiAodmFsdWUgIT0gbnVsbCkgcmV0dXJuIHZhbHVlO1xuICAgIGxldCBzdHIgPSBzcmMuc2xpY2UocmFuZ2Uuc3RhcnQsIGl0ZW1zWzBdLnJhbmdlLnN0YXJ0KSArIFN0cmluZyhpdGVtc1swXSk7XG5cbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBpdGVtID0gaXRlbXNbaV07XG4gICAgICBjb25zdCB7XG4gICAgICAgIGF0TGluZVN0YXJ0LFxuICAgICAgICBpbmRlbnRcbiAgICAgIH0gPSBpdGVtLmNvbnRleHQ7XG4gICAgICBpZiAoYXRMaW5lU3RhcnQpIGZvciAobGV0IGkgPSAwOyBpIDwgaW5kZW50OyArK2kpIHN0ciArPSAnICc7XG4gICAgICBzdHIgKz0gU3RyaW5nKGl0ZW0pO1xuICAgIH1cblxuICAgIHJldHVybiBOb2RlLmFkZFN0cmluZ1Rlcm1pbmF0b3Ioc3JjLCByYW5nZS5lbmQsIHN0cik7XG4gIH1cblxufVxuXG5leHBvcnQgeyBDb2xsZWN0aW9uLCBncmFiQ29sbGVjdGlvbkVuZENvbW1lbnRzIH07XG4iLCJpbXBvcnQgeyBUeXBlIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL1JhbmdlLmpzJztcblxuY2xhc3MgRGlyZWN0aXZlIGV4dGVuZHMgTm9kZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFR5cGUuRElSRUNUSVZFKTtcbiAgICB0aGlzLm5hbWUgPSBudWxsO1xuICB9XG5cbiAgZ2V0IHBhcmFtZXRlcnMoKSB7XG4gICAgY29uc3QgcmF3ID0gdGhpcy5yYXdWYWx1ZTtcbiAgICByZXR1cm4gcmF3ID8gcmF3LnRyaW0oKS5zcGxpdCgvWyBcXHRdKy8pIDogW107XG4gIH1cblxuICBwYXJzZU5hbWUoc3RhcnQpIHtcbiAgICBjb25zdCB7XG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGxldCBvZmZzZXQgPSBzdGFydDtcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0XTtcblxuICAgIHdoaWxlIChjaCAmJiBjaCAhPT0gJ1xcbicgJiYgY2ggIT09ICdcXHQnICYmIGNoICE9PSAnICcpIGNoID0gc3JjW29mZnNldCArPSAxXTtcblxuICAgIHRoaXMubmFtZSA9IHNyYy5zbGljZShzdGFydCwgb2Zmc2V0KTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgcGFyc2VQYXJhbWV0ZXJzKHN0YXJ0KSB7XG4gICAgY29uc3Qge1xuICAgICAgc3JjXG4gICAgfSA9IHRoaXMuY29udGV4dDtcbiAgICBsZXQgb2Zmc2V0ID0gc3RhcnQ7XG4gICAgbGV0IGNoID0gc3JjW29mZnNldF07XG5cbiAgICB3aGlsZSAoY2ggJiYgY2ggIT09ICdcXG4nICYmIGNoICE9PSAnIycpIGNoID0gc3JjW29mZnNldCArPSAxXTtcblxuICAgIHRoaXMudmFsdWVSYW5nZSA9IG5ldyBSYW5nZShzdGFydCwgb2Zmc2V0KTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgcGFyc2UoY29udGV4dCwgc3RhcnQpIHtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIGxldCBvZmZzZXQgPSB0aGlzLnBhcnNlTmFtZShzdGFydCArIDEpO1xuICAgIG9mZnNldCA9IHRoaXMucGFyc2VQYXJhbWV0ZXJzKG9mZnNldCk7XG4gICAgb2Zmc2V0ID0gdGhpcy5wYXJzZUNvbW1lbnQob2Zmc2V0KTtcbiAgICB0aGlzLnJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LCBvZmZzZXQpO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxufVxuXG5leHBvcnQgeyBEaXJlY3RpdmUgfTtcbiIsImltcG9ydCB7IFR5cGUsIENoYXIgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWUFNTFNlbWFudGljRXJyb3IsIFlBTUxTeW50YXhFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBCbGFua0xpbmUgfSBmcm9tICcuL0JsYW5rTGluZS5qcyc7XG5pbXBvcnQgeyBncmFiQ29sbGVjdGlvbkVuZENvbW1lbnRzIH0gZnJvbSAnLi9Db2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IENvbW1lbnQgfSBmcm9tICcuL0NvbW1lbnQuanMnO1xuaW1wb3J0IHsgRGlyZWN0aXZlIH0gZnJvbSAnLi9EaXJlY3RpdmUuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5jbGFzcyBEb2N1bWVudCBleHRlbmRzIE5vZGUge1xuICBzdGF0aWMgc3RhcnRDb21tZW50T3JFbmRCbGFua0xpbmUoc3JjLCBzdGFydCkge1xuICAgIGNvbnN0IG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgc3RhcnQpO1xuICAgIGNvbnN0IGNoID0gc3JjW29mZnNldF07XG4gICAgcmV0dXJuIGNoID09PSAnIycgfHwgY2ggPT09ICdcXG4nID8gb2Zmc2V0IDogc3RhcnQ7XG4gIH1cblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihUeXBlLkRPQ1VNRU5UKTtcbiAgICB0aGlzLmRpcmVjdGl2ZXMgPSBudWxsO1xuICAgIHRoaXMuY29udGVudHMgPSBudWxsO1xuICAgIHRoaXMuZGlyZWN0aXZlc0VuZE1hcmtlciA9IG51bGw7XG4gICAgdGhpcy5kb2N1bWVudEVuZE1hcmtlciA9IG51bGw7XG4gIH1cblxuICBwYXJzZURpcmVjdGl2ZXMoc3RhcnQpIHtcbiAgICBjb25zdCB7XG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIHRoaXMuZGlyZWN0aXZlcyA9IFtdO1xuICAgIGxldCBhdExpbmVTdGFydCA9IHRydWU7XG4gICAgbGV0IGhhc0RpcmVjdGl2ZXMgPSBmYWxzZTtcbiAgICBsZXQgb2Zmc2V0ID0gc3RhcnQ7XG5cbiAgICB3aGlsZSAoIU5vZGUuYXREb2N1bWVudEJvdW5kYXJ5KHNyYywgb2Zmc2V0LCBDaGFyLkRJUkVDVElWRVNfRU5EKSkge1xuICAgICAgb2Zmc2V0ID0gRG9jdW1lbnQuc3RhcnRDb21tZW50T3JFbmRCbGFua0xpbmUoc3JjLCBvZmZzZXQpO1xuXG4gICAgICBzd2l0Y2ggKHNyY1tvZmZzZXRdKSB7XG4gICAgICAgIGNhc2UgJ1xcbic6XG4gICAgICAgICAgaWYgKGF0TGluZVN0YXJ0KSB7XG4gICAgICAgICAgICBjb25zdCBibGFua0xpbmUgPSBuZXcgQmxhbmtMaW5lKCk7XG4gICAgICAgICAgICBvZmZzZXQgPSBibGFua0xpbmUucGFyc2Uoe1xuICAgICAgICAgICAgICBzcmNcbiAgICAgICAgICAgIH0sIG9mZnNldCk7XG5cbiAgICAgICAgICAgIGlmIChvZmZzZXQgPCBzcmMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHRoaXMuZGlyZWN0aXZlcy5wdXNoKGJsYW5rTGluZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9mZnNldCArPSAxO1xuICAgICAgICAgICAgYXRMaW5lU3RhcnQgPSB0cnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJyMnOlxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbW1lbnQgPSBuZXcgQ29tbWVudCgpO1xuICAgICAgICAgICAgb2Zmc2V0ID0gY29tbWVudC5wYXJzZSh7XG4gICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgfSwgb2Zmc2V0KTtcbiAgICAgICAgICAgIHRoaXMuZGlyZWN0aXZlcy5wdXNoKGNvbW1lbnQpO1xuICAgICAgICAgICAgYXRMaW5lU3RhcnQgPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnJSc6XG4gICAgICAgICAge1xuICAgICAgICAgICAgY29uc3QgZGlyZWN0aXZlID0gbmV3IERpcmVjdGl2ZSgpO1xuICAgICAgICAgICAgb2Zmc2V0ID0gZGlyZWN0aXZlLnBhcnNlKHtcbiAgICAgICAgICAgICAgcGFyZW50OiB0aGlzLFxuICAgICAgICAgICAgICBzcmNcbiAgICAgICAgICAgIH0sIG9mZnNldCk7XG4gICAgICAgICAgICB0aGlzLmRpcmVjdGl2ZXMucHVzaChkaXJlY3RpdmUpO1xuICAgICAgICAgICAgaGFzRGlyZWN0aXZlcyA9IHRydWU7XG4gICAgICAgICAgICBhdExpbmVTdGFydCA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmIChoYXNEaXJlY3RpdmVzKSB7XG4gICAgICAgICAgICB0aGlzLmVycm9yID0gbmV3IFlBTUxTZW1hbnRpY0Vycm9yKHRoaXMsICdNaXNzaW5nIGRpcmVjdGl2ZXMtZW5kIGluZGljYXRvciBsaW5lJyk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmRpcmVjdGl2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5jb250ZW50cyA9IHRoaXMuZGlyZWN0aXZlcztcbiAgICAgICAgICAgIHRoaXMuZGlyZWN0aXZlcyA9IFtdO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBvZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNyY1tvZmZzZXRdKSB7XG4gICAgICB0aGlzLmRpcmVjdGl2ZXNFbmRNYXJrZXIgPSBuZXcgUmFuZ2Uob2Zmc2V0LCBvZmZzZXQgKyAzKTtcbiAgICAgIHJldHVybiBvZmZzZXQgKyAzO1xuICAgIH1cblxuICAgIGlmIChoYXNEaXJlY3RpdmVzKSB7XG4gICAgICB0aGlzLmVycm9yID0gbmV3IFlBTUxTZW1hbnRpY0Vycm9yKHRoaXMsICdNaXNzaW5nIGRpcmVjdGl2ZXMtZW5kIGluZGljYXRvciBsaW5lJyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmRpcmVjdGl2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5jb250ZW50cyA9IHRoaXMuZGlyZWN0aXZlcztcbiAgICAgIHRoaXMuZGlyZWN0aXZlcyA9IFtdO1xuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBwYXJzZUNvbnRlbnRzKHN0YXJ0KSB7XG4gICAgY29uc3Qge1xuICAgICAgcGFyc2VOb2RlLFxuICAgICAgc3JjXG4gICAgfSA9IHRoaXMuY29udGV4dDtcbiAgICBpZiAoIXRoaXMuY29udGVudHMpIHRoaXMuY29udGVudHMgPSBbXTtcbiAgICBsZXQgbGluZVN0YXJ0ID0gc3RhcnQ7XG5cbiAgICB3aGlsZSAoc3JjW2xpbmVTdGFydCAtIDFdID09PSAnLScpIGxpbmVTdGFydCAtPSAxO1xuXG4gICAgbGV0IG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgc3RhcnQpO1xuICAgIGxldCBhdExpbmVTdGFydCA9IGxpbmVTdGFydCA9PT0gc3RhcnQ7XG4gICAgdGhpcy52YWx1ZVJhbmdlID0gbmV3IFJhbmdlKG9mZnNldCk7XG5cbiAgICB3aGlsZSAoIU5vZGUuYXREb2N1bWVudEJvdW5kYXJ5KHNyYywgb2Zmc2V0LCBDaGFyLkRPQ1VNRU5UX0VORCkpIHtcbiAgICAgIHN3aXRjaCAoc3JjW29mZnNldF0pIHtcbiAgICAgICAgY2FzZSAnXFxuJzpcbiAgICAgICAgICBpZiAoYXRMaW5lU3RhcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGJsYW5rTGluZSA9IG5ldyBCbGFua0xpbmUoKTtcbiAgICAgICAgICAgIG9mZnNldCA9IGJsYW5rTGluZS5wYXJzZSh7XG4gICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgfSwgb2Zmc2V0KTtcblxuICAgICAgICAgICAgaWYgKG9mZnNldCA8IHNyYy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5jb250ZW50cy5wdXNoKGJsYW5rTGluZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9mZnNldCArPSAxO1xuICAgICAgICAgICAgYXRMaW5lU3RhcnQgPSB0cnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpbmVTdGFydCA9IG9mZnNldDtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICcjJzpcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjb25zdCBjb21tZW50ID0gbmV3IENvbW1lbnQoKTtcbiAgICAgICAgICAgIG9mZnNldCA9IGNvbW1lbnQucGFyc2Uoe1xuICAgICAgICAgICAgICBzcmNcbiAgICAgICAgICAgIH0sIG9mZnNldCk7XG4gICAgICAgICAgICB0aGlzLmNvbnRlbnRzLnB1c2goY29tbWVudCk7XG4gICAgICAgICAgICBhdExpbmVTdGFydCA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNvbnN0IGlFbmQgPSBOb2RlLmVuZE9mSW5kZW50KHNyYywgb2Zmc2V0KTtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSB7XG4gICAgICAgICAgICAgIGF0TGluZVN0YXJ0LFxuICAgICAgICAgICAgICBpbmRlbnQ6IC0xLFxuICAgICAgICAgICAgICBpbkZsb3c6IGZhbHNlLFxuICAgICAgICAgICAgICBpbkNvbGxlY3Rpb246IGZhbHNlLFxuICAgICAgICAgICAgICBsaW5lU3RhcnQsXG4gICAgICAgICAgICAgIHBhcmVudDogdGhpc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBwYXJzZU5vZGUoY29udGV4dCwgaUVuZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB0aGlzLnZhbHVlUmFuZ2UuZW5kID0gaUVuZDsgLy8gYXQgbmV4dCBkb2N1bWVudCBzdGFydFxuXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnRzLnB1c2gobm9kZSk7XG4gICAgICAgICAgICBvZmZzZXQgPSBub2RlLnJhbmdlLmVuZDtcbiAgICAgICAgICAgIGF0TGluZVN0YXJ0ID0gZmFsc2U7XG4gICAgICAgICAgICBjb25zdCBlYyA9IGdyYWJDb2xsZWN0aW9uRW5kQ29tbWVudHMobm9kZSk7XG4gICAgICAgICAgICBpZiAoZWMpIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHRoaXMuY29udGVudHMsIGVjKTtcbiAgICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIG9mZnNldCA9IERvY3VtZW50LnN0YXJ0Q29tbWVudE9yRW5kQmxhbmtMaW5lKHNyYywgb2Zmc2V0KTtcbiAgICB9XG5cbiAgICB0aGlzLnZhbHVlUmFuZ2UuZW5kID0gb2Zmc2V0O1xuXG4gICAgaWYgKHNyY1tvZmZzZXRdKSB7XG4gICAgICB0aGlzLmRvY3VtZW50RW5kTWFya2VyID0gbmV3IFJhbmdlKG9mZnNldCwgb2Zmc2V0ICsgMyk7XG4gICAgICBvZmZzZXQgKz0gMztcblxuICAgICAgaWYgKHNyY1tvZmZzZXRdKSB7XG4gICAgICAgIG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0KTtcblxuICAgICAgICBpZiAoc3JjW29mZnNldF0gPT09ICcjJykge1xuICAgICAgICAgIGNvbnN0IGNvbW1lbnQgPSBuZXcgQ29tbWVudCgpO1xuICAgICAgICAgIG9mZnNldCA9IGNvbW1lbnQucGFyc2Uoe1xuICAgICAgICAgICAgc3JjXG4gICAgICAgICAgfSwgb2Zmc2V0KTtcbiAgICAgICAgICB0aGlzLmNvbnRlbnRzLnB1c2goY29tbWVudCk7XG4gICAgICAgIH1cblxuICAgICAgICBzd2l0Y2ggKHNyY1tvZmZzZXRdKSB7XG4gICAgICAgICAgY2FzZSAnXFxuJzpcbiAgICAgICAgICAgIG9mZnNldCArPSAxO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRoaXMuZXJyb3IgPSBuZXcgWUFNTFN5bnRheEVycm9yKHRoaXMsICdEb2N1bWVudCBlbmQgbWFya2VyIGxpbmUgY2Fubm90IGhhdmUgYSBub24tY29tbWVudCBzdWZmaXgnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cbiAgLyoqXG4gICAqIEBwYXJhbSB7UGFyc2VDb250ZXh0fSBjb250ZXh0XG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydCAtIEluZGV4IG9mIGZpcnN0IGNoYXJhY3RlclxuICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIEluZGV4IG9mIHRoZSBjaGFyYWN0ZXIgYWZ0ZXIgdGhpc1xuICAgKi9cblxuXG4gIHBhcnNlKGNvbnRleHQsIHN0YXJ0KSB7XG4gICAgY29udGV4dC5yb290ID0gdGhpcztcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSBjb250ZXh0O1xuICAgIGxldCBvZmZzZXQgPSBzcmMuY2hhckNvZGVBdChzdGFydCkgPT09IDB4ZmVmZiA/IHN0YXJ0ICsgMSA6IHN0YXJ0OyAvLyBza2lwIEJPTVxuXG4gICAgb2Zmc2V0ID0gdGhpcy5wYXJzZURpcmVjdGl2ZXMob2Zmc2V0KTtcbiAgICBvZmZzZXQgPSB0aGlzLnBhcnNlQ29udGVudHMob2Zmc2V0KTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gc3VwZXIuc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KTtcbiAgICB0aGlzLmRpcmVjdGl2ZXMuZm9yRWFjaChub2RlID0+IHtcbiAgICAgIG9mZnNldCA9IG5vZGUuc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KTtcbiAgICB9KTtcbiAgICBpZiAodGhpcy5kaXJlY3RpdmVzRW5kTWFya2VyKSBvZmZzZXQgPSB0aGlzLmRpcmVjdGl2ZXNFbmRNYXJrZXIuc2V0T3JpZ1JhbmdlKGNyLCBvZmZzZXQpO1xuICAgIHRoaXMuY29udGVudHMuZm9yRWFjaChub2RlID0+IHtcbiAgICAgIG9mZnNldCA9IG5vZGUuc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KTtcbiAgICB9KTtcbiAgICBpZiAodGhpcy5kb2N1bWVudEVuZE1hcmtlcikgb2Zmc2V0ID0gdGhpcy5kb2N1bWVudEVuZE1hcmtlci5zZXRPcmlnUmFuZ2UoY3IsIG9mZnNldCk7XG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIHRvU3RyaW5nKCkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbnRlbnRzLFxuICAgICAgZGlyZWN0aXZlcyxcbiAgICAgIHZhbHVlXG4gICAgfSA9IHRoaXM7XG4gICAgaWYgKHZhbHVlICE9IG51bGwpIHJldHVybiB2YWx1ZTtcbiAgICBsZXQgc3RyID0gZGlyZWN0aXZlcy5qb2luKCcnKTtcblxuICAgIGlmIChjb250ZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAoZGlyZWN0aXZlcy5sZW5ndGggPiAwIHx8IGNvbnRlbnRzWzBdLnR5cGUgPT09IFR5cGUuQ09NTUVOVCkgc3RyICs9ICctLS1cXG4nO1xuICAgICAgc3RyICs9IGNvbnRlbnRzLmpvaW4oJycpO1xuICAgIH1cblxuICAgIGlmIChzdHJbc3RyLmxlbmd0aCAtIDFdICE9PSAnXFxuJykgc3RyICs9ICdcXG4nO1xuICAgIHJldHVybiBzdHI7XG4gIH1cblxufVxuXG5leHBvcnQgeyBEb2N1bWVudCB9O1xuIiwiZnVuY3Rpb24gX2RlZmluZVByb3BlcnR5KG9iaiwga2V5LCB2YWx1ZSkge1xuICBpZiAoa2V5IGluIG9iaikge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIGtleSwge1xuICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgb2JqW2tleV0gPSB2YWx1ZTtcbiAgfVxuXG4gIHJldHVybiBvYmo7XG59XG5cbmV4cG9ydCB7IF9kZWZpbmVQcm9wZXJ0eSBhcyBkZWZpbmVQcm9wZXJ0eSB9O1xuIiwiaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5jbGFzcyBBbGlhcyBleHRlbmRzIE5vZGUge1xuICAvKipcbiAgICogUGFyc2VzIGFuICphbGlhcyBmcm9tIHRoZSBzb3VyY2VcbiAgICpcbiAgICogQHBhcmFtIHtQYXJzZUNvbnRleHR9IGNvbnRleHRcbiAgICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IC0gSW5kZXggb2YgZmlyc3QgY2hhcmFjdGVyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gSW5kZXggb2YgdGhlIGNoYXJhY3RlciBhZnRlciB0aGlzIHNjYWxhclxuICAgKi9cbiAgcGFyc2UoY29udGV4dCwgc3RhcnQpIHtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSBjb250ZXh0O1xuICAgIGxldCBvZmZzZXQgPSBOb2RlLmVuZE9mSWRlbnRpZmllcihzcmMsIHN0YXJ0ICsgMSk7XG4gICAgdGhpcy52YWx1ZVJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0ICsgMSwgb2Zmc2V0KTtcbiAgICBvZmZzZXQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIG9mZnNldCk7XG4gICAgb2Zmc2V0ID0gdGhpcy5wYXJzZUNvbW1lbnQob2Zmc2V0KTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbn1cblxuZXhwb3J0IHsgQWxpYXMgfTtcbiIsImltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWUFNTFNlbWFudGljRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5jb25zdCBDaG9tcCA9IHtcbiAgQ0xJUDogJ0NMSVAnLFxuICBLRUVQOiAnS0VFUCcsXG4gIFNUUklQOiAnU1RSSVAnXG59O1xuY2xhc3MgQmxvY2tWYWx1ZSBleHRlbmRzIE5vZGUge1xuICBjb25zdHJ1Y3Rvcih0eXBlLCBwcm9wcykge1xuICAgIHN1cGVyKHR5cGUsIHByb3BzKTtcbiAgICB0aGlzLmJsb2NrSW5kZW50ID0gbnVsbDtcbiAgICB0aGlzLmNob21waW5nID0gQ2hvbXAuQ0xJUDtcbiAgICB0aGlzLmhlYWRlciA9IG51bGw7XG4gIH1cblxuICBnZXQgaW5jbHVkZXNUcmFpbGluZ0xpbmVzKCkge1xuICAgIHJldHVybiB0aGlzLmNob21waW5nID09PSBDaG9tcC5LRUVQO1xuICB9XG5cbiAgZ2V0IHN0clZhbHVlKCkge1xuICAgIGlmICghdGhpcy52YWx1ZVJhbmdlIHx8ICF0aGlzLmNvbnRleHQpIHJldHVybiBudWxsO1xuICAgIGxldCB7XG4gICAgICBzdGFydCxcbiAgICAgIGVuZFxuICAgIH0gPSB0aGlzLnZhbHVlUmFuZ2U7XG4gICAgY29uc3Qge1xuICAgICAgaW5kZW50LFxuICAgICAgc3JjXG4gICAgfSA9IHRoaXMuY29udGV4dDtcbiAgICBpZiAodGhpcy52YWx1ZVJhbmdlLmlzRW1wdHkoKSkgcmV0dXJuICcnO1xuICAgIGxldCBsYXN0TmV3TGluZSA9IG51bGw7XG4gICAgbGV0IGNoID0gc3JjW2VuZCAtIDFdO1xuXG4gICAgd2hpbGUgKGNoID09PSAnXFxuJyB8fCBjaCA9PT0gJ1xcdCcgfHwgY2ggPT09ICcgJykge1xuICAgICAgZW5kIC09IDE7XG5cbiAgICAgIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICAgICAgaWYgKHRoaXMuY2hvbXBpbmcgPT09IENob21wLktFRVApIGJyZWFrO2Vsc2UgcmV0dXJuICcnOyAvLyBwcm9iYWJseSBuZXZlciBoYXBwZW5zXG4gICAgICB9XG5cbiAgICAgIGlmIChjaCA9PT0gJ1xcbicpIGxhc3ROZXdMaW5lID0gZW5kO1xuICAgICAgY2ggPSBzcmNbZW5kIC0gMV07XG4gICAgfVxuXG4gICAgbGV0IGtlZXBTdGFydCA9IGVuZCArIDE7XG5cbiAgICBpZiAobGFzdE5ld0xpbmUpIHtcbiAgICAgIGlmICh0aGlzLmNob21waW5nID09PSBDaG9tcC5LRUVQKSB7XG4gICAgICAgIGtlZXBTdGFydCA9IGxhc3ROZXdMaW5lO1xuICAgICAgICBlbmQgPSB0aGlzLnZhbHVlUmFuZ2UuZW5kO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW5kID0gbGFzdE5ld0xpbmU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYmkgPSBpbmRlbnQgKyB0aGlzLmJsb2NrSW5kZW50O1xuICAgIGNvbnN0IGZvbGRlZCA9IHRoaXMudHlwZSA9PT0gVHlwZS5CTE9DS19GT0xERUQ7XG4gICAgbGV0IGF0U3RhcnQgPSB0cnVlO1xuICAgIGxldCBzdHIgPSAnJztcbiAgICBsZXQgc2VwID0gJyc7XG4gICAgbGV0IHByZXZNb3JlSW5kZW50ZWQgPSBmYWxzZTtcblxuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJpOyArK2opIHtcbiAgICAgICAgaWYgKHNyY1tpXSAhPT0gJyAnKSBicmVhaztcbiAgICAgICAgaSArPSAxO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjaCA9IHNyY1tpXTtcblxuICAgICAgaWYgKGNoID09PSAnXFxuJykge1xuICAgICAgICBpZiAoc2VwID09PSAnXFxuJykgc3RyICs9ICdcXG4nO2Vsc2Ugc2VwID0gJ1xcbic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBsaW5lRW5kID0gTm9kZS5lbmRPZkxpbmUoc3JjLCBpKTtcbiAgICAgICAgY29uc3QgbGluZSA9IHNyYy5zbGljZShpLCBsaW5lRW5kKTtcbiAgICAgICAgaSA9IGxpbmVFbmQ7XG5cbiAgICAgICAgaWYgKGZvbGRlZCAmJiAoY2ggPT09ICcgJyB8fCBjaCA9PT0gJ1xcdCcpICYmIGkgPCBrZWVwU3RhcnQpIHtcbiAgICAgICAgICBpZiAoc2VwID09PSAnICcpIHNlcCA9ICdcXG4nO2Vsc2UgaWYgKCFwcmV2TW9yZUluZGVudGVkICYmICFhdFN0YXJ0ICYmIHNlcCA9PT0gJ1xcbicpIHNlcCA9ICdcXG5cXG4nO1xuICAgICAgICAgIHN0ciArPSBzZXAgKyBsaW5lOyAvLysgKChsaW5lRW5kIDwgZW5kICYmIHNyY1tsaW5lRW5kXSkgfHwgJycpXG5cbiAgICAgICAgICBzZXAgPSBsaW5lRW5kIDwgZW5kICYmIHNyY1tsaW5lRW5kXSB8fCAnJztcbiAgICAgICAgICBwcmV2TW9yZUluZGVudGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdHIgKz0gc2VwICsgbGluZTtcbiAgICAgICAgICBzZXAgPSBmb2xkZWQgJiYgaSA8IGtlZXBTdGFydCA/ICcgJyA6ICdcXG4nO1xuICAgICAgICAgIHByZXZNb3JlSW5kZW50ZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdFN0YXJ0ICYmIGxpbmUgIT09ICcnKSBhdFN0YXJ0ID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY2hvbXBpbmcgPT09IENob21wLlNUUklQID8gc3RyIDogc3RyICsgJ1xcbic7XG4gIH1cblxuICBwYXJzZUJsb2NrSGVhZGVyKHN0YXJ0KSB7XG4gICAgY29uc3Qge1xuICAgICAgc3JjXG4gICAgfSA9IHRoaXMuY29udGV4dDtcbiAgICBsZXQgb2Zmc2V0ID0gc3RhcnQgKyAxO1xuICAgIGxldCBiaSA9ICcnO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IGNoID0gc3JjW29mZnNldF07XG5cbiAgICAgIHN3aXRjaCAoY2gpIHtcbiAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgdGhpcy5jaG9tcGluZyA9IENob21wLlNUUklQO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJysnOlxuICAgICAgICAgIHRoaXMuY2hvbXBpbmcgPSBDaG9tcC5LRUVQO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJzAnOlxuICAgICAgICBjYXNlICcxJzpcbiAgICAgICAgY2FzZSAnMic6XG4gICAgICAgIGNhc2UgJzMnOlxuICAgICAgICBjYXNlICc0JzpcbiAgICAgICAgY2FzZSAnNSc6XG4gICAgICAgIGNhc2UgJzYnOlxuICAgICAgICBjYXNlICc3JzpcbiAgICAgICAgY2FzZSAnOCc6XG4gICAgICAgIGNhc2UgJzknOlxuICAgICAgICAgIGJpICs9IGNoO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhpcy5ibG9ja0luZGVudCA9IE51bWJlcihiaSkgfHwgbnVsbDtcbiAgICAgICAgICB0aGlzLmhlYWRlciA9IG5ldyBSYW5nZShzdGFydCwgb2Zmc2V0KTtcbiAgICAgICAgICByZXR1cm4gb2Zmc2V0O1xuICAgICAgfVxuXG4gICAgICBvZmZzZXQgKz0gMTtcbiAgICB9XG4gIH1cblxuICBwYXJzZUJsb2NrVmFsdWUoc3RhcnQpIHtcbiAgICBjb25zdCB7XG4gICAgICBpbmRlbnQsXG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGNvbnN0IGV4cGxpY2l0ID0gISF0aGlzLmJsb2NrSW5kZW50O1xuICAgIGxldCBvZmZzZXQgPSBzdGFydDtcbiAgICBsZXQgdmFsdWVFbmQgPSBzdGFydDtcbiAgICBsZXQgbWluQmxvY2tJbmRlbnQgPSAxO1xuXG4gICAgZm9yIChsZXQgY2ggPSBzcmNbb2Zmc2V0XTsgY2ggPT09ICdcXG4nOyBjaCA9IHNyY1tvZmZzZXRdKSB7XG4gICAgICBvZmZzZXQgKz0gMTtcbiAgICAgIGlmIChOb2RlLmF0RG9jdW1lbnRCb3VuZGFyeShzcmMsIG9mZnNldCkpIGJyZWFrO1xuICAgICAgY29uc3QgZW5kID0gTm9kZS5lbmRPZkJsb2NrSW5kZW50KHNyYywgaW5kZW50LCBvZmZzZXQpOyAvLyBzaG91bGQgbm90IGluY2x1ZGUgdGFiP1xuXG4gICAgICBpZiAoZW5kID09PSBudWxsKSBicmVhaztcbiAgICAgIGNvbnN0IGNoID0gc3JjW2VuZF07XG4gICAgICBjb25zdCBsaW5lSW5kZW50ID0gZW5kIC0gKG9mZnNldCArIGluZGVudCk7XG5cbiAgICAgIGlmICghdGhpcy5ibG9ja0luZGVudCkge1xuICAgICAgICAvLyBubyBleHBsaWNpdCBibG9jayBpbmRlbnQsIG5vbmUgeWV0IGRldGVjdGVkXG4gICAgICAgIGlmIChzcmNbZW5kXSAhPT0gJ1xcbicpIHtcbiAgICAgICAgICAvLyBmaXJzdCBsaW5lIHdpdGggbm9uLXdoaXRlc3BhY2UgY29udGVudFxuICAgICAgICAgIGlmIChsaW5lSW5kZW50IDwgbWluQmxvY2tJbmRlbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IG1zZyA9ICdCbG9jayBzY2FsYXJzIHdpdGggbW9yZS1pbmRlbnRlZCBsZWFkaW5nIGVtcHR5IGxpbmVzIG11c3QgdXNlIGFuIGV4cGxpY2l0IGluZGVudGF0aW9uIGluZGljYXRvcic7XG4gICAgICAgICAgICB0aGlzLmVycm9yID0gbmV3IFlBTUxTZW1hbnRpY0Vycm9yKHRoaXMsIG1zZyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5ibG9ja0luZGVudCA9IGxpbmVJbmRlbnQ7XG4gICAgICAgIH0gZWxzZSBpZiAobGluZUluZGVudCA+IG1pbkJsb2NrSW5kZW50KSB7XG4gICAgICAgICAgLy8gZW1wdHkgbGluZSB3aXRoIG1vcmUgd2hpdGVzcGFjZVxuICAgICAgICAgIG1pbkJsb2NrSW5kZW50ID0gbGluZUluZGVudDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjaCAmJiBjaCAhPT0gJ1xcbicgJiYgbGluZUluZGVudCA8IHRoaXMuYmxvY2tJbmRlbnQpIHtcbiAgICAgICAgaWYgKHNyY1tlbmRdID09PSAnIycpIGJyZWFrO1xuXG4gICAgICAgIGlmICghdGhpcy5lcnJvcikge1xuICAgICAgICAgIGNvbnN0IHNyYyA9IGV4cGxpY2l0ID8gJ2V4cGxpY2l0IGluZGVudGF0aW9uIGluZGljYXRvcicgOiAnZmlyc3QgbGluZSc7XG4gICAgICAgICAgY29uc3QgbXNnID0gXCJCbG9jayBzY2FsYXJzIG11c3Qgbm90IGJlIGxlc3MgaW5kZW50ZWQgdGhhbiB0aGVpciBcIi5jb25jYXQoc3JjKTtcbiAgICAgICAgICB0aGlzLmVycm9yID0gbmV3IFlBTUxTZW1hbnRpY0Vycm9yKHRoaXMsIG1zZyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHNyY1tlbmRdID09PSAnXFxuJykge1xuICAgICAgICBvZmZzZXQgPSBlbmQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvZmZzZXQgPSB2YWx1ZUVuZCA9IE5vZGUuZW5kT2ZMaW5lKHNyYywgZW5kKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5jaG9tcGluZyAhPT0gQ2hvbXAuS0VFUCkge1xuICAgICAgb2Zmc2V0ID0gc3JjW3ZhbHVlRW5kXSA/IHZhbHVlRW5kICsgMSA6IHZhbHVlRW5kO1xuICAgIH1cblxuICAgIHRoaXMudmFsdWVSYW5nZSA9IG5ldyBSYW5nZShzdGFydCArIDEsIG9mZnNldCk7XG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuICAvKipcbiAgICogUGFyc2VzIGEgYmxvY2sgdmFsdWUgZnJvbSB0aGUgc291cmNlXG4gICAqXG4gICAqIEFjY2VwdGVkIGZvcm1zIGFyZTpcbiAgICogYGBgXG4gICAqIEJTXG4gICAqIGJsb2NrXG4gICAqIGxpbmVzXG4gICAqXG4gICAqIEJTICNjb21tZW50XG4gICAqIGJsb2NrXG4gICAqIGxpbmVzXG4gICAqIGBgYFxuICAgKiB3aGVyZSB0aGUgYmxvY2sgc3R5bGUgQlMgbWF0Y2hlcyB0aGUgcmVnZXhwIGBbfD5dWy0rMS05XSpgIGFuZCBibG9jayBsaW5lc1xuICAgKiBhcmUgZW1wdHkgb3IgaGF2ZSBhbiBpbmRlbnQgbGV2ZWwgZ3JlYXRlciB0aGFuIGBpbmRlbnRgLlxuICAgKlxuICAgKiBAcGFyYW0ge1BhcnNlQ29udGV4dH0gY29udGV4dFxuICAgKiBAcGFyYW0ge251bWJlcn0gc3RhcnQgLSBJbmRleCBvZiBmaXJzdCBjaGFyYWN0ZXJcbiAgICogQHJldHVybnMge251bWJlcn0gLSBJbmRleCBvZiB0aGUgY2hhcmFjdGVyIGFmdGVyIHRoaXMgYmxvY2tcbiAgICovXG5cblxuICBwYXJzZShjb250ZXh0LCBzdGFydCkge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgY29uc3Qge1xuICAgICAgc3JjXG4gICAgfSA9IGNvbnRleHQ7XG4gICAgbGV0IG9mZnNldCA9IHRoaXMucGFyc2VCbG9ja0hlYWRlcihzdGFydCk7XG4gICAgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IHRoaXMucGFyc2VDb21tZW50KG9mZnNldCk7XG4gICAgb2Zmc2V0ID0gdGhpcy5wYXJzZUJsb2NrVmFsdWUob2Zmc2V0KTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gc3VwZXIuc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KTtcbiAgICByZXR1cm4gdGhpcy5oZWFkZXIgPyB0aGlzLmhlYWRlci5zZXRPcmlnUmFuZ2UoY3IsIG9mZnNldCkgOiBvZmZzZXQ7XG4gIH1cblxufVxuXG5leHBvcnQgeyBCbG9ja1ZhbHVlLCBDaG9tcCB9O1xuIiwiaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MU2VtYW50aWNFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBCbGFua0xpbmUgfSBmcm9tICcuL0JsYW5rTGluZS5qcyc7XG5pbXBvcnQgeyBDb21tZW50IH0gZnJvbSAnLi9Db21tZW50LmpzJztcbmltcG9ydCB7IE5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL1JhbmdlLmpzJztcblxuY2xhc3MgRmxvd0NvbGxlY3Rpb24gZXh0ZW5kcyBOb2RlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgcHJvcHMpIHtcbiAgICBzdXBlcih0eXBlLCBwcm9wcyk7XG4gICAgdGhpcy5pdGVtcyA9IG51bGw7XG4gIH1cblxuICBwcmV2Tm9kZUlzSnNvbkxpa2UoaWR4ID0gdGhpcy5pdGVtcy5sZW5ndGgpIHtcbiAgICBjb25zdCBub2RlID0gdGhpcy5pdGVtc1tpZHggLSAxXTtcbiAgICByZXR1cm4gISFub2RlICYmIChub2RlLmpzb25MaWtlIHx8IG5vZGUudHlwZSA9PT0gVHlwZS5DT01NRU5UICYmIHRoaXMucHJldk5vZGVJc0pzb25MaWtlKGlkeCAtIDEpKTtcbiAgfVxuICAvKipcbiAgICogQHBhcmFtIHtQYXJzZUNvbnRleHR9IGNvbnRleHRcbiAgICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IC0gSW5kZXggb2YgZmlyc3QgY2hhcmFjdGVyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gSW5kZXggb2YgdGhlIGNoYXJhY3RlciBhZnRlciB0aGlzXG4gICAqL1xuXG5cbiAgcGFyc2UoY29udGV4dCwgc3RhcnQpIHtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIGNvbnN0IHtcbiAgICAgIHBhcnNlTm9kZSxcbiAgICAgIHNyY1xuICAgIH0gPSBjb250ZXh0O1xuICAgIGxldCB7XG4gICAgICBpbmRlbnQsXG4gICAgICBsaW5lU3RhcnRcbiAgICB9ID0gY29udGV4dDtcbiAgICBsZXQgY2hhciA9IHNyY1tzdGFydF07IC8vIHsgb3IgW1xuXG4gICAgdGhpcy5pdGVtcyA9IFt7XG4gICAgICBjaGFyLFxuICAgICAgb2Zmc2V0OiBzdGFydFxuICAgIH1dO1xuICAgIGxldCBvZmZzZXQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIHN0YXJ0ICsgMSk7XG4gICAgY2hhciA9IHNyY1tvZmZzZXRdO1xuXG4gICAgd2hpbGUgKGNoYXIgJiYgY2hhciAhPT0gJ10nICYmIGNoYXIgIT09ICd9Jykge1xuICAgICAgc3dpdGNoIChjaGFyKSB7XG4gICAgICAgIGNhc2UgJ1xcbic6XG4gICAgICAgICAge1xuICAgICAgICAgICAgbGluZVN0YXJ0ID0gb2Zmc2V0ICsgMTtcbiAgICAgICAgICAgIGNvbnN0IHdzRW5kID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBsaW5lU3RhcnQpO1xuXG4gICAgICAgICAgICBpZiAoc3JjW3dzRW5kXSA9PT0gJ1xcbicpIHtcbiAgICAgICAgICAgICAgY29uc3QgYmxhbmtMaW5lID0gbmV3IEJsYW5rTGluZSgpO1xuICAgICAgICAgICAgICBsaW5lU3RhcnQgPSBibGFua0xpbmUucGFyc2Uoe1xuICAgICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgICB9LCBsaW5lU3RhcnQpO1xuICAgICAgICAgICAgICB0aGlzLml0ZW1zLnB1c2goYmxhbmtMaW5lKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb2Zmc2V0ID0gTm9kZS5lbmRPZkluZGVudChzcmMsIGxpbmVTdGFydCk7XG5cbiAgICAgICAgICAgIGlmIChvZmZzZXQgPD0gbGluZVN0YXJ0ICsgaW5kZW50KSB7XG4gICAgICAgICAgICAgIGNoYXIgPSBzcmNbb2Zmc2V0XTtcblxuICAgICAgICAgICAgICBpZiAob2Zmc2V0IDwgbGluZVN0YXJ0ICsgaW5kZW50IHx8IGNoYXIgIT09ICddJyAmJiBjaGFyICE9PSAnfScpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtc2cgPSAnSW5zdWZmaWNpZW50IGluZGVudGF0aW9uIGluIGZsb3cgY29sbGVjdGlvbic7XG4gICAgICAgICAgICAgICAgdGhpcy5lcnJvciA9IG5ldyBZQU1MU2VtYW50aWNFcnJvcih0aGlzLCBtc2cpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJywnOlxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuaXRlbXMucHVzaCh7XG4gICAgICAgICAgICAgIGNoYXIsXG4gICAgICAgICAgICAgIG9mZnNldFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBvZmZzZXQgKz0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnIyc6XG4gICAgICAgICAge1xuICAgICAgICAgICAgY29uc3QgY29tbWVudCA9IG5ldyBDb21tZW50KCk7XG4gICAgICAgICAgICBvZmZzZXQgPSBjb21tZW50LnBhcnNlKHtcbiAgICAgICAgICAgICAgc3JjXG4gICAgICAgICAgICB9LCBvZmZzZXQpO1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5wdXNoKGNvbW1lbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICc/JzpcbiAgICAgICAgY2FzZSAnOic6XG4gICAgICAgICAge1xuICAgICAgICAgICAgY29uc3QgbmV4dCA9IHNyY1tvZmZzZXQgKyAxXTtcblxuICAgICAgICAgICAgaWYgKG5leHQgPT09ICdcXG4nIHx8IG5leHQgPT09ICdcXHQnIHx8IG5leHQgPT09ICcgJyB8fCBuZXh0ID09PSAnLCcgfHwgLy8gaW4tZmxvdyA6IGFmdGVyIEpTT04tbGlrZSBrZXkgZG9lcyBub3QgbmVlZCB0byBiZSBmb2xsb3dlZCBieSB3aGl0ZXNwYWNlXG4gICAgICAgICAgICBjaGFyID09PSAnOicgJiYgdGhpcy5wcmV2Tm9kZUlzSnNvbkxpa2UoKSkge1xuICAgICAgICAgICAgICB0aGlzLml0ZW1zLnB1c2goe1xuICAgICAgICAgICAgICAgIGNoYXIsXG4gICAgICAgICAgICAgICAgb2Zmc2V0XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBvZmZzZXQgKz0gMTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAvLyBmYWxsdGhyb3VnaFxuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHBhcnNlTm9kZSh7XG4gICAgICAgICAgICAgIGF0TGluZVN0YXJ0OiBmYWxzZSxcbiAgICAgICAgICAgICAgaW5Db2xsZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgICAgICAgaW5GbG93OiB0cnVlLFxuICAgICAgICAgICAgICBpbmRlbnQ6IC0xLFxuICAgICAgICAgICAgICBsaW5lU3RhcnQsXG4gICAgICAgICAgICAgIHBhcmVudDogdGhpc1xuICAgICAgICAgICAgfSwgb2Zmc2V0KTtcblxuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgIC8vIGF0IG5leHQgZG9jdW1lbnQgc3RhcnRcbiAgICAgICAgICAgICAgdGhpcy52YWx1ZVJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LCBvZmZzZXQpO1xuICAgICAgICAgICAgICByZXR1cm4gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLml0ZW1zLnB1c2gobm9kZSk7XG4gICAgICAgICAgICBvZmZzZXQgPSBOb2RlLm5vcm1hbGl6ZU9mZnNldChzcmMsIG5vZGUucmFuZ2UuZW5kKTtcbiAgICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0KTtcbiAgICAgIGNoYXIgPSBzcmNbb2Zmc2V0XTtcbiAgICB9XG5cbiAgICB0aGlzLnZhbHVlUmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIG9mZnNldCArIDEpO1xuXG4gICAgaWYgKGNoYXIpIHtcbiAgICAgIHRoaXMuaXRlbXMucHVzaCh7XG4gICAgICAgIGNoYXIsXG4gICAgICAgIG9mZnNldFxuICAgICAgfSk7XG4gICAgICBvZmZzZXQgPSBOb2RlLmVuZE9mV2hpdGVTcGFjZShzcmMsIG9mZnNldCArIDEpO1xuICAgICAgb2Zmc2V0ID0gdGhpcy5wYXJzZUNvbW1lbnQob2Zmc2V0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gc3VwZXIuc2V0T3JpZ1Jhbmdlcyhjciwgb2Zmc2V0KTtcbiAgICB0aGlzLml0ZW1zLmZvckVhY2gobm9kZSA9PiB7XG4gICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgICAgb2Zmc2V0ID0gbm9kZS5zZXRPcmlnUmFuZ2VzKGNyLCBvZmZzZXQpO1xuICAgICAgfSBlbHNlIGlmIChjci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgbm9kZS5vcmlnT2Zmc2V0ID0gbm9kZS5vZmZzZXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgaSA9IG9mZnNldDtcblxuICAgICAgICB3aGlsZSAoaSA8IGNyLmxlbmd0aCkge1xuICAgICAgICAgIGlmIChjcltpXSA+IG5vZGUub2Zmc2V0KSBicmVhaztlbHNlICsraTtcbiAgICAgICAgfVxuXG4gICAgICAgIG5vZGUub3JpZ09mZnNldCA9IG5vZGUub2Zmc2V0ICsgaTtcbiAgICAgICAgb2Zmc2V0ID0gaTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgdG9TdHJpbmcoKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29udGV4dDoge1xuICAgICAgICBzcmNcbiAgICAgIH0sXG4gICAgICBpdGVtcyxcbiAgICAgIHJhbmdlLFxuICAgICAgdmFsdWVcbiAgICB9ID0gdGhpcztcbiAgICBpZiAodmFsdWUgIT0gbnVsbCkgcmV0dXJuIHZhbHVlO1xuICAgIGNvbnN0IG5vZGVzID0gaXRlbXMuZmlsdGVyKGl0ZW0gPT4gaXRlbSBpbnN0YW5jZW9mIE5vZGUpO1xuICAgIGxldCBzdHIgPSAnJztcbiAgICBsZXQgcHJldkVuZCA9IHJhbmdlLnN0YXJ0O1xuICAgIG5vZGVzLmZvckVhY2gobm9kZSA9PiB7XG4gICAgICBjb25zdCBwcmVmaXggPSBzcmMuc2xpY2UocHJldkVuZCwgbm9kZS5yYW5nZS5zdGFydCk7XG4gICAgICBwcmV2RW5kID0gbm9kZS5yYW5nZS5lbmQ7XG4gICAgICBzdHIgKz0gcHJlZml4ICsgU3RyaW5nKG5vZGUpO1xuXG4gICAgICBpZiAoc3RyW3N0ci5sZW5ndGggLSAxXSA9PT0gJ1xcbicgJiYgc3JjW3ByZXZFbmQgLSAxXSAhPT0gJ1xcbicgJiYgc3JjW3ByZXZFbmRdID09PSAnXFxuJykge1xuICAgICAgICAvLyBDb21tZW50IHJhbmdlIGRvZXMgbm90IGluY2x1ZGUgdGhlIHRlcm1pbmFsIG5ld2xpbmUsIGJ1dCBpdHNcbiAgICAgICAgLy8gc3RyaW5naWZpZWQgdmFsdWUgZG9lcy4gV2l0aG91dCB0aGlzIGZpeCwgbmV3bGluZXMgYXQgY29tbWVudCBlbmRzXG4gICAgICAgIC8vIGdldCBkdXBsaWNhdGVkLlxuICAgICAgICBwcmV2RW5kICs9IDE7XG4gICAgICB9XG4gICAgfSk7XG4gICAgc3RyICs9IHNyYy5zbGljZShwcmV2RW5kLCByYW5nZS5lbmQpO1xuICAgIHJldHVybiBOb2RlLmFkZFN0cmluZ1Rlcm1pbmF0b3Ioc3JjLCByYW5nZS5lbmQsIHN0cik7XG4gIH1cblxufVxuXG5leHBvcnQgeyBGbG93Q29sbGVjdGlvbiB9O1xuIiwiaW1wb3J0IHsgWUFNTFNlbWFudGljRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4vUmFuZ2UuanMnO1xuXG5jbGFzcyBQbGFpblZhbHVlIGV4dGVuZHMgTm9kZSB7XG4gIHN0YXRpYyBlbmRPZkxpbmUoc3JjLCBzdGFydCwgaW5GbG93KSB7XG4gICAgbGV0IGNoID0gc3JjW3N0YXJ0XTtcbiAgICBsZXQgb2Zmc2V0ID0gc3RhcnQ7XG5cbiAgICB3aGlsZSAoY2ggJiYgY2ggIT09ICdcXG4nKSB7XG4gICAgICBpZiAoaW5GbG93ICYmIChjaCA9PT0gJ1snIHx8IGNoID09PSAnXScgfHwgY2ggPT09ICd7JyB8fCBjaCA9PT0gJ30nIHx8IGNoID09PSAnLCcpKSBicmVhaztcbiAgICAgIGNvbnN0IG5leHQgPSBzcmNbb2Zmc2V0ICsgMV07XG4gICAgICBpZiAoY2ggPT09ICc6JyAmJiAoIW5leHQgfHwgbmV4dCA9PT0gJ1xcbicgfHwgbmV4dCA9PT0gJ1xcdCcgfHwgbmV4dCA9PT0gJyAnIHx8IGluRmxvdyAmJiBuZXh0ID09PSAnLCcpKSBicmVhaztcbiAgICAgIGlmICgoY2ggPT09ICcgJyB8fCBjaCA9PT0gJ1xcdCcpICYmIG5leHQgPT09ICcjJykgYnJlYWs7XG4gICAgICBvZmZzZXQgKz0gMTtcbiAgICAgIGNoID0gbmV4dDtcbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgZ2V0IHN0clZhbHVlKCkge1xuICAgIGlmICghdGhpcy52YWx1ZVJhbmdlIHx8ICF0aGlzLmNvbnRleHQpIHJldHVybiBudWxsO1xuICAgIGxldCB7XG4gICAgICBzdGFydCxcbiAgICAgIGVuZFxuICAgIH0gPSB0aGlzLnZhbHVlUmFuZ2U7XG4gICAgY29uc3Qge1xuICAgICAgc3JjXG4gICAgfSA9IHRoaXMuY29udGV4dDtcbiAgICBsZXQgY2ggPSBzcmNbZW5kIC0gMV07XG5cbiAgICB3aGlsZSAoc3RhcnQgPCBlbmQgJiYgKGNoID09PSAnXFxuJyB8fCBjaCA9PT0gJ1xcdCcgfHwgY2ggPT09ICcgJykpIGNoID0gc3JjWy0tZW5kIC0gMV07XG5cbiAgICBsZXQgc3RyID0gJyc7XG5cbiAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgICAgY29uc3QgY2ggPSBzcmNbaV07XG5cbiAgICAgIGlmIChjaCA9PT0gJ1xcbicpIHtcbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgIGZvbGQsXG4gICAgICAgICAgb2Zmc2V0XG4gICAgICAgIH0gPSBOb2RlLmZvbGROZXdsaW5lKHNyYywgaSwgLTEpO1xuICAgICAgICBzdHIgKz0gZm9sZDtcbiAgICAgICAgaSA9IG9mZnNldDtcbiAgICAgIH0gZWxzZSBpZiAoY2ggPT09ICcgJyB8fCBjaCA9PT0gJ1xcdCcpIHtcbiAgICAgICAgLy8gdHJpbSB0cmFpbGluZyB3aGl0ZXNwYWNlXG4gICAgICAgIGNvbnN0IHdzU3RhcnQgPSBpO1xuICAgICAgICBsZXQgbmV4dCA9IHNyY1tpICsgMV07XG5cbiAgICAgICAgd2hpbGUgKGkgPCBlbmQgJiYgKG5leHQgPT09ICcgJyB8fCBuZXh0ID09PSAnXFx0JykpIHtcbiAgICAgICAgICBpICs9IDE7XG4gICAgICAgICAgbmV4dCA9IHNyY1tpICsgMV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV4dCAhPT0gJ1xcbicpIHN0ciArPSBpID4gd3NTdGFydCA/IHNyYy5zbGljZSh3c1N0YXJ0LCBpICsgMSkgOiBjaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBjaDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjaDAgPSBzcmNbc3RhcnRdO1xuXG4gICAgc3dpdGNoIChjaDApIHtcbiAgICAgIGNhc2UgJ1xcdCc6XG4gICAgICAgIHtcbiAgICAgICAgICBjb25zdCBtc2cgPSAnUGxhaW4gdmFsdWUgY2Fubm90IHN0YXJ0IHdpdGggYSB0YWIgY2hhcmFjdGVyJztcbiAgICAgICAgICBjb25zdCBlcnJvcnMgPSBbbmV3IFlBTUxTZW1hbnRpY0Vycm9yKHRoaXMsIG1zZyldO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBlcnJvcnMsXG4gICAgICAgICAgICBzdHJcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgIGNhc2UgJ0AnOlxuICAgICAgY2FzZSAnYCc6XG4gICAgICAgIHtcbiAgICAgICAgICBjb25zdCBtc2cgPSBcIlBsYWluIHZhbHVlIGNhbm5vdCBzdGFydCB3aXRoIHJlc2VydmVkIGNoYXJhY3RlciBcIi5jb25jYXQoY2gwKTtcbiAgICAgICAgICBjb25zdCBlcnJvcnMgPSBbbmV3IFlBTUxTZW1hbnRpY0Vycm9yKHRoaXMsIG1zZyldO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBlcnJvcnMsXG4gICAgICAgICAgICBzdHJcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VCbG9ja1ZhbHVlKHN0YXJ0KSB7XG4gICAgY29uc3Qge1xuICAgICAgaW5kZW50LFxuICAgICAgaW5GbG93LFxuICAgICAgc3JjXG4gICAgfSA9IHRoaXMuY29udGV4dDtcbiAgICBsZXQgb2Zmc2V0ID0gc3RhcnQ7XG4gICAgbGV0IHZhbHVlRW5kID0gc3RhcnQ7XG5cbiAgICBmb3IgKGxldCBjaCA9IHNyY1tvZmZzZXRdOyBjaCA9PT0gJ1xcbic7IGNoID0gc3JjW29mZnNldF0pIHtcbiAgICAgIGlmIChOb2RlLmF0RG9jdW1lbnRCb3VuZGFyeShzcmMsIG9mZnNldCArIDEpKSBicmVhaztcbiAgICAgIGNvbnN0IGVuZCA9IE5vZGUuZW5kT2ZCbG9ja0luZGVudChzcmMsIGluZGVudCwgb2Zmc2V0ICsgMSk7XG4gICAgICBpZiAoZW5kID09PSBudWxsIHx8IHNyY1tlbmRdID09PSAnIycpIGJyZWFrO1xuXG4gICAgICBpZiAoc3JjW2VuZF0gPT09ICdcXG4nKSB7XG4gICAgICAgIG9mZnNldCA9IGVuZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlRW5kID0gUGxhaW5WYWx1ZS5lbmRPZkxpbmUoc3JjLCBlbmQsIGluRmxvdyk7XG4gICAgICAgIG9mZnNldCA9IHZhbHVlRW5kO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLnZhbHVlUmFuZ2UuaXNFbXB0eSgpKSB0aGlzLnZhbHVlUmFuZ2Uuc3RhcnQgPSBzdGFydDtcbiAgICB0aGlzLnZhbHVlUmFuZ2UuZW5kID0gdmFsdWVFbmQ7XG4gICAgcmV0dXJuIHZhbHVlRW5kO1xuICB9XG4gIC8qKlxuICAgKiBQYXJzZXMgYSBwbGFpbiB2YWx1ZSBmcm9tIHRoZSBzb3VyY2VcbiAgICpcbiAgICogQWNjZXB0ZWQgZm9ybXMgYXJlOlxuICAgKiBgYGBcbiAgICogI2NvbW1lbnRcbiAgICpcbiAgICogZmlyc3QgbGluZVxuICAgKlxuICAgKiBmaXJzdCBsaW5lICNjb21tZW50XG4gICAqXG4gICAqIGZpcnN0IGxpbmVcbiAgICogYmxvY2tcbiAgICogbGluZXNcbiAgICpcbiAgICogI2NvbW1lbnRcbiAgICogYmxvY2tcbiAgICogbGluZXNcbiAgICogYGBgXG4gICAqIHdoZXJlIGJsb2NrIGxpbmVzIGFyZSBlbXB0eSBvciBoYXZlIGFuIGluZGVudCBsZXZlbCBncmVhdGVyIHRoYW4gYGluZGVudGAuXG4gICAqXG4gICAqIEBwYXJhbSB7UGFyc2VDb250ZXh0fSBjb250ZXh0XG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydCAtIEluZGV4IG9mIGZpcnN0IGNoYXJhY3RlclxuICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIEluZGV4IG9mIHRoZSBjaGFyYWN0ZXIgYWZ0ZXIgdGhpcyBzY2FsYXIsIG1heSBiZSBgXFxuYFxuICAgKi9cblxuXG4gIHBhcnNlKGNvbnRleHQsIHN0YXJ0KSB7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICBjb25zdCB7XG4gICAgICBpbkZsb3csXG4gICAgICBzcmNcbiAgICB9ID0gY29udGV4dDtcbiAgICBsZXQgb2Zmc2V0ID0gc3RhcnQ7XG4gICAgY29uc3QgY2ggPSBzcmNbb2Zmc2V0XTtcblxuICAgIGlmIChjaCAmJiBjaCAhPT0gJyMnICYmIGNoICE9PSAnXFxuJykge1xuICAgICAgb2Zmc2V0ID0gUGxhaW5WYWx1ZS5lbmRPZkxpbmUoc3JjLCBzdGFydCwgaW5GbG93KTtcbiAgICB9XG5cbiAgICB0aGlzLnZhbHVlUmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIG9mZnNldCk7XG4gICAgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IHRoaXMucGFyc2VDb21tZW50KG9mZnNldCk7XG5cbiAgICBpZiAoIXRoaXMuaGFzQ29tbWVudCB8fCB0aGlzLnZhbHVlUmFuZ2UuaXNFbXB0eSgpKSB7XG4gICAgICBvZmZzZXQgPSB0aGlzLnBhcnNlQmxvY2tWYWx1ZShvZmZzZXQpO1xuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxufVxuXG5leHBvcnQgeyBQbGFpblZhbHVlIH07XG4iLCJpbXBvcnQgeyBZQU1MU3ludGF4RXJyb3IsIFlBTUxTZW1hbnRpY0Vycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IE5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL1JhbmdlLmpzJztcblxuY2xhc3MgUXVvdGVEb3VibGUgZXh0ZW5kcyBOb2RlIHtcbiAgc3RhdGljIGVuZE9mUXVvdGUoc3JjLCBvZmZzZXQpIHtcbiAgICBsZXQgY2ggPSBzcmNbb2Zmc2V0XTtcblxuICAgIHdoaWxlIChjaCAmJiBjaCAhPT0gJ1wiJykge1xuICAgICAgb2Zmc2V0ICs9IGNoID09PSAnXFxcXCcgPyAyIDogMTtcbiAgICAgIGNoID0gc3JjW29mZnNldF07XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldCArIDE7XG4gIH1cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtzdHJpbmcgfCB7IHN0cjogc3RyaW5nLCBlcnJvcnM6IFlBTUxTeW50YXhFcnJvcltdIH19XG4gICAqL1xuXG5cbiAgZ2V0IHN0clZhbHVlKCkge1xuICAgIGlmICghdGhpcy52YWx1ZVJhbmdlIHx8ICF0aGlzLmNvbnRleHQpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IGVycm9ycyA9IFtdO1xuICAgIGNvbnN0IHtcbiAgICAgIHN0YXJ0LFxuICAgICAgZW5kXG4gICAgfSA9IHRoaXMudmFsdWVSYW5nZTtcbiAgICBjb25zdCB7XG4gICAgICBpbmRlbnQsXG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGlmIChzcmNbZW5kIC0gMV0gIT09ICdcIicpIGVycm9ycy5wdXNoKG5ldyBZQU1MU3ludGF4RXJyb3IodGhpcywgJ01pc3NpbmcgY2xvc2luZyBcInF1b3RlJykpOyAvLyBVc2luZyBTdHJpbmcjcmVwbGFjZSBpcyB0b28gcGFpbmZ1bCB3aXRoIGVzY2FwZWQgbmV3bGluZXMgcHJlY2VkZWQgYnlcbiAgICAvLyBlc2NhcGVkIGJhY2tzbGFzaGVzOyBhbHNvLCB0aGlzIHNob3VsZCBiZSBmYXN0ZXIuXG5cbiAgICBsZXQgc3RyID0gJyc7XG5cbiAgICBmb3IgKGxldCBpID0gc3RhcnQgKyAxOyBpIDwgZW5kIC0gMTsgKytpKSB7XG4gICAgICBjb25zdCBjaCA9IHNyY1tpXTtcblxuICAgICAgaWYgKGNoID09PSAnXFxuJykge1xuICAgICAgICBpZiAoTm9kZS5hdERvY3VtZW50Qm91bmRhcnkoc3JjLCBpICsgMSkpIGVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcih0aGlzLCAnRG9jdW1lbnQgYm91bmRhcnkgaW5kaWNhdG9ycyBhcmUgbm90IGFsbG93ZWQgd2l0aGluIHN0cmluZyB2YWx1ZXMnKSk7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICBmb2xkLFxuICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICBlcnJvclxuICAgICAgICB9ID0gTm9kZS5mb2xkTmV3bGluZShzcmMsIGksIGluZGVudCk7XG4gICAgICAgIHN0ciArPSBmb2xkO1xuICAgICAgICBpID0gb2Zmc2V0O1xuICAgICAgICBpZiAoZXJyb3IpIGVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcih0aGlzLCAnTXVsdGktbGluZSBkb3VibGUtcXVvdGVkIHN0cmluZyBuZWVkcyB0byBiZSBzdWZmaWNpZW50bHkgaW5kZW50ZWQnKSk7XG4gICAgICB9IGVsc2UgaWYgKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSArPSAxO1xuXG4gICAgICAgIHN3aXRjaCAoc3JjW2ldKSB7XG4gICAgICAgICAgY2FzZSAnMCc6XG4gICAgICAgICAgICBzdHIgKz0gJ1xcMCc7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBudWxsIGNoYXJhY3RlclxuXG4gICAgICAgICAgY2FzZSAnYSc6XG4gICAgICAgICAgICBzdHIgKz0gJ1xceDA3JztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIGJlbGwgY2hhcmFjdGVyXG5cbiAgICAgICAgICBjYXNlICdiJzpcbiAgICAgICAgICAgIHN0ciArPSAnXFxiJztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIGJhY2tzcGFjZVxuXG4gICAgICAgICAgY2FzZSAnZSc6XG4gICAgICAgICAgICBzdHIgKz0gJ1xceDFiJztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIGVzY2FwZSBjaGFyYWN0ZXJcblxuICAgICAgICAgIGNhc2UgJ2YnOlxuICAgICAgICAgICAgc3RyICs9ICdcXGYnO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gZm9ybSBmZWVkXG5cbiAgICAgICAgICBjYXNlICduJzpcbiAgICAgICAgICAgIHN0ciArPSAnXFxuJztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIGxpbmUgZmVlZFxuXG4gICAgICAgICAgY2FzZSAncic6XG4gICAgICAgICAgICBzdHIgKz0gJ1xccic7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBjYXJyaWFnZSByZXR1cm5cblxuICAgICAgICAgIGNhc2UgJ3QnOlxuICAgICAgICAgICAgc3RyICs9ICdcXHQnO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gaG9yaXpvbnRhbCB0YWJcblxuICAgICAgICAgIGNhc2UgJ3YnOlxuICAgICAgICAgICAgc3RyICs9ICdcXHYnO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gdmVydGljYWwgdGFiXG5cbiAgICAgICAgICBjYXNlICdOJzpcbiAgICAgICAgICAgIHN0ciArPSAnXFx1MDA4NSc7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBVbmljb2RlIG5leHQgbGluZVxuXG4gICAgICAgICAgY2FzZSAnXyc6XG4gICAgICAgICAgICBzdHIgKz0gJ1xcdTAwYTAnO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gVW5pY29kZSBub24tYnJlYWtpbmcgc3BhY2VcblxuICAgICAgICAgIGNhc2UgJ0wnOlxuICAgICAgICAgICAgc3RyICs9ICdcXHUyMDI4JztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIFVuaWNvZGUgbGluZSBzZXBhcmF0b3JcblxuICAgICAgICAgIGNhc2UgJ1AnOlxuICAgICAgICAgICAgc3RyICs9ICdcXHUyMDI5JztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIFVuaWNvZGUgcGFyYWdyYXBoIHNlcGFyYXRvclxuXG4gICAgICAgICAgY2FzZSAnICc6XG4gICAgICAgICAgICBzdHIgKz0gJyAnO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdcIic6XG4gICAgICAgICAgICBzdHIgKz0gJ1wiJztcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgICBzdHIgKz0gJy8nO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdcXFxcJzpcbiAgICAgICAgICAgIHN0ciArPSAnXFxcXCc7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ1xcdCc6XG4gICAgICAgICAgICBzdHIgKz0gJ1xcdCc7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ3gnOlxuICAgICAgICAgICAgc3RyICs9IHRoaXMucGFyc2VDaGFyQ29kZShpICsgMSwgMiwgZXJyb3JzKTtcbiAgICAgICAgICAgIGkgKz0gMjtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndSc6XG4gICAgICAgICAgICBzdHIgKz0gdGhpcy5wYXJzZUNoYXJDb2RlKGkgKyAxLCA0LCBlcnJvcnMpO1xuICAgICAgICAgICAgaSArPSA0O1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdVJzpcbiAgICAgICAgICAgIHN0ciArPSB0aGlzLnBhcnNlQ2hhckNvZGUoaSArIDEsIDgsIGVycm9ycyk7XG4gICAgICAgICAgICBpICs9IDg7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ1xcbic6XG4gICAgICAgICAgICAvLyBza2lwIGVzY2FwZWQgbmV3bGluZXMsIGJ1dCBzdGlsbCB0cmltIHRoZSBmb2xsb3dpbmcgbGluZVxuICAgICAgICAgICAgd2hpbGUgKHNyY1tpICsgMV0gPT09ICcgJyB8fCBzcmNbaSArIDFdID09PSAnXFx0JykgaSArPSAxO1xuXG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBlcnJvcnMucHVzaChuZXcgWUFNTFN5bnRheEVycm9yKHRoaXMsIFwiSW52YWxpZCBlc2NhcGUgc2VxdWVuY2UgXCIuY29uY2F0KHNyYy5zdWJzdHIoaSAtIDEsIDIpKSkpO1xuICAgICAgICAgICAgc3RyICs9ICdcXFxcJyArIHNyY1tpXTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjaCA9PT0gJyAnIHx8IGNoID09PSAnXFx0Jykge1xuICAgICAgICAvLyB0cmltIHRyYWlsaW5nIHdoaXRlc3BhY2VcbiAgICAgICAgY29uc3Qgd3NTdGFydCA9IGk7XG4gICAgICAgIGxldCBuZXh0ID0gc3JjW2kgKyAxXTtcblxuICAgICAgICB3aGlsZSAobmV4dCA9PT0gJyAnIHx8IG5leHQgPT09ICdcXHQnKSB7XG4gICAgICAgICAgaSArPSAxO1xuICAgICAgICAgIG5leHQgPSBzcmNbaSArIDFdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHQgIT09ICdcXG4nKSBzdHIgKz0gaSA+IHdzU3RhcnQgPyBzcmMuc2xpY2Uod3NTdGFydCwgaSArIDEpIDogY2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gY2g7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGVycm9ycy5sZW5ndGggPiAwID8ge1xuICAgICAgZXJyb3JzLFxuICAgICAgc3RyXG4gICAgfSA6IHN0cjtcbiAgfVxuXG4gIHBhcnNlQ2hhckNvZGUob2Zmc2V0LCBsZW5ndGgsIGVycm9ycykge1xuICAgIGNvbnN0IHtcbiAgICAgIHNyY1xuICAgIH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgY29uc3QgY2MgPSBzcmMuc3Vic3RyKG9mZnNldCwgbGVuZ3RoKTtcbiAgICBjb25zdCBvayA9IGNjLmxlbmd0aCA9PT0gbGVuZ3RoICYmIC9eWzAtOWEtZkEtRl0rJC8udGVzdChjYyk7XG4gICAgY29uc3QgY29kZSA9IG9rID8gcGFyc2VJbnQoY2MsIDE2KSA6IE5hTjtcblxuICAgIGlmIChpc05hTihjb2RlKSkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFlBTUxTeW50YXhFcnJvcih0aGlzLCBcIkludmFsaWQgZXNjYXBlIHNlcXVlbmNlIFwiLmNvbmNhdChzcmMuc3Vic3RyKG9mZnNldCAtIDIsIGxlbmd0aCArIDIpKSkpO1xuICAgICAgcmV0dXJuIHNyYy5zdWJzdHIob2Zmc2V0IC0gMiwgbGVuZ3RoICsgMik7XG4gICAgfVxuXG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ29kZVBvaW50KGNvZGUpO1xuICB9XG4gIC8qKlxuICAgKiBQYXJzZXMgYSBcImRvdWJsZSBxdW90ZWRcIiB2YWx1ZSBmcm9tIHRoZSBzb3VyY2VcbiAgICpcbiAgICogQHBhcmFtIHtQYXJzZUNvbnRleHR9IGNvbnRleHRcbiAgICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IC0gSW5kZXggb2YgZmlyc3QgY2hhcmFjdGVyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gSW5kZXggb2YgdGhlIGNoYXJhY3RlciBhZnRlciB0aGlzIHNjYWxhclxuICAgKi9cblxuXG4gIHBhcnNlKGNvbnRleHQsIHN0YXJ0KSB7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICBjb25zdCB7XG4gICAgICBzcmNcbiAgICB9ID0gY29udGV4dDtcbiAgICBsZXQgb2Zmc2V0ID0gUXVvdGVEb3VibGUuZW5kT2ZRdW90ZShzcmMsIHN0YXJ0ICsgMSk7XG4gICAgdGhpcy52YWx1ZVJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0KTtcbiAgICBvZmZzZXQgPSB0aGlzLnBhcnNlQ29tbWVudChvZmZzZXQpO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxufVxuXG5leHBvcnQgeyBRdW90ZURvdWJsZSB9O1xuIiwiaW1wb3J0IHsgWUFNTFN5bnRheEVycm9yLCBZQU1MU2VtYW50aWNFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi9SYW5nZS5qcyc7XG5cbmNsYXNzIFF1b3RlU2luZ2xlIGV4dGVuZHMgTm9kZSB7XG4gIHN0YXRpYyBlbmRPZlF1b3RlKHNyYywgb2Zmc2V0KSB7XG4gICAgbGV0IGNoID0gc3JjW29mZnNldF07XG5cbiAgICB3aGlsZSAoY2gpIHtcbiAgICAgIGlmIChjaCA9PT0gXCInXCIpIHtcbiAgICAgICAgaWYgKHNyY1tvZmZzZXQgKyAxXSAhPT0gXCInXCIpIGJyZWFrO1xuICAgICAgICBjaCA9IHNyY1tvZmZzZXQgKz0gMl07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaCA9IHNyY1tvZmZzZXQgKz0gMV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldCArIDE7XG4gIH1cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtzdHJpbmcgfCB7IHN0cjogc3RyaW5nLCBlcnJvcnM6IFlBTUxTeW50YXhFcnJvcltdIH19XG4gICAqL1xuXG5cbiAgZ2V0IHN0clZhbHVlKCkge1xuICAgIGlmICghdGhpcy52YWx1ZVJhbmdlIHx8ICF0aGlzLmNvbnRleHQpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IGVycm9ycyA9IFtdO1xuICAgIGNvbnN0IHtcbiAgICAgIHN0YXJ0LFxuICAgICAgZW5kXG4gICAgfSA9IHRoaXMudmFsdWVSYW5nZTtcbiAgICBjb25zdCB7XG4gICAgICBpbmRlbnQsXG4gICAgICBzcmNcbiAgICB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGlmIChzcmNbZW5kIC0gMV0gIT09IFwiJ1wiKSBlcnJvcnMucHVzaChuZXcgWUFNTFN5bnRheEVycm9yKHRoaXMsIFwiTWlzc2luZyBjbG9zaW5nICdxdW90ZVwiKSk7XG4gICAgbGV0IHN0ciA9ICcnO1xuXG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0ICsgMTsgaSA8IGVuZCAtIDE7ICsraSkge1xuICAgICAgY29uc3QgY2ggPSBzcmNbaV07XG5cbiAgICAgIGlmIChjaCA9PT0gJ1xcbicpIHtcbiAgICAgICAgaWYgKE5vZGUuYXREb2N1bWVudEJvdW5kYXJ5KHNyYywgaSArIDEpKSBlcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3IodGhpcywgJ0RvY3VtZW50IGJvdW5kYXJ5IGluZGljYXRvcnMgYXJlIG5vdCBhbGxvd2VkIHdpdGhpbiBzdHJpbmcgdmFsdWVzJykpO1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgZm9sZCxcbiAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgZXJyb3JcbiAgICAgICAgfSA9IE5vZGUuZm9sZE5ld2xpbmUoc3JjLCBpLCBpbmRlbnQpO1xuICAgICAgICBzdHIgKz0gZm9sZDtcbiAgICAgICAgaSA9IG9mZnNldDtcbiAgICAgICAgaWYgKGVycm9yKSBlcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3IodGhpcywgJ011bHRpLWxpbmUgc2luZ2xlLXF1b3RlZCBzdHJpbmcgbmVlZHMgdG8gYmUgc3VmZmljaWVudGx5IGluZGVudGVkJykpO1xuICAgICAgfSBlbHNlIGlmIChjaCA9PT0gXCInXCIpIHtcbiAgICAgICAgc3RyICs9IGNoO1xuICAgICAgICBpICs9IDE7XG4gICAgICAgIGlmIChzcmNbaV0gIT09IFwiJ1wiKSBlcnJvcnMucHVzaChuZXcgWUFNTFN5bnRheEVycm9yKHRoaXMsICdVbmVzY2FwZWQgc2luZ2xlIHF1b3RlPyBUaGlzIHNob3VsZCBub3QgaGFwcGVuLicpKTtcbiAgICAgIH0gZWxzZSBpZiAoY2ggPT09ICcgJyB8fCBjaCA9PT0gJ1xcdCcpIHtcbiAgICAgICAgLy8gdHJpbSB0cmFpbGluZyB3aGl0ZXNwYWNlXG4gICAgICAgIGNvbnN0IHdzU3RhcnQgPSBpO1xuICAgICAgICBsZXQgbmV4dCA9IHNyY1tpICsgMV07XG5cbiAgICAgICAgd2hpbGUgKG5leHQgPT09ICcgJyB8fCBuZXh0ID09PSAnXFx0Jykge1xuICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgICBuZXh0ID0gc3JjW2kgKyAxXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXh0ICE9PSAnXFxuJykgc3RyICs9IGkgPiB3c1N0YXJ0ID8gc3JjLnNsaWNlKHdzU3RhcnQsIGkgKyAxKSA6IGNoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9IGNoO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBlcnJvcnMubGVuZ3RoID4gMCA/IHtcbiAgICAgIGVycm9ycyxcbiAgICAgIHN0clxuICAgIH0gOiBzdHI7XG4gIH1cbiAgLyoqXG4gICAqIFBhcnNlcyBhICdzaW5nbGUgcXVvdGVkJyB2YWx1ZSBmcm9tIHRoZSBzb3VyY2VcbiAgICpcbiAgICogQHBhcmFtIHtQYXJzZUNvbnRleHR9IGNvbnRleHRcbiAgICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IC0gSW5kZXggb2YgZmlyc3QgY2hhcmFjdGVyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gSW5kZXggb2YgdGhlIGNoYXJhY3RlciBhZnRlciB0aGlzIHNjYWxhclxuICAgKi9cblxuXG4gIHBhcnNlKGNvbnRleHQsIHN0YXJ0KSB7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICBjb25zdCB7XG4gICAgICBzcmNcbiAgICB9ID0gY29udGV4dDtcbiAgICBsZXQgb2Zmc2V0ID0gUXVvdGVTaW5nbGUuZW5kT2ZRdW90ZShzcmMsIHN0YXJ0ICsgMSk7XG4gICAgdGhpcy52YWx1ZVJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LCBvZmZzZXQpO1xuICAgIG9mZnNldCA9IE5vZGUuZW5kT2ZXaGl0ZVNwYWNlKHNyYywgb2Zmc2V0KTtcbiAgICBvZmZzZXQgPSB0aGlzLnBhcnNlQ29tbWVudChvZmZzZXQpO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxufVxuXG5leHBvcnQgeyBRdW90ZVNpbmdsZSB9O1xuIiwiaW1wb3J0IHsgZGVmaW5lUHJvcGVydHkgYXMgX2RlZmluZVByb3BlcnR5IH0gZnJvbSAnLi4vX3ZpcnR1YWwvX3JvbGx1cFBsdWdpbkJhYmVsSGVscGVycy5qcyc7XG5pbXBvcnQgeyBUeXBlLCBDaGFyIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFlBTUxTeW50YXhFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBBbGlhcyB9IGZyb20gJy4vQWxpYXMuanMnO1xuaW1wb3J0IHsgQmxvY2tWYWx1ZSB9IGZyb20gJy4vQmxvY2tWYWx1ZS5qcyc7XG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9Db2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IENvbGxlY3Rpb25JdGVtIH0gZnJvbSAnLi9Db2xsZWN0aW9uSXRlbS5qcyc7XG5pbXBvcnQgeyBGbG93Q29sbGVjdGlvbiB9IGZyb20gJy4vRmxvd0NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBQbGFpblZhbHVlIH0gZnJvbSAnLi9QbGFpblZhbHVlLmpzJztcbmltcG9ydCB7IFF1b3RlRG91YmxlIH0gZnJvbSAnLi9RdW90ZURvdWJsZS5qcyc7XG5pbXBvcnQgeyBRdW90ZVNpbmdsZSB9IGZyb20gJy4vUXVvdGVTaW5nbGUuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL1JhbmdlLmpzJztcblxuZnVuY3Rpb24gY3JlYXRlTmV3Tm9kZSh0eXBlLCBwcm9wcykge1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlIFR5cGUuQUxJQVM6XG4gICAgICByZXR1cm4gbmV3IEFsaWFzKHR5cGUsIHByb3BzKTtcblxuICAgIGNhc2UgVHlwZS5CTE9DS19GT0xERUQ6XG4gICAgY2FzZSBUeXBlLkJMT0NLX0xJVEVSQUw6XG4gICAgICByZXR1cm4gbmV3IEJsb2NrVmFsdWUodHlwZSwgcHJvcHMpO1xuXG4gICAgY2FzZSBUeXBlLkZMT1dfTUFQOlxuICAgIGNhc2UgVHlwZS5GTE9XX1NFUTpcbiAgICAgIHJldHVybiBuZXcgRmxvd0NvbGxlY3Rpb24odHlwZSwgcHJvcHMpO1xuXG4gICAgY2FzZSBUeXBlLk1BUF9LRVk6XG4gICAgY2FzZSBUeXBlLk1BUF9WQUxVRTpcbiAgICBjYXNlIFR5cGUuU0VRX0lURU06XG4gICAgICByZXR1cm4gbmV3IENvbGxlY3Rpb25JdGVtKHR5cGUsIHByb3BzKTtcblxuICAgIGNhc2UgVHlwZS5DT01NRU5UOlxuICAgIGNhc2UgVHlwZS5QTEFJTjpcbiAgICAgIHJldHVybiBuZXcgUGxhaW5WYWx1ZSh0eXBlLCBwcm9wcyk7XG5cbiAgICBjYXNlIFR5cGUuUVVPVEVfRE9VQkxFOlxuICAgICAgcmV0dXJuIG5ldyBRdW90ZURvdWJsZSh0eXBlLCBwcm9wcyk7XG5cbiAgICBjYXNlIFR5cGUuUVVPVEVfU0lOR0xFOlxuICAgICAgcmV0dXJuIG5ldyBRdW90ZVNpbmdsZSh0eXBlLCBwcm9wcyk7XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsO1xuICAgIC8vIHNob3VsZCBuZXZlciBoYXBwZW5cbiAgfVxufVxuLyoqXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGF0TGluZVN0YXJ0IC0gTm9kZSBzdGFydHMgYXQgYmVnaW5uaW5nIG9mIGxpbmVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaW5GbG93IC0gdHJ1ZSBpZiBjdXJyZW50bHkgaW4gYSBmbG93IGNvbnRleHRcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaW5Db2xsZWN0aW9uIC0gdHJ1ZSBpZiBjdXJyZW50bHkgaW4gYSBjb2xsZWN0aW9uIGNvbnRleHRcbiAqIEBwYXJhbSB7bnVtYmVyfSBpbmRlbnQgLSBDdXJyZW50IGxldmVsIG9mIGluZGVudGF0aW9uXG4gKiBAcGFyYW0ge251bWJlcn0gbGluZVN0YXJ0IC0gU3RhcnQgb2YgdGhlIGN1cnJlbnQgbGluZVxuICogQHBhcmFtIHtOb2RlfSBwYXJlbnQgLSBUaGUgcGFyZW50IG9mIHRoZSBub2RlXG4gKiBAcGFyYW0ge3N0cmluZ30gc3JjIC0gU291cmNlIG9mIHRoZSBZQU1MIGRvY3VtZW50XG4gKi9cblxuXG5jbGFzcyBQYXJzZUNvbnRleHQge1xuICBzdGF0aWMgcGFyc2VUeXBlKHNyYywgb2Zmc2V0LCBpbkZsb3cpIHtcbiAgICBzd2l0Y2ggKHNyY1tvZmZzZXRdKSB7XG4gICAgICBjYXNlICcqJzpcbiAgICAgICAgcmV0dXJuIFR5cGUuQUxJQVM7XG5cbiAgICAgIGNhc2UgJz4nOlxuICAgICAgICByZXR1cm4gVHlwZS5CTE9DS19GT0xERUQ7XG5cbiAgICAgIGNhc2UgJ3wnOlxuICAgICAgICByZXR1cm4gVHlwZS5CTE9DS19MSVRFUkFMO1xuXG4gICAgICBjYXNlICd7JzpcbiAgICAgICAgcmV0dXJuIFR5cGUuRkxPV19NQVA7XG5cbiAgICAgIGNhc2UgJ1snOlxuICAgICAgICByZXR1cm4gVHlwZS5GTE9XX1NFUTtcblxuICAgICAgY2FzZSAnPyc6XG4gICAgICAgIHJldHVybiAhaW5GbG93ICYmIE5vZGUuYXRCbGFuayhzcmMsIG9mZnNldCArIDEsIHRydWUpID8gVHlwZS5NQVBfS0VZIDogVHlwZS5QTEFJTjtcblxuICAgICAgY2FzZSAnOic6XG4gICAgICAgIHJldHVybiAhaW5GbG93ICYmIE5vZGUuYXRCbGFuayhzcmMsIG9mZnNldCArIDEsIHRydWUpID8gVHlwZS5NQVBfVkFMVUUgOiBUeXBlLlBMQUlOO1xuXG4gICAgICBjYXNlICctJzpcbiAgICAgICAgcmV0dXJuICFpbkZsb3cgJiYgTm9kZS5hdEJsYW5rKHNyYywgb2Zmc2V0ICsgMSwgdHJ1ZSkgPyBUeXBlLlNFUV9JVEVNIDogVHlwZS5QTEFJTjtcblxuICAgICAgY2FzZSAnXCInOlxuICAgICAgICByZXR1cm4gVHlwZS5RVU9URV9ET1VCTEU7XG5cbiAgICAgIGNhc2UgXCInXCI6XG4gICAgICAgIHJldHVybiBUeXBlLlFVT1RFX1NJTkdMRTtcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFR5cGUuUExBSU47XG4gICAgfVxuICB9XG5cbiAgY29uc3RydWN0b3Iob3JpZyA9IHt9LCB7XG4gICAgYXRMaW5lU3RhcnQsXG4gICAgaW5Db2xsZWN0aW9uLFxuICAgIGluRmxvdyxcbiAgICBpbmRlbnQsXG4gICAgbGluZVN0YXJ0LFxuICAgIHBhcmVudFxuICB9ID0ge30pIHtcbiAgICBfZGVmaW5lUHJvcGVydHkodGhpcywgXCJwYXJzZU5vZGVcIiwgKG92ZXJsYXksIHN0YXJ0KSA9PiB7XG4gICAgICBpZiAoTm9kZS5hdERvY3VtZW50Qm91bmRhcnkodGhpcy5zcmMsIHN0YXJ0KSkgcmV0dXJuIG51bGw7XG4gICAgICBjb25zdCBjb250ZXh0ID0gbmV3IFBhcnNlQ29udGV4dCh0aGlzLCBvdmVybGF5KTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgcHJvcHMsXG4gICAgICAgIHR5cGUsXG4gICAgICAgIHZhbHVlU3RhcnRcbiAgICAgIH0gPSBjb250ZXh0LnBhcnNlUHJvcHMoc3RhcnQpO1xuICAgICAgY29uc3Qgbm9kZSA9IGNyZWF0ZU5ld05vZGUodHlwZSwgcHJvcHMpO1xuICAgICAgbGV0IG9mZnNldCA9IG5vZGUucGFyc2UoY29udGV4dCwgdmFsdWVTdGFydCk7XG4gICAgICBub2RlLnJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LCBvZmZzZXQpO1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG5cbiAgICAgIGlmIChvZmZzZXQgPD0gc3RhcnQpIHtcbiAgICAgICAgLy8gVGhpcyBzaG91bGQgbmV2ZXIgaGFwcGVuLCBidXQgaWYgaXQgZG9lcywgbGV0J3MgbWFrZSBzdXJlIHRvIGF0IGxlYXN0XG4gICAgICAgIC8vIHN0ZXAgb25lIGNoYXJhY3RlciBmb3J3YXJkIHRvIGF2b2lkIGEgYnVzeSBsb29wLlxuICAgICAgICBub2RlLmVycm9yID0gbmV3IEVycm9yKFwiTm9kZSNwYXJzZSBjb25zdW1lZCBubyBjaGFyYWN0ZXJzXCIpO1xuICAgICAgICBub2RlLmVycm9yLnBhcnNlRW5kID0gb2Zmc2V0O1xuICAgICAgICBub2RlLmVycm9yLnNvdXJjZSA9IG5vZGU7XG4gICAgICAgIG5vZGUucmFuZ2UuZW5kID0gc3RhcnQgKyAxO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29udGV4dC5ub2RlU3RhcnRzQ29sbGVjdGlvbihub2RlKSkge1xuICAgICAgICBpZiAoIW5vZGUuZXJyb3IgJiYgIWNvbnRleHQuYXRMaW5lU3RhcnQgJiYgY29udGV4dC5wYXJlbnQudHlwZSA9PT0gVHlwZS5ET0NVTUVOVCkge1xuICAgICAgICAgIG5vZGUuZXJyb3IgPSBuZXcgWUFNTFN5bnRheEVycm9yKG5vZGUsICdCbG9jayBjb2xsZWN0aW9uIG11c3Qgbm90IGhhdmUgcHJlY2VkaW5nIGNvbnRlbnQgaGVyZSAoZS5nLiBkaXJlY3RpdmVzLWVuZCBpbmRpY2F0b3IpJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb2xsZWN0aW9uID0gbmV3IENvbGxlY3Rpb24obm9kZSk7XG4gICAgICAgIG9mZnNldCA9IGNvbGxlY3Rpb24ucGFyc2UobmV3IFBhcnNlQ29udGV4dChjb250ZXh0KSwgb2Zmc2V0KTtcbiAgICAgICAgY29sbGVjdGlvbi5yYW5nZSA9IG5ldyBSYW5nZShzdGFydCwgb2Zmc2V0KTtcbiAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb247XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBub2RlO1xuICAgIH0pO1xuXG4gICAgdGhpcy5hdExpbmVTdGFydCA9IGF0TGluZVN0YXJ0ICE9IG51bGwgPyBhdExpbmVTdGFydCA6IG9yaWcuYXRMaW5lU3RhcnQgfHwgZmFsc2U7XG4gICAgdGhpcy5pbkNvbGxlY3Rpb24gPSBpbkNvbGxlY3Rpb24gIT0gbnVsbCA/IGluQ29sbGVjdGlvbiA6IG9yaWcuaW5Db2xsZWN0aW9uIHx8IGZhbHNlO1xuICAgIHRoaXMuaW5GbG93ID0gaW5GbG93ICE9IG51bGwgPyBpbkZsb3cgOiBvcmlnLmluRmxvdyB8fCBmYWxzZTtcbiAgICB0aGlzLmluZGVudCA9IGluZGVudCAhPSBudWxsID8gaW5kZW50IDogb3JpZy5pbmRlbnQ7XG4gICAgdGhpcy5saW5lU3RhcnQgPSBsaW5lU3RhcnQgIT0gbnVsbCA/IGxpbmVTdGFydCA6IG9yaWcubGluZVN0YXJ0O1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50ICE9IG51bGwgPyBwYXJlbnQgOiBvcmlnLnBhcmVudCB8fCB7fTtcbiAgICB0aGlzLnJvb3QgPSBvcmlnLnJvb3Q7XG4gICAgdGhpcy5zcmMgPSBvcmlnLnNyYztcbiAgfVxuXG4gIG5vZGVTdGFydHNDb2xsZWN0aW9uKG5vZGUpIHtcbiAgICBjb25zdCB7XG4gICAgICBpbkNvbGxlY3Rpb24sXG4gICAgICBpbkZsb3csXG4gICAgICBzcmNcbiAgICB9ID0gdGhpcztcbiAgICBpZiAoaW5Db2xsZWN0aW9uIHx8IGluRmxvdykgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgQ29sbGVjdGlvbkl0ZW0pIHJldHVybiB0cnVlOyAvLyBjaGVjayBmb3IgaW1wbGljaXQga2V5XG5cbiAgICBsZXQgb2Zmc2V0ID0gbm9kZS5yYW5nZS5lbmQ7XG4gICAgaWYgKHNyY1tvZmZzZXRdID09PSAnXFxuJyB8fCBzcmNbb2Zmc2V0IC0gMV0gPT09ICdcXG4nKSByZXR1cm4gZmFsc2U7XG4gICAgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBvZmZzZXQpO1xuICAgIHJldHVybiBzcmNbb2Zmc2V0XSA9PT0gJzonO1xuICB9IC8vIEFuY2hvciBhbmQgdGFnIGFyZSBiZWZvcmUgdHlwZSwgd2hpY2ggZGV0ZXJtaW5lcyB0aGUgbm9kZSBpbXBsZW1lbnRhdGlvblxuICAvLyBjbGFzczsgaGVuY2UgdGhpcyBpbnRlcm1lZGlhdGUgc3RlcC5cblxuXG4gIHBhcnNlUHJvcHMob2Zmc2V0KSB7XG4gICAgY29uc3Qge1xuICAgICAgaW5GbG93LFxuICAgICAgcGFyZW50LFxuICAgICAgc3JjXG4gICAgfSA9IHRoaXM7XG4gICAgY29uc3QgcHJvcHMgPSBbXTtcbiAgICBsZXQgbGluZUhhc1Byb3BzID0gZmFsc2U7XG4gICAgb2Zmc2V0ID0gdGhpcy5hdExpbmVTdGFydCA/IE5vZGUuZW5kT2ZJbmRlbnQoc3JjLCBvZmZzZXQpIDogTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBvZmZzZXQpO1xuICAgIGxldCBjaCA9IHNyY1tvZmZzZXRdO1xuXG4gICAgd2hpbGUgKGNoID09PSBDaGFyLkFOQ0hPUiB8fCBjaCA9PT0gQ2hhci5DT01NRU5UIHx8IGNoID09PSBDaGFyLlRBRyB8fCBjaCA9PT0gJ1xcbicpIHtcbiAgICAgIGlmIChjaCA9PT0gJ1xcbicpIHtcbiAgICAgICAgY29uc3QgbGluZVN0YXJ0ID0gb2Zmc2V0ICsgMTtcbiAgICAgICAgY29uc3QgaW5FbmQgPSBOb2RlLmVuZE9mSW5kZW50KHNyYywgbGluZVN0YXJ0KTtcbiAgICAgICAgY29uc3QgaW5kZW50RGlmZiA9IGluRW5kIC0gKGxpbmVTdGFydCArIHRoaXMuaW5kZW50KTtcbiAgICAgICAgY29uc3Qgbm9JbmRpY2F0b3JBc0luZGVudCA9IHBhcmVudC50eXBlID09PSBUeXBlLlNFUV9JVEVNICYmIHBhcmVudC5jb250ZXh0LmF0TGluZVN0YXJ0O1xuICAgICAgICBpZiAoIU5vZGUubmV4dE5vZGVJc0luZGVudGVkKHNyY1tpbkVuZF0sIGluZGVudERpZmYsICFub0luZGljYXRvckFzSW5kZW50KSkgYnJlYWs7XG4gICAgICAgIHRoaXMuYXRMaW5lU3RhcnQgPSB0cnVlO1xuICAgICAgICB0aGlzLmxpbmVTdGFydCA9IGxpbmVTdGFydDtcbiAgICAgICAgbGluZUhhc1Byb3BzID0gZmFsc2U7XG4gICAgICAgIG9mZnNldCA9IGluRW5kO1xuICAgICAgfSBlbHNlIGlmIChjaCA9PT0gQ2hhci5DT01NRU5UKSB7XG4gICAgICAgIGNvbnN0IGVuZCA9IE5vZGUuZW5kT2ZMaW5lKHNyYywgb2Zmc2V0ICsgMSk7XG4gICAgICAgIHByb3BzLnB1c2gobmV3IFJhbmdlKG9mZnNldCwgZW5kKSk7XG4gICAgICAgIG9mZnNldCA9IGVuZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBlbmQgPSBOb2RlLmVuZE9mSWRlbnRpZmllcihzcmMsIG9mZnNldCArIDEpO1xuXG4gICAgICAgIGlmIChjaCA9PT0gQ2hhci5UQUcgJiYgc3JjW2VuZF0gPT09ICcsJyAmJiAvXlthLXpBLVowLTktXStcXC5bYS16QS1aMC05LV0rLFxcZFxcZFxcZFxcZCgtXFxkXFxkKXswLDJ9XFwvXFxTLy50ZXN0KHNyYy5zbGljZShvZmZzZXQgKyAxLCBlbmQgKyAxMykpKSB7XG4gICAgICAgICAgLy8gTGV0J3MgcHJlc3VtZSB3ZSdyZSBkZWFsaW5nIHdpdGggYSBZQU1MIDEuMCBkb21haW4gdGFnIGhlcmUsIHJhdGhlclxuICAgICAgICAgIC8vIHRoYW4gYW4gZW1wdHkgYnV0ICdmb28uYmFyJyBwcml2YXRlLXRhZ2dlZCBub2RlIGluIGEgZmxvdyBjb2xsZWN0aW9uXG4gICAgICAgICAgLy8gZm9sbG93ZWQgd2l0aG91dCB3aGl0ZXNwYWNlIGJ5IGEgcGxhaW4gc3RyaW5nIHN0YXJ0aW5nIHdpdGggYSB5ZWFyXG4gICAgICAgICAgLy8gb3IgZGF0ZSBkaXZpZGVkIGJ5IHNvbWV0aGluZy5cbiAgICAgICAgICBlbmQgPSBOb2RlLmVuZE9mSWRlbnRpZmllcihzcmMsIGVuZCArIDUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvcHMucHVzaChuZXcgUmFuZ2Uob2Zmc2V0LCBlbmQpKTtcbiAgICAgICAgbGluZUhhc1Byb3BzID0gdHJ1ZTtcbiAgICAgICAgb2Zmc2V0ID0gTm9kZS5lbmRPZldoaXRlU3BhY2Uoc3JjLCBlbmQpO1xuICAgICAgfVxuXG4gICAgICBjaCA9IHNyY1tvZmZzZXRdO1xuICAgIH0gLy8gJy0gJmEgOiBiJyBoYXMgYW4gYW5jaG9yIG9uIGFuIGVtcHR5IG5vZGVcblxuXG4gICAgaWYgKGxpbmVIYXNQcm9wcyAmJiBjaCA9PT0gJzonICYmIE5vZGUuYXRCbGFuayhzcmMsIG9mZnNldCArIDEsIHRydWUpKSBvZmZzZXQgLT0gMTtcbiAgICBjb25zdCB0eXBlID0gUGFyc2VDb250ZXh0LnBhcnNlVHlwZShzcmMsIG9mZnNldCwgaW5GbG93KTtcbiAgICByZXR1cm4ge1xuICAgICAgcHJvcHMsXG4gICAgICB0eXBlLFxuICAgICAgdmFsdWVTdGFydDogb2Zmc2V0XG4gICAgfTtcbiAgfVxuICAvKipcbiAgICogUGFyc2VzIGEgbm9kZSBmcm9tIHRoZSBzb3VyY2VcbiAgICogQHBhcmFtIHtQYXJzZUNvbnRleHR9IG92ZXJsYXlcbiAgICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IC0gSW5kZXggb2YgZmlyc3Qgbm9uLXdoaXRlc3BhY2UgY2hhcmFjdGVyIGZvciB0aGUgbm9kZVxuICAgKiBAcmV0dXJucyB7P05vZGV9IC0gbnVsbCBpZiBhdCBhIGRvY3VtZW50IGJvdW5kYXJ5XG4gICAqL1xuXG5cbn1cblxuZXhwb3J0IHsgUGFyc2VDb250ZXh0IH07XG4iLCJpbXBvcnQgeyBEb2N1bWVudCB9IGZyb20gJy4vRG9jdW1lbnQuanMnO1xuaW1wb3J0IHsgUGFyc2VDb250ZXh0IH0gZnJvbSAnLi9QYXJzZUNvbnRleHQuanMnO1xuXG5mdW5jdGlvbiBwYXJzZShzcmMpIHtcbiAgY29uc3QgY3IgPSBbXTtcblxuICBpZiAoc3JjLmluZGV4T2YoJ1xccicpICE9PSAtMSkge1xuICAgIHNyYyA9IHNyYy5yZXBsYWNlKC9cXHJcXG4/L2csIChtYXRjaCwgb2Zmc2V0KSA9PiB7XG4gICAgICBpZiAobWF0Y2gubGVuZ3RoID4gMSkgY3IucHVzaChvZmZzZXQpO1xuICAgICAgcmV0dXJuICdcXG4nO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZG9jdW1lbnRzID0gW107XG4gIGxldCBvZmZzZXQgPSAwO1xuXG4gIGRvIHtcbiAgICBjb25zdCBkb2MgPSBuZXcgRG9jdW1lbnQoKTtcbiAgICBjb25zdCBjb250ZXh0ID0gbmV3IFBhcnNlQ29udGV4dCh7XG4gICAgICBzcmNcbiAgICB9KTtcbiAgICBvZmZzZXQgPSBkb2MucGFyc2UoY29udGV4dCwgb2Zmc2V0KTtcbiAgICBkb2N1bWVudHMucHVzaChkb2MpO1xuICB9IHdoaWxlIChvZmZzZXQgPCBzcmMubGVuZ3RoKTtcblxuICBkb2N1bWVudHMuc2V0T3JpZ1JhbmdlcyA9ICgpID0+IHtcbiAgICBpZiAoY3IubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XG5cbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGNyLmxlbmd0aDsgKytpKSBjcltpXSAtPSBpO1xuXG4gICAgbGV0IGNyT2Zmc2V0ID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jdW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICBjck9mZnNldCA9IGRvY3VtZW50c1tpXS5zZXRPcmlnUmFuZ2VzKGNyLCBjck9mZnNldCk7XG4gICAgfVxuXG4gICAgY3Iuc3BsaWNlKDAsIGNyLmxlbmd0aCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgZG9jdW1lbnRzLnRvU3RyaW5nID0gKCkgPT4gZG9jdW1lbnRzLmpvaW4oJy4uLlxcbicpO1xuXG4gIHJldHVybiBkb2N1bWVudHM7XG59XG5cbmV4cG9ydCB7IHBhcnNlIH07XG4iLCJpbXBvcnQgeyBUeXBlIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuY29uc3QgYmluYXJ5T3B0aW9ucyA9IHtcbiAgZGVmYXVsdFR5cGU6IFR5cGUuQkxPQ0tfTElURVJBTCxcbiAgbGluZVdpZHRoOiA3NlxufTtcbmNvbnN0IGJvb2xPcHRpb25zID0ge1xuICB0cnVlU3RyOiAndHJ1ZScsXG4gIGZhbHNlU3RyOiAnZmFsc2UnXG59O1xuY29uc3QgaW50T3B0aW9ucyA9IHtcbiAgYXNCaWdJbnQ6IGZhbHNlXG59O1xuY29uc3QgbnVsbE9wdGlvbnMgPSB7XG4gIG51bGxTdHI6ICdudWxsJ1xufTtcbmNvbnN0IHN0ck9wdGlvbnMgPSB7XG4gIGRlZmF1bHRUeXBlOiBUeXBlLlBMQUlOLFxuICBkZWZhdWx0S2V5VHlwZTogVHlwZS5QTEFJTixcbiAgZGVmYXVsdFF1b3RlU2luZ2xlOiBmYWxzZSxcbiAgZG91YmxlUXVvdGVkOiB7XG4gICAganNvbkVuY29kaW5nOiBmYWxzZSxcbiAgICBtaW5NdWx0aUxpbmVMZW5ndGg6IDQwXG4gIH0sXG4gIGZvbGQ6IHtcbiAgICBsaW5lV2lkdGg6IDgwLFxuICAgIG1pbkNvbnRlbnRXaWR0aDogMjBcbiAgfVxufTtcblxuZXhwb3J0IHsgYmluYXJ5T3B0aW9ucywgYm9vbE9wdGlvbnMsIGludE9wdGlvbnMsIG51bGxPcHRpb25zLCBzdHJPcHRpb25zIH07XG4iLCJpbXBvcnQgeyBkZWZhdWx0VGFnUHJlZml4IH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgYmluYXJ5T3B0aW9ucywgYm9vbE9wdGlvbnMsIGludE9wdGlvbnMsIG51bGxPcHRpb25zLCBzdHJPcHRpb25zIH0gZnJvbSAnLi90YWdzL29wdGlvbnMuanMnO1xuXG5jb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgYW5jaG9yUHJlZml4OiAnYScsXG4gIGN1c3RvbVRhZ3M6IG51bGwsXG4gIGluZGVudDogMixcbiAgaW5kZW50U2VxOiB0cnVlLFxuICBrZWVwQ3N0Tm9kZXM6IGZhbHNlLFxuICBrZWVwTm9kZVR5cGVzOiB0cnVlLFxuICBrZWVwVW5kZWZpbmVkOiBmYWxzZSxcbiAgbG9nTGV2ZWw6ICd3YXJuJyxcbiAgbWFwQXNNYXA6IGZhbHNlLFxuICBtYXhBbGlhc0NvdW50OiAxMDAsXG4gIHByZXR0eUVycm9yczogdHJ1ZSxcbiAgc2ltcGxlS2V5czogZmFsc2UsXG4gIHZlcnNpb246ICcxLjInXG59O1xuY29uc3Qgc2NhbGFyT3B0aW9ucyA9IHtcbiAgZ2V0IGJpbmFyeSgpIHtcbiAgICByZXR1cm4gYmluYXJ5T3B0aW9ucztcbiAgfSxcblxuICBzZXQgYmluYXJ5KG9wdCkge1xuICAgIE9iamVjdC5hc3NpZ24oYmluYXJ5T3B0aW9ucywgb3B0KTtcbiAgfSxcblxuICBnZXQgYm9vbCgpIHtcbiAgICByZXR1cm4gYm9vbE9wdGlvbnM7XG4gIH0sXG5cbiAgc2V0IGJvb2wob3B0KSB7XG4gICAgT2JqZWN0LmFzc2lnbihib29sT3B0aW9ucywgb3B0KTtcbiAgfSxcblxuICBnZXQgaW50KCkge1xuICAgIHJldHVybiBpbnRPcHRpb25zO1xuICB9LFxuXG4gIHNldCBpbnQob3B0KSB7XG4gICAgT2JqZWN0LmFzc2lnbihpbnRPcHRpb25zLCBvcHQpO1xuICB9LFxuXG4gIGdldCBudWxsKCkge1xuICAgIHJldHVybiBudWxsT3B0aW9ucztcbiAgfSxcblxuICBzZXQgbnVsbChvcHQpIHtcbiAgICBPYmplY3QuYXNzaWduKG51bGxPcHRpb25zLCBvcHQpO1xuICB9LFxuXG4gIGdldCBzdHIoKSB7XG4gICAgcmV0dXJuIHN0ck9wdGlvbnM7XG4gIH0sXG5cbiAgc2V0IHN0cihvcHQpIHtcbiAgICBPYmplY3QuYXNzaWduKHN0ck9wdGlvbnMsIG9wdCk7XG4gIH1cblxufTtcbmNvbnN0IGRvY3VtZW50T3B0aW9ucyA9IHtcbiAgJzEuMCc6IHtcbiAgICBzY2hlbWE6ICd5YW1sLTEuMScsXG4gICAgbWVyZ2U6IHRydWUsXG4gICAgdGFnUHJlZml4ZXM6IFt7XG4gICAgICBoYW5kbGU6ICchJyxcbiAgICAgIHByZWZpeDogZGVmYXVsdFRhZ1ByZWZpeFxuICAgIH0sIHtcbiAgICAgIGhhbmRsZTogJyEhJyxcbiAgICAgIHByZWZpeDogJ3RhZzpwcml2YXRlLnlhbWwub3JnLDIwMDI6J1xuICAgIH1dXG4gIH0sXG4gIDEuMToge1xuICAgIHNjaGVtYTogJ3lhbWwtMS4xJyxcbiAgICBtZXJnZTogdHJ1ZSxcbiAgICB0YWdQcmVmaXhlczogW3tcbiAgICAgIGhhbmRsZTogJyEnLFxuICAgICAgcHJlZml4OiAnISdcbiAgICB9LCB7XG4gICAgICBoYW5kbGU6ICchIScsXG4gICAgICBwcmVmaXg6IGRlZmF1bHRUYWdQcmVmaXhcbiAgICB9XVxuICB9LFxuICAxLjI6IHtcbiAgICBzY2hlbWE6ICdjb3JlJyxcbiAgICBtZXJnZTogZmFsc2UsXG4gICAgcmVzb2x2ZUtub3duVGFnczogdHJ1ZSxcbiAgICB0YWdQcmVmaXhlczogW3tcbiAgICAgIGhhbmRsZTogJyEnLFxuICAgICAgcHJlZml4OiAnISdcbiAgICB9LCB7XG4gICAgICBoYW5kbGU6ICchIScsXG4gICAgICBwcmVmaXg6IGRlZmF1bHRUYWdQcmVmaXhcbiAgICB9XVxuICB9XG59O1xuXG5leHBvcnQgeyBkZWZhdWx0T3B0aW9ucywgZG9jdW1lbnRPcHRpb25zLCBzY2FsYXJPcHRpb25zIH07XG4iLCJmdW5jdGlvbiBhZGRDb21tZW50QmVmb3JlKHN0ciwgaW5kZW50LCBjb21tZW50KSB7XG4gIGlmICghY29tbWVudCkgcmV0dXJuIHN0cjtcbiAgY29uc3QgY2MgPSBjb21tZW50LnJlcGxhY2UoL1tcXHNcXFNdXi9nbSwgXCIkJlwiLmNvbmNhdChpbmRlbnQsIFwiI1wiKSk7XG4gIHJldHVybiBcIiNcIi5jb25jYXQoY2MsIFwiXFxuXCIpLmNvbmNhdChpbmRlbnQpLmNvbmNhdChzdHIpO1xufVxuZnVuY3Rpb24gYWRkQ29tbWVudChzdHIsIGluZGVudCwgY29tbWVudCkge1xuICByZXR1cm4gIWNvbW1lbnQgPyBzdHIgOiBjb21tZW50LmluZGV4T2YoJ1xcbicpID09PSAtMSA/IFwiXCIuY29uY2F0KHN0ciwgXCIgI1wiKS5jb25jYXQoY29tbWVudCkgOiBcIlwiLmNvbmNhdChzdHIsIFwiXFxuXCIpICsgY29tbWVudC5yZXBsYWNlKC9eL2dtLCBcIlwiLmNvbmNhdChpbmRlbnQgfHwgJycsIFwiI1wiKSk7XG59XG5cbmV4cG9ydCB7IGFkZENvbW1lbnQsIGFkZENvbW1lbnRCZWZvcmUgfTtcbiIsImNsYXNzIE5vZGUge31cblxuZXhwb3J0IHsgTm9kZSB9O1xuIiwiLyoqXG4gKiBSZWN1cnNpdmVseSBjb252ZXJ0IGFueSBub2RlIG9yIGl0cyBjb250ZW50cyB0byBuYXRpdmUgSmF2YVNjcmlwdFxuICpcbiAqIEBwYXJhbSB2YWx1ZSAtIFRoZSBpbnB1dCB2YWx1ZVxuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gYXJnIC0gSWYgYHZhbHVlYCBkZWZpbmVzIGEgYHRvSlNPTigpYCBtZXRob2QsIHVzZSB0aGlzXG4gKiAgIGFzIGl0cyBmaXJzdCBhcmd1bWVudFxuICogQHBhcmFtIGN0eCAtIENvbnZlcnNpb24gY29udGV4dCwgb3JpZ2luYWxseSBzZXQgaW4gRG9jdW1lbnQjdG9KUygpLiBJZlxuICogICBgeyBrZWVwOiB0cnVlIH1gIGlzIG5vdCBzZXQsIG91dHB1dCBzaG91bGQgYmUgc3VpdGFibGUgZm9yIEpTT05cbiAqICAgc3RyaW5naWZpY2F0aW9uLlxuICovXG5mdW5jdGlvbiB0b0pTKHZhbHVlLCBhcmcsIGN0eCkge1xuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoKHYsIGkpID0+IHRvSlModiwgU3RyaW5nKGkpLCBjdHgpKTtcblxuICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNvbnN0IGFuY2hvciA9IGN0eCAmJiBjdHguYW5jaG9ycyAmJiBjdHguYW5jaG9ycy5nZXQodmFsdWUpO1xuICAgIGlmIChhbmNob3IpIGN0eC5vbkNyZWF0ZSA9IHJlcyA9PiB7XG4gICAgICBhbmNob3IucmVzID0gcmVzO1xuICAgICAgZGVsZXRlIGN0eC5vbkNyZWF0ZTtcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IHZhbHVlLnRvSlNPTihhcmcsIGN0eCk7XG4gICAgaWYgKGFuY2hvciAmJiBjdHgub25DcmVhdGUpIGN0eC5vbkNyZWF0ZShyZXMpO1xuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBpZiAoIShjdHggJiYgY3R4LmtlZXApICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ2JpZ2ludCcpIHJldHVybiBOdW1iZXIodmFsdWUpO1xuICByZXR1cm4gdmFsdWU7XG59XG5cbmV4cG9ydCB7IHRvSlMgfTtcbiIsImltcG9ydCB7IE5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuaW1wb3J0IHsgdG9KUyB9IGZyb20gJy4vdG9KUy5qcyc7XG5cbmNvbnN0IGlzU2NhbGFyVmFsdWUgPSB2YWx1ZSA9PiAhdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCc7XG5jbGFzcyBTY2FsYXIgZXh0ZW5kcyBOb2RlIHtcbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuXG4gIHRvSlNPTihhcmcsIGN0eCkge1xuICAgIHJldHVybiBjdHggJiYgY3R4LmtlZXAgPyB0aGlzLnZhbHVlIDogdG9KUyh0aGlzLnZhbHVlLCBhcmcsIGN0eCk7XG4gIH1cblxuICB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gU3RyaW5nKHRoaXMudmFsdWUpO1xuICB9XG5cbn1cblxuZXhwb3J0IHsgU2NhbGFyLCBpc1NjYWxhclZhbHVlIH07XG4iLCJpbXBvcnQgeyBOb2RlIH0gZnJvbSAnLi4vYXN0L05vZGUuanMnO1xuaW1wb3J0IHsgU2NhbGFyIH0gZnJvbSAnLi4vYXN0L1NjYWxhci5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0VGFnUHJlZml4IH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuZnVuY3Rpb24gZmluZFRhZ09iamVjdCh2YWx1ZSwgdGFnTmFtZSwgdGFncykge1xuICBpZiAodGFnTmFtZSkge1xuICAgIGNvbnN0IG1hdGNoID0gdGFncy5maWx0ZXIodCA9PiB0LnRhZyA9PT0gdGFnTmFtZSk7XG4gICAgY29uc3QgdGFnT2JqID0gbWF0Y2guZmluZCh0ID0+ICF0LmZvcm1hdCkgfHwgbWF0Y2hbMF07XG4gICAgaWYgKCF0YWdPYmopIHRocm93IG5ldyBFcnJvcihcIlRhZyBcIi5jb25jYXQodGFnTmFtZSwgXCIgbm90IGZvdW5kXCIpKTtcbiAgICByZXR1cm4gdGFnT2JqO1xuICB9XG5cbiAgcmV0dXJuIHRhZ3MuZmluZCh0ID0+IHQuaWRlbnRpZnkgJiYgdC5pZGVudGlmeSh2YWx1ZSkgJiYgIXQuZm9ybWF0KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTm9kZSh2YWx1ZSwgdGFnTmFtZSwgY3R4KSB7XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIE5vZGUpIHJldHVybiB2YWx1ZTtcbiAgY29uc3Qge1xuICAgIG9uQWxpYXMsXG4gICAgb25UYWdPYmosXG4gICAgcHJldk9iamVjdHMsXG4gICAgd3JhcFNjYWxhcnNcbiAgfSA9IGN0eDtcbiAgY29uc3Qge1xuICAgIG1hcCxcbiAgICBzZXEsXG4gICAgdGFnc1xuICB9ID0gY3R4LnNjaGVtYTtcbiAgaWYgKHRhZ05hbWUgJiYgdGFnTmFtZS5zdGFydHNXaXRoKCchIScpKSB0YWdOYW1lID0gZGVmYXVsdFRhZ1ByZWZpeCArIHRhZ05hbWUuc2xpY2UoMik7XG4gIGxldCB0YWdPYmogPSBmaW5kVGFnT2JqZWN0KHZhbHVlLCB0YWdOYW1lLCB0YWdzKTtcblxuICBpZiAoIXRhZ09iaikge1xuICAgIGlmICh0eXBlb2YgdmFsdWUudG9KU09OID09PSAnZnVuY3Rpb24nKSB2YWx1ZSA9IHZhbHVlLnRvSlNPTigpO1xuICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIHdyYXBTY2FsYXJzID8gbmV3IFNjYWxhcih2YWx1ZSkgOiB2YWx1ZTtcbiAgICB0YWdPYmogPSB2YWx1ZSBpbnN0YW5jZW9mIE1hcCA/IG1hcCA6IHZhbHVlW1N5bWJvbC5pdGVyYXRvcl0gPyBzZXEgOiBtYXA7XG4gIH1cblxuICBpZiAob25UYWdPYmopIHtcbiAgICBvblRhZ09iaih0YWdPYmopO1xuICAgIGRlbGV0ZSBjdHgub25UYWdPYmo7XG4gIH0gLy8gRGV0ZWN0IGR1cGxpY2F0ZSByZWZlcmVuY2VzIHRvIHRoZSBzYW1lIG9iamVjdCAmIHVzZSBBbGlhcyBub2RlcyBmb3IgYWxsXG4gIC8vIGFmdGVyIGZpcnN0LiBUaGUgYG9iamAgd3JhcHBlciBhbGxvd3MgZm9yIGNpcmN1bGFyIHJlZmVyZW5jZXMgdG8gcmVzb2x2ZS5cblxuXG4gIGNvbnN0IG9iaiA9IHtcbiAgICB2YWx1ZTogdW5kZWZpbmVkLFxuICAgIG5vZGU6IHVuZGVmaW5lZFxuICB9O1xuXG4gIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgY29uc3QgcHJldiA9IHByZXZPYmplY3RzLmdldCh2YWx1ZSk7XG4gICAgaWYgKHByZXYpIHJldHVybiBvbkFsaWFzKHByZXYpO1xuICAgIG9iai52YWx1ZSA9IHZhbHVlO1xuICAgIHByZXZPYmplY3RzLnNldCh2YWx1ZSwgb2JqKTtcbiAgfVxuXG4gIG9iai5ub2RlID0gdGFnT2JqLmNyZWF0ZU5vZGUgPyB0YWdPYmouY3JlYXRlTm9kZShjdHguc2NoZW1hLCB2YWx1ZSwgY3R4KSA6IHdyYXBTY2FsYXJzID8gbmV3IFNjYWxhcih2YWx1ZSkgOiB2YWx1ZTtcbiAgaWYgKHRhZ05hbWUgJiYgb2JqLm5vZGUgaW5zdGFuY2VvZiBOb2RlKSBvYmoubm9kZS50YWcgPSB0YWdOYW1lO1xuICByZXR1cm4gb2JqLm5vZGU7XG59XG5cbmV4cG9ydCB7IGNyZWF0ZU5vZGUgfTtcbiIsImltcG9ydCB7IGRlZmluZVByb3BlcnR5IGFzIF9kZWZpbmVQcm9wZXJ0eSB9IGZyb20gJy4uL192aXJ0dWFsL19yb2xsdXBQbHVnaW5CYWJlbEhlbHBlcnMuanMnO1xuaW1wb3J0IHsgYWRkQ29tbWVudCB9IGZyb20gJy4uL3N0cmluZ2lmeS9hZGRDb21tZW50LmpzJztcbmltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgY3JlYXRlTm9kZSB9IGZyb20gJy4uL2RvYy9jcmVhdGVOb2RlLmpzJztcbmltcG9ydCB7IE5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuaW1wb3J0IHsgU2NhbGFyIH0gZnJvbSAnLi9TY2FsYXIuanMnO1xuXG5mdW5jdGlvbiBjb2xsZWN0aW9uRnJvbVBhdGgoc2NoZW1hLCBwYXRoLCB2YWx1ZSkge1xuICBsZXQgdiA9IHZhbHVlO1xuXG4gIGZvciAobGV0IGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgY29uc3QgayA9IHBhdGhbaV07XG5cbiAgICBpZiAoTnVtYmVyLmlzSW50ZWdlcihrKSAmJiBrID49IDApIHtcbiAgICAgIGNvbnN0IGEgPSBbXTtcbiAgICAgIGFba10gPSB2O1xuICAgICAgdiA9IGE7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG8gPSB7fTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrLCB7XG4gICAgICAgIHZhbHVlOiB2LFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIHYgPSBvO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjcmVhdGVOb2RlKHYsIG51bGwsIHtcbiAgICBvbkFsaWFzKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSZXBlYXRlZCBvYmplY3RzIGFyZSBub3Qgc3VwcG9ydGVkIGhlcmUnKTtcbiAgICB9LFxuXG4gICAgcHJldk9iamVjdHM6IG5ldyBNYXAoKSxcbiAgICBzY2hlbWEsXG4gICAgd3JhcFNjYWxhcnM6IGZhbHNlXG4gIH0pO1xufSAvLyBudWxsLCB1bmRlZmluZWQsIG9yIGFuIGVtcHR5IG5vbi1zdHJpbmcgaXRlcmFibGUgKGUuZy4gW10pXG5cbmNvbnN0IGlzRW1wdHlQYXRoID0gcGF0aCA9PiBwYXRoID09IG51bGwgfHwgdHlwZW9mIHBhdGggPT09ICdvYmplY3QnICYmIHBhdGhbU3ltYm9sLml0ZXJhdG9yXSgpLm5leHQoKS5kb25lO1xuY2xhc3MgQ29sbGVjdGlvbiBleHRlbmRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihzY2hlbWEpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgX2RlZmluZVByb3BlcnR5KHRoaXMsIFwiaXRlbXNcIiwgW10pO1xuXG4gICAgdGhpcy5zY2hlbWEgPSBzY2hlbWE7XG4gIH1cblxuICBhZGRJbihwYXRoLCB2YWx1ZSkge1xuICAgIGlmIChpc0VtcHR5UGF0aChwYXRoKSkgdGhpcy5hZGQodmFsdWUpO2Vsc2Uge1xuICAgICAgY29uc3QgW2tleSwgLi4ucmVzdF0gPSBwYXRoO1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0KGtleSwgdHJ1ZSk7XG4gICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIENvbGxlY3Rpb24pIG5vZGUuYWRkSW4ocmVzdCwgdmFsdWUpO2Vsc2UgaWYgKG5vZGUgPT09IHVuZGVmaW5lZCAmJiB0aGlzLnNjaGVtYSkgdGhpcy5zZXQoa2V5LCBjb2xsZWN0aW9uRnJvbVBhdGgodGhpcy5zY2hlbWEsIHJlc3QsIHZhbHVlKSk7ZWxzZSB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBZQU1MIGNvbGxlY3Rpb24gYXQgXCIuY29uY2F0KGtleSwgXCIuIFJlbWFpbmluZyBwYXRoOiBcIikuY29uY2F0KHJlc3QpKTtcbiAgICB9XG4gIH1cblxuICBkZWxldGVJbihba2V5LCAuLi5yZXN0XSkge1xuICAgIGlmIChyZXN0Lmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRoaXMuZGVsZXRlKGtleSk7XG4gICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0KGtleSwgdHJ1ZSk7XG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBDb2xsZWN0aW9uKSByZXR1cm4gbm9kZS5kZWxldGVJbihyZXN0KTtlbHNlIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIFlBTUwgY29sbGVjdGlvbiBhdCBcIi5jb25jYXQoa2V5LCBcIi4gUmVtYWluaW5nIHBhdGg6IFwiKS5jb25jYXQocmVzdCkpO1xuICB9XG5cbiAgZ2V0SW4oW2tleSwgLi4ucmVzdF0sIGtlZXBTY2FsYXIpIHtcbiAgICBjb25zdCBub2RlID0gdGhpcy5nZXQoa2V5LCB0cnVlKTtcbiAgICBpZiAocmVzdC5sZW5ndGggPT09IDApIHJldHVybiAha2VlcFNjYWxhciAmJiBub2RlIGluc3RhbmNlb2YgU2NhbGFyID8gbm9kZS52YWx1ZSA6IG5vZGU7ZWxzZSByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIENvbGxlY3Rpb24gPyBub2RlLmdldEluKHJlc3QsIGtlZXBTY2FsYXIpIDogdW5kZWZpbmVkO1xuICB9XG5cbiAgaGFzQWxsTnVsbFZhbHVlcygpIHtcbiAgICByZXR1cm4gdGhpcy5pdGVtcy5ldmVyeShub2RlID0+IHtcbiAgICAgIGlmICghbm9kZSB8fCBub2RlLnR5cGUgIT09ICdQQUlSJykgcmV0dXJuIGZhbHNlO1xuICAgICAgY29uc3QgbiA9IG5vZGUudmFsdWU7XG4gICAgICByZXR1cm4gbiA9PSBudWxsIHx8IG4gaW5zdGFuY2VvZiBTY2FsYXIgJiYgbi52YWx1ZSA9PSBudWxsICYmICFuLmNvbW1lbnRCZWZvcmUgJiYgIW4uY29tbWVudCAmJiAhbi50YWc7XG4gICAgfSk7XG4gIH1cblxuICBoYXNJbihba2V5LCAuLi5yZXN0XSkge1xuICAgIGlmIChyZXN0Lmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRoaXMuaGFzKGtleSk7XG4gICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0KGtleSwgdHJ1ZSk7XG4gICAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiBDb2xsZWN0aW9uID8gbm9kZS5oYXNJbihyZXN0KSA6IGZhbHNlO1xuICB9XG5cbiAgc2V0SW4oW2tleSwgLi4ucmVzdF0sIHZhbHVlKSB7XG4gICAgaWYgKHJlc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLnNldChrZXksIHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0KGtleSwgdHJ1ZSk7XG4gICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIENvbGxlY3Rpb24pIG5vZGUuc2V0SW4ocmVzdCwgdmFsdWUpO2Vsc2UgaWYgKG5vZGUgPT09IHVuZGVmaW5lZCAmJiB0aGlzLnNjaGVtYSkgdGhpcy5zZXQoa2V5LCBjb2xsZWN0aW9uRnJvbVBhdGgodGhpcy5zY2hlbWEsIHJlc3QsIHZhbHVlKSk7ZWxzZSB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBZQU1MIGNvbGxlY3Rpb24gYXQgXCIuY29uY2F0KGtleSwgXCIuIFJlbWFpbmluZyBwYXRoOiBcIikuY29uY2F0KHJlc3QpKTtcbiAgICB9XG4gIH1cbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQ6IG92ZXJyaWRkZW4gaW4gaW1wbGVtZW50YXRpb25zICovXG5cblxuICB0b0pTT04oKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB0b1N0cmluZyhjdHgsIHtcbiAgICBibG9ja0l0ZW0sXG4gICAgZmxvd0NoYXJzLFxuICAgIGlzTWFwLFxuICAgIGl0ZW1JbmRlbnRcbiAgfSwgb25Db21tZW50LCBvbkNob21wS2VlcCkge1xuICAgIGNvbnN0IHtcbiAgICAgIGluZGVudCxcbiAgICAgIGluZGVudFN0ZXAsXG4gICAgICBzdHJpbmdpZnlcbiAgICB9ID0gY3R4O1xuICAgIGNvbnN0IGluRmxvdyA9IHRoaXMudHlwZSA9PT0gVHlwZS5GTE9XX01BUCB8fCB0aGlzLnR5cGUgPT09IFR5cGUuRkxPV19TRVEgfHwgY3R4LmluRmxvdztcbiAgICBpZiAoaW5GbG93KSBpdGVtSW5kZW50ICs9IGluZGVudFN0ZXA7XG4gICAgY29uc3QgYWxsTnVsbFZhbHVlcyA9IGlzTWFwICYmIHRoaXMuaGFzQWxsTnVsbFZhbHVlcygpO1xuICAgIGN0eCA9IE9iamVjdC5hc3NpZ24oe30sIGN0eCwge1xuICAgICAgYWxsTnVsbFZhbHVlcyxcbiAgICAgIGluZGVudDogaXRlbUluZGVudCxcbiAgICAgIGluRmxvdyxcbiAgICAgIHR5cGU6IG51bGxcbiAgICB9KTtcbiAgICBsZXQgY2hvbXBLZWVwID0gZmFsc2U7XG4gICAgbGV0IGhhc0l0ZW1XaXRoTmV3TGluZSA9IGZhbHNlO1xuICAgIGNvbnN0IG5vZGVzID0gdGhpcy5pdGVtcy5yZWR1Y2UoKG5vZGVzLCBpdGVtLCBpKSA9PiB7XG4gICAgICBsZXQgY29tbWVudDtcblxuICAgICAgaWYgKGl0ZW0pIHtcbiAgICAgICAgaWYgKCFjaG9tcEtlZXAgJiYgaXRlbS5zcGFjZUJlZm9yZSkgbm9kZXMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ2NvbW1lbnQnLFxuICAgICAgICAgIHN0cjogJydcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChpdGVtLmNvbW1lbnRCZWZvcmUpIGl0ZW0uY29tbWVudEJlZm9yZS5tYXRjaCgvXi4qJC9nbSkuZm9yRWFjaChsaW5lID0+IHtcbiAgICAgICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6ICdjb21tZW50JyxcbiAgICAgICAgICAgIHN0cjogXCIjXCIuY29uY2F0KGxpbmUpXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoaXRlbS5jb21tZW50KSBjb21tZW50ID0gaXRlbS5jb21tZW50O1xuICAgICAgICBpZiAoaW5GbG93ICYmICghY2hvbXBLZWVwICYmIGl0ZW0uc3BhY2VCZWZvcmUgfHwgaXRlbS5jb21tZW50QmVmb3JlIHx8IGl0ZW0uY29tbWVudCB8fCBpdGVtLmtleSAmJiAoaXRlbS5rZXkuY29tbWVudEJlZm9yZSB8fCBpdGVtLmtleS5jb21tZW50KSB8fCBpdGVtLnZhbHVlICYmIChpdGVtLnZhbHVlLmNvbW1lbnRCZWZvcmUgfHwgaXRlbS52YWx1ZS5jb21tZW50KSkpIGhhc0l0ZW1XaXRoTmV3TGluZSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGNob21wS2VlcCA9IGZhbHNlO1xuICAgICAgbGV0IHN0ciA9IHN0cmluZ2lmeShpdGVtLCBjdHgsICgpID0+IGNvbW1lbnQgPSBudWxsLCAoKSA9PiBjaG9tcEtlZXAgPSB0cnVlKTtcbiAgICAgIGlmIChpbkZsb3cgJiYgIWhhc0l0ZW1XaXRoTmV3TGluZSAmJiBzdHIuaW5jbHVkZXMoJ1xcbicpKSBoYXNJdGVtV2l0aE5ld0xpbmUgPSB0cnVlO1xuICAgICAgaWYgKGluRmxvdyAmJiBpIDwgdGhpcy5pdGVtcy5sZW5ndGggLSAxKSBzdHIgKz0gJywnO1xuICAgICAgc3RyID0gYWRkQ29tbWVudChzdHIsIGl0ZW1JbmRlbnQsIGNvbW1lbnQpO1xuICAgICAgaWYgKGNob21wS2VlcCAmJiAoY29tbWVudCB8fCBpbkZsb3cpKSBjaG9tcEtlZXAgPSBmYWxzZTtcbiAgICAgIG5vZGVzLnB1c2goe1xuICAgICAgICB0eXBlOiAnaXRlbScsXG4gICAgICAgIHN0clxuICAgICAgfSk7XG4gICAgICByZXR1cm4gbm9kZXM7XG4gICAgfSwgW10pO1xuICAgIGxldCBzdHI7XG5cbiAgICBpZiAobm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzdHIgPSBmbG93Q2hhcnMuc3RhcnQgKyBmbG93Q2hhcnMuZW5kO1xuICAgIH0gZWxzZSBpZiAoaW5GbG93KSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmRcbiAgICAgIH0gPSBmbG93Q2hhcnM7XG4gICAgICBjb25zdCBzdHJpbmdzID0gbm9kZXMubWFwKG4gPT4gbi5zdHIpO1xuXG4gICAgICBpZiAoaGFzSXRlbVdpdGhOZXdMaW5lIHx8IHN0cmluZ3MucmVkdWNlKChzdW0sIHN0cikgPT4gc3VtICsgc3RyLmxlbmd0aCArIDIsIDIpID4gQ29sbGVjdGlvbi5tYXhGbG93U3RyaW5nU2luZ2xlTGluZUxlbmd0aCkge1xuICAgICAgICBzdHIgPSBzdGFydDtcblxuICAgICAgICBmb3IgKGNvbnN0IHMgb2Ygc3RyaW5ncykge1xuICAgICAgICAgIHN0ciArPSBzID8gXCJcXG5cIi5jb25jYXQoaW5kZW50U3RlcCkuY29uY2F0KGluZGVudCkuY29uY2F0KHMpIDogJ1xcbic7XG4gICAgICAgIH1cblxuICAgICAgICBzdHIgKz0gXCJcXG5cIi5jb25jYXQoaW5kZW50KS5jb25jYXQoZW5kKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciA9IFwiXCIuY29uY2F0KHN0YXJ0LCBcIiBcIikuY29uY2F0KHN0cmluZ3Muam9pbignICcpLCBcIiBcIikuY29uY2F0KGVuZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHN0cmluZ3MgPSBub2Rlcy5tYXAoYmxvY2tJdGVtKTtcbiAgICAgIHN0ciA9IHN0cmluZ3Muc2hpZnQoKTtcblxuICAgICAgZm9yIChjb25zdCBzIG9mIHN0cmluZ3MpIHN0ciArPSBzID8gXCJcXG5cIi5jb25jYXQoaW5kZW50KS5jb25jYXQocykgOiAnXFxuJztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb21tZW50KSB7XG4gICAgICBzdHIgKz0gJ1xcbicgKyB0aGlzLmNvbW1lbnQucmVwbGFjZSgvXi9nbSwgXCJcIi5jb25jYXQoaW5kZW50LCBcIiNcIikpO1xuICAgICAgaWYgKG9uQ29tbWVudCkgb25Db21tZW50KCk7XG4gICAgfSBlbHNlIGlmIChjaG9tcEtlZXAgJiYgb25DaG9tcEtlZXApIG9uQ2hvbXBLZWVwKCk7XG5cbiAgICByZXR1cm4gc3RyO1xuICB9XG5cbn1cblxuX2RlZmluZVByb3BlcnR5KENvbGxlY3Rpb24sIFwibWF4Rmxvd1N0cmluZ1NpbmdsZUxpbmVMZW5ndGhcIiwgNjApO1xuXG5leHBvcnQgeyBDb2xsZWN0aW9uLCBjb2xsZWN0aW9uRnJvbVBhdGgsIGlzRW1wdHlQYXRoIH07XG4iLCJpbXBvcnQgeyBMb2dMZXZlbCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuLyogZ2xvYmFsIGNvbnNvbGUsIHByb2Nlc3MgKi9cbmZ1bmN0aW9uIHdhcm4obG9nTGV2ZWwsIHdhcm5pbmcpIHtcbiAgaWYgKExvZ0xldmVsLmluZGV4T2YobG9nTGV2ZWwpID49IExvZ0xldmVsLldBUk4pIHtcbiAgICBpZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHByb2Nlc3MuZW1pdFdhcm5pbmcpIHByb2Nlc3MuZW1pdFdhcm5pbmcod2FybmluZyk7ZWxzZSBjb25zb2xlLndhcm4od2FybmluZyk7XG4gIH1cbn1cblxuZXhwb3J0IHsgd2FybiB9O1xuIiwiaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBTY2FsYXIsIGlzU2NhbGFyVmFsdWUgfSBmcm9tICcuL1NjYWxhci5qcyc7XG5pbXBvcnQgeyB0b0pTIH0gZnJvbSAnLi90b0pTLmpzJztcblxuZnVuY3Rpb24gYXNJdGVtSW5kZXgoa2V5KSB7XG4gIGxldCBpZHggPSBrZXkgaW5zdGFuY2VvZiBTY2FsYXIgPyBrZXkudmFsdWUgOiBrZXk7XG4gIGlmIChpZHggJiYgdHlwZW9mIGlkeCA9PT0gJ3N0cmluZycpIGlkeCA9IE51bWJlcihpZHgpO1xuICByZXR1cm4gTnVtYmVyLmlzSW50ZWdlcihpZHgpICYmIGlkeCA+PSAwID8gaWR4IDogbnVsbDtcbn1cblxuY2xhc3MgWUFNTFNlcSBleHRlbmRzIENvbGxlY3Rpb24ge1xuICBhZGQodmFsdWUpIHtcbiAgICB0aGlzLml0ZW1zLnB1c2godmFsdWUpO1xuICB9XG5cbiAgZGVsZXRlKGtleSkge1xuICAgIGNvbnN0IGlkeCA9IGFzSXRlbUluZGV4KGtleSk7XG4gICAgaWYgKHR5cGVvZiBpZHggIT09ICdudW1iZXInKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgZGVsID0gdGhpcy5pdGVtcy5zcGxpY2UoaWR4LCAxKTtcbiAgICByZXR1cm4gZGVsLmxlbmd0aCA+IDA7XG4gIH1cblxuICBnZXQoa2V5LCBrZWVwU2NhbGFyKSB7XG4gICAgY29uc3QgaWR4ID0gYXNJdGVtSW5kZXgoa2V5KTtcbiAgICBpZiAodHlwZW9mIGlkeCAhPT0gJ251bWJlcicpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgY29uc3QgaXQgPSB0aGlzLml0ZW1zW2lkeF07XG4gICAgcmV0dXJuICFrZWVwU2NhbGFyICYmIGl0IGluc3RhbmNlb2YgU2NhbGFyID8gaXQudmFsdWUgOiBpdDtcbiAgfVxuXG4gIGhhcyhrZXkpIHtcbiAgICBjb25zdCBpZHggPSBhc0l0ZW1JbmRleChrZXkpO1xuICAgIHJldHVybiB0eXBlb2YgaWR4ID09PSAnbnVtYmVyJyAmJiBpZHggPCB0aGlzLml0ZW1zLmxlbmd0aDtcbiAgfVxuXG4gIHNldChrZXksIHZhbHVlKSB7XG4gICAgY29uc3QgaWR4ID0gYXNJdGVtSW5kZXgoa2V5KTtcbiAgICBpZiAodHlwZW9mIGlkeCAhPT0gJ251bWJlcicpIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIGEgdmFsaWQgaW5kZXgsIG5vdCBcIi5jb25jYXQoa2V5LCBcIi5cIikpO1xuICAgIGNvbnN0IHByZXYgPSB0aGlzLml0ZW1zW2lkeF07XG4gICAgaWYgKHByZXYgaW5zdGFuY2VvZiBTY2FsYXIgJiYgaXNTY2FsYXJWYWx1ZSh2YWx1ZSkpIHByZXYudmFsdWUgPSB2YWx1ZTtlbHNlIHRoaXMuaXRlbXNbaWR4XSA9IHZhbHVlO1xuICB9XG5cbiAgdG9KU09OKF8sIGN0eCkge1xuICAgIGNvbnN0IHNlcSA9IFtdO1xuICAgIGlmIChjdHggJiYgY3R4Lm9uQ3JlYXRlKSBjdHgub25DcmVhdGUoc2VxKTtcbiAgICBsZXQgaSA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVtcykgc2VxLnB1c2godG9KUyhpdGVtLCBTdHJpbmcoaSsrKSwgY3R4KSk7XG5cbiAgICByZXR1cm4gc2VxO1xuICB9XG5cbiAgdG9TdHJpbmcoY3R4LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKSB7XG4gICAgaWYgKCFjdHgpIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzKTtcbiAgICByZXR1cm4gc3VwZXIudG9TdHJpbmcoY3R4LCB7XG4gICAgICBibG9ja0l0ZW06IG4gPT4gbi50eXBlID09PSAnY29tbWVudCcgPyBuLnN0ciA6IFwiLSBcIi5jb25jYXQobi5zdHIpLFxuICAgICAgZmxvd0NoYXJzOiB7XG4gICAgICAgIHN0YXJ0OiAnWycsXG4gICAgICAgIGVuZDogJ10nXG4gICAgICB9LFxuICAgICAgaXNNYXA6IGZhbHNlLFxuICAgICAgaXRlbUluZGVudDogKGN0eC5pbmRlbnQgfHwgJycpICsgJyAgJ1xuICAgIH0sIG9uQ29tbWVudCwgb25DaG9tcEtlZXApO1xuICB9XG5cbn1cblxuZXhwb3J0IHsgWUFNTFNlcSB9O1xuIiwiaW1wb3J0IHsgZGVmaW5lUHJvcGVydHkgYXMgX2RlZmluZVByb3BlcnR5IH0gZnJvbSAnLi4vX3ZpcnR1YWwvX3JvbGx1cFBsdWdpbkJhYmVsSGVscGVycy5qcyc7XG5pbXBvcnQgeyBUeXBlIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGNyZWF0ZU5vZGUgfSBmcm9tICcuLi9kb2MvY3JlYXRlTm9kZS5qcyc7XG5pbXBvcnQgeyB3YXJuIH0gZnJvbSAnLi4vbG9nLmpzJztcbmltcG9ydCB7IGFkZENvbW1lbnQgfSBmcm9tICcuLi9zdHJpbmdpZnkvYWRkQ29tbWVudC5qcyc7XG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9Db2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IE5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuaW1wb3J0IHsgU2NhbGFyIH0gZnJvbSAnLi9TY2FsYXIuanMnO1xuaW1wb3J0IHsgWUFNTFNlcSB9IGZyb20gJy4vWUFNTFNlcS5qcyc7XG5pbXBvcnQgeyB0b0pTIH0gZnJvbSAnLi90b0pTLmpzJztcblxuZnVuY3Rpb24gc3RyaW5naWZ5S2V5KGtleSwganNLZXksIGN0eCkge1xuICBpZiAoanNLZXkgPT09IG51bGwpIHJldHVybiAnJztcbiAgaWYgKHR5cGVvZiBqc0tleSAhPT0gJ29iamVjdCcpIHJldHVybiBTdHJpbmcoanNLZXkpO1xuXG4gIGlmIChrZXkgaW5zdGFuY2VvZiBOb2RlICYmIGN0eCAmJiBjdHguZG9jKSB7XG4gICAgY29uc3Qgc3RyS2V5ID0ga2V5LnRvU3RyaW5nKHtcbiAgICAgIGFuY2hvcnM6IE9iamVjdC5jcmVhdGUobnVsbCksXG4gICAgICBkb2M6IGN0eC5kb2MsXG4gICAgICBpbmRlbnQ6ICcnLFxuICAgICAgaW5kZW50U3RlcDogY3R4LmluZGVudFN0ZXAsXG4gICAgICBpbkZsb3c6IHRydWUsXG4gICAgICBpblN0cmluZ2lmeUtleTogdHJ1ZSxcbiAgICAgIHN0cmluZ2lmeTogY3R4LnN0cmluZ2lmeVxuICAgIH0pO1xuXG4gICAgaWYgKCFjdHgubWFwS2V5V2FybmVkKSB7XG4gICAgICBsZXQganNvblN0ciA9IEpTT04uc3RyaW5naWZ5KHN0cktleSk7XG4gICAgICBpZiAoanNvblN0ci5sZW5ndGggPiA0MCkganNvblN0ciA9IGpzb25TdHIuc3BsaXQoJycpLnNwbGljZSgzNiwgJy4uLlwiJykuam9pbignJyk7XG4gICAgICB3YXJuKGN0eC5kb2Mub3B0aW9ucy5sb2dMZXZlbCwgXCJLZXlzIHdpdGggY29sbGVjdGlvbiB2YWx1ZXMgd2lsbCBiZSBzdHJpbmdpZmllZCBkdWUgdG8gSlMgT2JqZWN0IHJlc3RyaWN0aW9uczogXCIuY29uY2F0KGpzb25TdHIsIFwiLiBTZXQgbWFwQXNNYXA6IHRydWUgdG8gdXNlIG9iamVjdCBrZXlzLlwiKSk7XG4gICAgICBjdHgubWFwS2V5V2FybmVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RyS2V5O1xuICB9XG5cbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGpzS2V5KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUGFpcihrZXksIHZhbHVlLCBjdHgpIHtcbiAgY29uc3QgayA9IGNyZWF0ZU5vZGUoa2V5LCBudWxsLCBjdHgpO1xuICBjb25zdCB2ID0gY3JlYXRlTm9kZSh2YWx1ZSwgbnVsbCwgY3R4KTtcbiAgcmV0dXJuIG5ldyBQYWlyKGssIHYpO1xufVxuY2xhc3MgUGFpciBleHRlbmRzIE5vZGUge1xuICBjb25zdHJ1Y3RvcihrZXksIHZhbHVlID0gbnVsbCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5rZXkgPSBrZXk7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgIHRoaXMudHlwZSA9IFBhaXIuVHlwZS5QQUlSO1xuICB9XG5cbiAgZ2V0IGNvbW1lbnRCZWZvcmUoKSB7XG4gICAgcmV0dXJuIHRoaXMua2V5IGluc3RhbmNlb2YgTm9kZSA/IHRoaXMua2V5LmNvbW1lbnRCZWZvcmUgOiB1bmRlZmluZWQ7XG4gIH1cblxuICBzZXQgY29tbWVudEJlZm9yZShjYikge1xuICAgIGlmICh0aGlzLmtleSA9PSBudWxsKSB0aGlzLmtleSA9IG5ldyBTY2FsYXIobnVsbCk7XG4gICAgaWYgKHRoaXMua2V5IGluc3RhbmNlb2YgTm9kZSkgdGhpcy5rZXkuY29tbWVudEJlZm9yZSA9IGNiO2Vsc2Uge1xuICAgICAgY29uc3QgbXNnID0gJ1BhaXIuY29tbWVudEJlZm9yZSBpcyBhbiBhbGlhcyBmb3IgUGFpci5rZXkuY29tbWVudEJlZm9yZS4gVG8gc2V0IGl0LCB0aGUga2V5IG11c3QgYmUgYSBOb2RlLic7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICB9XG4gIH1cblxuICBhZGRUb0pTTWFwKGN0eCwgbWFwKSB7XG4gICAgY29uc3Qga2V5ID0gdG9KUyh0aGlzLmtleSwgJycsIGN0eCk7XG5cbiAgICBpZiAobWFwIGluc3RhbmNlb2YgTWFwKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHRvSlModGhpcy52YWx1ZSwga2V5LCBjdHgpO1xuICAgICAgbWFwLnNldChrZXksIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKG1hcCBpbnN0YW5jZW9mIFNldCkge1xuICAgICAgbWFwLmFkZChrZXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzdHJpbmdLZXkgPSBzdHJpbmdpZnlLZXkodGhpcy5rZXksIGtleSwgY3R4KTtcbiAgICAgIGNvbnN0IHZhbHVlID0gdG9KUyh0aGlzLnZhbHVlLCBzdHJpbmdLZXksIGN0eCk7XG4gICAgICBpZiAoc3RyaW5nS2V5IGluIG1hcCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1hcCwgc3RyaW5nS2V5LCB7XG4gICAgICAgIHZhbHVlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtlbHNlIG1hcFtzdHJpbmdLZXldID0gdmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hcDtcbiAgfVxuXG4gIHRvSlNPTihfLCBjdHgpIHtcbiAgICBjb25zdCBwYWlyID0gY3R4ICYmIGN0eC5tYXBBc01hcCA/IG5ldyBNYXAoKSA6IHt9O1xuICAgIHJldHVybiB0aGlzLmFkZFRvSlNNYXAoY3R4LCBwYWlyKTtcbiAgfVxuXG4gIHRvU3RyaW5nKGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCkge1xuICAgIGlmICghY3R4IHx8ICFjdHguZG9jKSByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcyk7XG4gICAgY29uc3Qge1xuICAgICAgaW5kZW50OiBpbmRlbnRTaXplLFxuICAgICAgaW5kZW50U2VxLFxuICAgICAgc2ltcGxlS2V5c1xuICAgIH0gPSBjdHguZG9jLm9wdGlvbnM7XG4gICAgbGV0IHtcbiAgICAgIGtleSxcbiAgICAgIHZhbHVlXG4gICAgfSA9IHRoaXM7XG4gICAgbGV0IGtleUNvbW1lbnQgPSBrZXkgaW5zdGFuY2VvZiBOb2RlICYmIGtleS5jb21tZW50O1xuXG4gICAgaWYgKHNpbXBsZUtleXMpIHtcbiAgICAgIGlmIChrZXlDb21tZW50KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignV2l0aCBzaW1wbGUga2V5cywga2V5IG5vZGVzIGNhbm5vdCBoYXZlIGNvbW1lbnRzJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChrZXkgaW5zdGFuY2VvZiBDb2xsZWN0aW9uKSB7XG4gICAgICAgIGNvbnN0IG1zZyA9ICdXaXRoIHNpbXBsZSBrZXlzLCBjb2xsZWN0aW9uIGNhbm5vdCBiZSB1c2VkIGFzIGEga2V5IHZhbHVlJztcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGV4cGxpY2l0S2V5ID0gIXNpbXBsZUtleXMgJiYgKCFrZXkgfHwga2V5Q29tbWVudCB8fCAoa2V5IGluc3RhbmNlb2YgTm9kZSA/IGtleSBpbnN0YW5jZW9mIENvbGxlY3Rpb24gfHwga2V5LnR5cGUgPT09IFR5cGUuQkxPQ0tfRk9MREVEIHx8IGtleS50eXBlID09PSBUeXBlLkJMT0NLX0xJVEVSQUwgOiB0eXBlb2Yga2V5ID09PSAnb2JqZWN0JykpO1xuICAgIGNvbnN0IHtcbiAgICAgIGFsbE51bGxWYWx1ZXMsXG4gICAgICBkb2MsXG4gICAgICBpbmRlbnQsXG4gICAgICBpbmRlbnRTdGVwLFxuICAgICAgc3RyaW5naWZ5XG4gICAgfSA9IGN0eDtcbiAgICBjdHggPSBPYmplY3QuYXNzaWduKHt9LCBjdHgsIHtcbiAgICAgIGltcGxpY2l0S2V5OiAhZXhwbGljaXRLZXkgJiYgKHNpbXBsZUtleXMgfHwgIWFsbE51bGxWYWx1ZXMpLFxuICAgICAgaW5kZW50OiBpbmRlbnQgKyBpbmRlbnRTdGVwXG4gICAgfSk7XG4gICAgbGV0IGNob21wS2VlcCA9IGZhbHNlO1xuICAgIGxldCBzdHIgPSBzdHJpbmdpZnkoa2V5LCBjdHgsICgpID0+IGtleUNvbW1lbnQgPSBudWxsLCAoKSA9PiBjaG9tcEtlZXAgPSB0cnVlKTtcbiAgICBzdHIgPSBhZGRDb21tZW50KHN0ciwgY3R4LmluZGVudCwga2V5Q29tbWVudCk7XG5cbiAgICBpZiAoIWV4cGxpY2l0S2V5ICYmIHN0ci5sZW5ndGggPiAxMDI0KSB7XG4gICAgICBpZiAoc2ltcGxlS2V5cykgdGhyb3cgbmV3IEVycm9yKCdXaXRoIHNpbXBsZSBrZXlzLCBzaW5nbGUgbGluZSBzY2FsYXIgbXVzdCBub3Qgc3BhbiBtb3JlIHRoYW4gMTAyNCBjaGFyYWN0ZXJzJyk7XG4gICAgICBleHBsaWNpdEtleSA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKGFsbE51bGxWYWx1ZXMgJiYgIXNpbXBsZUtleXMpIHtcbiAgICAgIGlmICh0aGlzLmNvbW1lbnQpIHtcbiAgICAgICAgc3RyID0gYWRkQ29tbWVudChzdHIsIGN0eC5pbmRlbnQsIHRoaXMuY29tbWVudCk7XG4gICAgICAgIGlmIChvbkNvbW1lbnQpIG9uQ29tbWVudCgpO1xuICAgICAgfSBlbHNlIGlmIChjaG9tcEtlZXAgJiYgIWtleUNvbW1lbnQgJiYgb25DaG9tcEtlZXApIG9uQ2hvbXBLZWVwKCk7XG5cbiAgICAgIHJldHVybiBjdHguaW5GbG93ICYmICFleHBsaWNpdEtleSA/IHN0ciA6IFwiPyBcIi5jb25jYXQoc3RyKTtcbiAgICB9XG5cbiAgICBzdHIgPSBleHBsaWNpdEtleSA/IFwiPyBcIi5jb25jYXQoc3RyLCBcIlxcblwiKS5jb25jYXQoaW5kZW50LCBcIjpcIikgOiBcIlwiLmNvbmNhdChzdHIsIFwiOlwiKTtcblxuICAgIGlmICh0aGlzLmNvbW1lbnQpIHtcbiAgICAgIC8vIGV4cGVjdGVkIChidXQgbm90IHN0cmljdGx5IHJlcXVpcmVkKSB0byBiZSBhIHNpbmdsZS1saW5lIGNvbW1lbnRcbiAgICAgIHN0ciA9IGFkZENvbW1lbnQoc3RyLCBjdHguaW5kZW50LCB0aGlzLmNvbW1lbnQpO1xuICAgICAgaWYgKG9uQ29tbWVudCkgb25Db21tZW50KCk7XG4gICAgfVxuXG4gICAgbGV0IHZjYiA9ICcnO1xuICAgIGxldCB2YWx1ZUNvbW1lbnQgPSBudWxsO1xuXG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgTm9kZSkge1xuICAgICAgaWYgKHZhbHVlLnNwYWNlQmVmb3JlKSB2Y2IgPSAnXFxuJztcblxuICAgICAgaWYgKHZhbHVlLmNvbW1lbnRCZWZvcmUpIHtcbiAgICAgICAgY29uc3QgY3MgPSB2YWx1ZS5jb21tZW50QmVmb3JlLnJlcGxhY2UoL14vZ20sIFwiXCIuY29uY2F0KGN0eC5pbmRlbnQsIFwiI1wiKSk7XG4gICAgICAgIHZjYiArPSBcIlxcblwiLmNvbmNhdChjcyk7XG4gICAgICB9XG5cbiAgICAgIHZhbHVlQ29tbWVudCA9IHZhbHVlLmNvbW1lbnQ7XG4gICAgfSBlbHNlIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICB2YWx1ZSA9IGRvYy5jcmVhdGVOb2RlKHZhbHVlKTtcbiAgICB9XG5cbiAgICBjdHguaW1wbGljaXRLZXkgPSBmYWxzZTtcbiAgICBpZiAoIWV4cGxpY2l0S2V5ICYmICF0aGlzLmNvbW1lbnQgJiYgdmFsdWUgaW5zdGFuY2VvZiBTY2FsYXIpIGN0eC5pbmRlbnRBdFN0YXJ0ID0gc3RyLmxlbmd0aCArIDE7XG4gICAgY2hvbXBLZWVwID0gZmFsc2U7XG5cbiAgICBpZiAoIWluZGVudFNlcSAmJiBpbmRlbnRTaXplID49IDIgJiYgIWN0eC5pbkZsb3cgJiYgIWV4cGxpY2l0S2V5ICYmIHZhbHVlIGluc3RhbmNlb2YgWUFNTFNlcSAmJiB2YWx1ZS50eXBlICE9PSBUeXBlLkZMT1dfU0VRICYmICF2YWx1ZS50YWcgJiYgIWRvYy5hbmNob3JzLmdldE5hbWUodmFsdWUpKSB7XG4gICAgICAvLyBJZiBpbmRlbnRTZXEgPT09IGZhbHNlLCBjb25zaWRlciAnLSAnIGFzIHBhcnQgb2YgaW5kZW50YXRpb24gd2hlcmUgcG9zc2libGVcbiAgICAgIGN0eC5pbmRlbnQgPSBjdHguaW5kZW50LnN1YnN0cigyKTtcbiAgICB9XG5cbiAgICBjb25zdCB2YWx1ZVN0ciA9IHN0cmluZ2lmeSh2YWx1ZSwgY3R4LCAoKSA9PiB2YWx1ZUNvbW1lbnQgPSBudWxsLCAoKSA9PiBjaG9tcEtlZXAgPSB0cnVlKTtcbiAgICBsZXQgd3MgPSAnICc7XG5cbiAgICBpZiAodmNiIHx8IHRoaXMuY29tbWVudCkge1xuICAgICAgd3MgPSBcIlwiLmNvbmNhdCh2Y2IsIFwiXFxuXCIpLmNvbmNhdChjdHguaW5kZW50KTtcbiAgICB9IGVsc2UgaWYgKCFleHBsaWNpdEtleSAmJiB2YWx1ZSBpbnN0YW5jZW9mIENvbGxlY3Rpb24pIHtcbiAgICAgIGNvbnN0IGZsb3cgPSB2YWx1ZVN0clswXSA9PT0gJ1snIHx8IHZhbHVlU3RyWzBdID09PSAneyc7XG4gICAgICBpZiAoIWZsb3cgfHwgdmFsdWVTdHIuaW5jbHVkZXMoJ1xcbicpKSB3cyA9IFwiXFxuXCIuY29uY2F0KGN0eC5pbmRlbnQpO1xuICAgIH0gZWxzZSBpZiAodmFsdWVTdHJbMF0gPT09ICdcXG4nKSB3cyA9ICcnO1xuXG4gICAgaWYgKGNob21wS2VlcCAmJiAhdmFsdWVDb21tZW50ICYmIG9uQ2hvbXBLZWVwKSBvbkNob21wS2VlcCgpO1xuICAgIHJldHVybiBhZGRDb21tZW50KHN0ciArIHdzICsgdmFsdWVTdHIsIGN0eC5pbmRlbnQsIHZhbHVlQ29tbWVudCk7XG4gIH1cblxufVxuXG5fZGVmaW5lUHJvcGVydHkoUGFpciwgXCJUeXBlXCIsIHtcbiAgUEFJUjogJ1BBSVInLFxuICBNRVJHRV9QQUlSOiAnTUVSR0VfUEFJUidcbn0pO1xuXG5leHBvcnQgeyBQYWlyLCBjcmVhdGVQYWlyIH07XG4iLCJpbXBvcnQgeyBkZWZpbmVQcm9wZXJ0eSBhcyBfZGVmaW5lUHJvcGVydHkgfSBmcm9tICcuLi9fdmlydHVhbC9fcm9sbHVwUGx1Z2luQmFiZWxIZWxwZXJzLmpzJztcbmltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWUFNTFJlZmVyZW5jZUVycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuL0NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5pbXBvcnQgeyBQYWlyIH0gZnJvbSAnLi9QYWlyLmpzJztcbmltcG9ydCB7IHRvSlMgfSBmcm9tICcuL3RvSlMuanMnO1xuXG5jb25zdCBnZXRBbGlhc0NvdW50ID0gKG5vZGUsIGFuY2hvcnMpID0+IHtcbiAgaWYgKG5vZGUgaW5zdGFuY2VvZiBBbGlhcykge1xuICAgIGNvbnN0IGFuY2hvciA9IGFuY2hvcnMuZ2V0KG5vZGUuc291cmNlKTtcbiAgICByZXR1cm4gYW5jaG9yLmNvdW50ICogYW5jaG9yLmFsaWFzQ291bnQ7XG4gIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIENvbGxlY3Rpb24pIHtcbiAgICBsZXQgY291bnQgPSAwO1xuXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIG5vZGUuaXRlbXMpIHtcbiAgICAgIGNvbnN0IGMgPSBnZXRBbGlhc0NvdW50KGl0ZW0sIGFuY2hvcnMpO1xuICAgICAgaWYgKGMgPiBjb3VudCkgY291bnQgPSBjO1xuICAgIH1cblxuICAgIHJldHVybiBjb3VudDtcbiAgfSBlbHNlIGlmIChub2RlIGluc3RhbmNlb2YgUGFpcikge1xuICAgIGNvbnN0IGtjID0gZ2V0QWxpYXNDb3VudChub2RlLmtleSwgYW5jaG9ycyk7XG4gICAgY29uc3QgdmMgPSBnZXRBbGlhc0NvdW50KG5vZGUudmFsdWUsIGFuY2hvcnMpO1xuICAgIHJldHVybiBNYXRoLm1heChrYywgdmMpO1xuICB9XG5cbiAgcmV0dXJuIDE7XG59O1xuXG5jbGFzcyBBbGlhcyBleHRlbmRzIE5vZGUge1xuICBzdGF0aWMgc3RyaW5naWZ5KHtcbiAgICByYW5nZSxcbiAgICBzb3VyY2VcbiAgfSwge1xuICAgIGFuY2hvcnMsXG4gICAgZG9jLFxuICAgIGltcGxpY2l0S2V5LFxuICAgIGluU3RyaW5naWZ5S2V5XG4gIH0pIHtcbiAgICBsZXQgYW5jaG9yID0gT2JqZWN0LmtleXMoYW5jaG9ycykuZmluZChhID0+IGFuY2hvcnNbYV0gPT09IHNvdXJjZSk7XG4gICAgaWYgKCFhbmNob3IgJiYgaW5TdHJpbmdpZnlLZXkpIGFuY2hvciA9IGRvYy5hbmNob3JzLmdldE5hbWUoc291cmNlKSB8fCBkb2MuYW5jaG9ycy5uZXdOYW1lKCk7XG4gICAgaWYgKGFuY2hvcikgcmV0dXJuIFwiKlwiLmNvbmNhdChhbmNob3IpLmNvbmNhdChpbXBsaWNpdEtleSA/ICcgJyA6ICcnKTtcbiAgICBjb25zdCBtc2cgPSBkb2MuYW5jaG9ycy5nZXROYW1lKHNvdXJjZSkgPyAnQWxpYXMgbm9kZSBtdXN0IGJlIGFmdGVyIHNvdXJjZSBub2RlJyA6ICdTb3VyY2Ugbm9kZSBub3QgZm91bmQgZm9yIGFsaWFzIG5vZGUnO1xuICAgIHRocm93IG5ldyBFcnJvcihcIlwiLmNvbmNhdChtc2csIFwiIFtcIikuY29uY2F0KHJhbmdlLCBcIl1cIikpO1xuICB9XG5cbiAgY29uc3RydWN0b3Ioc291cmNlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnNvdXJjZSA9IHNvdXJjZTtcbiAgICB0aGlzLnR5cGUgPSBUeXBlLkFMSUFTO1xuICB9XG5cbiAgc2V0IHRhZyh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBbGlhcyBub2RlcyBjYW5ub3QgaGF2ZSB0YWdzJyk7XG4gIH1cblxuICB0b0pTT04oYXJnLCBjdHgpIHtcbiAgICBpZiAoIWN0eCkgcmV0dXJuIHRvSlModGhpcy5zb3VyY2UsIGFyZywgY3R4KTtcbiAgICBjb25zdCB7XG4gICAgICBhbmNob3JzLFxuICAgICAgbWF4QWxpYXNDb3VudFxuICAgIH0gPSBjdHg7XG4gICAgY29uc3QgYW5jaG9yID0gYW5jaG9ycy5nZXQodGhpcy5zb3VyY2UpO1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuXG4gICAgaWYgKCFhbmNob3IgfHwgYW5jaG9yLnJlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBtc2cgPSAnVGhpcyBzaG91bGQgbm90IGhhcHBlbjogQWxpYXMgYW5jaG9yIHdhcyBub3QgcmVzb2x2ZWQ/JztcbiAgICAgIGlmICh0aGlzLmNzdE5vZGUpIHRocm93IG5ldyBZQU1MUmVmZXJlbmNlRXJyb3IodGhpcy5jc3ROb2RlLCBtc2cpO2Vsc2UgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKG1zZyk7XG4gICAgfVxuXG4gICAgaWYgKG1heEFsaWFzQ291bnQgPj0gMCkge1xuICAgICAgYW5jaG9yLmNvdW50ICs9IDE7XG4gICAgICBpZiAoYW5jaG9yLmFsaWFzQ291bnQgPT09IDApIGFuY2hvci5hbGlhc0NvdW50ID0gZ2V0QWxpYXNDb3VudCh0aGlzLnNvdXJjZSwgYW5jaG9ycyk7XG5cbiAgICAgIGlmIChhbmNob3IuY291bnQgKiBhbmNob3IuYWxpYXNDb3VudCA+IG1heEFsaWFzQ291bnQpIHtcbiAgICAgICAgY29uc3QgbXNnID0gJ0V4Y2Vzc2l2ZSBhbGlhcyBjb3VudCBpbmRpY2F0ZXMgYSByZXNvdXJjZSBleGhhdXN0aW9uIGF0dGFjayc7XG4gICAgICAgIGlmICh0aGlzLmNzdE5vZGUpIHRocm93IG5ldyBZQU1MUmVmZXJlbmNlRXJyb3IodGhpcy5jc3ROb2RlLCBtc2cpO2Vsc2UgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKG1zZyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGFuY2hvci5yZXM7XG4gIH0gLy8gT25seSBjYWxsZWQgd2hlbiBzdHJpbmdpZnlpbmcgYW4gYWxpYXMgbWFwcGluZyBrZXkgd2hpbGUgY29uc3RydWN0aW5nXG4gIC8vIE9iamVjdCBvdXRwdXQuXG5cblxuICB0b1N0cmluZyhjdHgpIHtcbiAgICByZXR1cm4gQWxpYXMuc3RyaW5naWZ5KHRoaXMsIGN0eCk7XG4gIH1cblxufVxuXG5fZGVmaW5lUHJvcGVydHkoQWxpYXMsIFwiZGVmYXVsdFwiLCB0cnVlKTtcblxuZXhwb3J0IHsgQWxpYXMgfTtcbiIsImltcG9ydCB7IFNjYWxhciB9IGZyb20gJy4uL2FzdC9TY2FsYXIuanMnO1xuXG5mdW5jdGlvbiByZXNvbHZlU2NhbGFyKHN0ciwgdGFncykge1xuICBmb3IgKGNvbnN0IHtcbiAgICBmb3JtYXQsXG4gICAgdGVzdCxcbiAgICByZXNvbHZlXG4gIH0gb2YgdGFncykge1xuICAgIGlmICh0ZXN0ICYmIHRlc3QudGVzdChzdHIpKSB7XG4gICAgICBsZXQgcmVzID0gcmVzb2x2ZShzdHIpO1xuICAgICAgaWYgKCEocmVzIGluc3RhbmNlb2YgU2NhbGFyKSkgcmVzID0gbmV3IFNjYWxhcihyZXMpO1xuICAgICAgaWYgKGZvcm1hdCkgcmVzLmZvcm1hdCA9IGZvcm1hdDtcbiAgICAgIHJldHVybiByZXM7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ldyBTY2FsYXIoc3RyKTsgLy8gZmFsbGJhY2sgdG8gc3RyaW5nXG59XG5cbmV4cG9ydCB7IHJlc29sdmVTY2FsYXIgfTtcbiIsImNvbnN0IEZPTERfRkxPVyA9ICdmbG93JztcbmNvbnN0IEZPTERfQkxPQ0sgPSAnYmxvY2snO1xuY29uc3QgRk9MRF9RVU9URUQgPSAncXVvdGVkJzsgLy8gcHJlc3VtZXMgaSsxIGlzIGF0IHRoZSBzdGFydCBvZiBhIGxpbmVcbi8vIHJldHVybnMgaW5kZXggb2YgbGFzdCBuZXdsaW5lIGluIG1vcmUtaW5kZW50ZWQgYmxvY2tcblxuY29uc3QgY29uc3VtZU1vcmVJbmRlbnRlZExpbmVzID0gKHRleHQsIGkpID0+IHtcbiAgbGV0IGNoID0gdGV4dFtpICsgMV07XG5cbiAgd2hpbGUgKGNoID09PSAnICcgfHwgY2ggPT09ICdcXHQnKSB7XG4gICAgZG8ge1xuICAgICAgY2ggPSB0ZXh0W2kgKz0gMV07XG4gICAgfSB3aGlsZSAoY2ggJiYgY2ggIT09ICdcXG4nKTtcblxuICAgIGNoID0gdGV4dFtpICsgMV07XG4gIH1cblxuICByZXR1cm4gaTtcbn07XG4vKipcbiAqIFRyaWVzIHRvIGtlZXAgaW5wdXQgYXQgdXAgdG8gYGxpbmVXaWR0aGAgY2hhcmFjdGVycywgc3BsaXR0aW5nIG9ubHkgb24gc3BhY2VzXG4gKiBub3QgZm9sbG93ZWQgYnkgbmV3bGluZXMgb3Igc3BhY2VzIHVubGVzcyBgbW9kZWAgaXMgYCdxdW90ZWQnYC4gTGluZXMgYXJlXG4gKiB0ZXJtaW5hdGVkIHdpdGggYFxcbmAgYW5kIHN0YXJ0ZWQgd2l0aCBgaW5kZW50YC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dFxuICogQHBhcmFtIHtzdHJpbmd9IGluZGVudFxuICogQHBhcmFtIHtzdHJpbmd9IFttb2RlPSdmbG93J10gYCdibG9jaydgIHByZXZlbnRzIG1vcmUtaW5kZW50ZWQgbGluZXNcbiAqICAgZnJvbSBiZWluZyBmb2xkZWQ7IGAncXVvdGVkJ2AgYWxsb3dzIGZvciBgXFxgIGVzY2FwZXMsIGluY2x1ZGluZyBlc2NhcGVkXG4gKiAgIG5ld2xpbmVzXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmluZGVudEF0U3RhcnRdIEFjY291bnRzIGZvciBsZWFkaW5nIGNvbnRlbnRzIG9uXG4gKiAgIHRoZSBmaXJzdCBsaW5lLCBkZWZhdWx0aW5nIHRvIGBpbmRlbnQubGVuZ3RoYFxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmxpbmVXaWR0aD04MF1cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5Db250ZW50V2lkdGg9MjBdIEFsbG93IGhpZ2hseSBpbmRlbnRlZCBsaW5lcyB0b1xuICogICBzdHJldGNoIHRoZSBsaW5lIHdpZHRoIG9yIGluZGVudCBjb250ZW50IGZyb20gdGhlIHN0YXJ0XG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBvcHRpb25zLm9uRm9sZCBDYWxsZWQgb25jZSBpZiB0aGUgdGV4dCBpcyBmb2xkZWRcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IG9wdGlvbnMub25Gb2xkIENhbGxlZCBvbmNlIGlmIGFueSBsaW5lIG9mIHRleHQgZXhjZWVkc1xuICogICBsaW5lV2lkdGggY2hhcmFjdGVyc1xuICovXG5cblxuZnVuY3Rpb24gZm9sZEZsb3dMaW5lcyh0ZXh0LCBpbmRlbnQsIG1vZGUsIHtcbiAgaW5kZW50QXRTdGFydCxcbiAgbGluZVdpZHRoID0gODAsXG4gIG1pbkNvbnRlbnRXaWR0aCA9IDIwLFxuICBvbkZvbGQsXG4gIG9uT3ZlcmZsb3dcbn0pIHtcbiAgaWYgKCFsaW5lV2lkdGggfHwgbGluZVdpZHRoIDwgMCkgcmV0dXJuIHRleHQ7XG4gIGNvbnN0IGVuZFN0ZXAgPSBNYXRoLm1heCgxICsgbWluQ29udGVudFdpZHRoLCAxICsgbGluZVdpZHRoIC0gaW5kZW50Lmxlbmd0aCk7XG4gIGlmICh0ZXh0Lmxlbmd0aCA8PSBlbmRTdGVwKSByZXR1cm4gdGV4dDtcbiAgY29uc3QgZm9sZHMgPSBbXTtcbiAgY29uc3QgZXNjYXBlZEZvbGRzID0ge307XG4gIGxldCBlbmQgPSBsaW5lV2lkdGggLSBpbmRlbnQubGVuZ3RoO1xuXG4gIGlmICh0eXBlb2YgaW5kZW50QXRTdGFydCA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAoaW5kZW50QXRTdGFydCA+IGxpbmVXaWR0aCAtIE1hdGgubWF4KDIsIG1pbkNvbnRlbnRXaWR0aCkpIGZvbGRzLnB1c2goMCk7ZWxzZSBlbmQgPSBsaW5lV2lkdGggLSBpbmRlbnRBdFN0YXJ0O1xuICB9XG5cbiAgbGV0IHNwbGl0ID0gdW5kZWZpbmVkO1xuICBsZXQgcHJldiA9IHVuZGVmaW5lZDtcbiAgbGV0IG92ZXJmbG93ID0gZmFsc2U7XG4gIGxldCBpID0gLTE7XG4gIGxldCBlc2NTdGFydCA9IC0xO1xuICBsZXQgZXNjRW5kID0gLTE7XG5cbiAgaWYgKG1vZGUgPT09IEZPTERfQkxPQ0spIHtcbiAgICBpID0gY29uc3VtZU1vcmVJbmRlbnRlZExpbmVzKHRleHQsIGkpO1xuICAgIGlmIChpICE9PSAtMSkgZW5kID0gaSArIGVuZFN0ZXA7XG4gIH1cblxuICBmb3IgKGxldCBjaDsgY2ggPSB0ZXh0W2kgKz0gMV07KSB7XG4gICAgaWYgKG1vZGUgPT09IEZPTERfUVVPVEVEICYmIGNoID09PSAnXFxcXCcpIHtcbiAgICAgIGVzY1N0YXJ0ID0gaTtcblxuICAgICAgc3dpdGNoICh0ZXh0W2kgKyAxXSkge1xuICAgICAgICBjYXNlICd4JzpcbiAgICAgICAgICBpICs9IDM7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAndSc6XG4gICAgICAgICAgaSArPSA1O1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ1UnOlxuICAgICAgICAgIGkgKz0gOTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGkgKz0gMTtcbiAgICAgIH1cblxuICAgICAgZXNjRW5kID0gaTtcbiAgICB9XG5cbiAgICBpZiAoY2ggPT09ICdcXG4nKSB7XG4gICAgICBpZiAobW9kZSA9PT0gRk9MRF9CTE9DSykgaSA9IGNvbnN1bWVNb3JlSW5kZW50ZWRMaW5lcyh0ZXh0LCBpKTtcbiAgICAgIGVuZCA9IGkgKyBlbmRTdGVwO1xuICAgICAgc3BsaXQgPSB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjaCA9PT0gJyAnICYmIHByZXYgJiYgcHJldiAhPT0gJyAnICYmIHByZXYgIT09ICdcXG4nICYmIHByZXYgIT09ICdcXHQnKSB7XG4gICAgICAgIC8vIHNwYWNlIHN1cnJvdW5kZWQgYnkgbm9uLXNwYWNlIGNhbiBiZSByZXBsYWNlZCB3aXRoIG5ld2xpbmUgKyBpbmRlbnRcbiAgICAgICAgY29uc3QgbmV4dCA9IHRleHRbaSArIDFdO1xuICAgICAgICBpZiAobmV4dCAmJiBuZXh0ICE9PSAnICcgJiYgbmV4dCAhPT0gJ1xcbicgJiYgbmV4dCAhPT0gJ1xcdCcpIHNwbGl0ID0gaTtcbiAgICAgIH1cblxuICAgICAgaWYgKGkgPj0gZW5kKSB7XG4gICAgICAgIGlmIChzcGxpdCkge1xuICAgICAgICAgIGZvbGRzLnB1c2goc3BsaXQpO1xuICAgICAgICAgIGVuZCA9IHNwbGl0ICsgZW5kU3RlcDtcbiAgICAgICAgICBzcGxpdCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBGT0xEX1FVT1RFRCkge1xuICAgICAgICAgIC8vIHdoaXRlLXNwYWNlIGNvbGxlY3RlZCBhdCBlbmQgbWF5IHN0cmV0Y2ggcGFzdCBsaW5lV2lkdGhcbiAgICAgICAgICB3aGlsZSAocHJldiA9PT0gJyAnIHx8IHByZXYgPT09ICdcXHQnKSB7XG4gICAgICAgICAgICBwcmV2ID0gY2g7XG4gICAgICAgICAgICBjaCA9IHRleHRbaSArPSAxXTtcbiAgICAgICAgICAgIG92ZXJmbG93ID0gdHJ1ZTtcbiAgICAgICAgICB9IC8vIEFjY291bnQgZm9yIG5ld2xpbmUgZXNjYXBlLCBidXQgZG9uJ3QgYnJlYWsgcHJlY2VkaW5nIGVzY2FwZVxuXG5cbiAgICAgICAgICBjb25zdCBqID0gaSA+IGVzY0VuZCArIDEgPyBpIC0gMiA6IGVzY1N0YXJ0IC0gMTsgLy8gQmFpbCBvdXQgaWYgbGluZVdpZHRoICYgbWluQ29udGVudFdpZHRoIGFyZSBzaG9ydGVyIHRoYW4gYW4gZXNjYXBlIHN0cmluZ1xuXG4gICAgICAgICAgaWYgKGVzY2FwZWRGb2xkc1tqXSkgcmV0dXJuIHRleHQ7XG4gICAgICAgICAgZm9sZHMucHVzaChqKTtcbiAgICAgICAgICBlc2NhcGVkRm9sZHNbal0gPSB0cnVlO1xuICAgICAgICAgIGVuZCA9IGogKyBlbmRTdGVwO1xuICAgICAgICAgIHNwbGl0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG92ZXJmbG93ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHByZXYgPSBjaDtcbiAgfVxuXG4gIGlmIChvdmVyZmxvdyAmJiBvbk92ZXJmbG93KSBvbk92ZXJmbG93KCk7XG4gIGlmIChmb2xkcy5sZW5ndGggPT09IDApIHJldHVybiB0ZXh0O1xuICBpZiAob25Gb2xkKSBvbkZvbGQoKTtcbiAgbGV0IHJlcyA9IHRleHQuc2xpY2UoMCwgZm9sZHNbMF0pO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZm9sZHMubGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCBmb2xkID0gZm9sZHNbaV07XG4gICAgY29uc3QgZW5kID0gZm9sZHNbaSArIDFdIHx8IHRleHQubGVuZ3RoO1xuICAgIGlmIChmb2xkID09PSAwKSByZXMgPSBcIlxcblwiLmNvbmNhdChpbmRlbnQpLmNvbmNhdCh0ZXh0LnNsaWNlKDAsIGVuZCkpO2Vsc2Uge1xuICAgICAgaWYgKG1vZGUgPT09IEZPTERfUVVPVEVEICYmIGVzY2FwZWRGb2xkc1tmb2xkXSkgcmVzICs9IFwiXCIuY29uY2F0KHRleHRbZm9sZF0sIFwiXFxcXFwiKTtcbiAgICAgIHJlcyArPSBcIlxcblwiLmNvbmNhdChpbmRlbnQpLmNvbmNhdCh0ZXh0LnNsaWNlKGZvbGQgKyAxLCBlbmQpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgeyBGT0xEX0JMT0NLLCBGT0xEX0ZMT1csIEZPTERfUVVPVEVELCBmb2xkRmxvd0xpbmVzIH07XG4iLCJpbXBvcnQgeyBhZGRDb21tZW50QmVmb3JlIH0gZnJvbSAnLi9hZGRDb21tZW50LmpzJztcbmltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZVNjYWxhciB9IGZyb20gJy4uL3Jlc29sdmUvcmVzb2x2ZVNjYWxhci5qcyc7XG5pbXBvcnQgeyBmb2xkRmxvd0xpbmVzLCBGT0xEX1FVT1RFRCwgRk9MRF9GTE9XLCBGT0xEX0JMT0NLIH0gZnJvbSAnLi9mb2xkRmxvd0xpbmVzLmpzJztcbmltcG9ydCB7IHN0ck9wdGlvbnMgfSBmcm9tICcuLi90YWdzL29wdGlvbnMuanMnO1xuXG5jb25zdCBnZXRGb2xkT3B0aW9ucyA9ICh7XG4gIGluZGVudEF0U3RhcnRcbn0pID0+IGluZGVudEF0U3RhcnQgPyBPYmplY3QuYXNzaWduKHtcbiAgaW5kZW50QXRTdGFydFxufSwgc3RyT3B0aW9ucy5mb2xkKSA6IHN0ck9wdGlvbnMuZm9sZDsgLy8gQWxzbyBjaGVja3MgZm9yIGxpbmVzIHN0YXJ0aW5nIHdpdGggJSwgYXMgcGFyc2luZyB0aGUgb3V0cHV0IGFzIFlBTUwgMS4xIHdpbGxcbi8vIHByZXN1bWUgdGhhdCdzIHN0YXJ0aW5nIGEgbmV3IGRvY3VtZW50LlxuXG5cbmNvbnN0IGNvbnRhaW5zRG9jdW1lbnRNYXJrZXIgPSBzdHIgPT4gL14oJXwtLS18XFwuXFwuXFwuKS9tLnRlc3Qoc3RyKTtcblxuZnVuY3Rpb24gbGluZUxlbmd0aE92ZXJMaW1pdChzdHIsIGxpbWl0KSB7XG4gIGNvbnN0IHN0ckxlbiA9IHN0ci5sZW5ndGg7XG4gIGlmIChzdHJMZW4gPD0gbGltaXQpIHJldHVybiBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gMCwgc3RhcnQgPSAwOyBpIDwgc3RyTGVuOyArK2kpIHtcbiAgICBpZiAoc3RyW2ldID09PSAnXFxuJykge1xuICAgICAgaWYgKGkgLSBzdGFydCA+IGxpbWl0KSByZXR1cm4gdHJ1ZTtcbiAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICBpZiAoc3RyTGVuIC0gc3RhcnQgPD0gbGltaXQpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZG91YmxlUXVvdGVkU3RyaW5nKHZhbHVlLCBjdHgpIHtcbiAgY29uc3Qge1xuICAgIGltcGxpY2l0S2V5XG4gIH0gPSBjdHg7XG4gIGNvbnN0IHtcbiAgICBqc29uRW5jb2RpbmcsXG4gICAgbWluTXVsdGlMaW5lTGVuZ3RoXG4gIH0gPSBzdHJPcHRpb25zLmRvdWJsZVF1b3RlZDtcbiAgY29uc3QganNvbiA9IEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcbiAgaWYgKGpzb25FbmNvZGluZykgcmV0dXJuIGpzb247XG4gIGNvbnN0IGluZGVudCA9IGN0eC5pbmRlbnQgfHwgKGNvbnRhaW5zRG9jdW1lbnRNYXJrZXIodmFsdWUpID8gJyAgJyA6ICcnKTtcbiAgbGV0IHN0ciA9ICcnO1xuICBsZXQgc3RhcnQgPSAwO1xuXG4gIGZvciAobGV0IGkgPSAwLCBjaCA9IGpzb25baV07IGNoOyBjaCA9IGpzb25bKytpXSkge1xuICAgIGlmIChjaCA9PT0gJyAnICYmIGpzb25baSArIDFdID09PSAnXFxcXCcgJiYganNvbltpICsgMl0gPT09ICduJykge1xuICAgICAgLy8gc3BhY2UgYmVmb3JlIG5ld2xpbmUgbmVlZHMgdG8gYmUgZXNjYXBlZCB0byBub3QgYmUgZm9sZGVkXG4gICAgICBzdHIgKz0ganNvbi5zbGljZShzdGFydCwgaSkgKyAnXFxcXCAnO1xuICAgICAgaSArPSAxO1xuICAgICAgc3RhcnQgPSBpO1xuICAgICAgY2ggPSAnXFxcXCc7XG4gICAgfVxuXG4gICAgaWYgKGNoID09PSAnXFxcXCcpIHN3aXRjaCAoanNvbltpICsgMV0pIHtcbiAgICAgIGNhc2UgJ3UnOlxuICAgICAgICB7XG4gICAgICAgICAgc3RyICs9IGpzb24uc2xpY2Uoc3RhcnQsIGkpO1xuICAgICAgICAgIGNvbnN0IGNvZGUgPSBqc29uLnN1YnN0cihpICsgMiwgNCk7XG5cbiAgICAgICAgICBzd2l0Y2ggKGNvZGUpIHtcbiAgICAgICAgICAgIGNhc2UgJzAwMDAnOlxuICAgICAgICAgICAgICBzdHIgKz0gJ1xcXFwwJztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJzAwMDcnOlxuICAgICAgICAgICAgICBzdHIgKz0gJ1xcXFxhJztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJzAwMGInOlxuICAgICAgICAgICAgICBzdHIgKz0gJ1xcXFx2JztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJzAwMWInOlxuICAgICAgICAgICAgICBzdHIgKz0gJ1xcXFxlJztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJzAwODUnOlxuICAgICAgICAgICAgICBzdHIgKz0gJ1xcXFxOJztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJzAwYTAnOlxuICAgICAgICAgICAgICBzdHIgKz0gJ1xcXFxfJztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJzIwMjgnOlxuICAgICAgICAgICAgICBzdHIgKz0gJ1xcXFxMJztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJzIwMjknOlxuICAgICAgICAgICAgICBzdHIgKz0gJ1xcXFxQJztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIGlmIChjb2RlLnN1YnN0cigwLCAyKSA9PT0gJzAwJykgc3RyICs9ICdcXFxceCcgKyBjb2RlLnN1YnN0cigyKTtlbHNlIHN0ciArPSBqc29uLnN1YnN0cihpLCA2KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpICs9IDU7XG4gICAgICAgICAgc3RhcnQgPSBpICsgMTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnbic6XG4gICAgICAgIGlmIChpbXBsaWNpdEtleSB8fCBqc29uW2kgKyAyXSA9PT0gJ1wiJyB8fCBqc29uLmxlbmd0aCA8IG1pbk11bHRpTGluZUxlbmd0aCkge1xuICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBmb2xkaW5nIHdpbGwgZWF0IGZpcnN0IG5ld2xpbmVcbiAgICAgICAgICBzdHIgKz0ganNvbi5zbGljZShzdGFydCwgaSkgKyAnXFxuXFxuJztcblxuICAgICAgICAgIHdoaWxlIChqc29uW2kgKyAyXSA9PT0gJ1xcXFwnICYmIGpzb25baSArIDNdID09PSAnbicgJiYganNvbltpICsgNF0gIT09ICdcIicpIHtcbiAgICAgICAgICAgIHN0ciArPSAnXFxuJztcbiAgICAgICAgICAgIGkgKz0gMjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzdHIgKz0gaW5kZW50OyAvLyBzcGFjZSBhZnRlciBuZXdsaW5lIG5lZWRzIHRvIGJlIGVzY2FwZWQgdG8gbm90IGJlIGZvbGRlZFxuXG4gICAgICAgICAgaWYgKGpzb25baSArIDJdID09PSAnICcpIHN0ciArPSAnXFxcXCc7XG4gICAgICAgICAgaSArPSAxO1xuICAgICAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICAgIH1cblxuICAgICAgICBicmVhaztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaSArPSAxO1xuICAgIH1cbiAgfVxuXG4gIHN0ciA9IHN0YXJ0ID8gc3RyICsganNvbi5zbGljZShzdGFydCkgOiBqc29uO1xuICByZXR1cm4gaW1wbGljaXRLZXkgPyBzdHIgOiBmb2xkRmxvd0xpbmVzKHN0ciwgaW5kZW50LCBGT0xEX1FVT1RFRCwgZ2V0Rm9sZE9wdGlvbnMoY3R4KSk7XG59XG5cbmZ1bmN0aW9uIHNpbmdsZVF1b3RlZFN0cmluZyh2YWx1ZSwgY3R4KSB7XG4gIGlmIChjdHguaW1wbGljaXRLZXkpIHtcbiAgICBpZiAoL1xcbi8udGVzdCh2YWx1ZSkpIHJldHVybiBkb3VibGVRdW90ZWRTdHJpbmcodmFsdWUsIGN0eCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gc2luZ2xlIHF1b3RlZCBzdHJpbmcgY2FuJ3QgaGF2ZSBsZWFkaW5nIG9yIHRyYWlsaW5nIHdoaXRlc3BhY2UgYXJvdW5kIG5ld2xpbmVcbiAgICBpZiAoL1sgXFx0XVxcbnxcXG5bIFxcdF0vLnRlc3QodmFsdWUpKSByZXR1cm4gZG91YmxlUXVvdGVkU3RyaW5nKHZhbHVlLCBjdHgpO1xuICB9XG5cbiAgY29uc3QgaW5kZW50ID0gY3R4LmluZGVudCB8fCAoY29udGFpbnNEb2N1bWVudE1hcmtlcih2YWx1ZSkgPyAnICAnIDogJycpO1xuICBjb25zdCByZXMgPSBcIidcIiArIHZhbHVlLnJlcGxhY2UoLycvZywgXCInJ1wiKS5yZXBsYWNlKC9cXG4rL2csIFwiJCZcXG5cIi5jb25jYXQoaW5kZW50KSkgKyBcIidcIjtcbiAgcmV0dXJuIGN0eC5pbXBsaWNpdEtleSA/IHJlcyA6IGZvbGRGbG93TGluZXMocmVzLCBpbmRlbnQsIEZPTERfRkxPVywgZ2V0Rm9sZE9wdGlvbnMoY3R4KSk7XG59XG5cbmZ1bmN0aW9uIGJsb2NrU3RyaW5nKHtcbiAgY29tbWVudCxcbiAgdHlwZSxcbiAgdmFsdWVcbn0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCkge1xuICAvLyAxLiBCbG9jayBjYW4ndCBlbmQgaW4gd2hpdGVzcGFjZSB1bmxlc3MgdGhlIGxhc3QgbGluZSBpcyBub24tZW1wdHkuXG4gIC8vIDIuIFN0cmluZ3MgY29uc2lzdGluZyBvZiBvbmx5IHdoaXRlc3BhY2UgYXJlIGJlc3QgcmVuZGVyZWQgZXhwbGljaXRseS5cbiAgaWYgKC9cXG5bXFx0IF0rJC8udGVzdCh2YWx1ZSkgfHwgL15cXHMqJC8udGVzdCh2YWx1ZSkpIHtcbiAgICByZXR1cm4gZG91YmxlUXVvdGVkU3RyaW5nKHZhbHVlLCBjdHgpO1xuICB9XG5cbiAgY29uc3QgaW5kZW50ID0gY3R4LmluZGVudCB8fCAoY3R4LmZvcmNlQmxvY2tJbmRlbnQgfHwgY29udGFpbnNEb2N1bWVudE1hcmtlcih2YWx1ZSkgPyAnICAnIDogJycpO1xuICBjb25zdCBpbmRlbnRTaXplID0gaW5kZW50ID8gJzInIDogJzEnOyAvLyByb290IGlzIGF0IC0xXG5cbiAgY29uc3QgbGl0ZXJhbCA9IHR5cGUgPT09IFR5cGUuQkxPQ0tfRk9MREVEID8gZmFsc2UgOiB0eXBlID09PSBUeXBlLkJMT0NLX0xJVEVSQUwgPyB0cnVlIDogIWxpbmVMZW5ndGhPdmVyTGltaXQodmFsdWUsIHN0ck9wdGlvbnMuZm9sZC5saW5lV2lkdGggLSBpbmRlbnQubGVuZ3RoKTtcbiAgbGV0IGhlYWRlciA9IGxpdGVyYWwgPyAnfCcgOiAnPic7XG4gIGlmICghdmFsdWUpIHJldHVybiBoZWFkZXIgKyAnXFxuJztcbiAgbGV0IHdzU3RhcnQgPSAnJztcbiAgbGV0IHdzRW5kID0gJyc7XG4gIHZhbHVlID0gdmFsdWUucmVwbGFjZSgvW1xcblxcdCBdKiQvLCB3cyA9PiB7XG4gICAgY29uc3QgbiA9IHdzLmluZGV4T2YoJ1xcbicpO1xuXG4gICAgaWYgKG4gPT09IC0xKSB7XG4gICAgICBoZWFkZXIgKz0gJy0nOyAvLyBzdHJpcFxuICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IHdzIHx8IG4gIT09IHdzLmxlbmd0aCAtIDEpIHtcbiAgICAgIGhlYWRlciArPSAnKyc7IC8vIGtlZXBcblxuICAgICAgaWYgKG9uQ2hvbXBLZWVwKSBvbkNob21wS2VlcCgpO1xuICAgIH1cblxuICAgIHdzRW5kID0gd3MucmVwbGFjZSgvXFxuJC8sICcnKTtcbiAgICByZXR1cm4gJyc7XG4gIH0pLnJlcGxhY2UoL15bXFxuIF0qLywgd3MgPT4ge1xuICAgIGlmICh3cy5pbmRleE9mKCcgJykgIT09IC0xKSBoZWFkZXIgKz0gaW5kZW50U2l6ZTtcbiAgICBjb25zdCBtID0gd3MubWF0Y2goLyArJC8pO1xuXG4gICAgaWYgKG0pIHtcbiAgICAgIHdzU3RhcnQgPSB3cy5zbGljZSgwLCAtbVswXS5sZW5ndGgpO1xuICAgICAgcmV0dXJuIG1bMF07XG4gICAgfSBlbHNlIHtcbiAgICAgIHdzU3RhcnQgPSB3cztcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gIH0pO1xuICBpZiAod3NFbmQpIHdzRW5kID0gd3NFbmQucmVwbGFjZSgvXFxuKyg/IVxcbnwkKS9nLCBcIiQmXCIuY29uY2F0KGluZGVudCkpO1xuICBpZiAod3NTdGFydCkgd3NTdGFydCA9IHdzU3RhcnQucmVwbGFjZSgvXFxuKy9nLCBcIiQmXCIuY29uY2F0KGluZGVudCkpO1xuXG4gIGlmIChjb21tZW50KSB7XG4gICAgaGVhZGVyICs9ICcgIycgKyBjb21tZW50LnJlcGxhY2UoLyA/W1xcclxcbl0rL2csICcgJyk7XG4gICAgaWYgKG9uQ29tbWVudCkgb25Db21tZW50KCk7XG4gIH1cblxuICBpZiAoIXZhbHVlKSByZXR1cm4gXCJcIi5jb25jYXQoaGVhZGVyKS5jb25jYXQoaW5kZW50U2l6ZSwgXCJcXG5cIikuY29uY2F0KGluZGVudCkuY29uY2F0KHdzRW5kKTtcblxuICBpZiAobGl0ZXJhbCkge1xuICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZSgvXFxuKy9nLCBcIiQmXCIuY29uY2F0KGluZGVudCkpO1xuICAgIHJldHVybiBcIlwiLmNvbmNhdChoZWFkZXIsIFwiXFxuXCIpLmNvbmNhdChpbmRlbnQpLmNvbmNhdCh3c1N0YXJ0KS5jb25jYXQodmFsdWUpLmNvbmNhdCh3c0VuZCk7XG4gIH1cblxuICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoL1xcbisvZywgJ1xcbiQmJykucmVwbGFjZSgvKD86XnxcXG4pKFtcXHQgXS4qKSg/OihbXFxuXFx0IF0qKVxcbig/IVtcXG5cXHQgXSkpPy9nLCAnJDEkMicpIC8vIG1vcmUtaW5kZW50ZWQgbGluZXMgYXJlbid0IGZvbGRlZFxuICAvLyAgICAgICAgIF4gaW5kLmxpbmUgIF4gZW1wdHkgICAgIF4gY2FwdHVyZSBuZXh0IGVtcHR5IGxpbmVzIG9ubHkgYXQgZW5kIG9mIGluZGVudFxuICAucmVwbGFjZSgvXFxuKy9nLCBcIiQmXCIuY29uY2F0KGluZGVudCkpO1xuICBjb25zdCBib2R5ID0gZm9sZEZsb3dMaW5lcyhcIlwiLmNvbmNhdCh3c1N0YXJ0KS5jb25jYXQodmFsdWUpLmNvbmNhdCh3c0VuZCksIGluZGVudCwgRk9MRF9CTE9DSywgc3RyT3B0aW9ucy5mb2xkKTtcbiAgcmV0dXJuIFwiXCIuY29uY2F0KGhlYWRlciwgXCJcXG5cIikuY29uY2F0KGluZGVudCkuY29uY2F0KGJvZHkpO1xufVxuXG5mdW5jdGlvbiBwbGFpblN0cmluZyhpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApIHtcbiAgY29uc3Qge1xuICAgIGNvbW1lbnQsXG4gICAgdHlwZSxcbiAgICB2YWx1ZVxuICB9ID0gaXRlbTtcbiAgY29uc3Qge1xuICAgIGFjdHVhbFN0cmluZyxcbiAgICBpbXBsaWNpdEtleSxcbiAgICBpbmRlbnQsXG4gICAgaW5GbG93XG4gIH0gPSBjdHg7XG5cbiAgaWYgKGltcGxpY2l0S2V5ICYmIC9bXFxuW1xcXXt9LF0vLnRlc3QodmFsdWUpIHx8IGluRmxvdyAmJiAvW1tcXF17fSxdLy50ZXN0KHZhbHVlKSkge1xuICAgIHJldHVybiBkb3VibGVRdW90ZWRTdHJpbmcodmFsdWUsIGN0eCk7XG4gIH1cblxuICBpZiAoIXZhbHVlIHx8IC9eW1xcblxcdCAsW1xcXXt9IyYqIXw+J1wiJUBgXXxeWz8tXSR8Xls/LV1bIFxcdF18W1xcbjpdWyBcXHRdfFsgXFx0XVxcbnxbXFxuXFx0IF0jfFtcXG5cXHQgOl0kLy50ZXN0KHZhbHVlKSkge1xuICAgIGNvbnN0IGhhc0RvdWJsZSA9IHZhbHVlLmluZGV4T2YoJ1wiJykgIT09IC0xO1xuICAgIGNvbnN0IGhhc1NpbmdsZSA9IHZhbHVlLmluZGV4T2YoXCInXCIpICE9PSAtMTtcbiAgICBsZXQgcXVvdGVkU3RyaW5nO1xuXG4gICAgaWYgKGhhc0RvdWJsZSAmJiAhaGFzU2luZ2xlKSB7XG4gICAgICBxdW90ZWRTdHJpbmcgPSBzaW5nbGVRdW90ZWRTdHJpbmc7XG4gICAgfSBlbHNlIGlmIChoYXNTaW5nbGUgJiYgIWhhc0RvdWJsZSkge1xuICAgICAgcXVvdGVkU3RyaW5nID0gZG91YmxlUXVvdGVkU3RyaW5nO1xuICAgIH0gZWxzZSBpZiAoc3RyT3B0aW9ucy5kZWZhdWx0UXVvdGVTaW5nbGUpIHtcbiAgICAgIHF1b3RlZFN0cmluZyA9IHNpbmdsZVF1b3RlZFN0cmluZztcbiAgICB9IGVsc2Uge1xuICAgICAgcXVvdGVkU3RyaW5nID0gZG91YmxlUXVvdGVkU3RyaW5nO1xuICAgIH0gLy8gbm90IGFsbG93ZWQ6XG4gICAgLy8gLSBlbXB0eSBzdHJpbmcsICctJyBvciAnPydcbiAgICAvLyAtIHN0YXJ0IHdpdGggYW4gaW5kaWNhdG9yIGNoYXJhY3RlciAoZXhjZXB0IFs/Oi1dKSBvciAvWz8tXSAvXG4gICAgLy8gLSAnXFxuICcsICc6ICcgb3IgJyBcXG4nIGFueXdoZXJlXG4gICAgLy8gLSAnIycgbm90IHByZWNlZGVkIGJ5IGEgbm9uLXNwYWNlIGNoYXJcbiAgICAvLyAtIGVuZCB3aXRoICcgJyBvciAnOidcblxuXG4gICAgcmV0dXJuIGltcGxpY2l0S2V5IHx8IGluRmxvdyB8fCB2YWx1ZS5pbmRleE9mKCdcXG4nKSA9PT0gLTEgPyBxdW90ZWRTdHJpbmcodmFsdWUsIGN0eCkgOiBibG9ja1N0cmluZyhpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApO1xuICB9XG5cbiAgaWYgKCFpbXBsaWNpdEtleSAmJiAhaW5GbG93ICYmIHR5cGUgIT09IFR5cGUuUExBSU4gJiYgdmFsdWUuaW5kZXhPZignXFxuJykgIT09IC0xKSB7XG4gICAgLy8gV2hlcmUgYWxsb3dlZCAmIHR5cGUgbm90IHNldCBleHBsaWNpdGx5LCBwcmVmZXIgYmxvY2sgc3R5bGUgZm9yIG11bHRpbGluZSBzdHJpbmdzXG4gICAgcmV0dXJuIGJsb2NrU3RyaW5nKGl0ZW0sIGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCk7XG4gIH1cblxuICBpZiAoaW5kZW50ID09PSAnJyAmJiBjb250YWluc0RvY3VtZW50TWFya2VyKHZhbHVlKSkge1xuICAgIGN0eC5mb3JjZUJsb2NrSW5kZW50ID0gdHJ1ZTtcbiAgICByZXR1cm4gYmxvY2tTdHJpbmcoaXRlbSwgY3R4LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKTtcbiAgfVxuXG4gIGNvbnN0IHN0ciA9IHZhbHVlLnJlcGxhY2UoL1xcbisvZywgXCIkJlxcblwiLmNvbmNhdChpbmRlbnQpKTsgLy8gVmVyaWZ5IHRoYXQgb3V0cHV0IHdpbGwgYmUgcGFyc2VkIGFzIGEgc3RyaW5nLCBhcyBlLmcuIHBsYWluIG51bWJlcnMgYW5kXG4gIC8vIGJvb2xlYW5zIGdldCBwYXJzZWQgd2l0aCB0aG9zZSB0eXBlcyBpbiB2MS4yIChlLmcuICc0MicsICd0cnVlJyAmICcwLjllLTMnKSxcbiAgLy8gYW5kIG90aGVycyBpbiB2MS4xLlxuXG4gIGlmIChhY3R1YWxTdHJpbmcpIHtcbiAgICBjb25zdCB7XG4gICAgICB0YWdzXG4gICAgfSA9IGN0eC5kb2Muc2NoZW1hO1xuICAgIGNvbnN0IHJlc29sdmVkID0gcmVzb2x2ZVNjYWxhcihzdHIsIHRhZ3MpLnZhbHVlO1xuICAgIGlmICh0eXBlb2YgcmVzb2x2ZWQgIT09ICdzdHJpbmcnKSByZXR1cm4gZG91YmxlUXVvdGVkU3RyaW5nKHZhbHVlLCBjdHgpO1xuICB9XG5cbiAgY29uc3QgYm9keSA9IGltcGxpY2l0S2V5ID8gc3RyIDogZm9sZEZsb3dMaW5lcyhzdHIsIGluZGVudCwgRk9MRF9GTE9XLCBnZXRGb2xkT3B0aW9ucyhjdHgpKTtcblxuICBpZiAoY29tbWVudCAmJiAhaW5GbG93ICYmIChib2R5LmluZGV4T2YoJ1xcbicpICE9PSAtMSB8fCBjb21tZW50LmluZGV4T2YoJ1xcbicpICE9PSAtMSkpIHtcbiAgICBpZiAob25Db21tZW50KSBvbkNvbW1lbnQoKTtcbiAgICByZXR1cm4gYWRkQ29tbWVudEJlZm9yZShib2R5LCBpbmRlbnQsIGNvbW1lbnQpO1xuICB9XG5cbiAgcmV0dXJuIGJvZHk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeVN0cmluZyhpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApIHtcbiAgY29uc3Qge1xuICAgIGRlZmF1bHRLZXlUeXBlLFxuICAgIGRlZmF1bHRUeXBlXG4gIH0gPSBzdHJPcHRpb25zO1xuICBjb25zdCB7XG4gICAgaW1wbGljaXRLZXksXG4gICAgaW5GbG93XG4gIH0gPSBjdHg7XG4gIGxldCB7XG4gICAgdHlwZSxcbiAgICB2YWx1ZVxuICB9ID0gaXRlbTtcblxuICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgIHZhbHVlID0gU3RyaW5nKHZhbHVlKTtcbiAgICBpdGVtID0gT2JqZWN0LmFzc2lnbih7fSwgaXRlbSwge1xuICAgICAgdmFsdWVcbiAgICB9KTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSBUeXBlLlFVT1RFX0RPVUJMRSkge1xuICAgIC8vIGZvcmNlIGRvdWJsZSBxdW90ZXMgb24gY29udHJvbCBjaGFyYWN0ZXJzICYgdW5wYWlyZWQgc3Vycm9nYXRlc1xuICAgIGlmICgvW1xceDAwLVxceDA4XFx4MGItXFx4MWZcXHg3Zi1cXHg5ZlxcdXtEODAwfS1cXHV7REZGRn1dL3UudGVzdCh2YWx1ZSkpIHR5cGUgPSBUeXBlLlFVT1RFX0RPVUJMRTtcbiAgfVxuXG4gIGNvbnN0IF9zdHJpbmdpZnkgPSBfdHlwZSA9PiB7XG4gICAgc3dpdGNoIChfdHlwZSkge1xuICAgICAgY2FzZSBUeXBlLkJMT0NLX0ZPTERFRDpcbiAgICAgIGNhc2UgVHlwZS5CTE9DS19MSVRFUkFMOlxuICAgICAgICByZXR1cm4gaW1wbGljaXRLZXkgfHwgaW5GbG93ID8gZG91YmxlUXVvdGVkU3RyaW5nKHZhbHVlLCBjdHgpIC8vIGJsb2NrcyBhcmUgbm90IHZhbGlkIGluc2lkZSBmbG93IGNvbnRhaW5lcnNcbiAgICAgICAgOiBibG9ja1N0cmluZyhpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApO1xuXG4gICAgICBjYXNlIFR5cGUuUVVPVEVfRE9VQkxFOlxuICAgICAgICByZXR1cm4gZG91YmxlUXVvdGVkU3RyaW5nKHZhbHVlLCBjdHgpO1xuXG4gICAgICBjYXNlIFR5cGUuUVVPVEVfU0lOR0xFOlxuICAgICAgICByZXR1cm4gc2luZ2xlUXVvdGVkU3RyaW5nKHZhbHVlLCBjdHgpO1xuXG4gICAgICBjYXNlIFR5cGUuUExBSU46XG4gICAgICAgIHJldHVybiBwbGFpblN0cmluZyhpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH07XG5cbiAgbGV0IHJlcyA9IF9zdHJpbmdpZnkodHlwZSk7XG5cbiAgaWYgKHJlcyA9PT0gbnVsbCkge1xuICAgIGNvbnN0IHQgPSBpbXBsaWNpdEtleSA/IGRlZmF1bHRLZXlUeXBlIDogZGVmYXVsdFR5cGU7XG4gICAgcmVzID0gX3N0cmluZ2lmeSh0KTtcbiAgICBpZiAocmVzID09PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBkZWZhdWx0IHN0cmluZyB0eXBlIFwiLmNvbmNhdCh0KSk7XG4gIH1cblxuICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgeyBzdHJpbmdpZnlTdHJpbmcgfTtcbiIsImZ1bmN0aW9uIHN0cmluZ2lmeVRhZyhkb2MsIHRhZykge1xuICBpZiAoKGRvYy52ZXJzaW9uIHx8IGRvYy5vcHRpb25zLnZlcnNpb24pID09PSAnMS4wJykge1xuICAgIGNvbnN0IHByaXYgPSB0YWcubWF0Y2goL150YWc6cHJpdmF0ZVxcLnlhbWxcXC5vcmcsMjAwMjooW146L10rKSQvKTtcbiAgICBpZiAocHJpdikgcmV0dXJuICchJyArIHByaXZbMV07XG4gICAgY29uc3Qgdm9jYWIgPSB0YWcubWF0Y2goL150YWc6KFthLXpBLVowLTktXSspXFwueWFtbFxcLm9yZywyMDAyOiguKikvKTtcbiAgICByZXR1cm4gdm9jYWIgPyBcIiFcIi5jb25jYXQodm9jYWJbMV0sIFwiL1wiKS5jb25jYXQodm9jYWJbMl0pIDogXCIhXCIuY29uY2F0KHRhZy5yZXBsYWNlKC9edGFnOi8sICcnKSk7XG4gIH1cblxuICBsZXQgcCA9IGRvYy50YWdQcmVmaXhlcy5maW5kKHAgPT4gdGFnLmluZGV4T2YocC5wcmVmaXgpID09PSAwKTtcblxuICBpZiAoIXApIHtcbiAgICBjb25zdCBkdHAgPSBkb2MuZ2V0RGVmYXVsdHMoKS50YWdQcmVmaXhlcztcbiAgICBwID0gZHRwICYmIGR0cC5maW5kKHAgPT4gdGFnLmluZGV4T2YocC5wcmVmaXgpID09PSAwKTtcbiAgfVxuXG4gIGlmICghcCkgcmV0dXJuIHRhZ1swXSA9PT0gJyEnID8gdGFnIDogXCIhPFwiLmNvbmNhdCh0YWcsIFwiPlwiKTtcbiAgY29uc3Qgc3VmZml4ID0gdGFnLnN1YnN0cihwLnByZWZpeC5sZW5ndGgpLnJlcGxhY2UoL1shLFtcXF17fV0vZywgY2ggPT4gKHtcbiAgICAnISc6ICclMjEnLFxuICAgICcsJzogJyUyQycsXG4gICAgJ1snOiAnJTVCJyxcbiAgICAnXSc6ICclNUQnLFxuICAgICd7JzogJyU3QicsXG4gICAgJ30nOiAnJTdEJ1xuICB9KVtjaF0pO1xuICByZXR1cm4gcC5oYW5kbGUgKyBzdWZmaXg7XG59XG5cbmV4cG9ydCB7IHN0cmluZ2lmeVRhZyB9O1xuIiwiaW1wb3J0IHsgQWxpYXMgfSBmcm9tICcuLi9hc3QvQWxpYXMuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4uL2FzdC9Ob2RlLmpzJztcbmltcG9ydCB7IFBhaXIgfSBmcm9tICcuLi9hc3QvUGFpci5qcyc7XG5pbXBvcnQgeyBTY2FsYXIgfSBmcm9tICcuLi9hc3QvU2NhbGFyLmpzJztcbmltcG9ydCB7IHN0cmluZ2lmeVN0cmluZyB9IGZyb20gJy4vc3RyaW5naWZ5U3RyaW5nLmpzJztcbmltcG9ydCB7IHN0cmluZ2lmeVRhZyB9IGZyb20gJy4vc3RyaW5naWZ5VGFnLmpzJztcblxuZnVuY3Rpb24gZ2V0VGFnT2JqZWN0KHRhZ3MsIGl0ZW0pIHtcbiAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBBbGlhcykgcmV0dXJuIEFsaWFzO1xuXG4gIGlmIChpdGVtLnRhZykge1xuICAgIGNvbnN0IG1hdGNoID0gdGFncy5maWx0ZXIodCA9PiB0LnRhZyA9PT0gaXRlbS50YWcpO1xuICAgIGlmIChtYXRjaC5sZW5ndGggPiAwKSByZXR1cm4gbWF0Y2guZmluZCh0ID0+IHQuZm9ybWF0ID09PSBpdGVtLmZvcm1hdCkgfHwgbWF0Y2hbMF07XG4gIH1cblxuICBsZXQgdGFnT2JqLCBvYmo7XG5cbiAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBTY2FsYXIpIHtcbiAgICBvYmogPSBpdGVtLnZhbHVlO1xuICAgIGNvbnN0IG1hdGNoID0gdGFncy5maWx0ZXIodCA9PiB0LmlkZW50aWZ5ICYmIHQuaWRlbnRpZnkob2JqKSk7XG4gICAgdGFnT2JqID0gbWF0Y2guZmluZCh0ID0+IHQuZm9ybWF0ID09PSBpdGVtLmZvcm1hdCkgfHwgbWF0Y2guZmluZCh0ID0+ICF0LmZvcm1hdCk7XG4gIH0gZWxzZSB7XG4gICAgb2JqID0gaXRlbTtcbiAgICB0YWdPYmogPSB0YWdzLmZpbmQodCA9PiB0Lm5vZGVDbGFzcyAmJiBvYmogaW5zdGFuY2VvZiB0Lm5vZGVDbGFzcyk7XG4gIH1cblxuICBpZiAoIXRhZ09iaikge1xuICAgIGNvbnN0IG5hbWUgPSBvYmogJiYgb2JqLmNvbnN0cnVjdG9yID8gb2JqLmNvbnN0cnVjdG9yLm5hbWUgOiB0eXBlb2Ygb2JqO1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRhZyBub3QgcmVzb2x2ZWQgZm9yIFwiLmNvbmNhdChuYW1lLCBcIiB2YWx1ZVwiKSk7XG4gIH1cblxuICByZXR1cm4gdGFnT2JqO1xufSAvLyBuZWVkcyB0byBiZSBjYWxsZWQgYmVmb3JlIHZhbHVlIHN0cmluZ2lmaWVyIHRvIGFsbG93IGZvciBjaXJjdWxhciBhbmNob3IgcmVmc1xuXG5cbmZ1bmN0aW9uIHN0cmluZ2lmeVByb3BzKG5vZGUsIHRhZ09iaiwge1xuICBhbmNob3JzLFxuICBkb2Ncbn0pIHtcbiAgY29uc3QgcHJvcHMgPSBbXTtcbiAgY29uc3QgYW5jaG9yID0gZG9jLmFuY2hvcnMuZ2V0TmFtZShub2RlKTtcblxuICBpZiAoYW5jaG9yKSB7XG4gICAgYW5jaG9yc1thbmNob3JdID0gbm9kZTtcbiAgICBwcm9wcy5wdXNoKFwiJlwiLmNvbmNhdChhbmNob3IpKTtcbiAgfVxuXG4gIGlmIChub2RlLnRhZykge1xuICAgIHByb3BzLnB1c2goc3RyaW5naWZ5VGFnKGRvYywgbm9kZS50YWcpKTtcbiAgfSBlbHNlIGlmICghdGFnT2JqLmRlZmF1bHQpIHtcbiAgICBwcm9wcy5wdXNoKHN0cmluZ2lmeVRhZyhkb2MsIHRhZ09iai50YWcpKTtcbiAgfVxuXG4gIHJldHVybiBwcm9wcy5qb2luKCcgJyk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeShpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApIHtcbiAgY29uc3Qge1xuICAgIHNjaGVtYVxuICB9ID0gY3R4LmRvYztcbiAgbGV0IHRhZ09iajtcblxuICBpZiAoIShpdGVtIGluc3RhbmNlb2YgTm9kZSkpIHtcbiAgICBpdGVtID0gY3R4LmRvYy5jcmVhdGVOb2RlKGl0ZW0sIHtcbiAgICAgIG9uVGFnT2JqOiBvID0+IHRhZ09iaiA9IG8sXG4gICAgICB3cmFwU2NhbGFyczogdHJ1ZVxuICAgIH0pO1xuICB9XG5cbiAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBQYWlyKSByZXR1cm4gaXRlbS50b1N0cmluZyhjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApO1xuICBpZiAoIXRhZ09iaikgdGFnT2JqID0gZ2V0VGFnT2JqZWN0KHNjaGVtYS50YWdzLCBpdGVtKTtcbiAgY29uc3QgcHJvcHMgPSBzdHJpbmdpZnlQcm9wcyhpdGVtLCB0YWdPYmosIGN0eCk7XG4gIGlmIChwcm9wcy5sZW5ndGggPiAwKSBjdHguaW5kZW50QXRTdGFydCA9IChjdHguaW5kZW50QXRTdGFydCB8fCAwKSArIHByb3BzLmxlbmd0aCArIDE7XG4gIGNvbnN0IHN0ciA9IHR5cGVvZiB0YWdPYmouc3RyaW5naWZ5ID09PSAnZnVuY3Rpb24nID8gdGFnT2JqLnN0cmluZ2lmeShpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApIDogaXRlbSBpbnN0YW5jZW9mIFNjYWxhciA/IHN0cmluZ2lmeVN0cmluZyhpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApIDogaXRlbS50b1N0cmluZyhjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApO1xuICBpZiAoIXByb3BzKSByZXR1cm4gc3RyO1xuICByZXR1cm4gaXRlbSBpbnN0YW5jZW9mIFNjYWxhciB8fCBzdHJbMF0gPT09ICd7JyB8fCBzdHJbMF0gPT09ICdbJyA/IFwiXCIuY29uY2F0KHByb3BzLCBcIiBcIikuY29uY2F0KHN0cikgOiBcIlwiLmNvbmNhdChwcm9wcywgXCJcXG5cIikuY29uY2F0KGN0eC5pbmRlbnQpLmNvbmNhdChzdHIpO1xufVxuXG5leHBvcnQgeyBzdHJpbmdpZnkgfTtcbiIsImltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuL0NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgUGFpciB9IGZyb20gJy4vUGFpci5qcyc7XG5pbXBvcnQgeyBTY2FsYXIsIGlzU2NhbGFyVmFsdWUgfSBmcm9tICcuL1NjYWxhci5qcyc7XG5cbmZ1bmN0aW9uIGZpbmRQYWlyKGl0ZW1zLCBrZXkpIHtcbiAgY29uc3QgayA9IGtleSBpbnN0YW5jZW9mIFNjYWxhciA/IGtleS52YWx1ZSA6IGtleTtcblxuICBmb3IgKGNvbnN0IGl0IG9mIGl0ZW1zKSB7XG4gICAgaWYgKGl0IGluc3RhbmNlb2YgUGFpcikge1xuICAgICAgaWYgKGl0LmtleSA9PT0ga2V5IHx8IGl0LmtleSA9PT0gaykgcmV0dXJuIGl0O1xuICAgICAgaWYgKGl0LmtleSAmJiBpdC5rZXkudmFsdWUgPT09IGspIHJldHVybiBpdDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuY2xhc3MgWUFNTE1hcCBleHRlbmRzIENvbGxlY3Rpb24ge1xuICBhZGQocGFpciwgb3ZlcndyaXRlKSB7XG4gICAgaWYgKCFwYWlyKSBwYWlyID0gbmV3IFBhaXIocGFpcik7ZWxzZSBpZiAoIShwYWlyIGluc3RhbmNlb2YgUGFpcikpIHBhaXIgPSBuZXcgUGFpcihwYWlyLmtleSB8fCBwYWlyLCBwYWlyLnZhbHVlKTtcbiAgICBjb25zdCBwcmV2ID0gZmluZFBhaXIodGhpcy5pdGVtcywgcGFpci5rZXkpO1xuICAgIGNvbnN0IHNvcnRFbnRyaWVzID0gdGhpcy5zY2hlbWEgJiYgdGhpcy5zY2hlbWEuc29ydE1hcEVudHJpZXM7XG5cbiAgICBpZiAocHJldikge1xuICAgICAgaWYgKCFvdmVyd3JpdGUpIHRocm93IG5ldyBFcnJvcihcIktleSBcIi5jb25jYXQocGFpci5rZXksIFwiIGFscmVhZHkgc2V0XCIpKTsgLy8gRm9yIHNjYWxhcnMsIGtlZXAgdGhlIG9sZCBub2RlICYgaXRzIGNvbW1lbnRzIGFuZCBhbmNob3JzXG5cbiAgICAgIGlmIChwcmV2LnZhbHVlIGluc3RhbmNlb2YgU2NhbGFyICYmIGlzU2NhbGFyVmFsdWUocGFpci52YWx1ZSkpIHByZXYudmFsdWUudmFsdWUgPSBwYWlyLnZhbHVlO2Vsc2UgcHJldi52YWx1ZSA9IHBhaXIudmFsdWU7XG4gICAgfSBlbHNlIGlmIChzb3J0RW50cmllcykge1xuICAgICAgY29uc3QgaSA9IHRoaXMuaXRlbXMuZmluZEluZGV4KGl0ZW0gPT4gc29ydEVudHJpZXMocGFpciwgaXRlbSkgPCAwKTtcbiAgICAgIGlmIChpID09PSAtMSkgdGhpcy5pdGVtcy5wdXNoKHBhaXIpO2Vsc2UgdGhpcy5pdGVtcy5zcGxpY2UoaSwgMCwgcGFpcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuaXRlbXMucHVzaChwYWlyKTtcbiAgICB9XG4gIH1cblxuICBkZWxldGUoa2V5KSB7XG4gICAgY29uc3QgaXQgPSBmaW5kUGFpcih0aGlzLml0ZW1zLCBrZXkpO1xuICAgIGlmICghaXQpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBkZWwgPSB0aGlzLml0ZW1zLnNwbGljZSh0aGlzLml0ZW1zLmluZGV4T2YoaXQpLCAxKTtcbiAgICByZXR1cm4gZGVsLmxlbmd0aCA+IDA7XG4gIH1cblxuICBnZXQoa2V5LCBrZWVwU2NhbGFyKSB7XG4gICAgY29uc3QgaXQgPSBmaW5kUGFpcih0aGlzLml0ZW1zLCBrZXkpO1xuICAgIGNvbnN0IG5vZGUgPSBpdCAmJiBpdC52YWx1ZTtcbiAgICByZXR1cm4gIWtlZXBTY2FsYXIgJiYgbm9kZSBpbnN0YW5jZW9mIFNjYWxhciA/IG5vZGUudmFsdWUgOiBub2RlO1xuICB9XG5cbiAgaGFzKGtleSkge1xuICAgIHJldHVybiAhIWZpbmRQYWlyKHRoaXMuaXRlbXMsIGtleSk7XG4gIH1cblxuICBzZXQoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYWRkKG5ldyBQYWlyKGtleSwgdmFsdWUpLCB0cnVlKTtcbiAgfVxuICAvKipcbiAgICogQHBhcmFtIGN0eCAtIENvbnZlcnNpb24gY29udGV4dCwgb3JpZ2luYWxseSBzZXQgaW4gRG9jdW1lbnQjdG9KUygpXG4gICAqIEBwYXJhbSB7Q2xhc3N9IFR5cGUgLSBJZiBzZXQsIGZvcmNlcyB0aGUgcmV0dXJuZWQgY29sbGVjdGlvbiB0eXBlXG4gICAqIEByZXR1cm5zIEluc3RhbmNlIG9mIFR5cGUsIE1hcCwgb3IgT2JqZWN0XG4gICAqL1xuXG5cbiAgdG9KU09OKF8sIGN0eCwgVHlwZSkge1xuICAgIGNvbnN0IG1hcCA9IFR5cGUgPyBuZXcgVHlwZSgpIDogY3R4ICYmIGN0eC5tYXBBc01hcCA/IG5ldyBNYXAoKSA6IHt9O1xuICAgIGlmIChjdHggJiYgY3R4Lm9uQ3JlYXRlKSBjdHgub25DcmVhdGUobWFwKTtcblxuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZW1zKSBpdGVtLmFkZFRvSlNNYXAoY3R4LCBtYXApO1xuXG4gICAgcmV0dXJuIG1hcDtcbiAgfVxuXG4gIHRvU3RyaW5nKGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCkge1xuICAgIGlmICghY3R4KSByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcyk7XG5cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVtcykge1xuICAgICAgaWYgKCEoaXRlbSBpbnN0YW5jZW9mIFBhaXIpKSB0aHJvdyBuZXcgRXJyb3IoXCJNYXAgaXRlbXMgbXVzdCBhbGwgYmUgcGFpcnM7IGZvdW5kIFwiLmNvbmNhdChKU09OLnN0cmluZ2lmeShpdGVtKSwgXCIgaW5zdGVhZFwiKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1cGVyLnRvU3RyaW5nKGN0eCwge1xuICAgICAgYmxvY2tJdGVtOiBuID0+IG4uc3RyLFxuICAgICAgZmxvd0NoYXJzOiB7XG4gICAgICAgIHN0YXJ0OiAneycsXG4gICAgICAgIGVuZDogJ30nXG4gICAgICB9LFxuICAgICAgaXNNYXA6IHRydWUsXG4gICAgICBpdGVtSW5kZW50OiBjdHguaW5kZW50IHx8ICcnXG4gICAgfSwgb25Db21tZW50LCBvbkNob21wS2VlcCk7XG4gIH1cblxufVxuXG5leHBvcnQgeyBZQU1MTWFwLCBmaW5kUGFpciB9O1xuIiwiaW1wb3J0IHsgUGFpciB9IGZyb20gJy4vUGFpci5qcyc7XG5pbXBvcnQgeyBTY2FsYXIgfSBmcm9tICcuL1NjYWxhci5qcyc7XG5pbXBvcnQgeyBZQU1MTWFwIH0gZnJvbSAnLi9ZQU1MTWFwLmpzJztcbmltcG9ydCB7IFlBTUxTZXEgfSBmcm9tICcuL1lBTUxTZXEuanMnO1xuXG5jb25zdCBNRVJHRV9LRVkgPSAnPDwnO1xuY2xhc3MgTWVyZ2UgZXh0ZW5kcyBQYWlyIHtcbiAgY29uc3RydWN0b3IocGFpcikge1xuICAgIGlmIChwYWlyIGluc3RhbmNlb2YgUGFpcikge1xuICAgICAgbGV0IHNlcSA9IHBhaXIudmFsdWU7XG5cbiAgICAgIGlmICghKHNlcSBpbnN0YW5jZW9mIFlBTUxTZXEpKSB7XG4gICAgICAgIHNlcSA9IG5ldyBZQU1MU2VxKCk7XG4gICAgICAgIHNlcS5pdGVtcy5wdXNoKHBhaXIudmFsdWUpO1xuICAgICAgICBzZXEucmFuZ2UgPSBwYWlyLnZhbHVlLnJhbmdlO1xuICAgICAgfVxuXG4gICAgICBzdXBlcihwYWlyLmtleSwgc2VxKTtcbiAgICAgIHRoaXMucmFuZ2UgPSBwYWlyLnJhbmdlO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlcihuZXcgU2NhbGFyKE1FUkdFX0tFWSksIG5ldyBZQU1MU2VxKCkpO1xuICAgIH1cblxuICAgIHRoaXMudHlwZSA9IFBhaXIuVHlwZS5NRVJHRV9QQUlSO1xuICB9IC8vIElmIHRoZSB2YWx1ZSBhc3NvY2lhdGVkIHdpdGggYSBtZXJnZSBrZXkgaXMgYSBzaW5nbGUgbWFwcGluZyBub2RlLCBlYWNoIG9mXG4gIC8vIGl0cyBrZXkvdmFsdWUgcGFpcnMgaXMgaW5zZXJ0ZWQgaW50byB0aGUgY3VycmVudCBtYXBwaW5nLCB1bmxlc3MgdGhlIGtleVxuICAvLyBhbHJlYWR5IGV4aXN0cyBpbiBpdC4gSWYgdGhlIHZhbHVlIGFzc29jaWF0ZWQgd2l0aCB0aGUgbWVyZ2Uga2V5IGlzIGFcbiAgLy8gc2VxdWVuY2UsIHRoZW4gdGhpcyBzZXF1ZW5jZSBpcyBleHBlY3RlZCB0byBjb250YWluIG1hcHBpbmcgbm9kZXMgYW5kIGVhY2hcbiAgLy8gb2YgdGhlc2Ugbm9kZXMgaXMgbWVyZ2VkIGluIHR1cm4gYWNjb3JkaW5nIHRvIGl0cyBvcmRlciBpbiB0aGUgc2VxdWVuY2UuXG4gIC8vIEtleXMgaW4gbWFwcGluZyBub2RlcyBlYXJsaWVyIGluIHRoZSBzZXF1ZW5jZSBvdmVycmlkZSBrZXlzIHNwZWNpZmllZCBpblxuICAvLyBsYXRlciBtYXBwaW5nIG5vZGVzLiAtLSBodHRwOi8veWFtbC5vcmcvdHlwZS9tZXJnZS5odG1sXG5cblxuICBhZGRUb0pTTWFwKGN0eCwgbWFwKSB7XG4gICAgZm9yIChjb25zdCB7XG4gICAgICBzb3VyY2VcbiAgICB9IG9mIHRoaXMudmFsdWUuaXRlbXMpIHtcbiAgICAgIGlmICghKHNvdXJjZSBpbnN0YW5jZW9mIFlBTUxNYXApKSB0aHJvdyBuZXcgRXJyb3IoJ01lcmdlIHNvdXJjZXMgbXVzdCBiZSBtYXBzJyk7XG4gICAgICBjb25zdCBzcmNNYXAgPSBzb3VyY2UudG9KU09OKG51bGwsIGN0eCwgTWFwKTtcblxuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2Ygc3JjTWFwKSB7XG4gICAgICAgIGlmIChtYXAgaW5zdGFuY2VvZiBNYXApIHtcbiAgICAgICAgICBpZiAoIW1hcC5oYXMoa2V5KSkgbWFwLnNldChrZXksIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIGlmIChtYXAgaW5zdGFuY2VvZiBTZXQpIHtcbiAgICAgICAgICBtYXAuYWRkKGtleSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtYXAsIGtleSkpIHtcbiAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobWFwLCBrZXksIHtcbiAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbWFwO1xuICB9XG5cbiAgdG9TdHJpbmcoY3R4LCBvbkNvbW1lbnQpIHtcbiAgICBjb25zdCBzZXEgPSB0aGlzLnZhbHVlO1xuICAgIGlmIChzZXEuaXRlbXMubGVuZ3RoID4gMSkgcmV0dXJuIHN1cGVyLnRvU3RyaW5nKGN0eCwgb25Db21tZW50KTtcbiAgICB0aGlzLnZhbHVlID0gc2VxLml0ZW1zWzBdO1xuICAgIGNvbnN0IHN0ciA9IHN1cGVyLnRvU3RyaW5nKGN0eCwgb25Db21tZW50KTtcbiAgICB0aGlzLnZhbHVlID0gc2VxO1xuICAgIHJldHVybiBzdHI7XG4gIH1cblxufVxuXG5leHBvcnQgeyBNRVJHRV9LRVksIE1lcmdlIH07XG4iLCJpbXBvcnQgeyBkZWZpbmVQcm9wZXJ0eSBhcyBfZGVmaW5lUHJvcGVydHkgfSBmcm9tICcuLi9fdmlydHVhbC9fcm9sbHVwUGx1Z2luQmFiZWxIZWxwZXJzLmpzJztcbmltcG9ydCB7IFNjYWxhciB9IGZyb20gJy4uL2FzdC9TY2FsYXIuanMnO1xuaW1wb3J0IHsgWUFNTFNlcSB9IGZyb20gJy4uL2FzdC9ZQU1MU2VxLmpzJztcbmltcG9ydCB7IFlBTUxNYXAgfSBmcm9tICcuLi9hc3QvWUFNTE1hcC5qcyc7XG5pbXBvcnQgeyBBbGlhcyB9IGZyb20gJy4uL2FzdC9BbGlhcy5qcyc7XG5pbXBvcnQgeyBNZXJnZSB9IGZyb20gJy4uL2FzdC9NZXJnZS5qcyc7XG5cbmNsYXNzIEFuY2hvcnMge1xuICBzdGF0aWMgdmFsaWRBbmNob3JOb2RlKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIFNjYWxhciB8fCBub2RlIGluc3RhbmNlb2YgWUFNTFNlcSB8fCBub2RlIGluc3RhbmNlb2YgWUFNTE1hcDtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByZWZpeCkge1xuICAgIF9kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm1hcFwiLCBPYmplY3QuY3JlYXRlKG51bGwpKTtcblxuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG5cbiAgY3JlYXRlQWxpYXMobm9kZSwgbmFtZSkge1xuICAgIHRoaXMuc2V0QW5jaG9yKG5vZGUsIG5hbWUpO1xuICAgIHJldHVybiBuZXcgQWxpYXMobm9kZSk7XG4gIH1cblxuICBjcmVhdGVNZXJnZVBhaXIoLi4uc291cmNlcykge1xuICAgIGNvbnN0IG1lcmdlID0gbmV3IE1lcmdlKCk7XG4gICAgbWVyZ2UudmFsdWUuaXRlbXMgPSBzb3VyY2VzLm1hcChzID0+IHtcbiAgICAgIGlmIChzIGluc3RhbmNlb2YgQWxpYXMpIHtcbiAgICAgICAgaWYgKHMuc291cmNlIGluc3RhbmNlb2YgWUFNTE1hcCkgcmV0dXJuIHM7XG4gICAgICB9IGVsc2UgaWYgKHMgaW5zdGFuY2VvZiBZQU1MTWFwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZUFsaWFzKHMpO1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01lcmdlIHNvdXJjZXMgbXVzdCBiZSBNYXAgbm9kZXMgb3IgdGhlaXIgQWxpYXNlcycpO1xuICAgIH0pO1xuICAgIHJldHVybiBtZXJnZTtcbiAgfVxuXG4gIGdldE5hbWUobm9kZSkge1xuICAgIGNvbnN0IHtcbiAgICAgIG1hcFxuICAgIH0gPSB0aGlzO1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhtYXApLmZpbmQoYSA9PiBtYXBbYV0gPT09IG5vZGUpO1xuICB9XG5cbiAgZ2V0TmFtZXMoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMubWFwKTtcbiAgfVxuXG4gIGdldE5vZGUobmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1hcFtuYW1lXTtcbiAgfVxuXG4gIG5ld05hbWUocHJlZml4KSB7XG4gICAgaWYgKCFwcmVmaXgpIHByZWZpeCA9IHRoaXMucHJlZml4O1xuICAgIGNvbnN0IG5hbWVzID0gT2JqZWN0LmtleXModGhpcy5tYXApO1xuXG4gICAgZm9yIChsZXQgaSA9IDE7IHRydWU7ICsraSkge1xuICAgICAgY29uc3QgbmFtZSA9IFwiXCIuY29uY2F0KHByZWZpeCkuY29uY2F0KGkpO1xuICAgICAgaWYgKCFuYW1lcy5pbmNsdWRlcyhuYW1lKSkgcmV0dXJuIG5hbWU7XG4gICAgfVxuICB9IC8vIER1cmluZyBwYXJzaW5nLCBtYXAgJiBhbGlhc2VzIGNvbnRhaW4gQ1NUIG5vZGVzXG5cblxuICByZXNvbHZlTm9kZXMoKSB7XG4gICAgY29uc3Qge1xuICAgICAgbWFwLFxuICAgICAgX2NzdEFsaWFzZXNcbiAgICB9ID0gdGhpcztcbiAgICBPYmplY3Qua2V5cyhtYXApLmZvckVhY2goYSA9PiB7XG4gICAgICBtYXBbYV0gPSBtYXBbYV0ucmVzb2x2ZWQ7XG4gICAgfSk7XG5cbiAgICBfY3N0QWxpYXNlcy5mb3JFYWNoKGEgPT4ge1xuICAgICAgYS5zb3VyY2UgPSBhLnNvdXJjZS5yZXNvbHZlZDtcbiAgICB9KTtcblxuICAgIGRlbGV0ZSB0aGlzLl9jc3RBbGlhc2VzO1xuICB9XG5cbiAgc2V0QW5jaG9yKG5vZGUsIG5hbWUpIHtcbiAgICBpZiAobm9kZSAhPSBudWxsICYmICFBbmNob3JzLnZhbGlkQW5jaG9yTm9kZShub2RlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbmNob3JzIG1heSBvbmx5IGJlIHNldCBmb3IgU2NhbGFyLCBTZXEgYW5kIE1hcCBub2RlcycpO1xuICAgIH1cblxuICAgIGlmIChuYW1lICYmIC9bXFx4MDAtXFx4MTlcXHMsW1xcXXt9XS8udGVzdChuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbmNob3IgbmFtZXMgbXVzdCBub3QgY29udGFpbiB3aGl0ZXNwYWNlIG9yIGNvbnRyb2wgY2hhcmFjdGVycycpO1xuICAgIH1cblxuICAgIGNvbnN0IHtcbiAgICAgIG1hcFxuICAgIH0gPSB0aGlzO1xuICAgIGNvbnN0IHByZXYgPSBub2RlICYmIE9iamVjdC5rZXlzKG1hcCkuZmluZChhID0+IG1hcFthXSA9PT0gbm9kZSk7XG5cbiAgICBpZiAocHJldikge1xuICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgIHJldHVybiBwcmV2O1xuICAgICAgfSBlbHNlIGlmIChwcmV2ICE9PSBuYW1lKSB7XG4gICAgICAgIGRlbGV0ZSBtYXBbcHJldl07XG4gICAgICAgIG1hcFtuYW1lXSA9IG5vZGU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghbmFtZSkge1xuICAgICAgICBpZiAoIW5vZGUpIHJldHVybiBudWxsO1xuICAgICAgICBuYW1lID0gdGhpcy5uZXdOYW1lKCk7XG4gICAgICB9XG5cbiAgICAgIG1hcFtuYW1lXSA9IG5vZGU7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5hbWU7XG4gIH1cblxufVxuXG5leHBvcnQgeyBBbmNob3JzIH07XG4iLCJmdW5jdGlvbiBzdHJpbmdpZnlOdW1iZXIoe1xuICBmb3JtYXQsXG4gIG1pbkZyYWN0aW9uRGlnaXRzLFxuICB0YWcsXG4gIHZhbHVlXG59KSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdiaWdpbnQnKSByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgaWYgKCFpc0Zpbml0ZSh2YWx1ZSkpIHJldHVybiBpc05hTih2YWx1ZSkgPyAnLm5hbicgOiB2YWx1ZSA8IDAgPyAnLS5pbmYnIDogJy5pbmYnO1xuICBsZXQgbiA9IEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcblxuICBpZiAoIWZvcm1hdCAmJiBtaW5GcmFjdGlvbkRpZ2l0cyAmJiAoIXRhZyB8fCB0YWcgPT09ICd0YWc6eWFtbC5vcmcsMjAwMjpmbG9hdCcpICYmIC9eXFxkLy50ZXN0KG4pKSB7XG4gICAgbGV0IGkgPSBuLmluZGV4T2YoJy4nKTtcblxuICAgIGlmIChpIDwgMCkge1xuICAgICAgaSA9IG4ubGVuZ3RoO1xuICAgICAgbiArPSAnLic7XG4gICAgfVxuXG4gICAgbGV0IGQgPSBtaW5GcmFjdGlvbkRpZ2l0cyAtIChuLmxlbmd0aCAtIGkgLSAxKTtcblxuICAgIHdoaWxlIChkLS0gPiAwKSBuICs9ICcwJztcbiAgfVxuXG4gIHJldHVybiBuO1xufVxuXG5leHBvcnQgeyBzdHJpbmdpZnlOdW1iZXIgfTtcbiIsImltcG9ydCB7IGNyZWF0ZVBhaXIgfSBmcm9tICcuLi8uLi9hc3QvUGFpci5qcyc7XG5pbXBvcnQgeyBZQU1MTWFwIH0gZnJvbSAnLi4vLi4vYXN0L1lBTUxNYXAuanMnO1xuXG5mdW5jdGlvbiBjcmVhdGVNYXAoc2NoZW1hLCBvYmosIGN0eCkge1xuICBjb25zdCB7XG4gICAga2VlcFVuZGVmaW5lZCxcbiAgICByZXBsYWNlclxuICB9ID0gY3R4O1xuICBjb25zdCBtYXAgPSBuZXcgWUFNTE1hcChzY2hlbWEpO1xuXG4gIGNvbnN0IGFkZCA9IChrZXksIHZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiByZXBsYWNlciA9PT0gJ2Z1bmN0aW9uJykgdmFsdWUgPSByZXBsYWNlci5jYWxsKG9iaiwga2V5LCB2YWx1ZSk7ZWxzZSBpZiAoQXJyYXkuaXNBcnJheShyZXBsYWNlcikgJiYgIXJlcGxhY2VyLmluY2x1ZGVzKGtleSkpIHJldHVybjtcbiAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCB8fCBrZWVwVW5kZWZpbmVkKSBtYXAuaXRlbXMucHVzaChjcmVhdGVQYWlyKGtleSwgdmFsdWUsIGN0eCkpO1xuICB9O1xuXG4gIGlmIChvYmogaW5zdGFuY2VvZiBNYXApIHtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBvYmopIGFkZChrZXksIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvYmopKSBhZGQoa2V5LCBvYmpba2V5XSk7XG4gIH1cblxuICBpZiAodHlwZW9mIHNjaGVtYS5zb3J0TWFwRW50cmllcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIG1hcC5pdGVtcy5zb3J0KHNjaGVtYS5zb3J0TWFwRW50cmllcyk7XG4gIH1cblxuICByZXR1cm4gbWFwO1xufVxuXG5jb25zdCBtYXAgPSB7XG4gIGNyZWF0ZU5vZGU6IGNyZWF0ZU1hcCxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgbm9kZUNsYXNzOiBZQU1MTWFwLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjptYXAnLFxuICByZXNvbHZlOiBtYXAgPT4gbWFwXG59O1xuXG5leHBvcnQgeyBtYXAgfTtcbiIsImltcG9ydCB7IFlBTUxTZXEgfSBmcm9tICcuLi8uLi9hc3QvWUFNTFNlcS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVOb2RlIH0gZnJvbSAnLi4vLi4vZG9jL2NyZWF0ZU5vZGUuanMnO1xuXG5mdW5jdGlvbiBjcmVhdGVTZXEoc2NoZW1hLCBvYmosIGN0eCkge1xuICBjb25zdCB7XG4gICAgcmVwbGFjZXJcbiAgfSA9IGN0eDtcbiAgY29uc3Qgc2VxID0gbmV3IFlBTUxTZXEoc2NoZW1hKTtcblxuICBpZiAob2JqICYmIG9ialtTeW1ib2wuaXRlcmF0b3JdKSB7XG4gICAgbGV0IGkgPSAwO1xuXG4gICAgZm9yIChsZXQgaXQgb2Ygb2JqKSB7XG4gICAgICBpZiAodHlwZW9mIHJlcGxhY2VyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNvbnN0IGtleSA9IG9iaiBpbnN0YW5jZW9mIFNldCA/IGl0IDogU3RyaW5nKGkrKyk7XG4gICAgICAgIGl0ID0gcmVwbGFjZXIuY2FsbChvYmosIGtleSwgaXQpO1xuICAgICAgfVxuXG4gICAgICBzZXEuaXRlbXMucHVzaChjcmVhdGVOb2RlKGl0LCBudWxsLCBjdHgpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc2VxO1xufVxuXG5jb25zdCBzZXEgPSB7XG4gIGNyZWF0ZU5vZGU6IGNyZWF0ZVNlcSxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgbm9kZUNsYXNzOiBZQU1MU2VxLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpzZXEnLFxuICByZXNvbHZlOiBzZXEgPT4gc2VxXG59O1xuXG5leHBvcnQgeyBzZXEgfTtcbiIsImltcG9ydCB7IHN0cmluZ2lmeVN0cmluZyB9IGZyb20gJy4uLy4uL3N0cmluZ2lmeS9zdHJpbmdpZnlTdHJpbmcuanMnO1xuaW1wb3J0IHsgc3RyT3B0aW9ucyB9IGZyb20gJy4uL29wdGlvbnMuanMnO1xuXG5jb25zdCBzdHJpbmcgPSB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpzdHInLFxuICByZXNvbHZlOiBzdHIgPT4gc3RyLFxuXG4gIHN0cmluZ2lmeShpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApIHtcbiAgICBjdHggPSBPYmplY3QuYXNzaWduKHtcbiAgICAgIGFjdHVhbFN0cmluZzogdHJ1ZVxuICAgIH0sIGN0eCk7XG4gICAgcmV0dXJuIHN0cmluZ2lmeVN0cmluZyhpdGVtLCBjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApO1xuICB9LFxuXG4gIG9wdGlvbnM6IHN0ck9wdGlvbnNcbn07XG5cbmV4cG9ydCB7IHN0cmluZyB9O1xuIiwiaW1wb3J0IHsgbWFwIH0gZnJvbSAnLi9tYXAuanMnO1xuaW1wb3J0IHsgc2VxIH0gZnJvbSAnLi9zZXEuanMnO1xuaW1wb3J0IHsgc3RyaW5nIH0gZnJvbSAnLi9zdHJpbmcuanMnO1xuXG5jb25zdCBmYWlsc2FmZSA9IFttYXAsIHNlcSwgc3RyaW5nXTtcblxuZXhwb3J0IHsgZmFpbHNhZmUgfTtcbiIsImltcG9ydCB7IFNjYWxhciB9IGZyb20gJy4uL2FzdC9TY2FsYXIuanMnO1xuaW1wb3J0IHsgc3RyaW5naWZ5TnVtYmVyIH0gZnJvbSAnLi4vc3RyaW5naWZ5L3N0cmluZ2lmeU51bWJlci5qcyc7XG5pbXBvcnQgeyBmYWlsc2FmZSB9IGZyb20gJy4vZmFpbHNhZmUvaW5kZXguanMnO1xuaW1wb3J0IHsgbnVsbE9wdGlvbnMsIGJvb2xPcHRpb25zLCBpbnRPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zLmpzJztcblxuLyogZ2xvYmFsIEJpZ0ludCAqL1xuXG5jb25zdCBpbnRJZGVudGlmeSA9IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ2JpZ2ludCcgfHwgTnVtYmVyLmlzSW50ZWdlcih2YWx1ZSk7XG5cbmNvbnN0IGludFJlc29sdmUgPSAoc3JjLCBvZmZzZXQsIHJhZGl4KSA9PiBpbnRPcHRpb25zLmFzQmlnSW50ID8gQmlnSW50KHNyYykgOiBwYXJzZUludChzcmMuc3Vic3RyaW5nKG9mZnNldCksIHJhZGl4KTtcblxuZnVuY3Rpb24gaW50U3RyaW5naWZ5KG5vZGUsIHJhZGl4LCBwcmVmaXgpIHtcbiAgY29uc3Qge1xuICAgIHZhbHVlXG4gIH0gPSBub2RlO1xuICBpZiAoaW50SWRlbnRpZnkodmFsdWUpICYmIHZhbHVlID49IDApIHJldHVybiBwcmVmaXggKyB2YWx1ZS50b1N0cmluZyhyYWRpeCk7XG4gIHJldHVybiBzdHJpbmdpZnlOdW1iZXIobm9kZSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeUJvb2wobm9kZSkge1xuICBjb25zdCB7XG4gICAgdmFsdWUsXG4gICAgc291cmNlU3RyXG4gIH0gPSBub2RlO1xuXG4gIGlmIChzb3VyY2VTdHIpIHtcbiAgICBjb25zdCBtYXRjaCA9IGJvb2xPYmoudGVzdC50ZXN0KHNvdXJjZVN0cik7XG4gICAgaWYgKG1hdGNoICYmIHZhbHVlID09PSAoc291cmNlU3RyWzBdID09PSAndCcgfHwgc291cmNlU3RyWzBdID09PSAnVCcpKSByZXR1cm4gc291cmNlU3RyO1xuICB9XG5cbiAgcmV0dXJuIHZhbHVlID8gYm9vbE9wdGlvbnMudHJ1ZVN0ciA6IGJvb2xPcHRpb25zLmZhbHNlU3RyO1xufVxuXG5jb25zdCBudWxsT2JqID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdmFsdWUgPT0gbnVsbCxcbiAgY3JlYXRlTm9kZTogKHNjaGVtYSwgdmFsdWUsIGN0eCkgPT4gY3R4LndyYXBTY2FsYXJzID8gbmV3IFNjYWxhcihudWxsKSA6IG51bGwsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOm51bGwnLFxuICB0ZXN0OiAvXig/On58W05uXXVsbHxOVUxMKT8kLyxcbiAgcmVzb2x2ZTogc3RyID0+IHtcbiAgICBjb25zdCBub2RlID0gbmV3IFNjYWxhcihudWxsKTtcbiAgICBub2RlLnNvdXJjZVN0ciA9IHN0cjtcbiAgICByZXR1cm4gbm9kZTtcbiAgfSxcbiAgb3B0aW9uczogbnVsbE9wdGlvbnMsXG4gIHN0cmluZ2lmeTogKHtcbiAgICBzb3VyY2VTdHJcbiAgfSkgPT4gc291cmNlU3RyICE9PSBudWxsICYmIHNvdXJjZVN0ciAhPT0gdm9pZCAwID8gc291cmNlU3RyIDogbnVsbE9wdGlvbnMubnVsbFN0clxufTtcbmNvbnN0IGJvb2xPYmogPSB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJyxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6Ym9vbCcsXG4gIHRlc3Q6IC9eKD86W1R0XXJ1ZXxUUlVFfFtGZl1hbHNlfEZBTFNFKSQvLFxuICByZXNvbHZlOiBzdHIgPT4ge1xuICAgIGNvbnN0IG5vZGUgPSBuZXcgU2NhbGFyKHN0clswXSA9PT0gJ3QnIHx8IHN0clswXSA9PT0gJ1QnKTtcbiAgICBub2RlLnNvdXJjZVN0ciA9IHN0cjtcbiAgICByZXR1cm4gbm9kZTtcbiAgfSxcbiAgb3B0aW9uczogYm9vbE9wdGlvbnMsXG4gIHN0cmluZ2lmeTogc3RyaW5naWZ5Qm9vbFxufTtcbmNvbnN0IG9jdE9iaiA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IGludElkZW50aWZ5KHZhbHVlKSAmJiB2YWx1ZSA+PSAwLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjppbnQnLFxuICBmb3JtYXQ6ICdPQ1QnLFxuICB0ZXN0OiAvXjBvWzAtN10rJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBpbnRSZXNvbHZlKHN0ciwgMiwgOCksXG4gIG9wdGlvbnM6IGludE9wdGlvbnMsXG4gIHN0cmluZ2lmeTogbm9kZSA9PiBpbnRTdHJpbmdpZnkobm9kZSwgOCwgJzBvJylcbn07XG5jb25zdCBpbnRPYmogPSB7XG4gIGlkZW50aWZ5OiBpbnRJZGVudGlmeSxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6aW50JyxcbiAgdGVzdDogL15bLStdP1swLTldKyQvLFxuICByZXNvbHZlOiBzdHIgPT4gaW50UmVzb2x2ZShzdHIsIDAsIDEwKSxcbiAgb3B0aW9uczogaW50T3B0aW9ucyxcbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlOdW1iZXJcbn07XG5jb25zdCBoZXhPYmogPSB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiBpbnRJZGVudGlmeSh2YWx1ZSkgJiYgdmFsdWUgPj0gMCxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6aW50JyxcbiAgZm9ybWF0OiAnSEVYJyxcbiAgdGVzdDogL14weFswLTlhLWZBLUZdKyQvLFxuICByZXNvbHZlOiBzdHIgPT4gaW50UmVzb2x2ZShzdHIsIDIsIDE2KSxcbiAgb3B0aW9uczogaW50T3B0aW9ucyxcbiAgc3RyaW5naWZ5OiBub2RlID0+IGludFN0cmluZ2lmeShub2RlLCAxNiwgJzB4Jylcbn07XG5jb25zdCBuYW5PYmogPSB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpmbG9hdCcsXG4gIHRlc3Q6IC9eKD86Wy0rXT9cXC4oPzppbmZ8SW5mfElORnxuYW58TmFOfE5BTikpJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBzdHIuc2xpY2UoLTMpLnRvTG93ZXJDYXNlKCkgPT09ICduYW4nID8gTmFOIDogc3RyWzBdID09PSAnLScgPyBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFkgOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksXG4gIHN0cmluZ2lmeTogc3RyaW5naWZ5TnVtYmVyXG59O1xuY29uc3QgZXhwT2JqID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6ZmxvYXQnLFxuICBmb3JtYXQ6ICdFWFAnLFxuICB0ZXN0OiAvXlstK10/KD86XFwuWzAtOV0rfFswLTldKyg/OlxcLlswLTldKik/KVtlRV1bLStdP1swLTldKyQvLFxuICByZXNvbHZlOiBzdHIgPT4gcGFyc2VGbG9hdChzdHIpLFxuICBzdHJpbmdpZnk6ICh7XG4gICAgdmFsdWVcbiAgfSkgPT4gTnVtYmVyKHZhbHVlKS50b0V4cG9uZW50aWFsKClcbn07XG5jb25zdCBmbG9hdE9iaiA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmZsb2F0JyxcbiAgdGVzdDogL15bLStdPyg/OlxcLlswLTldK3xbMC05XStcXC5bMC05XSopJC8sXG5cbiAgcmVzb2x2ZShzdHIpIHtcbiAgICBjb25zdCBub2RlID0gbmV3IFNjYWxhcihwYXJzZUZsb2F0KHN0cikpO1xuICAgIGNvbnN0IGRvdCA9IHN0ci5pbmRleE9mKCcuJyk7XG4gICAgaWYgKGRvdCAhPT0gLTEgJiYgc3RyW3N0ci5sZW5ndGggLSAxXSA9PT0gJzAnKSBub2RlLm1pbkZyYWN0aW9uRGlnaXRzID0gc3RyLmxlbmd0aCAtIGRvdCAtIDE7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH0sXG5cbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlOdW1iZXJcbn07XG5jb25zdCBjb3JlID0gZmFpbHNhZmUuY29uY2F0KFtudWxsT2JqLCBib29sT2JqLCBvY3RPYmosIGludE9iaiwgaGV4T2JqLCBuYW5PYmosIGV4cE9iaiwgZmxvYXRPYmpdKTtcblxuZXhwb3J0IHsgYm9vbE9iaiwgY29yZSwgZXhwT2JqLCBmbG9hdE9iaiwgaGV4T2JqLCBpbnRPYmosIG5hbk9iaiwgbnVsbE9iaiwgb2N0T2JqIH07XG4iLCJpbXBvcnQgeyBTY2FsYXIgfSBmcm9tICcuLi9hc3QvU2NhbGFyLmpzJztcbmltcG9ydCB7IG1hcCB9IGZyb20gJy4vZmFpbHNhZmUvbWFwLmpzJztcbmltcG9ydCB7IHNlcSB9IGZyb20gJy4vZmFpbHNhZmUvc2VxLmpzJztcbmltcG9ydCB7IGludE9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMuanMnO1xuXG4vKiBnbG9iYWwgQmlnSW50ICovXG5cbmNvbnN0IGludElkZW50aWZ5ID0gdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnYmlnaW50JyB8fCBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKTtcblxuY29uc3Qgc3RyaW5naWZ5SlNPTiA9ICh7XG4gIHZhbHVlXG59KSA9PiBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG5cbmNvbnN0IGpzb24gPSBbbWFwLCBzZXEsIHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOnN0cicsXG4gIHJlc29sdmU6IHN0ciA9PiBzdHIsXG4gIHN0cmluZ2lmeTogc3RyaW5naWZ5SlNPTlxufSwge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdmFsdWUgPT0gbnVsbCxcbiAgY3JlYXRlTm9kZTogKHNjaGVtYSwgdmFsdWUsIGN0eCkgPT4gY3R4LndyYXBTY2FsYXJzID8gbmV3IFNjYWxhcihudWxsKSA6IG51bGwsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOm51bGwnLFxuICB0ZXN0OiAvXm51bGwkLyxcbiAgcmVzb2x2ZTogKCkgPT4gbnVsbCxcbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlKU09OXG59LCB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJyxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6Ym9vbCcsXG4gIHRlc3Q6IC9edHJ1ZXxmYWxzZSQvLFxuICByZXNvbHZlOiBzdHIgPT4gc3RyID09PSAndHJ1ZScsXG4gIHN0cmluZ2lmeTogc3RyaW5naWZ5SlNPTlxufSwge1xuICBpZGVudGlmeTogaW50SWRlbnRpZnksXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmludCcsXG4gIHRlc3Q6IC9eLT8oPzowfFsxLTldWzAtOV0qKSQvLFxuICByZXNvbHZlOiBzdHIgPT4gaW50T3B0aW9ucy5hc0JpZ0ludCA/IEJpZ0ludChzdHIpIDogcGFyc2VJbnQoc3RyLCAxMCksXG4gIHN0cmluZ2lmeTogKHtcbiAgICB2YWx1ZVxuICB9KSA9PiBpbnRJZGVudGlmeSh2YWx1ZSkgPyB2YWx1ZS50b1N0cmluZygpIDogSlNPTi5zdHJpbmdpZnkodmFsdWUpXG59LCB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpmbG9hdCcsXG4gIHRlc3Q6IC9eLT8oPzowfFsxLTldWzAtOV0qKSg/OlxcLlswLTldKik/KD86W2VFXVstK10/WzAtOV0rKT8kLyxcbiAgcmVzb2x2ZTogc3RyID0+IHBhcnNlRmxvYXQoc3RyKSxcbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlKU09OXG59LCB7XG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRlc3Q6IC9eLyxcblxuICByZXNvbHZlKHN0ciwgb25FcnJvcikge1xuICAgIG9uRXJyb3IoXCJVbnJlc29sdmVkIHBsYWluIHNjYWxhciBcIi5jb25jYXQoSlNPTi5zdHJpbmdpZnkoc3RyKSkpO1xuICAgIHJldHVybiBzdHI7XG4gIH1cblxufV07XG5cbmV4cG9ydCB7IGpzb24gfTtcbiIsImltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi8uLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgc3RyaW5naWZ5U3RyaW5nIH0gZnJvbSAnLi4vLi4vc3RyaW5naWZ5L3N0cmluZ2lmeVN0cmluZy5qcyc7XG5pbXBvcnQgeyBiaW5hcnlPcHRpb25zIH0gZnJvbSAnLi4vb3B0aW9ucy5qcyc7XG5cbi8qIGdsb2JhbCBhdG9iLCBidG9hLCBCdWZmZXIgKi9cbmNvbnN0IGJpbmFyeSA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHZhbHVlIGluc3RhbmNlb2YgVWludDhBcnJheSxcbiAgLy8gQnVmZmVyIGluaGVyaXRzIGZyb20gVWludDhBcnJheVxuICBkZWZhdWx0OiBmYWxzZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6YmluYXJ5JyxcblxuICAvKipcbiAgICogUmV0dXJucyBhIEJ1ZmZlciBpbiBub2RlIGFuZCBhbiBVaW50OEFycmF5IGluIGJyb3dzZXJzXG4gICAqXG4gICAqIFRvIHVzZSB0aGUgcmVzdWx0aW5nIGJ1ZmZlciBhcyBhbiBpbWFnZSwgeW91J2xsIHdhbnQgdG8gZG8gc29tZXRoaW5nIGxpa2U6XG4gICAqXG4gICAqICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtidWZmZXJdLCB7IHR5cGU6ICdpbWFnZS9qcGVnJyB9KVxuICAgKiAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNwaG90bycpLnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYilcbiAgICovXG4gIHJlc29sdmUoc3JjLCBvbkVycm9yKSB7XG4gICAgaWYgKHR5cGVvZiBCdWZmZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbShzcmMsICdiYXNlNjQnKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBhdG9iID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBPbiBJRSAxMSwgYXRvYigpIGNhbid0IGhhbmRsZSBuZXdsaW5lc1xuICAgICAgY29uc3Qgc3RyID0gYXRvYihzcmMucmVwbGFjZSgvW1xcblxccl0vZywgJycpKTtcbiAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KHN0ci5sZW5ndGgpO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkgYnVmZmVyW2ldID0gc3RyLmNoYXJDb2RlQXQoaSk7XG5cbiAgICAgIHJldHVybiBidWZmZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9uRXJyb3IoJ1RoaXMgZW52aXJvbm1lbnQgZG9lcyBub3Qgc3VwcG9ydCByZWFkaW5nIGJpbmFyeSB0YWdzOyBlaXRoZXIgQnVmZmVyIG9yIGF0b2IgaXMgcmVxdWlyZWQnKTtcbiAgICAgIHJldHVybiBzcmM7XG4gICAgfVxuICB9LFxuXG4gIG9wdGlvbnM6IGJpbmFyeU9wdGlvbnMsXG4gIHN0cmluZ2lmeTogKHtcbiAgICBjb21tZW50LFxuICAgIHR5cGUsXG4gICAgdmFsdWVcbiAgfSwgY3R4LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKSA9PiB7XG4gICAgbGV0IHNyYztcblxuICAgIGlmICh0eXBlb2YgQnVmZmVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBzcmMgPSB2YWx1ZSBpbnN0YW5jZW9mIEJ1ZmZlciA/IHZhbHVlLnRvU3RyaW5nKCdiYXNlNjQnKSA6IEJ1ZmZlci5mcm9tKHZhbHVlLmJ1ZmZlcikudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGJ0b2EgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGxldCBzID0gJyc7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyArK2kpIHMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh2YWx1ZVtpXSk7XG5cbiAgICAgIHNyYyA9IGJ0b2Eocyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhpcyBlbnZpcm9ubWVudCBkb2VzIG5vdCBzdXBwb3J0IHdyaXRpbmcgYmluYXJ5IHRhZ3M7IGVpdGhlciBCdWZmZXIgb3IgYnRvYSBpcyByZXF1aXJlZCcpO1xuICAgIH1cblxuICAgIGlmICghdHlwZSkgdHlwZSA9IGJpbmFyeU9wdGlvbnMuZGVmYXVsdFR5cGU7XG5cbiAgICBpZiAodHlwZSA9PT0gVHlwZS5RVU9URV9ET1VCTEUpIHtcbiAgICAgIHZhbHVlID0gc3JjO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIGxpbmVXaWR0aFxuICAgICAgfSA9IGJpbmFyeU9wdGlvbnM7XG4gICAgICBjb25zdCBuID0gTWF0aC5jZWlsKHNyYy5sZW5ndGggLyBsaW5lV2lkdGgpO1xuICAgICAgY29uc3QgbGluZXMgPSBuZXcgQXJyYXkobik7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwLCBvID0gMDsgaSA8IG47ICsraSwgbyArPSBsaW5lV2lkdGgpIHtcbiAgICAgICAgbGluZXNbaV0gPSBzcmMuc3Vic3RyKG8sIGxpbmVXaWR0aCk7XG4gICAgICB9XG5cbiAgICAgIHZhbHVlID0gbGluZXMuam9pbih0eXBlID09PSBUeXBlLkJMT0NLX0xJVEVSQUwgPyAnXFxuJyA6ICcgJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0cmluZ2lmeVN0cmluZyh7XG4gICAgICBjb21tZW50LFxuICAgICAgdHlwZSxcbiAgICAgIHZhbHVlXG4gICAgfSwgY3R4LCBvbkNvbW1lbnQsIG9uQ2hvbXBLZWVwKTtcbiAgfVxufTtcblxuZXhwb3J0IHsgYmluYXJ5IH07XG4iLCJpbXBvcnQgeyBQYWlyLCBjcmVhdGVQYWlyIH0gZnJvbSAnLi4vLi4vYXN0L1BhaXIuanMnO1xuaW1wb3J0IHsgWUFNTE1hcCB9IGZyb20gJy4uLy4uL2FzdC9ZQU1MTWFwLmpzJztcbmltcG9ydCB7IFlBTUxTZXEgfSBmcm9tICcuLi8uLi9hc3QvWUFNTFNlcS5qcyc7XG5cbmZ1bmN0aW9uIHBhcnNlUGFpcnMoc2VxLCBvbkVycm9yKSB7XG4gIGlmIChzZXEgaW5zdGFuY2VvZiBZQU1MU2VxKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZXEuaXRlbXMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGxldCBpdGVtID0gc2VxLml0ZW1zW2ldO1xuICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBQYWlyKSBjb250aW51ZTtlbHNlIGlmIChpdGVtIGluc3RhbmNlb2YgWUFNTE1hcCkge1xuICAgICAgICBpZiAoaXRlbS5pdGVtcy5sZW5ndGggPiAxKSBvbkVycm9yKCdFYWNoIHBhaXIgbXVzdCBoYXZlIGl0cyBvd24gc2VxdWVuY2UgaW5kaWNhdG9yJyk7XG4gICAgICAgIGNvbnN0IHBhaXIgPSBpdGVtLml0ZW1zWzBdIHx8IG5ldyBQYWlyKCk7XG4gICAgICAgIGlmIChpdGVtLmNvbW1lbnRCZWZvcmUpIHBhaXIuY29tbWVudEJlZm9yZSA9IHBhaXIuY29tbWVudEJlZm9yZSA/IFwiXCIuY29uY2F0KGl0ZW0uY29tbWVudEJlZm9yZSwgXCJcXG5cIikuY29uY2F0KHBhaXIuY29tbWVudEJlZm9yZSkgOiBpdGVtLmNvbW1lbnRCZWZvcmU7XG4gICAgICAgIGlmIChpdGVtLmNvbW1lbnQpIHBhaXIuY29tbWVudCA9IHBhaXIuY29tbWVudCA/IFwiXCIuY29uY2F0KGl0ZW0uY29tbWVudCwgXCJcXG5cIikuY29uY2F0KHBhaXIuY29tbWVudCkgOiBpdGVtLmNvbW1lbnQ7XG4gICAgICAgIGl0ZW0gPSBwYWlyO1xuICAgICAgfVxuICAgICAgc2VxLml0ZW1zW2ldID0gaXRlbSBpbnN0YW5jZW9mIFBhaXIgPyBpdGVtIDogbmV3IFBhaXIoaXRlbSk7XG4gICAgfVxuICB9IGVsc2Ugb25FcnJvcignRXhwZWN0ZWQgYSBzZXF1ZW5jZSBmb3IgdGhpcyB0YWcnKTtcblxuICByZXR1cm4gc2VxO1xufVxuZnVuY3Rpb24gY3JlYXRlUGFpcnMoc2NoZW1hLCBpdGVyYWJsZSwgY3R4KSB7XG4gIGNvbnN0IHtcbiAgICByZXBsYWNlclxuICB9ID0gY3R4O1xuICBjb25zdCBwYWlycyA9IG5ldyBZQU1MU2VxKHNjaGVtYSk7XG4gIHBhaXJzLnRhZyA9ICd0YWc6eWFtbC5vcmcsMjAwMjpwYWlycyc7XG4gIGxldCBpID0gMDtcblxuICBmb3IgKGxldCBpdCBvZiBpdGVyYWJsZSkge1xuICAgIGlmICh0eXBlb2YgcmVwbGFjZXIgPT09ICdmdW5jdGlvbicpIGl0ID0gcmVwbGFjZXIuY2FsbChpdGVyYWJsZSwgU3RyaW5nKGkrKyksIGl0KTtcbiAgICBsZXQga2V5LCB2YWx1ZTtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KGl0KSkge1xuICAgICAgaWYgKGl0Lmxlbmd0aCA9PT0gMikge1xuICAgICAgICBrZXkgPSBpdFswXTtcbiAgICAgICAgdmFsdWUgPSBpdFsxXTtcbiAgICAgIH0gZWxzZSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRXhwZWN0ZWQgW2tleSwgdmFsdWVdIHR1cGxlOiBcIi5jb25jYXQoaXQpKTtcbiAgICB9IGVsc2UgaWYgKGl0ICYmIGl0IGluc3RhbmNlb2YgT2JqZWN0KSB7XG4gICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMoaXQpO1xuXG4gICAgICBpZiAoa2V5cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAga2V5ID0ga2V5c1swXTtcbiAgICAgICAgdmFsdWUgPSBpdFtrZXldO1xuICAgICAgfSBlbHNlIHRocm93IG5ldyBUeXBlRXJyb3IoXCJFeHBlY3RlZCB7IGtleTogdmFsdWUgfSB0dXBsZTogXCIuY29uY2F0KGl0KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGtleSA9IGl0O1xuICAgIH1cblxuICAgIHBhaXJzLml0ZW1zLnB1c2goY3JlYXRlUGFpcihrZXksIHZhbHVlLCBjdHgpKTtcbiAgfVxuXG4gIHJldHVybiBwYWlycztcbn1cbmNvbnN0IHBhaXJzID0ge1xuICBkZWZhdWx0OiBmYWxzZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6cGFpcnMnLFxuICByZXNvbHZlOiBwYXJzZVBhaXJzLFxuICBjcmVhdGVOb2RlOiBjcmVhdGVQYWlyc1xufTtcblxuZXhwb3J0IHsgY3JlYXRlUGFpcnMsIHBhaXJzLCBwYXJzZVBhaXJzIH07XG4iLCJpbXBvcnQgeyBkZWZpbmVQcm9wZXJ0eSBhcyBfZGVmaW5lUHJvcGVydHkgfSBmcm9tICcuLi8uLi9fdmlydHVhbC9fcm9sbHVwUGx1Z2luQmFiZWxIZWxwZXJzLmpzJztcbmltcG9ydCB7IFBhaXIgfSBmcm9tICcuLi8uLi9hc3QvUGFpci5qcyc7XG5pbXBvcnQgeyBTY2FsYXIgfSBmcm9tICcuLi8uLi9hc3QvU2NhbGFyLmpzJztcbmltcG9ydCB7IFlBTUxNYXAgfSBmcm9tICcuLi8uLi9hc3QvWUFNTE1hcC5qcyc7XG5pbXBvcnQgeyBZQU1MU2VxIH0gZnJvbSAnLi4vLi4vYXN0L1lBTUxTZXEuanMnO1xuaW1wb3J0IHsgdG9KUyB9IGZyb20gJy4uLy4uL2FzdC90b0pTLmpzJztcbmltcG9ydCB7IHBhcnNlUGFpcnMsIGNyZWF0ZVBhaXJzIH0gZnJvbSAnLi9wYWlycy5qcyc7XG5cbmNsYXNzIFlBTUxPTWFwIGV4dGVuZHMgWUFNTFNlcSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG5cbiAgICBfZGVmaW5lUHJvcGVydHkodGhpcywgXCJhZGRcIiwgWUFNTE1hcC5wcm90b3R5cGUuYWRkLmJpbmQodGhpcykpO1xuXG4gICAgX2RlZmluZVByb3BlcnR5KHRoaXMsIFwiZGVsZXRlXCIsIFlBTUxNYXAucHJvdG90eXBlLmRlbGV0ZS5iaW5kKHRoaXMpKTtcblxuICAgIF9kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImdldFwiLCBZQU1MTWFwLnByb3RvdHlwZS5nZXQuYmluZCh0aGlzKSk7XG5cbiAgICBfZGVmaW5lUHJvcGVydHkodGhpcywgXCJoYXNcIiwgWUFNTE1hcC5wcm90b3R5cGUuaGFzLmJpbmQodGhpcykpO1xuXG4gICAgX2RlZmluZVByb3BlcnR5KHRoaXMsIFwic2V0XCIsIFlBTUxNYXAucHJvdG90eXBlLnNldC5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMudGFnID0gWUFNTE9NYXAudGFnO1xuICB9XG5cbiAgdG9KU09OKF8sIGN0eCkge1xuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAoKTtcbiAgICBpZiAoY3R4ICYmIGN0eC5vbkNyZWF0ZSkgY3R4Lm9uQ3JlYXRlKG1hcCk7XG5cbiAgICBmb3IgKGNvbnN0IHBhaXIgb2YgdGhpcy5pdGVtcykge1xuICAgICAgbGV0IGtleSwgdmFsdWU7XG5cbiAgICAgIGlmIChwYWlyIGluc3RhbmNlb2YgUGFpcikge1xuICAgICAgICBrZXkgPSB0b0pTKHBhaXIua2V5LCAnJywgY3R4KTtcbiAgICAgICAgdmFsdWUgPSB0b0pTKHBhaXIudmFsdWUsIGtleSwgY3R4KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGtleSA9IHRvSlMocGFpciwgJycsIGN0eCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChtYXAuaGFzKGtleSkpIHRocm93IG5ldyBFcnJvcignT3JkZXJlZCBtYXBzIG11c3Qgbm90IGluY2x1ZGUgZHVwbGljYXRlIGtleXMnKTtcbiAgICAgIG1hcC5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hcDtcbiAgfVxuXG59XG5cbl9kZWZpbmVQcm9wZXJ0eShZQU1MT01hcCwgXCJ0YWdcIiwgJ3RhZzp5YW1sLm9yZywyMDAyOm9tYXAnKTtcblxuZnVuY3Rpb24gcGFyc2VPTWFwKHNlcSwgb25FcnJvcikge1xuICBjb25zdCBwYWlycyA9IHBhcnNlUGFpcnMoc2VxLCBvbkVycm9yKTtcbiAgY29uc3Qgc2VlbktleXMgPSBbXTtcblxuICBmb3IgKGNvbnN0IHtcbiAgICBrZXlcbiAgfSBvZiBwYWlycy5pdGVtcykge1xuICAgIGlmIChrZXkgaW5zdGFuY2VvZiBTY2FsYXIpIHtcbiAgICAgIGlmIChzZWVuS2V5cy5pbmNsdWRlcyhrZXkudmFsdWUpKSB7XG4gICAgICAgIG9uRXJyb3IoXCJPcmRlcmVkIG1hcHMgbXVzdCBub3QgaW5jbHVkZSBkdXBsaWNhdGUga2V5czogXCIuY29uY2F0KGtleS52YWx1ZSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2VlbktleXMucHVzaChrZXkudmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKG5ldyBZQU1MT01hcCgpLCBwYWlycyk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU9NYXAoc2NoZW1hLCBpdGVyYWJsZSwgY3R4KSB7XG4gIGNvbnN0IHBhaXJzID0gY3JlYXRlUGFpcnMoc2NoZW1hLCBpdGVyYWJsZSwgY3R4KTtcbiAgY29uc3Qgb21hcCA9IG5ldyBZQU1MT01hcCgpO1xuICBvbWFwLml0ZW1zID0gcGFpcnMuaXRlbXM7XG4gIHJldHVybiBvbWFwO1xufVxuXG5jb25zdCBvbWFwID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdmFsdWUgaW5zdGFuY2VvZiBNYXAsXG4gIG5vZGVDbGFzczogWUFNTE9NYXAsXG4gIGRlZmF1bHQ6IGZhbHNlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpvbWFwJyxcbiAgcmVzb2x2ZTogcGFyc2VPTWFwLFxuICBjcmVhdGVOb2RlOiBjcmVhdGVPTWFwXG59O1xuXG5leHBvcnQgeyBZQU1MT01hcCwgb21hcCB9O1xuIiwiaW1wb3J0IHsgZGVmaW5lUHJvcGVydHkgYXMgX2RlZmluZVByb3BlcnR5IH0gZnJvbSAnLi4vLi4vX3ZpcnR1YWwvX3JvbGx1cFBsdWdpbkJhYmVsSGVscGVycy5qcyc7XG5pbXBvcnQgeyBQYWlyLCBjcmVhdGVQYWlyIH0gZnJvbSAnLi4vLi4vYXN0L1BhaXIuanMnO1xuaW1wb3J0IHsgU2NhbGFyIH0gZnJvbSAnLi4vLi4vYXN0L1NjYWxhci5qcyc7XG5pbXBvcnQgeyBZQU1MTWFwLCBmaW5kUGFpciB9IGZyb20gJy4uLy4uL2FzdC9ZQU1MTWFwLmpzJztcblxuY2xhc3MgWUFNTFNldCBleHRlbmRzIFlBTUxNYXAge1xuICBjb25zdHJ1Y3RvcihzY2hlbWEpIHtcbiAgICBzdXBlcihzY2hlbWEpO1xuICAgIHRoaXMudGFnID0gWUFNTFNldC50YWc7XG4gIH1cblxuICBhZGQoa2V5KSB7XG4gICAgY29uc3QgcGFpciA9IGtleSBpbnN0YW5jZW9mIFBhaXIgPyBrZXkgOiBuZXcgUGFpcihrZXkpO1xuICAgIGNvbnN0IHByZXYgPSBmaW5kUGFpcih0aGlzLml0ZW1zLCBwYWlyLmtleSk7XG4gICAgaWYgKCFwcmV2KSB0aGlzLml0ZW1zLnB1c2gocGFpcik7XG4gIH1cblxuICBnZXQoa2V5LCBrZWVwUGFpcikge1xuICAgIGNvbnN0IHBhaXIgPSBmaW5kUGFpcih0aGlzLml0ZW1zLCBrZXkpO1xuICAgIHJldHVybiAha2VlcFBhaXIgJiYgcGFpciBpbnN0YW5jZW9mIFBhaXIgPyBwYWlyLmtleSBpbnN0YW5jZW9mIFNjYWxhciA/IHBhaXIua2V5LnZhbHVlIDogcGFpci5rZXkgOiBwYWlyO1xuICB9XG5cbiAgc2V0KGtleSwgdmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnYm9vbGVhbicpIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIGJvb2xlYW4gdmFsdWUgZm9yIHNldChrZXksIHZhbHVlKSBpbiBhIFlBTUwgc2V0LCBub3QgXCIuY29uY2F0KHR5cGVvZiB2YWx1ZSkpO1xuICAgIGNvbnN0IHByZXYgPSBmaW5kUGFpcih0aGlzLml0ZW1zLCBrZXkpO1xuXG4gICAgaWYgKHByZXYgJiYgIXZhbHVlKSB7XG4gICAgICB0aGlzLml0ZW1zLnNwbGljZSh0aGlzLml0ZW1zLmluZGV4T2YocHJldiksIDEpO1xuICAgIH0gZWxzZSBpZiAoIXByZXYgJiYgdmFsdWUpIHtcbiAgICAgIHRoaXMuaXRlbXMucHVzaChuZXcgUGFpcihrZXkpKTtcbiAgICB9XG4gIH1cblxuICB0b0pTT04oXywgY3R4KSB7XG4gICAgcmV0dXJuIHN1cGVyLnRvSlNPTihfLCBjdHgsIFNldCk7XG4gIH1cblxuICB0b1N0cmluZyhjdHgsIG9uQ29tbWVudCwgb25DaG9tcEtlZXApIHtcbiAgICBpZiAoIWN0eCkgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMpO1xuICAgIGlmICh0aGlzLmhhc0FsbE51bGxWYWx1ZXMoKSkgcmV0dXJuIHN1cGVyLnRvU3RyaW5nKGN0eCwgb25Db21tZW50LCBvbkNob21wS2VlcCk7ZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ1NldCBpdGVtcyBtdXN0IGFsbCBoYXZlIG51bGwgdmFsdWVzJyk7XG4gIH1cblxufVxuXG5fZGVmaW5lUHJvcGVydHkoWUFNTFNldCwgXCJ0YWdcIiwgJ3RhZzp5YW1sLm9yZywyMDAyOnNldCcpO1xuXG5mdW5jdGlvbiBwYXJzZVNldChtYXAsIG9uRXJyb3IpIHtcbiAgaWYgKG1hcCBpbnN0YW5jZW9mIFlBTUxNYXApIHtcbiAgICBpZiAobWFwLmhhc0FsbE51bGxWYWx1ZXMoKSkgcmV0dXJuIE9iamVjdC5hc3NpZ24obmV3IFlBTUxTZXQoKSwgbWFwKTtlbHNlIG9uRXJyb3IoJ1NldCBpdGVtcyBtdXN0IGFsbCBoYXZlIG51bGwgdmFsdWVzJyk7XG4gIH0gZWxzZSBvbkVycm9yKCdFeHBlY3RlZCBhIG1hcHBpbmcgZm9yIHRoaXMgdGFnJyk7XG5cbiAgcmV0dXJuIG1hcDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU2V0KHNjaGVtYSwgaXRlcmFibGUsIGN0eCkge1xuICBjb25zdCB7XG4gICAgcmVwbGFjZXJcbiAgfSA9IGN0eDtcbiAgY29uc3Qgc2V0ID0gbmV3IFlBTUxTZXQoc2NoZW1hKTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBpdGVyYWJsZSkge1xuICAgIGlmICh0eXBlb2YgcmVwbGFjZXIgPT09ICdmdW5jdGlvbicpIHZhbHVlID0gcmVwbGFjZXIuY2FsbChpdGVyYWJsZSwgdmFsdWUsIHZhbHVlKTtcbiAgICBzZXQuaXRlbXMucHVzaChjcmVhdGVQYWlyKHZhbHVlLCBudWxsLCBjdHgpKTtcbiAgfVxuXG4gIHJldHVybiBzZXQ7XG59XG5cbmNvbnN0IHNldCA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHZhbHVlIGluc3RhbmNlb2YgU2V0LFxuICBub2RlQ2xhc3M6IFlBTUxTZXQsXG4gIGRlZmF1bHQ6IGZhbHNlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpzZXQnLFxuICByZXNvbHZlOiBwYXJzZVNldCxcbiAgY3JlYXRlTm9kZTogY3JlYXRlU2V0XG59O1xuXG5leHBvcnQgeyBZQU1MU2V0LCBzZXQgfTtcbiIsImltcG9ydCB7IGludE9wdGlvbnMgfSBmcm9tICcuLi9vcHRpb25zLmpzJztcbmltcG9ydCB7IHN0cmluZ2lmeU51bWJlciB9IGZyb20gJy4uLy4uL3N0cmluZ2lmeS9zdHJpbmdpZnlOdW1iZXIuanMnO1xuXG4vKiBnbG9iYWwgQmlnSW50ICovXG5cbmNvbnN0IHBhcnNlU2V4YWdlc2ltYWwgPSAoc3RyLCBpc0ludCkgPT4ge1xuICBjb25zdCBzaWduID0gc3RyWzBdO1xuICBjb25zdCBwYXJ0cyA9IHNpZ24gPT09ICctJyB8fCBzaWduID09PSAnKycgPyBzdHIuc3Vic3RyaW5nKDEpIDogc3RyO1xuXG4gIGNvbnN0IG51bSA9IG4gPT4gaXNJbnQgJiYgaW50T3B0aW9ucy5hc0JpZ0ludCA/IEJpZ0ludChuKSA6IE51bWJlcihuKTtcblxuICBjb25zdCByZXMgPSBwYXJ0cy5yZXBsYWNlKC9fL2csICcnKS5zcGxpdCgnOicpLnJlZHVjZSgocmVzLCBwKSA9PiByZXMgKiBudW0oNjApICsgbnVtKHApLCBudW0oMCkpO1xuICByZXR1cm4gc2lnbiA9PT0gJy0nID8gbnVtKC0xKSAqIHJlcyA6IHJlcztcbn07IC8vIGhoaGg6bW06c3Muc3NzXG5cblxuY29uc3Qgc3RyaW5naWZ5U2V4YWdlc2ltYWwgPSAoe1xuICB2YWx1ZVxufSkgPT4ge1xuICBsZXQgbnVtID0gbiA9PiBuO1xuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdiaWdpbnQnKSBudW0gPSBuID0+IEJpZ0ludChuKTtlbHNlIGlmIChpc05hTih2YWx1ZSkgfHwgIWlzRmluaXRlKHZhbHVlKSkgcmV0dXJuIHN0cmluZ2lmeU51bWJlcih2YWx1ZSk7XG4gIGxldCBzaWduID0gJyc7XG5cbiAgaWYgKHZhbHVlIDwgMCkge1xuICAgIHNpZ24gPSAnLSc7XG4gICAgdmFsdWUgKj0gbnVtKC0xKTtcbiAgfVxuXG4gIGNvbnN0IF82MCA9IG51bSg2MCk7XG5cbiAgY29uc3QgcGFydHMgPSBbdmFsdWUgJSBfNjBdOyAvLyBzZWNvbmRzLCBpbmNsdWRpbmcgbXNcblxuICBpZiAodmFsdWUgPCA2MCkge1xuICAgIHBhcnRzLnVuc2hpZnQoMCk7IC8vIGF0IGxlYXN0IG9uZSA6IGlzIHJlcXVpcmVkXG4gIH0gZWxzZSB7XG4gICAgdmFsdWUgPSAodmFsdWUgLSBwYXJ0c1swXSkgLyBfNjA7XG4gICAgcGFydHMudW5zaGlmdCh2YWx1ZSAlIF82MCk7IC8vIG1pbnV0ZXNcblxuICAgIGlmICh2YWx1ZSA+PSA2MCkge1xuICAgICAgdmFsdWUgPSAodmFsdWUgLSBwYXJ0c1swXSkgLyBfNjA7XG4gICAgICBwYXJ0cy51bnNoaWZ0KHZhbHVlKTsgLy8gaG91cnNcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc2lnbiArIHBhcnRzLm1hcChuID0+IG4gPCAxMCA/ICcwJyArIFN0cmluZyhuKSA6IFN0cmluZyhuKSkuam9pbignOicpLnJlcGxhY2UoLzAwMDAwMFxcZCokLywgJycpIC8vICUgNjAgbWF5IGludHJvZHVjZSBlcnJvclxuICA7XG59O1xuXG5jb25zdCBpbnRUaW1lID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnYmlnaW50JyB8fCBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKSxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6aW50JyxcbiAgZm9ybWF0OiAnVElNRScsXG4gIHRlc3Q6IC9eWy0rXT9bMC05XVswLTlfXSooPzo6WzAtNV0/WzAtOV0pKyQvLFxuICByZXNvbHZlOiBzdHIgPT4gcGFyc2VTZXhhZ2VzaW1hbChzdHIsIHRydWUpLFxuICBzdHJpbmdpZnk6IHN0cmluZ2lmeVNleGFnZXNpbWFsXG59O1xuY29uc3QgZmxvYXRUaW1lID0ge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6ZmxvYXQnLFxuICBmb3JtYXQ6ICdUSU1FJyxcbiAgdGVzdDogL15bLStdP1swLTldWzAtOV9dKig/OjpbMC01XT9bMC05XSkrXFwuWzAtOV9dKiQvLFxuICByZXNvbHZlOiBzdHIgPT4gcGFyc2VTZXhhZ2VzaW1hbChzdHIsIGZhbHNlKSxcbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlTZXhhZ2VzaW1hbFxufTtcbmNvbnN0IHRpbWVzdGFtcCA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHZhbHVlIGluc3RhbmNlb2YgRGF0ZSxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6dGltZXN0YW1wJyxcbiAgLy8gSWYgdGhlIHRpbWUgem9uZSBpcyBvbWl0dGVkLCB0aGUgdGltZXN0YW1wIGlzIGFzc3VtZWQgdG8gYmUgc3BlY2lmaWVkIGluIFVUQy4gVGhlIHRpbWUgcGFydFxuICAvLyBtYXkgYmUgb21pdHRlZCBhbHRvZ2V0aGVyLCByZXN1bHRpbmcgaW4gYSBkYXRlIGZvcm1hdC4gSW4gc3VjaCBhIGNhc2UsIHRoZSB0aW1lIHBhcnQgaXNcbiAgLy8gYXNzdW1lZCB0byBiZSAwMDowMDowMFogKHN0YXJ0IG9mIGRheSwgVVRDKS5cbiAgdGVzdDogUmVnRXhwKCdeKFswLTldezR9KS0oWzAtOV17MSwyfSktKFswLTldezEsMn0pJyArIC8vIFlZWVktTW0tRGRcbiAgJyg/OicgKyAvLyB0aW1lIGlzIG9wdGlvbmFsXG4gICcoPzp0fFR8WyBcXFxcdF0rKScgKyAvLyB0IHwgVCB8IHdoaXRlc3BhY2VcbiAgJyhbMC05XXsxLDJ9KTooWzAtOV17MSwyfSk6KFswLTldezEsMn0oXFxcXC5bMC05XSspPyknICsgLy8gSGg6TW06U3MoLnNzKT9cbiAgJyg/OlsgXFxcXHRdKihafFstK11bMDEyXT9bMC05XSg/OjpbMC05XXsyfSk/KSk/JyArIC8vIFogfCArNSB8IC0wMzozMFxuICAnKT8kJyksXG5cbiAgcmVzb2x2ZShzdHIpIHtcbiAgICBsZXQgWywgeWVhciwgbW9udGgsIGRheSwgaG91ciwgbWludXRlLCBzZWNvbmQsIG1pbGxpc2VjLCB0el0gPSBzdHIubWF0Y2godGltZXN0YW1wLnRlc3QpO1xuICAgIGlmIChtaWxsaXNlYykgbWlsbGlzZWMgPSAobWlsbGlzZWMgKyAnMDAnKS5zdWJzdHIoMSwgMyk7XG4gICAgbGV0IGRhdGUgPSBEYXRlLlVUQyh5ZWFyLCBtb250aCAtIDEsIGRheSwgaG91ciB8fCAwLCBtaW51dGUgfHwgMCwgc2Vjb25kIHx8IDAsIG1pbGxpc2VjIHx8IDApO1xuXG4gICAgaWYgKHR6ICYmIHR6ICE9PSAnWicpIHtcbiAgICAgIGxldCBkID0gcGFyc2VTZXhhZ2VzaW1hbCh0eiwgZmFsc2UpO1xuICAgICAgaWYgKE1hdGguYWJzKGQpIDwgMzApIGQgKj0gNjA7XG4gICAgICBkYXRlIC09IDYwMDAwICogZDtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IERhdGUoZGF0ZSk7XG4gIH0sXG5cbiAgc3RyaW5naWZ5OiAoe1xuICAgIHZhbHVlXG4gIH0pID0+IHZhbHVlLnRvSVNPU3RyaW5nKCkucmVwbGFjZSgvKChUMDA6MDApPzowMCk/XFwuMDAwWiQvLCAnJylcbn07XG5cbmV4cG9ydCB7IGZsb2F0VGltZSwgaW50VGltZSwgdGltZXN0YW1wIH07XG4iLCJpbXBvcnQgeyBTY2FsYXIgfSBmcm9tICcuLi8uLi9hc3QvU2NhbGFyLmpzJztcbmltcG9ydCB7IHN0cmluZ2lmeU51bWJlciB9IGZyb20gJy4uLy4uL3N0cmluZ2lmeS9zdHJpbmdpZnlOdW1iZXIuanMnO1xuaW1wb3J0IHsgZmFpbHNhZmUgfSBmcm9tICcuLi9mYWlsc2FmZS9pbmRleC5qcyc7XG5pbXBvcnQgeyBudWxsT3B0aW9ucywgYm9vbE9wdGlvbnMsIGludE9wdGlvbnMgfSBmcm9tICcuLi9vcHRpb25zLmpzJztcbmltcG9ydCB7IGJpbmFyeSB9IGZyb20gJy4vYmluYXJ5LmpzJztcbmltcG9ydCB7IG9tYXAgfSBmcm9tICcuL29tYXAuanMnO1xuaW1wb3J0IHsgcGFpcnMgfSBmcm9tICcuL3BhaXJzLmpzJztcbmltcG9ydCB7IHNldCB9IGZyb20gJy4vc2V0LmpzJztcbmltcG9ydCB7IGludFRpbWUsIGZsb2F0VGltZSwgdGltZXN0YW1wIH0gZnJvbSAnLi90aW1lc3RhbXAuanMnO1xuXG4vKiBnbG9iYWwgQmlnSW50ICovXG5cbmNvbnN0IGJvb2xTdHJpbmdpZnkgPSAoe1xuICB2YWx1ZSxcbiAgc291cmNlU3RyXG59KSA9PiB7XG4gIGNvbnN0IGJvb2xPYmogPSB2YWx1ZSA/IHRydWVPYmogOiBmYWxzZU9iajtcbiAgaWYgKHNvdXJjZVN0ciAmJiBib29sT2JqLnRlc3QudGVzdChzb3VyY2VTdHIpKSByZXR1cm4gc291cmNlU3RyO1xuICByZXR1cm4gdmFsdWUgPyBib29sT3B0aW9ucy50cnVlU3RyIDogYm9vbE9wdGlvbnMuZmFsc2VTdHI7XG59O1xuXG5jb25zdCBib29sUmVzb2x2ZSA9ICh2YWx1ZSwgc3RyKSA9PiB7XG4gIGNvbnN0IG5vZGUgPSBuZXcgU2NhbGFyKHZhbHVlKTtcbiAgbm9kZS5zb3VyY2VTdHIgPSBzdHI7XG4gIHJldHVybiBub2RlO1xufTtcblxuY29uc3QgdHJ1ZU9iaiA9IHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHZhbHVlID09PSB0cnVlLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpib29sJyxcbiAgdGVzdDogL14oPzpZfHl8W1l5XWVzfFlFU3xbVHRdcnVlfFRSVUV8W09vXW58T04pJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBib29sUmVzb2x2ZSh0cnVlLCBzdHIpLFxuICBvcHRpb25zOiBib29sT3B0aW9ucyxcbiAgc3RyaW5naWZ5OiBib29sU3RyaW5naWZ5XG59O1xuY29uc3QgZmFsc2VPYmogPSB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB2YWx1ZSA9PT0gZmFsc2UsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmJvb2wnLFxuICB0ZXN0OiAvXig/Ok58bnxbTm5db3xOT3xbRmZdYWxzZXxGQUxTRXxbT29dZmZ8T0ZGKSQvaSxcbiAgcmVzb2x2ZTogc3RyID0+IGJvb2xSZXNvbHZlKGZhbHNlLCBzdHIpLFxuICBvcHRpb25zOiBib29sT3B0aW9ucyxcbiAgc3RyaW5naWZ5OiBib29sU3RyaW5naWZ5XG59O1xuXG5jb25zdCBpbnRJZGVudGlmeSA9IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ2JpZ2ludCcgfHwgTnVtYmVyLmlzSW50ZWdlcih2YWx1ZSk7XG5cbmZ1bmN0aW9uIGludFJlc29sdmUoc3RyLCBvZmZzZXQsIHJhZGl4KSB7XG4gIGNvbnN0IHNpZ24gPSBzdHJbMF07XG4gIGlmIChzaWduID09PSAnLScgfHwgc2lnbiA9PT0gJysnKSBvZmZzZXQgKz0gMTtcbiAgc3RyID0gc3RyLnN1YnN0cmluZyhvZmZzZXQpLnJlcGxhY2UoL18vZywgJycpO1xuXG4gIGlmIChpbnRPcHRpb25zLmFzQmlnSW50KSB7XG4gICAgc3dpdGNoIChyYWRpeCkge1xuICAgICAgY2FzZSAyOlxuICAgICAgICBzdHIgPSBcIjBiXCIuY29uY2F0KHN0cik7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIDg6XG4gICAgICAgIHN0ciA9IFwiMG9cIi5jb25jYXQoc3RyKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgMTY6XG4gICAgICAgIHN0ciA9IFwiMHhcIi5jb25jYXQoc3RyKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgY29uc3QgbiA9IEJpZ0ludChzdHIpO1xuICAgIHJldHVybiBzaWduID09PSAnLScgPyBCaWdJbnQoLTEpICogbiA6IG47XG4gIH1cblxuICBjb25zdCBuID0gcGFyc2VJbnQoc3RyLCByYWRpeCk7XG4gIHJldHVybiBzaWduID09PSAnLScgPyAtMSAqIG4gOiBuO1xufVxuXG5mdW5jdGlvbiBpbnRTdHJpbmdpZnkobm9kZSwgcmFkaXgsIHByZWZpeCkge1xuICBjb25zdCB7XG4gICAgdmFsdWVcbiAgfSA9IG5vZGU7XG5cbiAgaWYgKGludElkZW50aWZ5KHZhbHVlKSkge1xuICAgIGNvbnN0IHN0ciA9IHZhbHVlLnRvU3RyaW5nKHJhZGl4KTtcbiAgICByZXR1cm4gdmFsdWUgPCAwID8gJy0nICsgcHJlZml4ICsgc3RyLnN1YnN0cigxKSA6IHByZWZpeCArIHN0cjtcbiAgfVxuXG4gIHJldHVybiBzdHJpbmdpZnlOdW1iZXIobm9kZSk7XG59XG5cbmNvbnN0IHlhbWwxMSA9IGZhaWxzYWZlLmNvbmNhdChbe1xuICBpZGVudGlmeTogdmFsdWUgPT4gdmFsdWUgPT0gbnVsbCxcbiAgY3JlYXRlTm9kZTogKHNjaGVtYSwgdmFsdWUsIGN0eCkgPT4gY3R4LndyYXBTY2FsYXJzID8gbmV3IFNjYWxhcihudWxsKSA6IG51bGwsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOm51bGwnLFxuICB0ZXN0OiAvXig/On58W05uXXVsbHxOVUxMKT8kLyxcbiAgcmVzb2x2ZTogc3RyID0+IHtcbiAgICBjb25zdCBub2RlID0gbmV3IFNjYWxhcihudWxsKTtcbiAgICBub2RlLnNvdXJjZVN0ciA9IHN0cjtcbiAgICByZXR1cm4gbm9kZTtcbiAgfSxcbiAgb3B0aW9uczogbnVsbE9wdGlvbnMsXG4gIHN0cmluZ2lmeTogKHtcbiAgICBzb3VyY2VTdHJcbiAgfSkgPT4gc291cmNlU3RyICE9PSBudWxsICYmIHNvdXJjZVN0ciAhPT0gdm9pZCAwID8gc291cmNlU3RyIDogbnVsbE9wdGlvbnMubnVsbFN0clxufSwgdHJ1ZU9iaiwgZmFsc2VPYmosIHtcbiAgaWRlbnRpZnk6IGludElkZW50aWZ5LFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjppbnQnLFxuICBmb3JtYXQ6ICdCSU4nLFxuICB0ZXN0OiAvXlstK10/MGJbMC0xX10rJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBpbnRSZXNvbHZlKHN0ciwgMiwgMiksXG4gIHN0cmluZ2lmeTogbm9kZSA9PiBpbnRTdHJpbmdpZnkobm9kZSwgMiwgJzBiJylcbn0sIHtcbiAgaWRlbnRpZnk6IGludElkZW50aWZ5LFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjppbnQnLFxuICBmb3JtYXQ6ICdPQ1QnLFxuICB0ZXN0OiAvXlstK10/MFswLTdfXSskLyxcbiAgcmVzb2x2ZTogc3RyID0+IGludFJlc29sdmUoc3RyLCAxLCA4KSxcbiAgc3RyaW5naWZ5OiBub2RlID0+IGludFN0cmluZ2lmeShub2RlLCA4LCAnMCcpXG59LCB7XG4gIGlkZW50aWZ5OiBpbnRJZGVudGlmeSxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6aW50JyxcbiAgdGVzdDogL15bLStdP1swLTldWzAtOV9dKiQvLFxuICByZXNvbHZlOiBzdHIgPT4gaW50UmVzb2x2ZShzdHIsIDAsIDEwKSxcbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlOdW1iZXJcbn0sIHtcbiAgaWRlbnRpZnk6IGludElkZW50aWZ5LFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjppbnQnLFxuICBmb3JtYXQ6ICdIRVgnLFxuICB0ZXN0OiAvXlstK10/MHhbMC05YS1mQS1GX10rJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBpbnRSZXNvbHZlKHN0ciwgMiwgMTYpLFxuICBzdHJpbmdpZnk6IG5vZGUgPT4gaW50U3RyaW5naWZ5KG5vZGUsIDE2LCAnMHgnKVxufSwge1xuICBpZGVudGlmeTogdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyxcbiAgZGVmYXVsdDogdHJ1ZSxcbiAgdGFnOiAndGFnOnlhbWwub3JnLDIwMDI6ZmxvYXQnLFxuICB0ZXN0OiAvXlstK10/XFwuKD86aW5mfEluZnxJTkZ8bmFufE5hTnxOQU4pJC8sXG4gIHJlc29sdmU6IHN0ciA9PiBzdHIuc2xpY2UoLTMpLnRvTG93ZXJDYXNlKCkgPT09ICduYW4nID8gTmFOIDogc3RyWzBdID09PSAnLScgPyBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFkgOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksXG4gIHN0cmluZ2lmeTogc3RyaW5naWZ5TnVtYmVyXG59LCB7XG4gIGlkZW50aWZ5OiB2YWx1ZSA9PiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLFxuICBkZWZhdWx0OiB0cnVlLFxuICB0YWc6ICd0YWc6eWFtbC5vcmcsMjAwMjpmbG9hdCcsXG4gIGZvcm1hdDogJ0VYUCcsXG4gIHRlc3Q6IC9eWy0rXT8oPzpbMC05XVswLTlfXSopPyg/OlxcLlswLTlfXSopP1tlRV1bLStdP1swLTldKyQvLFxuICByZXNvbHZlOiBzdHIgPT4gcGFyc2VGbG9hdChzdHIucmVwbGFjZSgvXy9nLCAnJykpLFxuICBzdHJpbmdpZnk6ICh7XG4gICAgdmFsdWVcbiAgfSkgPT4gTnVtYmVyKHZhbHVlKS50b0V4cG9uZW50aWFsKClcbn0sIHtcbiAgaWRlbnRpZnk6IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsXG4gIGRlZmF1bHQ6IHRydWUsXG4gIHRhZzogJ3RhZzp5YW1sLm9yZywyMDAyOmZsb2F0JyxcbiAgdGVzdDogL15bLStdPyg/OlswLTldWzAtOV9dKik/XFwuWzAtOV9dKiQvLFxuXG4gIHJlc29sdmUoc3RyKSB7XG4gICAgY29uc3Qgbm9kZSA9IG5ldyBTY2FsYXIocGFyc2VGbG9hdChzdHIucmVwbGFjZSgvXy9nLCAnJykpKTtcbiAgICBjb25zdCBkb3QgPSBzdHIuaW5kZXhPZignLicpO1xuXG4gICAgaWYgKGRvdCAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IGYgPSBzdHIuc3Vic3RyaW5nKGRvdCArIDEpLnJlcGxhY2UoL18vZywgJycpO1xuICAgICAgaWYgKGZbZi5sZW5ndGggLSAxXSA9PT0gJzAnKSBub2RlLm1pbkZyYWN0aW9uRGlnaXRzID0gZi5sZW5ndGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGU7XG4gIH0sXG5cbiAgc3RyaW5naWZ5OiBzdHJpbmdpZnlOdW1iZXJcbn1dLCBiaW5hcnksIG9tYXAsIHBhaXJzLCBzZXQsIGludFRpbWUsIGZsb2F0VGltZSwgdGltZXN0YW1wKTtcblxuZXhwb3J0IHsgeWFtbDExIH07XG4iLCJpbXBvcnQgeyBib29sT2JqLCBmbG9hdE9iaiwgZXhwT2JqLCBuYW5PYmosIGludE9iaiwgaGV4T2JqLCBvY3RPYmosIG51bGxPYmosIGNvcmUgfSBmcm9tICcuL2NvcmUuanMnO1xuaW1wb3J0IHsgZmFpbHNhZmUgfSBmcm9tICcuL2ZhaWxzYWZlL2luZGV4LmpzJztcbmltcG9ydCB7IGpzb24gfSBmcm9tICcuL2pzb24uanMnO1xuaW1wb3J0IHsgeWFtbDExIH0gZnJvbSAnLi95YW1sLTEuMS9pbmRleC5qcyc7XG5pbXBvcnQgeyBtYXAgfSBmcm9tICcuL2ZhaWxzYWZlL21hcC5qcyc7XG5pbXBvcnQgeyBzZXEgfSBmcm9tICcuL2ZhaWxzYWZlL3NlcS5qcyc7XG5pbXBvcnQgeyBiaW5hcnkgfSBmcm9tICcuL3lhbWwtMS4xL2JpbmFyeS5qcyc7XG5pbXBvcnQgeyBvbWFwIH0gZnJvbSAnLi95YW1sLTEuMS9vbWFwLmpzJztcbmltcG9ydCB7IHBhaXJzIH0gZnJvbSAnLi95YW1sLTEuMS9wYWlycy5qcyc7XG5pbXBvcnQgeyBzZXQgfSBmcm9tICcuL3lhbWwtMS4xL3NldC5qcyc7XG5pbXBvcnQgeyBmbG9hdFRpbWUsIGludFRpbWUsIHRpbWVzdGFtcCB9IGZyb20gJy4veWFtbC0xLjEvdGltZXN0YW1wLmpzJztcblxuY29uc3Qgc2NoZW1hcyA9IHtcbiAgY29yZSxcbiAgZmFpbHNhZmUsXG4gIGpzb24sXG4gIHlhbWwxMVxufTtcbmNvbnN0IHRhZ3MgPSB7XG4gIGJpbmFyeSxcbiAgYm9vbDogYm9vbE9iaixcbiAgZmxvYXQ6IGZsb2F0T2JqLFxuICBmbG9hdEV4cDogZXhwT2JqLFxuICBmbG9hdE5hTjogbmFuT2JqLFxuICBmbG9hdFRpbWUsXG4gIGludDogaW50T2JqLFxuICBpbnRIZXg6IGhleE9iaixcbiAgaW50T2N0OiBvY3RPYmosXG4gIGludFRpbWUsXG4gIG1hcCxcbiAgbnVsbDogbnVsbE9iaixcbiAgb21hcCxcbiAgcGFpcnMsXG4gIHNlcSxcbiAgc2V0LFxuICB0aW1lc3RhbXBcbn07XG5cbmV4cG9ydCB7IHNjaGVtYXMsIHRhZ3MgfTtcbiIsImZ1bmN0aW9uIGdldFNjaGVtYVRhZ3Moc2NoZW1hcywga25vd25UYWdzLCBjdXN0b21UYWdzLCBzY2hlbWFJZCkge1xuICBsZXQgdGFncyA9IHNjaGVtYXNbc2NoZW1hSWQucmVwbGFjZSgvXFxXL2csICcnKV07IC8vICd5YW1sLTEuMScgLT4gJ3lhbWwxMSdcblxuICBpZiAoIXRhZ3MpIHtcbiAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMoc2NoZW1hcykubWFwKGtleSA9PiBKU09OLnN0cmluZ2lmeShrZXkpKS5qb2luKCcsICcpO1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gc2NoZW1hIFxcXCJcIi5jb25jYXQoc2NoZW1hSWQsIFwiXFxcIjsgdXNlIG9uZSBvZiBcIikuY29uY2F0KGtleXMpKTtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KGN1c3RvbVRhZ3MpKSB7XG4gICAgZm9yIChjb25zdCB0YWcgb2YgY3VzdG9tVGFncykgdGFncyA9IHRhZ3MuY29uY2F0KHRhZyk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGN1c3RvbVRhZ3MgPT09ICdmdW5jdGlvbicpIHtcbiAgICB0YWdzID0gY3VzdG9tVGFncyh0YWdzLnNsaWNlKCkpO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0YWdzLmxlbmd0aDsgKytpKSB7XG4gICAgY29uc3QgdGFnID0gdGFnc1tpXTtcblxuICAgIGlmICh0eXBlb2YgdGFnID09PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgdGFnT2JqID0ga25vd25UYWdzW3RhZ107XG5cbiAgICAgIGlmICghdGFnT2JqKSB7XG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhrbm93blRhZ3MpLm1hcChrZXkgPT4gSlNPTi5zdHJpbmdpZnkoa2V5KSkuam9pbignLCAnKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBjdXN0b20gdGFnIFxcXCJcIi5jb25jYXQodGFnLCBcIlxcXCI7IHVzZSBvbmUgb2YgXCIpLmNvbmNhdChrZXlzKSk7XG4gICAgICB9XG5cbiAgICAgIHRhZ3NbaV0gPSB0YWdPYmo7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRhZ3M7XG59XG5cbmV4cG9ydCB7IGdldFNjaGVtYVRhZ3MgfTtcbiIsImltcG9ydCB7IHRhZ3MsIHNjaGVtYXMgfSBmcm9tICcuLi90YWdzL2luZGV4LmpzJztcbmltcG9ydCB7IGdldFNjaGVtYVRhZ3MgfSBmcm9tICcuL2dldFNjaGVtYVRhZ3MuanMnO1xuXG5jb25zdCBzb3J0TWFwRW50cmllc0J5S2V5ID0gKGEsIGIpID0+IGEua2V5IDwgYi5rZXkgPyAtMSA6IGEua2V5ID4gYi5rZXkgPyAxIDogMDtcblxuY29uc3QgY29yZUtub3duVGFncyA9IHtcbiAgJ3RhZzp5YW1sLm9yZywyMDAyOmJpbmFyeSc6IHRhZ3MuYmluYXJ5LFxuICAndGFnOnlhbWwub3JnLDIwMDI6b21hcCc6IHRhZ3Mub21hcCxcbiAgJ3RhZzp5YW1sLm9yZywyMDAyOnBhaXJzJzogdGFncy5wYWlycyxcbiAgJ3RhZzp5YW1sLm9yZywyMDAyOnNldCc6IHRhZ3Muc2V0LFxuICAndGFnOnlhbWwub3JnLDIwMDI6dGltZXN0YW1wJzogdGFncy50aW1lc3RhbXBcbn07XG5jbGFzcyBTY2hlbWEge1xuICBjb25zdHJ1Y3Rvcih7XG4gICAgY3VzdG9tVGFncyxcbiAgICBtZXJnZSxcbiAgICByZXNvbHZlS25vd25UYWdzLFxuICAgIHNjaGVtYSxcbiAgICBzb3J0TWFwRW50cmllc1xuICB9KSB7XG4gICAgdGhpcy5tZXJnZSA9ICEhbWVyZ2U7XG4gICAgdGhpcy5uYW1lID0gc2NoZW1hO1xuICAgIHRoaXMua25vd25UYWdzID0gcmVzb2x2ZUtub3duVGFncyA/IGNvcmVLbm93blRhZ3MgOiB7fTtcbiAgICB0aGlzLnRhZ3MgPSBnZXRTY2hlbWFUYWdzKHNjaGVtYXMsIHRhZ3MsIGN1c3RvbVRhZ3MsIHNjaGVtYSk7IC8vIFVzZWQgYnkgY3JlYXRlTm9kZSgpLCB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmNpZXNcblxuICAgIHRoaXMubWFwID0gdGFncy5tYXA7XG4gICAgdGhpcy5zZXEgPSB0YWdzLnNlcTsgLy8gVXNlZCBieSBjcmVhdGVNYXAoKVxuXG4gICAgdGhpcy5zb3J0TWFwRW50cmllcyA9IHNvcnRNYXBFbnRyaWVzID09PSB0cnVlID8gc29ydE1hcEVudHJpZXNCeUtleSA6IHNvcnRNYXBFbnRyaWVzIHx8IG51bGw7XG4gIH1cblxufVxuXG5leHBvcnQgeyBTY2hlbWEgfTtcbiIsIi8qKlxuICogQXBwbGllcyB0aGUgSlNPTi5wYXJzZSByZXZpdmVyIGFsZ29yaXRobSBhcyBkZWZpbmVkIGluIHRoZSBFQ01BLTI2MiBzcGVjLFxuICogaW4gc2VjdGlvbiAyNC41LjEuMSBcIlJ1bnRpbWUgU2VtYW50aWNzOiBJbnRlcm5hbGl6ZUpTT05Qcm9wZXJ0eVwiIG9mIHRoZVxuICogMjAyMSBlZGl0aW9uOiBodHRwczovL3RjMzkuZXMvZWNtYTI2Mi8jc2VjLWpzb24ucGFyc2VcbiAqXG4gKiBJbmNsdWRlcyBleHRlbnNpb25zIGZvciBoYW5kbGluZyBNYXAgYW5kIFNldCBvYmplY3RzLlxuICovXG5mdW5jdGlvbiBhcHBseVJldml2ZXIocmV2aXZlciwgb2JqLCBrZXksIHZhbCkge1xuICBpZiAodmFsICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsKSkge1xuICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHZhbC5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBjb25zdCB2MCA9IHZhbFtpXTtcbiAgICAgICAgY29uc3QgdjEgPSBhcHBseVJldml2ZXIocmV2aXZlciwgdmFsLCBTdHJpbmcoaSksIHYwKTtcbiAgICAgICAgaWYgKHYxID09PSB1bmRlZmluZWQpIGRlbGV0ZSB2YWxbaV07ZWxzZSBpZiAodjEgIT09IHYwKSB2YWxbaV0gPSB2MTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHZhbCBpbnN0YW5jZW9mIE1hcCkge1xuICAgICAgZm9yIChjb25zdCBrIG9mIEFycmF5LmZyb20odmFsLmtleXMoKSkpIHtcbiAgICAgICAgY29uc3QgdjAgPSB2YWwuZ2V0KGspO1xuICAgICAgICBjb25zdCB2MSA9IGFwcGx5UmV2aXZlcihyZXZpdmVyLCB2YWwsIGssIHYwKTtcbiAgICAgICAgaWYgKHYxID09PSB1bmRlZmluZWQpIHZhbC5kZWxldGUoayk7ZWxzZSBpZiAodjEgIT09IHYwKSB2YWwuc2V0KGssIHYxKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHZhbCBpbnN0YW5jZW9mIFNldCkge1xuICAgICAgZm9yIChjb25zdCB2MCBvZiBBcnJheS5mcm9tKHZhbCkpIHtcbiAgICAgICAgY29uc3QgdjEgPSBhcHBseVJldml2ZXIocmV2aXZlciwgdmFsLCB2MCwgdjApO1xuICAgICAgICBpZiAodjEgPT09IHVuZGVmaW5lZCkgdmFsLmRlbGV0ZSh2MCk7ZWxzZSBpZiAodjEgIT09IHYwKSB7XG4gICAgICAgICAgdmFsLmRlbGV0ZSh2MCk7XG4gICAgICAgICAgdmFsLmFkZCh2MSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIChjb25zdCBbaywgdjBdIG9mIE9iamVjdC5lbnRyaWVzKHZhbCkpIHtcbiAgICAgICAgY29uc3QgdjEgPSBhcHBseVJldml2ZXIocmV2aXZlciwgdmFsLCBrLCB2MCk7XG4gICAgICAgIGlmICh2MSA9PT0gdW5kZWZpbmVkKSBkZWxldGUgdmFsW2tdO2Vsc2UgaWYgKHYxICE9PSB2MCkgdmFsW2tdID0gdjE7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJldml2ZXIuY2FsbChvYmosIGtleSwgdmFsKTtcbn1cblxuZXhwb3J0IHsgYXBwbHlSZXZpdmVyIH07XG4iLCJpbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi4vYXN0L0NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgUGFpciB9IGZyb20gJy4uL2FzdC9QYWlyLmpzJztcbmltcG9ydCB7IFNjYWxhciB9IGZyb20gJy4uL2FzdC9TY2FsYXIuanMnO1xuXG5jb25zdCB2aXNpdCA9IChub2RlLCB0YWdzKSA9PiB7XG4gIGlmIChub2RlICYmIHR5cGVvZiBub2RlID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IHtcbiAgICAgIHRhZ1xuICAgIH0gPSBub2RlO1xuXG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBDb2xsZWN0aW9uKSB7XG4gICAgICBpZiAodGFnKSB0YWdzW3RhZ10gPSB0cnVlO1xuICAgICAgbm9kZS5pdGVtcy5mb3JFYWNoKG4gPT4gdmlzaXQobiwgdGFncykpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIFBhaXIpIHtcbiAgICAgIHZpc2l0KG5vZGUua2V5LCB0YWdzKTtcbiAgICAgIHZpc2l0KG5vZGUudmFsdWUsIHRhZ3MpO1xuICAgIH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIFNjYWxhcikge1xuICAgICAgaWYgKHRhZykgdGFnc1t0YWddID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGFncztcbn07XG5cbmNvbnN0IGxpc3RUYWdOYW1lcyA9IG5vZGUgPT4gT2JqZWN0LmtleXModmlzaXQobm9kZSwge30pKTtcblxuZXhwb3J0IHsgbGlzdFRhZ05hbWVzIH07XG4iLCJpbXBvcnQgeyBUeXBlLCBkZWZhdWx0VGFncyB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MU2VtYW50aWNFcnJvciwgWUFNTFdhcm5pbmcgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuXG5mdW5jdGlvbiByZXNvbHZlVGFnSGFuZGxlKGRvYywgbm9kZSkge1xuICBjb25zdCB7XG4gICAgaGFuZGxlLFxuICAgIHN1ZmZpeFxuICB9ID0gbm9kZS50YWc7XG4gIGxldCBwcmVmaXggPSBkb2MudGFnUHJlZml4ZXMuZmluZChwID0+IHAuaGFuZGxlID09PSBoYW5kbGUpO1xuXG4gIGlmICghcHJlZml4KSB7XG4gICAgY29uc3QgZHRwID0gZG9jLmdldERlZmF1bHRzKCkudGFnUHJlZml4ZXM7XG4gICAgaWYgKGR0cCkgcHJlZml4ID0gZHRwLmZpbmQocCA9PiBwLmhhbmRsZSA9PT0gaGFuZGxlKTtcbiAgICBpZiAoIXByZWZpeCkgdGhyb3cgbmV3IFlBTUxTZW1hbnRpY0Vycm9yKG5vZGUsIFwiVGhlIFwiLmNvbmNhdChoYW5kbGUsIFwiIHRhZyBoYW5kbGUgaXMgbm9uLWRlZmF1bHQgYW5kIHdhcyBub3QgZGVjbGFyZWQuXCIpKTtcbiAgfVxuXG4gIGlmICghc3VmZml4KSB0aHJvdyBuZXcgWUFNTFNlbWFudGljRXJyb3Iobm9kZSwgXCJUaGUgXCIuY29uY2F0KGhhbmRsZSwgXCIgdGFnIGhhcyBubyBzdWZmaXguXCIpKTtcblxuICBpZiAoaGFuZGxlID09PSAnIScgJiYgKGRvYy52ZXJzaW9uIHx8IGRvYy5vcHRpb25zLnZlcnNpb24pID09PSAnMS4wJykge1xuICAgIGlmIChzdWZmaXhbMF0gPT09ICdeJykge1xuICAgICAgZG9jLndhcm5pbmdzLnB1c2gobmV3IFlBTUxXYXJuaW5nKG5vZGUsICdZQU1MIDEuMCBeIHRhZyBleHBhbnNpb24gaXMgbm90IHN1cHBvcnRlZCcpKTtcbiAgICAgIHJldHVybiBzdWZmaXg7XG4gICAgfVxuXG4gICAgaWYgKC9bOi9dLy50ZXN0KHN1ZmZpeCkpIHtcbiAgICAgIC8vIHdvcmQvZm9vIC0+IHRhZzp3b3JkLnlhbWwub3JnLDIwMDI6Zm9vXG4gICAgICBjb25zdCB2b2NhYiA9IHN1ZmZpeC5tYXRjaCgvXihbYS16MC05LV0rKVxcLyguKikvaSk7XG4gICAgICByZXR1cm4gdm9jYWIgPyBcInRhZzpcIi5jb25jYXQodm9jYWJbMV0sIFwiLnlhbWwub3JnLDIwMDI6XCIpLmNvbmNhdCh2b2NhYlsyXSkgOiBcInRhZzpcIi5jb25jYXQoc3VmZml4KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcHJlZml4LnByZWZpeCArIGRlY29kZVVSSUNvbXBvbmVudChzdWZmaXgpO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVGFnTmFtZShkb2MsIG5vZGUpIHtcbiAgY29uc3Qge1xuICAgIHRhZyxcbiAgICB0eXBlXG4gIH0gPSBub2RlO1xuICBsZXQgbm9uU3BlY2lmaWMgPSBmYWxzZTtcblxuICBpZiAodGFnKSB7XG4gICAgY29uc3Qge1xuICAgICAgaGFuZGxlLFxuICAgICAgc3VmZml4LFxuICAgICAgdmVyYmF0aW1cbiAgICB9ID0gdGFnO1xuXG4gICAgaWYgKHZlcmJhdGltKSB7XG4gICAgICBpZiAodmVyYmF0aW0gIT09ICchJyAmJiB2ZXJiYXRpbSAhPT0gJyEhJykgcmV0dXJuIHZlcmJhdGltO1xuICAgICAgY29uc3QgbXNnID0gXCJWZXJiYXRpbSB0YWdzIGFyZW4ndCByZXNvbHZlZCwgc28gXCIuY29uY2F0KHZlcmJhdGltLCBcIiBpcyBpbnZhbGlkLlwiKTtcbiAgICAgIGRvYy5lcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3Iobm9kZSwgbXNnKSk7XG4gICAgfSBlbHNlIGlmIChoYW5kbGUgPT09ICchJyAmJiAhc3VmZml4KSB7XG4gICAgICBub25TcGVjaWZpYyA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlVGFnSGFuZGxlKGRvYywgbm9kZSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBkb2MuZXJyb3JzLnB1c2goZXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgVHlwZS5CTE9DS19GT0xERUQ6XG4gICAgY2FzZSBUeXBlLkJMT0NLX0xJVEVSQUw6XG4gICAgY2FzZSBUeXBlLlFVT1RFX0RPVUJMRTpcbiAgICBjYXNlIFR5cGUuUVVPVEVfU0lOR0xFOlxuICAgICAgcmV0dXJuIGRlZmF1bHRUYWdzLlNUUjtcblxuICAgIGNhc2UgVHlwZS5GTE9XX01BUDpcbiAgICBjYXNlIFR5cGUuTUFQOlxuICAgICAgcmV0dXJuIGRlZmF1bHRUYWdzLk1BUDtcblxuICAgIGNhc2UgVHlwZS5GTE9XX1NFUTpcbiAgICBjYXNlIFR5cGUuU0VROlxuICAgICAgcmV0dXJuIGRlZmF1bHRUYWdzLlNFUTtcblxuICAgIGNhc2UgVHlwZS5QTEFJTjpcbiAgICAgIHJldHVybiBub25TcGVjaWZpYyA/IGRlZmF1bHRUYWdzLlNUUiA6IG51bGw7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IHsgcmVzb2x2ZVRhZ05hbWUgfTtcbiIsImltcG9ydCB7IFlBTUxTZW1hbnRpY0Vycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IFR5cGUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5mdW5jdGlvbiBjaGVja0Zsb3dDb2xsZWN0aW9uRW5kKGVycm9ycywgY3N0KSB7XG4gIGxldCBjaGFyLCBuYW1lO1xuXG4gIHN3aXRjaCAoY3N0LnR5cGUpIHtcbiAgICBjYXNlIFR5cGUuRkxPV19NQVA6XG4gICAgICBjaGFyID0gJ30nO1xuICAgICAgbmFtZSA9ICdmbG93IG1hcCc7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgVHlwZS5GTE9XX1NFUTpcbiAgICAgIGNoYXIgPSAnXSc7XG4gICAgICBuYW1lID0gJ2Zsb3cgc2VxdWVuY2UnO1xuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGNzdCwgJ05vdCBhIGZsb3cgY29sbGVjdGlvbiE/JykpO1xuICAgICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IGxhc3RJdGVtO1xuXG4gIGZvciAobGV0IGkgPSBjc3QuaXRlbXMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICBjb25zdCBpdGVtID0gY3N0Lml0ZW1zW2ldO1xuXG4gICAgaWYgKCFpdGVtIHx8IGl0ZW0udHlwZSAhPT0gVHlwZS5DT01NRU5UKSB7XG4gICAgICBsYXN0SXRlbSA9IGl0ZW07XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBpZiAobGFzdEl0ZW0gJiYgbGFzdEl0ZW0uY2hhciAhPT0gY2hhcikge1xuICAgIGNvbnN0IG1zZyA9IFwiRXhwZWN0ZWQgXCIuY29uY2F0KG5hbWUsIFwiIHRvIGVuZCB3aXRoIFwiKS5jb25jYXQoY2hhcik7XG4gICAgbGV0IGVycjtcblxuICAgIGlmICh0eXBlb2YgbGFzdEl0ZW0ub2Zmc2V0ID09PSAnbnVtYmVyJykge1xuICAgICAgZXJyID0gbmV3IFlBTUxTZW1hbnRpY0Vycm9yKGNzdCwgbXNnKTtcbiAgICAgIGVyci5vZmZzZXQgPSBsYXN0SXRlbS5vZmZzZXQgKyAxO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnIgPSBuZXcgWUFNTFNlbWFudGljRXJyb3IobGFzdEl0ZW0sIG1zZyk7XG4gICAgICBpZiAobGFzdEl0ZW0ucmFuZ2UgJiYgbGFzdEl0ZW0ucmFuZ2UuZW5kKSBlcnIub2Zmc2V0ID0gbGFzdEl0ZW0ucmFuZ2UuZW5kIC0gbGFzdEl0ZW0ucmFuZ2Uuc3RhcnQ7XG4gICAgfVxuXG4gICAgZXJyb3JzLnB1c2goZXJyKTtcbiAgfVxufVxuZnVuY3Rpb24gY2hlY2tGbG93Q29tbWVudFNwYWNlKGVycm9ycywgY29tbWVudCkge1xuICBjb25zdCBwcmV2ID0gY29tbWVudC5jb250ZXh0LnNyY1tjb21tZW50LnJhbmdlLnN0YXJ0IC0gMV07XG5cbiAgaWYgKHByZXYgIT09ICdcXG4nICYmIHByZXYgIT09ICdcXHQnICYmIHByZXYgIT09ICcgJykge1xuICAgIGNvbnN0IG1zZyA9ICdDb21tZW50cyBtdXN0IGJlIHNlcGFyYXRlZCBmcm9tIG90aGVyIHRva2VucyBieSB3aGl0ZSBzcGFjZSBjaGFyYWN0ZXJzJztcbiAgICBlcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3IoY29tbWVudCwgbXNnKSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldExvbmdLZXlFcnJvcihzb3VyY2UsIGtleSkge1xuICBjb25zdCBzayA9IFN0cmluZyhrZXkpO1xuICBjb25zdCBrID0gc2suc3Vic3RyKDAsIDgpICsgJy4uLicgKyBzay5zdWJzdHIoLTgpO1xuICByZXR1cm4gbmV3IFlBTUxTZW1hbnRpY0Vycm9yKHNvdXJjZSwgXCJUaGUgXFxcIlwiLmNvbmNhdChrLCBcIlxcXCIga2V5IGlzIHRvbyBsb25nXCIpKTtcbn1cbmZ1bmN0aW9uIHJlc29sdmVDb21tZW50cyhjb2xsZWN0aW9uLCBjb21tZW50cykge1xuICBmb3IgKGNvbnN0IHtcbiAgICBhZnRlcktleSxcbiAgICBiZWZvcmUsXG4gICAgY29tbWVudFxuICB9IG9mIGNvbW1lbnRzKSB7XG4gICAgbGV0IGl0ZW0gPSBjb2xsZWN0aW9uLml0ZW1zW2JlZm9yZV07XG5cbiAgICBpZiAoIWl0ZW0pIHtcbiAgICAgIGlmIChjb21tZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb24uY29tbWVudCkgY29sbGVjdGlvbi5jb21tZW50ICs9ICdcXG4nICsgY29tbWVudDtlbHNlIGNvbGxlY3Rpb24uY29tbWVudCA9IGNvbW1lbnQ7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChhZnRlcktleSAmJiBpdGVtLnZhbHVlKSBpdGVtID0gaXRlbS52YWx1ZTtcblxuICAgICAgaWYgKGNvbW1lbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoYWZ0ZXJLZXkgfHwgIWl0ZW0uY29tbWVudEJlZm9yZSkgaXRlbS5zcGFjZUJlZm9yZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoaXRlbS5jb21tZW50QmVmb3JlKSBpdGVtLmNvbW1lbnRCZWZvcmUgKz0gJ1xcbicgKyBjb21tZW50O2Vsc2UgaXRlbS5jb21tZW50QmVmb3JlID0gY29tbWVudDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IHsgY2hlY2tGbG93Q29sbGVjdGlvbkVuZCwgY2hlY2tGbG93Q29tbWVudFNwYWNlLCBnZXRMb25nS2V5RXJyb3IsIHJlc29sdmVDb21tZW50cyB9O1xuIiwiaW1wb3J0IHsgQWxpYXMgfSBmcm9tICcuLi9hc3QvQWxpYXMuanMnO1xuaW1wb3J0IHsgTUVSR0VfS0VZLCBNZXJnZSB9IGZyb20gJy4uL2FzdC9NZXJnZS5qcyc7XG5pbXBvcnQgeyBQYWlyIH0gZnJvbSAnLi4vYXN0L1BhaXIuanMnO1xuaW1wb3J0IHsgWUFNTE1hcCB9IGZyb20gJy4uL2FzdC9ZQU1MTWFwLmpzJztcbmltcG9ydCB7IFR5cGUsIENoYXIgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgUGxhaW5WYWx1ZSB9IGZyb20gJy4uL2NzdC9QbGFpblZhbHVlLmpzJztcbmltcG9ydCB7IFlBTUxTZW1hbnRpY0Vycm9yLCBZQU1MU3ludGF4RXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZUNvbW1lbnRzLCBnZXRMb25nS2V5RXJyb3IsIGNoZWNrRmxvd0NvbW1lbnRTcGFjZSwgY2hlY2tGbG93Q29sbGVjdGlvbkVuZCB9IGZyb20gJy4vY29sbGVjdGlvbi11dGlscy5qcyc7XG5pbXBvcnQgeyByZXNvbHZlTm9kZSB9IGZyb20gJy4vcmVzb2x2ZU5vZGUuanMnO1xuXG5mdW5jdGlvbiByZXNvbHZlTWFwKGRvYywgY3N0KSB7XG4gIGNvbnN0IHtcbiAgICBjb21tZW50cyxcbiAgICBpdGVtc1xuICB9ID0gY3N0LnR5cGUgPT09IFR5cGUuRkxPV19NQVAgPyByZXNvbHZlRmxvd01hcEl0ZW1zKGRvYywgY3N0KSA6IHJlc29sdmVCbG9ja01hcEl0ZW1zKGRvYywgY3N0KTtcbiAgY29uc3QgbWFwID0gbmV3IFlBTUxNYXAoZG9jLnNjaGVtYSk7XG4gIG1hcC5pdGVtcyA9IGl0ZW1zO1xuICByZXNvbHZlQ29tbWVudHMobWFwLCBjb21tZW50cyk7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IHtcbiAgICAgIGtleTogaUtleVxuICAgIH0gPSBpdGVtc1tpXTtcblxuICAgIGlmIChkb2Muc2NoZW1hLm1lcmdlICYmIGlLZXkgJiYgaUtleS52YWx1ZSA9PT0gTUVSR0VfS0VZKSB7XG4gICAgICBpdGVtc1tpXSA9IG5ldyBNZXJnZShpdGVtc1tpXSk7XG4gICAgICBjb25zdCBzb3VyY2VzID0gaXRlbXNbaV0udmFsdWUuaXRlbXM7XG4gICAgICBsZXQgZXJyb3IgPSBudWxsO1xuICAgICAgc291cmNlcy5zb21lKG5vZGUgPT4ge1xuICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIEFsaWFzKSB7XG4gICAgICAgICAgLy8gRHVyaW5nIHBhcnNpbmcsIGFsaWFzIHNvdXJjZXMgYXJlIENTVCBub2RlczsgdG8gYWNjb3VudCBmb3JcbiAgICAgICAgICAvLyBjaXJjdWxhciByZWZlcmVuY2VzIHRoZWlyIHJlc29sdmVkIHZhbHVlcyBjYW4ndCBiZSB1c2VkIGhlcmUuXG4gICAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgdHlwZVxuICAgICAgICAgIH0gPSBub2RlLnNvdXJjZTtcbiAgICAgICAgICBpZiAodHlwZSA9PT0gVHlwZS5NQVAgfHwgdHlwZSA9PT0gVHlwZS5GTE9XX01BUCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiBlcnJvciA9ICdNZXJnZSBub2RlcyBhbGlhc2VzIGNhbiBvbmx5IHBvaW50IHRvIG1hcHMnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVycm9yID0gJ01lcmdlIG5vZGVzIGNhbiBvbmx5IGhhdmUgQWxpYXMgbm9kZXMgYXMgdmFsdWVzJztcbiAgICAgIH0pO1xuICAgICAgaWYgKGVycm9yKSBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGNzdCwgZXJyb3IpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgaXRlbXMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgIGtleTogaktleVxuICAgICAgICB9ID0gaXRlbXNbal07XG5cbiAgICAgICAgaWYgKGlLZXkgPT09IGpLZXkgfHwgaUtleSAmJiBqS2V5ICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChpS2V5LCAndmFsdWUnKSAmJiBpS2V5LnZhbHVlID09PSBqS2V5LnZhbHVlKSB7XG4gICAgICAgICAgY29uc3QgbXNnID0gXCJNYXAga2V5cyBtdXN0IGJlIHVuaXF1ZTsgXFxcIlwiLmNvbmNhdChpS2V5LCBcIlxcXCIgaXMgcmVwZWF0ZWRcIik7XG4gICAgICAgICAgZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihjc3QsIG1zZykpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY3N0LnJlc29sdmVkID0gbWFwO1xuICByZXR1cm4gbWFwO1xufVxuXG5jb25zdCB2YWx1ZUhhc1BhaXJDb21tZW50ID0gKHtcbiAgY29udGV4dDoge1xuICAgIGxpbmVTdGFydCxcbiAgICBub2RlLFxuICAgIHNyY1xuICB9LFxuICBwcm9wc1xufSkgPT4ge1xuICBpZiAocHJvcHMubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHtcbiAgICBzdGFydFxuICB9ID0gcHJvcHNbMF07XG4gIGlmIChub2RlICYmIHN0YXJ0ID4gbm9kZS52YWx1ZVJhbmdlLnN0YXJ0KSByZXR1cm4gZmFsc2U7XG4gIGlmIChzcmNbc3RhcnRdICE9PSBDaGFyLkNPTU1FTlQpIHJldHVybiBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gbGluZVN0YXJ0OyBpIDwgc3RhcnQ7ICsraSkgaWYgKHNyY1tpXSA9PT0gJ1xcbicpIHJldHVybiBmYWxzZTtcblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbmZ1bmN0aW9uIHJlc29sdmVQYWlyQ29tbWVudChpdGVtLCBwYWlyKSB7XG4gIGlmICghdmFsdWVIYXNQYWlyQ29tbWVudChpdGVtKSkgcmV0dXJuO1xuICBjb25zdCBjb21tZW50ID0gaXRlbS5nZXRQcm9wVmFsdWUoMCwgQ2hhci5DT01NRU5ULCB0cnVlKTtcbiAgbGV0IGZvdW5kID0gZmFsc2U7XG4gIGNvbnN0IGNiID0gcGFpci52YWx1ZS5jb21tZW50QmVmb3JlO1xuXG4gIGlmIChjYiAmJiBjYi5zdGFydHNXaXRoKGNvbW1lbnQpKSB7XG4gICAgcGFpci52YWx1ZS5jb21tZW50QmVmb3JlID0gY2Iuc3Vic3RyKGNvbW1lbnQubGVuZ3RoICsgMSk7XG4gICAgZm91bmQgPSB0cnVlO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGNjID0gcGFpci52YWx1ZS5jb21tZW50O1xuXG4gICAgaWYgKCFpdGVtLm5vZGUgJiYgY2MgJiYgY2Muc3RhcnRzV2l0aChjb21tZW50KSkge1xuICAgICAgcGFpci52YWx1ZS5jb21tZW50ID0gY2Muc3Vic3RyKGNvbW1lbnQubGVuZ3RoICsgMSk7XG4gICAgICBmb3VuZCA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgaWYgKGZvdW5kKSBwYWlyLmNvbW1lbnQgPSBjb21tZW50O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQmxvY2tNYXBJdGVtcyhkb2MsIGNzdCkge1xuICBjb25zdCBjb21tZW50cyA9IFtdO1xuICBjb25zdCBpdGVtcyA9IFtdO1xuICBsZXQga2V5ID0gdW5kZWZpbmVkO1xuICBsZXQga2V5U3RhcnQgPSBudWxsO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY3N0Lml0ZW1zLmxlbmd0aDsgKytpKSB7XG4gICAgY29uc3QgaXRlbSA9IGNzdC5pdGVtc1tpXTtcblxuICAgIHN3aXRjaCAoaXRlbS50eXBlKSB7XG4gICAgICBjYXNlIFR5cGUuQkxBTktfTElORTpcbiAgICAgICAgY29tbWVudHMucHVzaCh7XG4gICAgICAgICAgYWZ0ZXJLZXk6ICEha2V5LFxuICAgICAgICAgIGJlZm9yZTogaXRlbXMubGVuZ3RoXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBUeXBlLkNPTU1FTlQ6XG4gICAgICAgIGNvbW1lbnRzLnB1c2goe1xuICAgICAgICAgIGFmdGVyS2V5OiAhIWtleSxcbiAgICAgICAgICBiZWZvcmU6IGl0ZW1zLmxlbmd0aCxcbiAgICAgICAgICBjb21tZW50OiBpdGVtLmNvbW1lbnRcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFR5cGUuTUFQX0tFWTpcbiAgICAgICAgaWYgKGtleSAhPT0gdW5kZWZpbmVkKSBpdGVtcy5wdXNoKG5ldyBQYWlyKGtleSkpO1xuICAgICAgICBpZiAoaXRlbS5lcnJvcikgZG9jLmVycm9ycy5wdXNoKGl0ZW0uZXJyb3IpO1xuICAgICAgICBrZXkgPSByZXNvbHZlTm9kZShkb2MsIGl0ZW0ubm9kZSk7XG4gICAgICAgIGtleVN0YXJ0ID0gbnVsbDtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgVHlwZS5NQVBfVkFMVUU6XG4gICAgICAgIHtcbiAgICAgICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpIGtleSA9IG51bGw7XG4gICAgICAgICAgaWYgKGl0ZW0uZXJyb3IpIGRvYy5lcnJvcnMucHVzaChpdGVtLmVycm9yKTtcblxuICAgICAgICAgIGlmICghaXRlbS5jb250ZXh0LmF0TGluZVN0YXJ0ICYmIGl0ZW0ubm9kZSAmJiBpdGVtLm5vZGUudHlwZSA9PT0gVHlwZS5NQVAgJiYgIWl0ZW0ubm9kZS5jb250ZXh0LmF0TGluZVN0YXJ0KSB7XG4gICAgICAgICAgICBjb25zdCBtc2cgPSAnTmVzdGVkIG1hcHBpbmdzIGFyZSBub3QgYWxsb3dlZCBpbiBjb21wYWN0IG1hcHBpbmdzJztcbiAgICAgICAgICAgIGRvYy5lcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3IoaXRlbS5ub2RlLCBtc2cpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZXQgdmFsdWVOb2RlID0gaXRlbS5ub2RlO1xuXG4gICAgICAgICAgaWYgKCF2YWx1ZU5vZGUgJiYgaXRlbS5wcm9wcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBDb21tZW50cyBvbiBhbiBlbXB0eSBtYXBwaW5nIHZhbHVlIG5lZWQgdG8gYmUgcHJlc2VydmVkLCBzbyB3ZVxuICAgICAgICAgICAgLy8gbmVlZCB0byBjb25zdHJ1Y3QgYSBtaW5pbWFsIGVtcHR5IG5vZGUgaGVyZSB0byB1c2UgaW5zdGVhZCBvZiB0aGVcbiAgICAgICAgICAgIC8vIG1pc3NpbmcgYGl0ZW0ubm9kZWAuIC0tIGVlbWVsaS95YW1sIzE5XG4gICAgICAgICAgICB2YWx1ZU5vZGUgPSBuZXcgUGxhaW5WYWx1ZShUeXBlLlBMQUlOLCBbXSk7XG4gICAgICAgICAgICB2YWx1ZU5vZGUuY29udGV4dCA9IHtcbiAgICAgICAgICAgICAgcGFyZW50OiBpdGVtLFxuICAgICAgICAgICAgICBzcmM6IGl0ZW0uY29udGV4dC5zcmNcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBwb3MgPSBpdGVtLnJhbmdlLnN0YXJ0ICsgMTtcbiAgICAgICAgICAgIHZhbHVlTm9kZS5yYW5nZSA9IHtcbiAgICAgICAgICAgICAgc3RhcnQ6IHBvcyxcbiAgICAgICAgICAgICAgZW5kOiBwb3NcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YWx1ZU5vZGUudmFsdWVSYW5nZSA9IHtcbiAgICAgICAgICAgICAgc3RhcnQ6IHBvcyxcbiAgICAgICAgICAgICAgZW5kOiBwb3NcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbS5yYW5nZS5vcmlnU3RhcnQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG9yaWdQb3MgPSBpdGVtLnJhbmdlLm9yaWdTdGFydCArIDE7XG4gICAgICAgICAgICAgIHZhbHVlTm9kZS5yYW5nZS5vcmlnU3RhcnQgPSB2YWx1ZU5vZGUucmFuZ2Uub3JpZ0VuZCA9IG9yaWdQb3M7XG4gICAgICAgICAgICAgIHZhbHVlTm9kZS52YWx1ZVJhbmdlLm9yaWdTdGFydCA9IHZhbHVlTm9kZS52YWx1ZVJhbmdlLm9yaWdFbmQgPSBvcmlnUG9zO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHBhaXIgPSBuZXcgUGFpcihrZXksIHJlc29sdmVOb2RlKGRvYywgdmFsdWVOb2RlKSk7XG4gICAgICAgICAgcmVzb2x2ZVBhaXJDb21tZW50KGl0ZW0sIHBhaXIpO1xuICAgICAgICAgIGl0ZW1zLnB1c2gocGFpcik7XG5cbiAgICAgICAgICBpZiAoa2V5ICYmIHR5cGVvZiBrZXlTdGFydCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGlmIChpdGVtLnJhbmdlLnN0YXJ0ID4ga2V5U3RhcnQgKyAxMDI0KSBkb2MuZXJyb3JzLnB1c2goZ2V0TG9uZ0tleUVycm9yKGNzdCwga2V5KSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAga2V5ID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGtleVN0YXJ0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGtleSAhPT0gdW5kZWZpbmVkKSBpdGVtcy5wdXNoKG5ldyBQYWlyKGtleSkpO1xuICAgICAgICBrZXkgPSByZXNvbHZlTm9kZShkb2MsIGl0ZW0pO1xuICAgICAgICBrZXlTdGFydCA9IGl0ZW0ucmFuZ2Uuc3RhcnQ7XG4gICAgICAgIGlmIChpdGVtLmVycm9yKSBkb2MuZXJyb3JzLnB1c2goaXRlbS5lcnJvcik7XG5cbiAgICAgICAgbmV4dDogZm9yIChsZXQgaiA9IGkgKyAxOzsgKytqKSB7XG4gICAgICAgICAgY29uc3QgbmV4dEl0ZW0gPSBjc3QuaXRlbXNbal07XG5cbiAgICAgICAgICBzd2l0Y2ggKG5leHRJdGVtICYmIG5leHRJdGVtLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgVHlwZS5CTEFOS19MSU5FOlxuICAgICAgICAgICAgY2FzZSBUeXBlLkNPTU1FTlQ6XG4gICAgICAgICAgICAgIGNvbnRpbnVlIG5leHQ7XG5cbiAgICAgICAgICAgIGNhc2UgVHlwZS5NQVBfVkFMVUU6XG4gICAgICAgICAgICAgIGJyZWFrIG5leHQ7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtc2cgPSAnSW1wbGljaXQgbWFwIGtleXMgbmVlZCB0byBiZSBmb2xsb3dlZCBieSBtYXAgdmFsdWVzJztcbiAgICAgICAgICAgICAgICBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGl0ZW0sIG1zZykpO1xuICAgICAgICAgICAgICAgIGJyZWFrIG5leHQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS52YWx1ZVJhbmdlQ29udGFpbnNOZXdsaW5lKSB7XG4gICAgICAgICAgY29uc3QgbXNnID0gJ0ltcGxpY2l0IG1hcCBrZXlzIG5lZWQgdG8gYmUgb24gYSBzaW5nbGUgbGluZSc7XG4gICAgICAgICAgZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihpdGVtLCBtc2cpKTtcbiAgICAgICAgfVxuXG4gICAgfVxuICB9XG5cbiAgaWYgKGtleSAhPT0gdW5kZWZpbmVkKSBpdGVtcy5wdXNoKG5ldyBQYWlyKGtleSkpO1xuICByZXR1cm4ge1xuICAgIGNvbW1lbnRzLFxuICAgIGl0ZW1zXG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVGbG93TWFwSXRlbXMoZG9jLCBjc3QpIHtcbiAgY29uc3QgY29tbWVudHMgPSBbXTtcbiAgY29uc3QgaXRlbXMgPSBbXTtcbiAgbGV0IGtleSA9IHVuZGVmaW5lZDtcbiAgbGV0IGV4cGxpY2l0S2V5ID0gZmFsc2U7XG4gIGxldCBuZXh0ID0gJ3snO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY3N0Lml0ZW1zLmxlbmd0aDsgKytpKSB7XG4gICAgY29uc3QgaXRlbSA9IGNzdC5pdGVtc1tpXTtcblxuICAgIGlmICh0eXBlb2YgaXRlbS5jaGFyID09PSAnc3RyaW5nJykge1xuICAgICAgY29uc3Qge1xuICAgICAgICBjaGFyLFxuICAgICAgICBvZmZzZXRcbiAgICAgIH0gPSBpdGVtO1xuXG4gICAgICBpZiAoY2hhciA9PT0gJz8nICYmIGtleSA9PT0gdW5kZWZpbmVkICYmICFleHBsaWNpdEtleSkge1xuICAgICAgICBleHBsaWNpdEtleSA9IHRydWU7XG4gICAgICAgIG5leHQgPSAnOic7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2hhciA9PT0gJzonKSB7XG4gICAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZCkga2V5ID0gbnVsbDtcblxuICAgICAgICBpZiAobmV4dCA9PT0gJzonKSB7XG4gICAgICAgICAgbmV4dCA9ICcsJztcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGV4cGxpY2l0S2V5KSB7XG4gICAgICAgICAgaWYgKGtleSA9PT0gdW5kZWZpbmVkICYmIGNoYXIgIT09ICcsJykga2V5ID0gbnVsbDtcbiAgICAgICAgICBleHBsaWNpdEtleSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgaXRlbXMucHVzaChuZXcgUGFpcihrZXkpKTtcbiAgICAgICAgICBrZXkgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgICBpZiAoY2hhciA9PT0gJywnKSB7XG4gICAgICAgICAgICBuZXh0ID0gJzonO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFyID09PSAnfScpIHtcbiAgICAgICAgaWYgKGkgPT09IGNzdC5pdGVtcy5sZW5ndGggLSAxKSBjb250aW51ZTtcbiAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gbmV4dCkge1xuICAgICAgICBuZXh0ID0gJzonO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbXNnID0gXCJGbG93IG1hcCBjb250YWlucyBhbiB1bmV4cGVjdGVkIFwiLmNvbmNhdChjaGFyKTtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBZQU1MU3ludGF4RXJyb3IoY3N0LCBtc2cpO1xuICAgICAgZXJyLm9mZnNldCA9IG9mZnNldDtcbiAgICAgIGRvYy5lcnJvcnMucHVzaChlcnIpO1xuICAgIH0gZWxzZSBpZiAoaXRlbS50eXBlID09PSBUeXBlLkJMQU5LX0xJTkUpIHtcbiAgICAgIGNvbW1lbnRzLnB1c2goe1xuICAgICAgICBhZnRlcktleTogISFrZXksXG4gICAgICAgIGJlZm9yZTogaXRlbXMubGVuZ3RoXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGl0ZW0udHlwZSA9PT0gVHlwZS5DT01NRU5UKSB7XG4gICAgICBjaGVja0Zsb3dDb21tZW50U3BhY2UoZG9jLmVycm9ycywgaXRlbSk7XG4gICAgICBjb21tZW50cy5wdXNoKHtcbiAgICAgICAgYWZ0ZXJLZXk6ICEha2V5LFxuICAgICAgICBiZWZvcmU6IGl0ZW1zLmxlbmd0aCxcbiAgICAgICAgY29tbWVudDogaXRlbS5jb21tZW50XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGtleSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAobmV4dCA9PT0gJywnKSBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGl0ZW0sICdTZXBhcmF0b3IgLCBtaXNzaW5nIGluIGZsb3cgbWFwJykpO1xuICAgICAga2V5ID0gcmVzb2x2ZU5vZGUoZG9jLCBpdGVtKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG5leHQgIT09ICcsJykgZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihpdGVtLCAnSW5kaWNhdG9yIDogbWlzc2luZyBpbiBmbG93IG1hcCBlbnRyeScpKTtcbiAgICAgIGl0ZW1zLnB1c2gobmV3IFBhaXIoa2V5LCByZXNvbHZlTm9kZShkb2MsIGl0ZW0pKSk7XG4gICAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgICBleHBsaWNpdEtleSA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGNoZWNrRmxvd0NvbGxlY3Rpb25FbmQoZG9jLmVycm9ycywgY3N0KTtcbiAgaWYgKGtleSAhPT0gdW5kZWZpbmVkKSBpdGVtcy5wdXNoKG5ldyBQYWlyKGtleSkpO1xuICByZXR1cm4ge1xuICAgIGNvbW1lbnRzLFxuICAgIGl0ZW1zXG4gIH07XG59XG5cbmV4cG9ydCB7IHJlc29sdmVNYXAgfTtcbiIsImltcG9ydCB7IFBhaXIgfSBmcm9tICcuLi9hc3QvUGFpci5qcyc7XG5pbXBvcnQgeyBZQU1MU2VxIH0gZnJvbSAnLi4vYXN0L1lBTUxTZXEuanMnO1xuaW1wb3J0IHsgVHlwZSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBZQU1MU3ludGF4RXJyb3IsIFlBTUxTZW1hbnRpY0Vycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IHJlc29sdmVDb21tZW50cywgZ2V0TG9uZ0tleUVycm9yLCBjaGVja0Zsb3dDb21tZW50U3BhY2UsIGNoZWNrRmxvd0NvbGxlY3Rpb25FbmQgfSBmcm9tICcuL2NvbGxlY3Rpb24tdXRpbHMuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZU5vZGUgfSBmcm9tICcuL3Jlc29sdmVOb2RlLmpzJztcblxuZnVuY3Rpb24gcmVzb2x2ZVNlcShkb2MsIGNzdCkge1xuICBjb25zdCB7XG4gICAgY29tbWVudHMsXG4gICAgaXRlbXNcbiAgfSA9IGNzdC50eXBlID09PSBUeXBlLkZMT1dfU0VRID8gcmVzb2x2ZUZsb3dTZXFJdGVtcyhkb2MsIGNzdCkgOiByZXNvbHZlQmxvY2tTZXFJdGVtcyhkb2MsIGNzdCk7XG4gIGNvbnN0IHNlcSA9IG5ldyBZQU1MU2VxKGRvYy5zY2hlbWEpO1xuICBzZXEuaXRlbXMgPSBpdGVtcztcbiAgcmVzb2x2ZUNvbW1lbnRzKHNlcSwgY29tbWVudHMpO1xuICBjc3QucmVzb2x2ZWQgPSBzZXE7XG4gIHJldHVybiBzZXE7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCbG9ja1NlcUl0ZW1zKGRvYywgY3N0KSB7XG4gIGNvbnN0IGNvbW1lbnRzID0gW107XG4gIGNvbnN0IGl0ZW1zID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjc3QuaXRlbXMubGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCBpdGVtID0gY3N0Lml0ZW1zW2ldO1xuXG4gICAgc3dpdGNoIChpdGVtLnR5cGUpIHtcbiAgICAgIGNhc2UgVHlwZS5CTEFOS19MSU5FOlxuICAgICAgICBjb21tZW50cy5wdXNoKHtcbiAgICAgICAgICBiZWZvcmU6IGl0ZW1zLmxlbmd0aFxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgVHlwZS5DT01NRU5UOlxuICAgICAgICBjb21tZW50cy5wdXNoKHtcbiAgICAgICAgICBjb21tZW50OiBpdGVtLmNvbW1lbnQsXG4gICAgICAgICAgYmVmb3JlOiBpdGVtcy5sZW5ndGhcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFR5cGUuU0VRX0lURU06XG4gICAgICAgIGlmIChpdGVtLmVycm9yKSBkb2MuZXJyb3JzLnB1c2goaXRlbS5lcnJvcik7XG4gICAgICAgIGl0ZW1zLnB1c2gocmVzb2x2ZU5vZGUoZG9jLCBpdGVtLm5vZGUpKTtcblxuICAgICAgICBpZiAoaXRlbS5oYXNQcm9wcykge1xuICAgICAgICAgIGNvbnN0IG1zZyA9ICdTZXF1ZW5jZSBpdGVtcyBjYW5ub3QgaGF2ZSB0YWdzIG9yIGFuY2hvcnMgYmVmb3JlIHRoZSAtIGluZGljYXRvcic7XG4gICAgICAgICAgZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihpdGVtLCBtc2cpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAoaXRlbS5lcnJvcikgZG9jLmVycm9ycy5wdXNoKGl0ZW0uZXJyb3IpO1xuICAgICAgICBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTeW50YXhFcnJvcihpdGVtLCBcIlVuZXhwZWN0ZWQgXCIuY29uY2F0KGl0ZW0udHlwZSwgXCIgbm9kZSBpbiBzZXF1ZW5jZVwiKSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY29tbWVudHMsXG4gICAgaXRlbXNcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZsb3dTZXFJdGVtcyhkb2MsIGNzdCkge1xuICBjb25zdCBjb21tZW50cyA9IFtdO1xuICBjb25zdCBpdGVtcyA9IFtdO1xuICBsZXQgZXhwbGljaXRLZXkgPSBmYWxzZTtcbiAgbGV0IGtleSA9IHVuZGVmaW5lZDtcbiAgbGV0IGtleVN0YXJ0ID0gbnVsbDtcbiAgbGV0IG5leHQgPSAnWyc7XG4gIGxldCBwcmV2SXRlbSA9IG51bGw7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjc3QuaXRlbXMubGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCBpdGVtID0gY3N0Lml0ZW1zW2ldO1xuXG4gICAgaWYgKHR5cGVvZiBpdGVtLmNoYXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIGNoYXIsXG4gICAgICAgIG9mZnNldFxuICAgICAgfSA9IGl0ZW07XG5cbiAgICAgIGlmIChjaGFyICE9PSAnOicgJiYgKGV4cGxpY2l0S2V5IHx8IGtleSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgICBpZiAoZXhwbGljaXRLZXkgJiYga2V5ID09PSB1bmRlZmluZWQpIGtleSA9IG5leHQgPyBpdGVtcy5wb3AoKSA6IG51bGw7XG4gICAgICAgIGl0ZW1zLnB1c2gobmV3IFBhaXIoa2V5KSk7XG4gICAgICAgIGV4cGxpY2l0S2V5ID0gZmFsc2U7XG4gICAgICAgIGtleSA9IHVuZGVmaW5lZDtcbiAgICAgICAga2V5U3RhcnQgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2hhciA9PT0gbmV4dCkge1xuICAgICAgICBuZXh0ID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoIW5leHQgJiYgY2hhciA9PT0gJz8nKSB7XG4gICAgICAgIGV4cGxpY2l0S2V5ID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAobmV4dCAhPT0gJ1snICYmIGNoYXIgPT09ICc6JyAmJiBrZXkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAobmV4dCA9PT0gJywnKSB7XG4gICAgICAgICAga2V5ID0gaXRlbXMucG9wKCk7XG5cbiAgICAgICAgICBpZiAoa2V5IGluc3RhbmNlb2YgUGFpcikge1xuICAgICAgICAgICAgY29uc3QgbXNnID0gJ0NoYWluaW5nIGZsb3cgc2VxdWVuY2UgcGFpcnMgaXMgaW52YWxpZCc7XG4gICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgWUFNTFNlbWFudGljRXJyb3IoY3N0LCBtc2cpO1xuICAgICAgICAgICAgZXJyLm9mZnNldCA9IG9mZnNldDtcbiAgICAgICAgICAgIGRvYy5lcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghZXhwbGljaXRLZXkgJiYgdHlwZW9mIGtleVN0YXJ0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgY29uc3Qga2V5RW5kID0gaXRlbS5yYW5nZSA/IGl0ZW0ucmFuZ2Uuc3RhcnQgOiBpdGVtLm9mZnNldDtcbiAgICAgICAgICAgIGlmIChrZXlFbmQgPiBrZXlTdGFydCArIDEwMjQpIGRvYy5lcnJvcnMucHVzaChnZXRMb25nS2V5RXJyb3IoY3N0LCBrZXkpKTtcbiAgICAgICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgICAgc3JjXG4gICAgICAgICAgICB9ID0gcHJldkl0ZW0uY29udGV4dDtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IGtleVN0YXJ0OyBpIDwga2V5RW5kOyArK2kpIGlmIChzcmNbaV0gPT09ICdcXG4nKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG1zZyA9ICdJbXBsaWNpdCBrZXlzIG9mIGZsb3cgc2VxdWVuY2UgcGFpcnMgbmVlZCB0byBiZSBvbiBhIHNpbmdsZSBsaW5lJztcbiAgICAgICAgICAgICAgZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihwcmV2SXRlbSwgbXNnKSk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBrZXkgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAga2V5U3RhcnQgPSBudWxsO1xuICAgICAgICBleHBsaWNpdEtleSA9IGZhbHNlO1xuICAgICAgICBuZXh0ID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAobmV4dCA9PT0gJ1snIHx8IGNoYXIgIT09ICddJyB8fCBpIDwgY3N0Lml0ZW1zLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgY29uc3QgbXNnID0gXCJGbG93IHNlcXVlbmNlIGNvbnRhaW5zIGFuIHVuZXhwZWN0ZWQgXCIuY29uY2F0KGNoYXIpO1xuICAgICAgICBjb25zdCBlcnIgPSBuZXcgWUFNTFN5bnRheEVycm9yKGNzdCwgbXNnKTtcbiAgICAgICAgZXJyLm9mZnNldCA9IG9mZnNldDtcbiAgICAgICAgZG9jLmVycm9ycy5wdXNoKGVycik7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpdGVtLnR5cGUgPT09IFR5cGUuQkxBTktfTElORSkge1xuICAgICAgY29tbWVudHMucHVzaCh7XG4gICAgICAgIGJlZm9yZTogaXRlbXMubGVuZ3RoXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGl0ZW0udHlwZSA9PT0gVHlwZS5DT01NRU5UKSB7XG4gICAgICBjaGVja0Zsb3dDb21tZW50U3BhY2UoZG9jLmVycm9ycywgaXRlbSk7XG4gICAgICBjb21tZW50cy5wdXNoKHtcbiAgICAgICAgY29tbWVudDogaXRlbS5jb21tZW50LFxuICAgICAgICBiZWZvcmU6IGl0ZW1zLmxlbmd0aFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgIGNvbnN0IG1zZyA9IFwiRXhwZWN0ZWQgYSBcIi5jb25jYXQobmV4dCwgXCIgaW4gZmxvdyBzZXF1ZW5jZVwiKTtcbiAgICAgICAgZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihpdGVtLCBtc2cpKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdmFsdWUgPSByZXNvbHZlTm9kZShkb2MsIGl0ZW0pO1xuXG4gICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaXRlbXMucHVzaCh2YWx1ZSk7XG4gICAgICAgIHByZXZJdGVtID0gaXRlbTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGl0ZW1zLnB1c2gobmV3IFBhaXIoa2V5LCB2YWx1ZSkpO1xuICAgICAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIGtleVN0YXJ0ID0gaXRlbS5yYW5nZS5zdGFydDtcbiAgICAgIG5leHQgPSAnLCc7XG4gICAgfVxuICB9XG5cbiAgY2hlY2tGbG93Q29sbGVjdGlvbkVuZChkb2MuZXJyb3JzLCBjc3QpO1xuICBpZiAoa2V5ICE9PSB1bmRlZmluZWQpIGl0ZW1zLnB1c2gobmV3IFBhaXIoa2V5KSk7XG4gIHJldHVybiB7XG4gICAgY29tbWVudHMsXG4gICAgaXRlbXNcbiAgfTtcbn1cblxuZXhwb3J0IHsgcmVzb2x2ZVNlcSB9O1xuIiwiaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4uL2FzdC9Db2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IFNjYWxhciB9IGZyb20gJy4uL2FzdC9TY2FsYXIuanMnO1xuaW1wb3J0IHsgVHlwZSwgZGVmYXVsdFRhZ3MgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWUFNTFNlbWFudGljRXJyb3IsIFlBTUxXYXJuaW5nLCBZQU1MUmVmZXJlbmNlRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZU1hcCB9IGZyb20gJy4vcmVzb2x2ZU1hcC5qcyc7XG5pbXBvcnQgeyByZXNvbHZlU2NhbGFyIH0gZnJvbSAnLi9yZXNvbHZlU2NhbGFyLmpzJztcbmltcG9ydCB7IHJlc29sdmVTZXEgfSBmcm9tICcuL3Jlc29sdmVTZXEuanMnO1xuXG5mdW5jdGlvbiByZXNvbHZlQnlUYWdOYW1lKHtcbiAga25vd25UYWdzLFxuICB0YWdzXG59LCB0YWdOYW1lLCB2YWx1ZSwgb25FcnJvcikge1xuICBjb25zdCBtYXRjaFdpdGhUZXN0ID0gW107XG5cbiAgZm9yIChjb25zdCB0YWcgb2YgdGFncykge1xuICAgIGlmICh0YWcudGFnID09PSB0YWdOYW1lKSB7XG4gICAgICBpZiAodGFnLnRlc3QpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIG1hdGNoV2l0aFRlc3QucHVzaCh0YWcpO2Vsc2Ugb25FcnJvcihcIlRoZSB0YWcgXCIuY29uY2F0KHRhZ05hbWUsIFwiIGNhbm5vdCBiZSBhcHBsaWVkIHRvIGEgY29sbGVjdGlvblwiKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXMgPSB0YWcucmVzb2x2ZSh2YWx1ZSwgb25FcnJvcik7XG4gICAgICAgIHJldHVybiByZXMgaW5zdGFuY2VvZiBDb2xsZWN0aW9uID8gcmVzIDogbmV3IFNjYWxhcihyZXMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChtYXRjaFdpdGhUZXN0Lmxlbmd0aCA+IDApIHJldHVybiByZXNvbHZlU2NhbGFyKHZhbHVlLCBtYXRjaFdpdGhUZXN0KTtcbiAgY29uc3Qga3QgPSBrbm93blRhZ3NbdGFnTmFtZV07XG5cbiAgaWYgKGt0KSB7XG4gICAgdGFncy5wdXNoKE9iamVjdC5hc3NpZ24oe30sIGt0LCB7XG4gICAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICAgIHRlc3Q6IHVuZGVmaW5lZFxuICAgIH0pKTtcbiAgICBjb25zdCByZXMgPSBrdC5yZXNvbHZlKHZhbHVlLCBvbkVycm9yKTtcbiAgICByZXR1cm4gcmVzIGluc3RhbmNlb2YgQ29sbGVjdGlvbiA/IHJlcyA6IG5ldyBTY2FsYXIocmVzKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVGFnKGRvYywgbm9kZSwgdGFnTmFtZSkge1xuICBjb25zdCB7XG4gICAgTUFQLFxuICAgIFNFUSxcbiAgICBTVFJcbiAgfSA9IGRlZmF1bHRUYWdzO1xuICBsZXQgdmFsdWUsIGZhbGxiYWNrO1xuXG4gIGNvbnN0IG9uRXJyb3IgPSBtZXNzYWdlID0+IGRvYy5lcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3Iobm9kZSwgbWVzc2FnZSkpO1xuXG4gIHRyeSB7XG4gICAgc3dpdGNoIChub2RlLnR5cGUpIHtcbiAgICAgIGNhc2UgVHlwZS5GTE9XX01BUDpcbiAgICAgIGNhc2UgVHlwZS5NQVA6XG4gICAgICAgIHZhbHVlID0gcmVzb2x2ZU1hcChkb2MsIG5vZGUpO1xuICAgICAgICBmYWxsYmFjayA9IE1BUDtcbiAgICAgICAgaWYgKHRhZ05hbWUgPT09IFNFUSB8fCB0YWdOYW1lID09PSBTVFIpIG9uRXJyb3IoXCJUaGUgdGFnIFwiLmNvbmNhdCh0YWdOYW1lLCBcIiBjYW5ub3QgYmUgYXBwbGllZCB0byBhIG1hcHBpbmdcIikpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBUeXBlLkZMT1dfU0VROlxuICAgICAgY2FzZSBUeXBlLlNFUTpcbiAgICAgICAgdmFsdWUgPSByZXNvbHZlU2VxKGRvYywgbm9kZSk7XG4gICAgICAgIGZhbGxiYWNrID0gU0VRO1xuICAgICAgICBpZiAodGFnTmFtZSA9PT0gTUFQIHx8IHRhZ05hbWUgPT09IFNUUikgb25FcnJvcihcIlRoZSB0YWcgXCIuY29uY2F0KHRhZ05hbWUsIFwiIGNhbm5vdCBiZSBhcHBsaWVkIHRvIGEgc2VxdWVuY2VcIikpO1xuICAgICAgICBicmVhaztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdmFsdWUgPSBub2RlLnN0clZhbHVlIHx8ICcnO1xuXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdmFsdWUuZXJyb3JzLmZvckVhY2goZXJyb3IgPT4gZG9jLmVycm9ycy5wdXNoKGVycm9yKSk7XG4gICAgICAgICAgdmFsdWUgPSB2YWx1ZS5zdHI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGFnTmFtZSA9PT0gTUFQIHx8IHRhZ05hbWUgPT09IFNFUSkgb25FcnJvcihcIlRoZSB0YWcgXCIuY29uY2F0KHRhZ05hbWUsIFwiIGNhbm5vdCBiZSBhcHBsaWVkIHRvIGEgc2NhbGFyXCIpKTtcbiAgICAgICAgZmFsbGJhY2sgPSBTVFI7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzID0gcmVzb2x2ZUJ5VGFnTmFtZShkb2Muc2NoZW1hLCB0YWdOYW1lLCB2YWx1ZSwgb25FcnJvcik7XG5cbiAgICBpZiAocmVzKSB7XG4gICAgICBpZiAodGFnTmFtZSAmJiBub2RlLnRhZykgcmVzLnRhZyA9IHRhZ05hbWU7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoIWVycm9yLnNvdXJjZSkgZXJyb3Iuc291cmNlID0gbm9kZTtcbiAgICBkb2MuZXJyb3JzLnB1c2goZXJyb3IpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBpZiAoIWZhbGxiYWNrKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgdGFnIFwiLmNvbmNhdCh0YWdOYW1lLCBcIiBpcyB1bmF2YWlsYWJsZVwiKSk7XG4gICAgY29uc3QgbXNnID0gXCJUaGUgdGFnIFwiLmNvbmNhdCh0YWdOYW1lLCBcIiBpcyB1bmF2YWlsYWJsZSwgZmFsbGluZyBiYWNrIHRvIFwiKS5jb25jYXQoZmFsbGJhY2spO1xuICAgIGRvYy53YXJuaW5ncy5wdXNoKG5ldyBZQU1MV2FybmluZyhub2RlLCBtc2cpKTtcbiAgICBjb25zdCByZXMgPSByZXNvbHZlQnlUYWdOYW1lKGRvYy5zY2hlbWEsIGZhbGxiYWNrLCB2YWx1ZSwgb25FcnJvcik7XG4gICAgcmVzLnRhZyA9IHRhZ05hbWU7XG4gICAgcmV0dXJuIHJlcztcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zdCByZWZFcnJvciA9IG5ldyBZQU1MUmVmZXJlbmNlRXJyb3Iobm9kZSwgZXJyb3IubWVzc2FnZSk7XG4gICAgcmVmRXJyb3Iuc3RhY2sgPSBlcnJvci5zdGFjaztcbiAgICBkb2MuZXJyb3JzLnB1c2gocmVmRXJyb3IpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCB7IHJlc29sdmVUYWcgfTtcbiIsImltcG9ydCB7IEFsaWFzIH0gZnJvbSAnLi4vYXN0L0FsaWFzLmpzJztcbmltcG9ydCB7IFR5cGUsIENoYXIgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWUFNTFNlbWFudGljRXJyb3IsIFlBTUxSZWZlcmVuY2VFcnJvciwgWUFNTFN5bnRheEVycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IHJlc29sdmVTY2FsYXIgfSBmcm9tICcuL3Jlc29sdmVTY2FsYXIuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZVRhZ05hbWUgfSBmcm9tICcuL3Jlc29sdmVUYWdOYW1lLmpzJztcbmltcG9ydCB7IHJlc29sdmVUYWcgfSBmcm9tICcuL3Jlc29sdmVUYWcuanMnO1xuXG5jb25zdCBpc0NvbGxlY3Rpb25JdGVtID0gbm9kZSA9PiB7XG4gIGlmICghbm9kZSkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCB7XG4gICAgdHlwZVxuICB9ID0gbm9kZTtcbiAgcmV0dXJuIHR5cGUgPT09IFR5cGUuTUFQX0tFWSB8fCB0eXBlID09PSBUeXBlLk1BUF9WQUxVRSB8fCB0eXBlID09PSBUeXBlLlNFUV9JVEVNO1xufTtcblxuZnVuY3Rpb24gcmVzb2x2ZU5vZGVQcm9wcyhlcnJvcnMsIG5vZGUpIHtcbiAgY29uc3QgY29tbWVudHMgPSB7XG4gICAgYmVmb3JlOiBbXSxcbiAgICBhZnRlcjogW11cbiAgfTtcbiAgbGV0IGhhc0FuY2hvciA9IGZhbHNlO1xuICBsZXQgaGFzVGFnID0gZmFsc2U7XG4gIGNvbnN0IHByb3BzID0gaXNDb2xsZWN0aW9uSXRlbShub2RlLmNvbnRleHQucGFyZW50KSA/IG5vZGUuY29udGV4dC5wYXJlbnQucHJvcHMuY29uY2F0KG5vZGUucHJvcHMpIDogbm9kZS5wcm9wcztcblxuICBmb3IgKGNvbnN0IHtcbiAgICBzdGFydCxcbiAgICBlbmRcbiAgfSBvZiBwcm9wcykge1xuICAgIHN3aXRjaCAobm9kZS5jb250ZXh0LnNyY1tzdGFydF0pIHtcbiAgICAgIGNhc2UgQ2hhci5DT01NRU5UOlxuICAgICAgICB7XG4gICAgICAgICAgaWYgKCFub2RlLmNvbW1lbnRIYXNSZXF1aXJlZFdoaXRlc3BhY2Uoc3RhcnQpKSB7XG4gICAgICAgICAgICBjb25zdCBtc2cgPSAnQ29tbWVudHMgbXVzdCBiZSBzZXBhcmF0ZWQgZnJvbSBvdGhlciB0b2tlbnMgYnkgd2hpdGUgc3BhY2UgY2hhcmFjdGVycyc7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3Iobm9kZSwgbXNnKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgaGVhZGVyLFxuICAgICAgICAgICAgdmFsdWVSYW5nZVxuICAgICAgICAgIH0gPSBub2RlO1xuICAgICAgICAgIGNvbnN0IGNjID0gdmFsdWVSYW5nZSAmJiAoc3RhcnQgPiB2YWx1ZVJhbmdlLnN0YXJ0IHx8IGhlYWRlciAmJiBzdGFydCA+IGhlYWRlci5zdGFydCkgPyBjb21tZW50cy5hZnRlciA6IGNvbW1lbnRzLmJlZm9yZTtcbiAgICAgICAgICBjYy5wdXNoKG5vZGUuY29udGV4dC5zcmMuc2xpY2Uoc3RhcnQgKyAxLCBlbmQpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgLy8gQWN0dWFsIGFuY2hvciAmIHRhZyByZXNvbHV0aW9uIGlzIGhhbmRsZWQgYnkgc2NoZW1hLCBoZXJlIHdlIGp1c3QgY29tcGxhaW5cblxuICAgICAgY2FzZSBDaGFyLkFOQ0hPUjpcbiAgICAgICAgaWYgKGhhc0FuY2hvcikge1xuICAgICAgICAgIGNvbnN0IG1zZyA9ICdBIG5vZGUgY2FuIGhhdmUgYXQgbW9zdCBvbmUgYW5jaG9yJztcbiAgICAgICAgICBlcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3Iobm9kZSwgbXNnKSk7XG4gICAgICAgIH1cblxuICAgICAgICBoYXNBbmNob3IgPSB0cnVlO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBDaGFyLlRBRzpcbiAgICAgICAgaWYgKGhhc1RhZykge1xuICAgICAgICAgIGNvbnN0IG1zZyA9ICdBIG5vZGUgY2FuIGhhdmUgYXQgbW9zdCBvbmUgdGFnJztcbiAgICAgICAgICBlcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3Iobm9kZSwgbXNnKSk7XG4gICAgICAgIH1cblxuICAgICAgICBoYXNUYWcgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGNvbW1lbnRzLFxuICAgIGhhc0FuY2hvcixcbiAgICBoYXNUYWdcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vZGVWYWx1ZShkb2MsIG5vZGUpIHtcbiAgY29uc3Qge1xuICAgIGFuY2hvcnMsXG4gICAgZXJyb3JzLFxuICAgIHNjaGVtYVxuICB9ID0gZG9jO1xuXG4gIGlmIChub2RlLnR5cGUgPT09IFR5cGUuQUxJQVMpIHtcbiAgICBjb25zdCBuYW1lID0gbm9kZS5yYXdWYWx1ZTtcbiAgICBjb25zdCBzcmMgPSBhbmNob3JzLmdldE5vZGUobmFtZSk7XG5cbiAgICBpZiAoIXNyYykge1xuICAgICAgY29uc3QgbXNnID0gXCJBbGlhc2VkIGFuY2hvciBub3QgZm91bmQ6IFwiLmNvbmNhdChuYW1lKTtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBZQU1MUmVmZXJlbmNlRXJyb3Iobm9kZSwgbXNnKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IC8vIExhenkgcmVzb2x1dGlvbiBmb3IgY2lyY3VsYXIgcmVmZXJlbmNlc1xuXG5cbiAgICBjb25zdCByZXMgPSBuZXcgQWxpYXMoc3JjKTtcblxuICAgIGFuY2hvcnMuX2NzdEFsaWFzZXMucHVzaChyZXMpO1xuXG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIGNvbnN0IHRhZ05hbWUgPSByZXNvbHZlVGFnTmFtZShkb2MsIG5vZGUpO1xuICBpZiAodGFnTmFtZSkgcmV0dXJuIHJlc29sdmVUYWcoZG9jLCBub2RlLCB0YWdOYW1lKTtcblxuICBpZiAobm9kZS50eXBlICE9PSBUeXBlLlBMQUlOKSB7XG4gICAgY29uc3QgbXNnID0gXCJGYWlsZWQgdG8gcmVzb2x2ZSBcIi5jb25jYXQobm9kZS50eXBlLCBcIiBub2RlIGhlcmVcIik7XG4gICAgZXJyb3JzLnB1c2gobmV3IFlBTUxTeW50YXhFcnJvcihub2RlLCBtc2cpKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHRyeSB7XG4gICAgbGV0IHN0ciA9IG5vZGUuc3RyVmFsdWUgfHwgJyc7XG5cbiAgICBpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHN0ci5lcnJvcnMuZm9yRWFjaChlcnJvciA9PiBkb2MuZXJyb3JzLnB1c2goZXJyb3IpKTtcbiAgICAgIHN0ciA9IHN0ci5zdHI7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc29sdmVTY2FsYXIoc3RyLCBzY2hlbWEudGFncyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKCFlcnJvci5zb3VyY2UpIGVycm9yLnNvdXJjZSA9IG5vZGU7XG4gICAgZXJyb3JzLnB1c2goZXJyb3IpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59IC8vIHNldHMgbm9kZS5yZXNvbHZlZCBvbiBzdWNjZXNzXG5cblxuZnVuY3Rpb24gcmVzb2x2ZU5vZGUoZG9jLCBub2RlKSB7XG4gIGlmICghbm9kZSkgcmV0dXJuIG51bGw7XG4gIGlmIChub2RlLmVycm9yKSBkb2MuZXJyb3JzLnB1c2gobm9kZS5lcnJvcik7XG4gIGNvbnN0IHtcbiAgICBjb21tZW50cyxcbiAgICBoYXNBbmNob3IsXG4gICAgaGFzVGFnXG4gIH0gPSByZXNvbHZlTm9kZVByb3BzKGRvYy5lcnJvcnMsIG5vZGUpO1xuXG4gIGlmIChoYXNBbmNob3IpIHtcbiAgICBjb25zdCB7XG4gICAgICBhbmNob3JzXG4gICAgfSA9IGRvYztcbiAgICBjb25zdCBuYW1lID0gbm9kZS5hbmNob3I7XG4gICAgY29uc3QgcHJldiA9IGFuY2hvcnMuZ2V0Tm9kZShuYW1lKTsgLy8gQXQgdGhpcyBwb2ludCwgYWxpYXNlcyBmb3IgYW55IHByZWNlZGluZyBub2RlIHdpdGggdGhlIHNhbWUgYW5jaG9yXG4gICAgLy8gbmFtZSBoYXZlIGFscmVhZHkgYmVlbiByZXNvbHZlZCwgc28gaXQgbWF5IHNhZmVseSBiZSByZW5hbWVkLlxuXG4gICAgaWYgKHByZXYpIGFuY2hvcnMubWFwW2FuY2hvcnMubmV3TmFtZShuYW1lKV0gPSBwcmV2OyAvLyBEdXJpbmcgcGFyc2luZywgd2UgbmVlZCB0byBzdG9yZSB0aGUgQ1NUIG5vZGUgaW4gYW5jaG9ycy5tYXAgYXNcbiAgICAvLyBhbmNob3JzIG5lZWQgdG8gYmUgYXZhaWxhYmxlIGR1cmluZyByZXNvbHV0aW9uIHRvIGFsbG93IGZvclxuICAgIC8vIGNpcmN1bGFyIHJlZmVyZW5jZXMuXG5cbiAgICBhbmNob3JzLm1hcFtuYW1lXSA9IG5vZGU7XG4gIH1cblxuICBpZiAobm9kZS50eXBlID09PSBUeXBlLkFMSUFTICYmIChoYXNBbmNob3IgfHwgaGFzVGFnKSkge1xuICAgIGNvbnN0IG1zZyA9ICdBbiBhbGlhcyBub2RlIG11c3Qgbm90IHNwZWNpZnkgYW55IHByb3BlcnRpZXMnO1xuICAgIGRvYy5lcnJvcnMucHVzaChuZXcgWUFNTFNlbWFudGljRXJyb3Iobm9kZSwgbXNnKSk7XG4gIH1cblxuICBjb25zdCByZXMgPSByZXNvbHZlTm9kZVZhbHVlKGRvYywgbm9kZSk7XG5cbiAgaWYgKHJlcykge1xuICAgIHJlcy5yYW5nZSA9IFtub2RlLnJhbmdlLnN0YXJ0LCBub2RlLnJhbmdlLmVuZF07XG4gICAgaWYgKGRvYy5vcHRpb25zLmtlZXBDc3ROb2RlcykgcmVzLmNzdE5vZGUgPSBub2RlO1xuICAgIGlmIChkb2Mub3B0aW9ucy5rZWVwTm9kZVR5cGVzKSByZXMudHlwZSA9IG5vZGUudHlwZTtcbiAgICBjb25zdCBjYiA9IGNvbW1lbnRzLmJlZm9yZS5qb2luKCdcXG4nKTtcblxuICAgIGlmIChjYikge1xuICAgICAgcmVzLmNvbW1lbnRCZWZvcmUgPSByZXMuY29tbWVudEJlZm9yZSA/IFwiXCIuY29uY2F0KHJlcy5jb21tZW50QmVmb3JlLCBcIlxcblwiKS5jb25jYXQoY2IpIDogY2I7XG4gICAgfVxuXG4gICAgY29uc3QgY2EgPSBjb21tZW50cy5hZnRlci5qb2luKCdcXG4nKTtcbiAgICBpZiAoY2EpIHJlcy5jb21tZW50ID0gcmVzLmNvbW1lbnQgPyBcIlwiLmNvbmNhdChyZXMuY29tbWVudCwgXCJcXG5cIikuY29uY2F0KGNhKSA6IGNhO1xuICB9XG5cbiAgcmV0dXJuIG5vZGUucmVzb2x2ZWQgPSByZXM7XG59XG5cbmV4cG9ydCB7IHJlc29sdmVOb2RlIH07XG4iLCJpbXBvcnQgeyBUeXBlIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFlBTUxTeW50YXhFcnJvciB9IGZyb20gJy4uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyByZXNvbHZlTm9kZSB9IGZyb20gJy4uL3Jlc29sdmUvcmVzb2x2ZU5vZGUuanMnO1xuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4uL2FzdC9Db2xsZWN0aW9uLmpzJztcblxuZnVuY3Rpb24gcGFyc2VDb250ZW50cyhkb2MsIGNvbnRlbnRzKSB7XG4gIGNvbnN0IGNvbW1lbnRzID0ge1xuICAgIGJlZm9yZTogW10sXG4gICAgYWZ0ZXI6IFtdXG4gIH07XG4gIGxldCBib2R5ID0gdW5kZWZpbmVkO1xuICBsZXQgc3BhY2VCZWZvcmUgPSBmYWxzZTtcblxuICBmb3IgKGNvbnN0IG5vZGUgb2YgY29udGVudHMpIHtcbiAgICBpZiAobm9kZS52YWx1ZVJhbmdlKSB7XG4gICAgICBpZiAoYm9keSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IG1zZyA9ICdEb2N1bWVudCBjb250YWlucyB0cmFpbGluZyBjb250ZW50IG5vdCBzZXBhcmF0ZWQgYnkgYSAuLi4gb3IgLS0tIGxpbmUnO1xuICAgICAgICBkb2MuZXJyb3JzLnB1c2gobmV3IFlBTUxTeW50YXhFcnJvcihub2RlLCBtc2cpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlcyA9IHJlc29sdmVOb2RlKGRvYywgbm9kZSk7XG5cbiAgICAgIGlmIChzcGFjZUJlZm9yZSkge1xuICAgICAgICByZXMuc3BhY2VCZWZvcmUgPSB0cnVlO1xuICAgICAgICBzcGFjZUJlZm9yZSA9IGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBib2R5ID0gcmVzO1xuICAgIH0gZWxzZSBpZiAobm9kZS5jb21tZW50ICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBjYyA9IGJvZHkgPT09IHVuZGVmaW5lZCA/IGNvbW1lbnRzLmJlZm9yZSA6IGNvbW1lbnRzLmFmdGVyO1xuICAgICAgY2MucHVzaChub2RlLmNvbW1lbnQpO1xuICAgIH0gZWxzZSBpZiAobm9kZS50eXBlID09PSBUeXBlLkJMQU5LX0xJTkUpIHtcbiAgICAgIHNwYWNlQmVmb3JlID0gdHJ1ZTtcblxuICAgICAgaWYgKGJvZHkgPT09IHVuZGVmaW5lZCAmJiBjb21tZW50cy5iZWZvcmUubGVuZ3RoID4gMCAmJiAhZG9jLmNvbW1lbnRCZWZvcmUpIHtcbiAgICAgICAgLy8gc3BhY2Utc2VwYXJhdGVkIGNvbW1lbnRzIGF0IHN0YXJ0IGFyZSBwYXJzZWQgYXMgZG9jdW1lbnQgY29tbWVudHNcbiAgICAgICAgZG9jLmNvbW1lbnRCZWZvcmUgPSBjb21tZW50cy5iZWZvcmUuam9pbignXFxuJyk7XG4gICAgICAgIGNvbW1lbnRzLmJlZm9yZSA9IFtdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGRvYy5jb250ZW50cyA9IGJvZHkgfHwgbnVsbDtcblxuICBpZiAoIWJvZHkpIHtcbiAgICBkb2MuY29tbWVudCA9IGNvbW1lbnRzLmJlZm9yZS5jb25jYXQoY29tbWVudHMuYWZ0ZXIpLmpvaW4oJ1xcbicpIHx8IG51bGw7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY2IgPSBjb21tZW50cy5iZWZvcmUuam9pbignXFxuJyk7XG5cbiAgICBpZiAoY2IpIHtcbiAgICAgIGNvbnN0IGNiTm9kZSA9IGJvZHkgaW5zdGFuY2VvZiBDb2xsZWN0aW9uICYmIGJvZHkuaXRlbXNbMF0gPyBib2R5Lml0ZW1zWzBdIDogYm9keTtcbiAgICAgIGNiTm9kZS5jb21tZW50QmVmb3JlID0gY2JOb2RlLmNvbW1lbnRCZWZvcmUgPyBcIlwiLmNvbmNhdChjYiwgXCJcXG5cIikuY29uY2F0KGNiTm9kZS5jb21tZW50QmVmb3JlKSA6IGNiO1xuICAgIH1cblxuICAgIGRvYy5jb21tZW50ID0gY29tbWVudHMuYWZ0ZXIuam9pbignXFxuJykgfHwgbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgeyBwYXJzZUNvbnRlbnRzIH07XG4iLCJpbXBvcnQgeyBZQU1MV2FybmluZywgWUFNTFNlbWFudGljRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgZG9jdW1lbnRPcHRpb25zIH0gZnJvbSAnLi4vb3B0aW9ucy5qcyc7XG5cbmZ1bmN0aW9uIHJlc29sdmVUYWdEaXJlY3RpdmUoe1xuICB0YWdQcmVmaXhlc1xufSwgZGlyZWN0aXZlKSB7XG4gIGNvbnN0IFtoYW5kbGUsIHByZWZpeF0gPSBkaXJlY3RpdmUucGFyYW1ldGVycztcblxuICBpZiAoIWhhbmRsZSB8fCAhcHJlZml4KSB7XG4gICAgY29uc3QgbXNnID0gJ0luc3VmZmljaWVudCBwYXJhbWV0ZXJzIGdpdmVuIGZvciAlVEFHIGRpcmVjdGl2ZSc7XG4gICAgdGhyb3cgbmV3IFlBTUxTZW1hbnRpY0Vycm9yKGRpcmVjdGl2ZSwgbXNnKTtcbiAgfVxuXG4gIGlmICh0YWdQcmVmaXhlcy5zb21lKHAgPT4gcC5oYW5kbGUgPT09IGhhbmRsZSkpIHtcbiAgICBjb25zdCBtc2cgPSAnVGhlICVUQUcgZGlyZWN0aXZlIG11c3Qgb25seSBiZSBnaXZlbiBhdCBtb3N0IG9uY2UgcGVyIGhhbmRsZSBpbiB0aGUgc2FtZSBkb2N1bWVudC4nO1xuICAgIHRocm93IG5ldyBZQU1MU2VtYW50aWNFcnJvcihkaXJlY3RpdmUsIG1zZyk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGhhbmRsZSxcbiAgICBwcmVmaXhcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVlhbWxEaXJlY3RpdmUoZG9jLCBkaXJlY3RpdmUpIHtcbiAgbGV0IFt2ZXJzaW9uXSA9IGRpcmVjdGl2ZS5wYXJhbWV0ZXJzO1xuICBpZiAoZGlyZWN0aXZlLm5hbWUgPT09ICdZQU1MOjEuMCcpIHZlcnNpb24gPSAnMS4wJztcblxuICBpZiAoIXZlcnNpb24pIHtcbiAgICBjb25zdCBtc2cgPSAnSW5zdWZmaWNpZW50IHBhcmFtZXRlcnMgZ2l2ZW4gZm9yICVZQU1MIGRpcmVjdGl2ZSc7XG4gICAgdGhyb3cgbmV3IFlBTUxTZW1hbnRpY0Vycm9yKGRpcmVjdGl2ZSwgbXNnKTtcbiAgfVxuXG4gIGlmICghZG9jdW1lbnRPcHRpb25zW3ZlcnNpb25dKSB7XG4gICAgY29uc3QgdjAgPSBkb2MudmVyc2lvbiB8fCBkb2Mub3B0aW9ucy52ZXJzaW9uO1xuICAgIGNvbnN0IG1zZyA9IFwiRG9jdW1lbnQgd2lsbCBiZSBwYXJzZWQgYXMgWUFNTCBcIi5jb25jYXQodjAsIFwiIHJhdGhlciB0aGFuIFlBTUwgXCIpLmNvbmNhdCh2ZXJzaW9uKTtcbiAgICBkb2Mud2FybmluZ3MucHVzaChuZXcgWUFNTFdhcm5pbmcoZGlyZWN0aXZlLCBtc2cpKTtcbiAgfVxuXG4gIHJldHVybiB2ZXJzaW9uO1xufVxuXG5mdW5jdGlvbiBwYXJzZURpcmVjdGl2ZXMoZG9jLCBkaXJlY3RpdmVzLCBwcmV2RG9jKSB7XG4gIGNvbnN0IGRpcmVjdGl2ZUNvbW1lbnRzID0gW107XG4gIGxldCBoYXNEaXJlY3RpdmVzID0gZmFsc2U7XG5cbiAgZm9yIChjb25zdCBkaXJlY3RpdmUgb2YgZGlyZWN0aXZlcykge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbW1lbnQsXG4gICAgICBuYW1lXG4gICAgfSA9IGRpcmVjdGl2ZTtcblxuICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgY2FzZSAnVEFHJzpcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBkb2MudGFnUHJlZml4ZXMucHVzaChyZXNvbHZlVGFnRGlyZWN0aXZlKGRvYywgZGlyZWN0aXZlKSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgZG9jLmVycm9ycy5wdXNoKGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGhhc0RpcmVjdGl2ZXMgPSB0cnVlO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnWUFNTCc6XG4gICAgICBjYXNlICdZQU1MOjEuMCc6XG4gICAgICAgIGlmIChkb2MudmVyc2lvbikge1xuICAgICAgICAgIGNvbnN0IG1zZyA9ICdUaGUgJVlBTUwgZGlyZWN0aXZlIG11c3Qgb25seSBiZSBnaXZlbiBhdCBtb3N0IG9uY2UgcGVyIGRvY3VtZW50Lic7XG4gICAgICAgICAgZG9jLmVycm9ycy5wdXNoKG5ldyBZQU1MU2VtYW50aWNFcnJvcihkaXJlY3RpdmUsIG1zZykpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBkb2MudmVyc2lvbiA9IHJlc29sdmVZYW1sRGlyZWN0aXZlKGRvYywgZGlyZWN0aXZlKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBkb2MuZXJyb3JzLnB1c2goZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgaGFzRGlyZWN0aXZlcyA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgIGNvbnN0IG1zZyA9IFwiWUFNTCBvbmx5IHN1cHBvcnRzICVUQUcgYW5kICVZQU1MIGRpcmVjdGl2ZXMsIGFuZCBub3QgJVwiLmNvbmNhdChuYW1lKTtcbiAgICAgICAgICBkb2Mud2FybmluZ3MucHVzaChuZXcgWUFNTFdhcm5pbmcoZGlyZWN0aXZlLCBtc2cpKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgaWYgKGNvbW1lbnQpIGRpcmVjdGl2ZUNvbW1lbnRzLnB1c2goY29tbWVudCk7XG4gIH1cblxuICBpZiAocHJldkRvYyAmJiAhaGFzRGlyZWN0aXZlcyAmJiAnMS4xJyA9PT0gKGRvYy52ZXJzaW9uIHx8IHByZXZEb2MudmVyc2lvbiB8fCBkb2Mub3B0aW9ucy52ZXJzaW9uKSkge1xuICAgIGNvbnN0IGNvcHlUYWdQcmVmaXggPSAoe1xuICAgICAgaGFuZGxlLFxuICAgICAgcHJlZml4XG4gICAgfSkgPT4gKHtcbiAgICAgIGhhbmRsZSxcbiAgICAgIHByZWZpeFxuICAgIH0pO1xuXG4gICAgZG9jLnRhZ1ByZWZpeGVzID0gcHJldkRvYy50YWdQcmVmaXhlcy5tYXAoY29weVRhZ1ByZWZpeCk7XG4gICAgZG9jLnZlcnNpb24gPSBwcmV2RG9jLnZlcnNpb247XG4gIH1cblxuICBkb2MuY29tbWVudEJlZm9yZSA9IGRpcmVjdGl2ZUNvbW1lbnRzLmpvaW4oJ1xcbicpIHx8IG51bGw7XG59XG5cbmV4cG9ydCB7IHBhcnNlRGlyZWN0aXZlcyB9O1xuIiwiaW1wb3J0IHsgZGVmaW5lUHJvcGVydHkgYXMgX2RlZmluZVByb3BlcnR5IH0gZnJvbSAnLi4vX3ZpcnR1YWwvX3JvbGx1cFBsdWdpbkJhYmVsSGVscGVycy5qcyc7XG5pbXBvcnQgeyBEb2N1bWVudCBhcyBEb2N1bWVudCQxIH0gZnJvbSAnLi4vY3N0L0RvY3VtZW50LmpzJztcbmltcG9ydCB7IGRlZmF1bHRUYWdQcmVmaXggfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWUFNTEVycm9yIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IGRlZmF1bHRPcHRpb25zLCBkb2N1bWVudE9wdGlvbnMgfSBmcm9tICcuLi9vcHRpb25zLmpzJztcbmltcG9ydCB7IGFkZENvbW1lbnQgfSBmcm9tICcuLi9zdHJpbmdpZnkvYWRkQ29tbWVudC5qcyc7XG5pbXBvcnQgeyBzdHJpbmdpZnkgfSBmcm9tICcuLi9zdHJpbmdpZnkvc3RyaW5naWZ5LmpzJztcbmltcG9ydCB7IEFuY2hvcnMgfSBmcm9tICcuL0FuY2hvcnMuanMnO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSAnLi9TY2hlbWEuanMnO1xuaW1wb3J0IHsgYXBwbHlSZXZpdmVyIH0gZnJvbSAnLi9hcHBseVJldml2ZXIuanMnO1xuaW1wb3J0IHsgY3JlYXRlTm9kZSB9IGZyb20gJy4vY3JlYXRlTm9kZS5qcyc7XG5pbXBvcnQgeyBsaXN0VGFnTmFtZXMgfSBmcm9tICcuL2xpc3RUYWdOYW1lcy5qcyc7XG5pbXBvcnQgeyBwYXJzZUNvbnRlbnRzIH0gZnJvbSAnLi9wYXJzZUNvbnRlbnRzLmpzJztcbmltcG9ydCB7IHBhcnNlRGlyZWN0aXZlcyB9IGZyb20gJy4vcGFyc2VEaXJlY3RpdmVzLmpzJztcbmltcG9ydCB7IFBhaXIgfSBmcm9tICcuLi9hc3QvUGFpci5qcyc7XG5pbXBvcnQgeyBpc0VtcHR5UGF0aCwgQ29sbGVjdGlvbiwgY29sbGVjdGlvbkZyb21QYXRoIH0gZnJvbSAnLi4vYXN0L0NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgU2NhbGFyIH0gZnJvbSAnLi4vYXN0L1NjYWxhci5qcyc7XG5pbXBvcnQgeyB0b0pTIH0gZnJvbSAnLi4vYXN0L3RvSlMuanMnO1xuaW1wb3J0IHsgTm9kZSB9IGZyb20gJy4uL2FzdC9Ob2RlLmpzJztcbmltcG9ydCB7IEFsaWFzIH0gZnJvbSAnLi4vYXN0L0FsaWFzLmpzJztcblxuZnVuY3Rpb24gYXNzZXJ0Q29sbGVjdGlvbihjb250ZW50cykge1xuICBpZiAoY29udGVudHMgaW5zdGFuY2VvZiBDb2xsZWN0aW9uKSByZXR1cm4gdHJ1ZTtcbiAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBhIFlBTUwgY29sbGVjdGlvbiBhcyBkb2N1bWVudCBjb250ZW50cycpO1xufVxuXG5jbGFzcyBEb2N1bWVudCB7XG4gIGNvbnN0cnVjdG9yKHZhbHVlLCByZXBsYWNlciwgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zID09PSB1bmRlZmluZWQgJiYgcmVwbGFjZXIgJiYgdHlwZW9mIHJlcGxhY2VyID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShyZXBsYWNlcikpIHtcbiAgICAgIG9wdGlvbnMgPSByZXBsYWNlcjtcbiAgICAgIHJlcGxhY2VyID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHRoaXMub3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRpb25zKTtcbiAgICB0aGlzLmFuY2hvcnMgPSBuZXcgQW5jaG9ycyh0aGlzLm9wdGlvbnMuYW5jaG9yUHJlZml4KTtcbiAgICB0aGlzLmNvbW1lbnRCZWZvcmUgPSBudWxsO1xuICAgIHRoaXMuY29tbWVudCA9IG51bGw7XG4gICAgdGhpcy5kaXJlY3RpdmVzRW5kTWFya2VyID0gbnVsbDtcbiAgICB0aGlzLmVycm9ycyA9IFtdO1xuICAgIHRoaXMuc2NoZW1hID0gbnVsbDtcbiAgICB0aGlzLnRhZ1ByZWZpeGVzID0gW107XG4gICAgdGhpcy52ZXJzaW9uID0gbnVsbDtcbiAgICB0aGlzLndhcm5pbmdzID0gW107XG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gbm90ZSB0aGF0IHRoaXMuc2NoZW1hIGlzIGxlZnQgYXMgbnVsbCBoZXJlXG4gICAgICB0aGlzLmNvbnRlbnRzID0gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgRG9jdW1lbnQkMSkge1xuICAgICAgdGhpcy5wYXJzZSh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY29udGVudHMgPSB0aGlzLmNyZWF0ZU5vZGUodmFsdWUsIHtcbiAgICAgICAgcmVwbGFjZXJcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGFkZCh2YWx1ZSkge1xuICAgIGFzc2VydENvbGxlY3Rpb24odGhpcy5jb250ZW50cyk7XG4gICAgcmV0dXJuIHRoaXMuY29udGVudHMuYWRkKHZhbHVlKTtcbiAgfVxuXG4gIGFkZEluKHBhdGgsIHZhbHVlKSB7XG4gICAgYXNzZXJ0Q29sbGVjdGlvbih0aGlzLmNvbnRlbnRzKTtcbiAgICB0aGlzLmNvbnRlbnRzLmFkZEluKHBhdGgsIHZhbHVlKTtcbiAgfVxuXG4gIGNyZWF0ZU5vZGUodmFsdWUsIHtcbiAgICBrZWVwVW5kZWZpbmVkLFxuICAgIG9uVGFnT2JqLFxuICAgIHJlcGxhY2VyLFxuICAgIHRhZyxcbiAgICB3cmFwU2NhbGFyc1xuICB9ID0ge30pIHtcbiAgICB0aGlzLnNldFNjaGVtYSgpO1xuICAgIGlmICh0eXBlb2YgcmVwbGFjZXIgPT09ICdmdW5jdGlvbicpIHZhbHVlID0gcmVwbGFjZXIuY2FsbCh7XG4gICAgICAnJzogdmFsdWVcbiAgICB9LCAnJywgdmFsdWUpO2Vsc2UgaWYgKEFycmF5LmlzQXJyYXkocmVwbGFjZXIpKSB7XG4gICAgICBjb25zdCBrZXlUb1N0ciA9IHYgPT4gdHlwZW9mIHYgPT09ICdudW1iZXInIHx8IHYgaW5zdGFuY2VvZiBTdHJpbmcgfHwgdiBpbnN0YW5jZW9mIE51bWJlcjtcblxuICAgICAgY29uc3QgYXNTdHIgPSByZXBsYWNlci5maWx0ZXIoa2V5VG9TdHIpLm1hcChTdHJpbmcpO1xuICAgICAgaWYgKGFzU3RyLmxlbmd0aCA+IDApIHJlcGxhY2VyID0gcmVwbGFjZXIuY29uY2F0KGFzU3RyKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBrZWVwVW5kZWZpbmVkICE9PSAnYm9vbGVhbicpIGtlZXBVbmRlZmluZWQgPSAhIXRoaXMub3B0aW9ucy5rZWVwVW5kZWZpbmVkO1xuICAgIGNvbnN0IGFsaWFzTm9kZXMgPSBbXTtcbiAgICBjb25zdCBjdHggPSB7XG4gICAgICBrZWVwVW5kZWZpbmVkLFxuXG4gICAgICBvbkFsaWFzKHNvdXJjZSkge1xuICAgICAgICBjb25zdCBhbGlhcyA9IG5ldyBBbGlhcyhzb3VyY2UpO1xuICAgICAgICBhbGlhc05vZGVzLnB1c2goYWxpYXMpO1xuICAgICAgICByZXR1cm4gYWxpYXM7XG4gICAgICB9LFxuXG4gICAgICBvblRhZ09iaixcbiAgICAgIHByZXZPYmplY3RzOiBuZXcgTWFwKCksXG4gICAgICByZXBsYWNlcixcbiAgICAgIHNjaGVtYTogdGhpcy5zY2hlbWEsXG4gICAgICB3cmFwU2NhbGFyczogd3JhcFNjYWxhcnMgIT09IGZhbHNlXG4gICAgfTtcbiAgICBjb25zdCBub2RlID0gY3JlYXRlTm9kZSh2YWx1ZSwgdGFnLCBjdHgpO1xuXG4gICAgZm9yIChjb25zdCBhbGlhcyBvZiBhbGlhc05vZGVzKSB7XG4gICAgICAvLyBXaXRoIGNpcmN1bGFyIHJlZmVyZW5jZXMsIHRoZSBzb3VyY2Ugbm9kZSBpcyBvbmx5IHJlc29sdmVkIGFmdGVyIGFsbCBvZlxuICAgICAgLy8gaXRzIGNoaWxkIG5vZGVzIGFyZS4gVGhpcyBpcyB3aHkgYW5jaG9ycyBhcmUgc2V0IG9ubHkgYWZ0ZXIgYWxsIG9mIHRoZVxuICAgICAgLy8gbm9kZXMgaGF2ZSBiZWVuIGNyZWF0ZWQuXG4gICAgICBhbGlhcy5zb3VyY2UgPSBhbGlhcy5zb3VyY2Uubm9kZTtcbiAgICAgIGxldCBuYW1lID0gdGhpcy5hbmNob3JzLmdldE5hbWUoYWxpYXMuc291cmNlKTtcblxuICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLmFuY2hvcnMubmV3TmFtZSgpO1xuICAgICAgICB0aGlzLmFuY2hvcnMubWFwW25hbWVdID0gYWxpYXMuc291cmNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgY3JlYXRlUGFpcihrZXksIHZhbHVlLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBrID0gdGhpcy5jcmVhdGVOb2RlKGtleSwgb3B0aW9ucyk7XG4gICAgY29uc3QgdiA9IHRoaXMuY3JlYXRlTm9kZSh2YWx1ZSwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIG5ldyBQYWlyKGssIHYpO1xuICB9XG5cbiAgZGVsZXRlKGtleSkge1xuICAgIGFzc2VydENvbGxlY3Rpb24odGhpcy5jb250ZW50cyk7XG4gICAgcmV0dXJuIHRoaXMuY29udGVudHMuZGVsZXRlKGtleSk7XG4gIH1cblxuICBkZWxldGVJbihwYXRoKSB7XG4gICAgaWYgKGlzRW1wdHlQYXRoKHBhdGgpKSB7XG4gICAgICBpZiAodGhpcy5jb250ZW50cyA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgICB0aGlzLmNvbnRlbnRzID0gbnVsbDtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGFzc2VydENvbGxlY3Rpb24odGhpcy5jb250ZW50cyk7XG4gICAgcmV0dXJuIHRoaXMuY29udGVudHMuZGVsZXRlSW4ocGF0aCk7XG4gIH1cblxuICBnZXREZWZhdWx0cygpIHtcbiAgICByZXR1cm4gRG9jdW1lbnQuZGVmYXVsdHNbdGhpcy52ZXJzaW9uXSB8fCBEb2N1bWVudC5kZWZhdWx0c1t0aGlzLm9wdGlvbnMudmVyc2lvbl0gfHwge307XG4gIH1cblxuICBnZXQoa2V5LCBrZWVwU2NhbGFyKSB7XG4gICAgcmV0dXJuIHRoaXMuY29udGVudHMgaW5zdGFuY2VvZiBDb2xsZWN0aW9uID8gdGhpcy5jb250ZW50cy5nZXQoa2V5LCBrZWVwU2NhbGFyKSA6IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGdldEluKHBhdGgsIGtlZXBTY2FsYXIpIHtcbiAgICBpZiAoaXNFbXB0eVBhdGgocGF0aCkpIHJldHVybiAha2VlcFNjYWxhciAmJiB0aGlzLmNvbnRlbnRzIGluc3RhbmNlb2YgU2NhbGFyID8gdGhpcy5jb250ZW50cy52YWx1ZSA6IHRoaXMuY29udGVudHM7XG4gICAgcmV0dXJuIHRoaXMuY29udGVudHMgaW5zdGFuY2VvZiBDb2xsZWN0aW9uID8gdGhpcy5jb250ZW50cy5nZXRJbihwYXRoLCBrZWVwU2NhbGFyKSA6IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGhhcyhrZXkpIHtcbiAgICByZXR1cm4gdGhpcy5jb250ZW50cyBpbnN0YW5jZW9mIENvbGxlY3Rpb24gPyB0aGlzLmNvbnRlbnRzLmhhcyhrZXkpIDogZmFsc2U7XG4gIH1cblxuICBoYXNJbihwYXRoKSB7XG4gICAgaWYgKGlzRW1wdHlQYXRoKHBhdGgpKSByZXR1cm4gdGhpcy5jb250ZW50cyAhPT0gdW5kZWZpbmVkO1xuICAgIHJldHVybiB0aGlzLmNvbnRlbnRzIGluc3RhbmNlb2YgQ29sbGVjdGlvbiA/IHRoaXMuY29udGVudHMuaGFzSW4ocGF0aCkgOiBmYWxzZTtcbiAgfVxuXG4gIHNldChrZXksIHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuY29udGVudHMgPT0gbnVsbCkge1xuICAgICAgdGhpcy5zZXRTY2hlbWEoKTtcbiAgICAgIHRoaXMuY29udGVudHMgPSBjb2xsZWN0aW9uRnJvbVBhdGgodGhpcy5zY2hlbWEsIFtrZXldLCB2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFzc2VydENvbGxlY3Rpb24odGhpcy5jb250ZW50cyk7XG4gICAgICB0aGlzLmNvbnRlbnRzLnNldChrZXksIHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBzZXRJbihwYXRoLCB2YWx1ZSkge1xuICAgIGlmIChpc0VtcHR5UGF0aChwYXRoKSkgdGhpcy5jb250ZW50cyA9IHZhbHVlO2Vsc2UgaWYgKHRoaXMuY29udGVudHMgPT0gbnVsbCkge1xuICAgICAgdGhpcy5zZXRTY2hlbWEoKTtcbiAgICAgIHRoaXMuY29udGVudHMgPSBjb2xsZWN0aW9uRnJvbVBhdGgodGhpcy5zY2hlbWEsIHBhdGgsIHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXNzZXJ0Q29sbGVjdGlvbih0aGlzLmNvbnRlbnRzKTtcbiAgICAgIHRoaXMuY29udGVudHMuc2V0SW4ocGF0aCwgdmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHNldFNjaGVtYShpZCwgY3VzdG9tVGFncykge1xuICAgIGlmICghaWQgJiYgIWN1c3RvbVRhZ3MgJiYgdGhpcy5zY2hlbWEpIHJldHVybjtcbiAgICBpZiAodHlwZW9mIGlkID09PSAnbnVtYmVyJykgaWQgPSBpZC50b0ZpeGVkKDEpO1xuXG4gICAgaWYgKGlkID09PSAnMS4wJyB8fCBpZCA9PT0gJzEuMScgfHwgaWQgPT09ICcxLjInKSB7XG4gICAgICBpZiAodGhpcy52ZXJzaW9uKSB0aGlzLnZlcnNpb24gPSBpZDtlbHNlIHRoaXMub3B0aW9ucy52ZXJzaW9uID0gaWQ7XG4gICAgICBkZWxldGUgdGhpcy5vcHRpb25zLnNjaGVtYTtcbiAgICB9IGVsc2UgaWYgKGlkICYmIHR5cGVvZiBpZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5zY2hlbWEgPSBpZDtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShjdXN0b21UYWdzKSkgdGhpcy5vcHRpb25zLmN1c3RvbVRhZ3MgPSBjdXN0b21UYWdzO1xuICAgIGNvbnN0IG9wdCA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZ2V0RGVmYXVsdHMoKSwgdGhpcy5vcHRpb25zKTtcbiAgICB0aGlzLnNjaGVtYSA9IG5ldyBTY2hlbWEob3B0KTtcbiAgfVxuXG4gIHBhcnNlKG5vZGUsIHByZXZEb2MpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmtlZXBDc3ROb2RlcykgdGhpcy5jc3ROb2RlID0gbm9kZTtcbiAgICBpZiAodGhpcy5vcHRpb25zLmtlZXBOb2RlVHlwZXMpIHRoaXMudHlwZSA9ICdET0NVTUVOVCc7XG4gICAgY29uc3Qge1xuICAgICAgZGlyZWN0aXZlcyA9IFtdLFxuICAgICAgY29udGVudHMgPSBbXSxcbiAgICAgIGRpcmVjdGl2ZXNFbmRNYXJrZXIsXG4gICAgICBlcnJvcixcbiAgICAgIHZhbHVlUmFuZ2VcbiAgICB9ID0gbm9kZTtcblxuICAgIGlmIChlcnJvcikge1xuICAgICAgaWYgKCFlcnJvci5zb3VyY2UpIGVycm9yLnNvdXJjZSA9IHRoaXM7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKGVycm9yKTtcbiAgICB9XG5cbiAgICBwYXJzZURpcmVjdGl2ZXModGhpcywgZGlyZWN0aXZlcywgcHJldkRvYyk7XG4gICAgaWYgKGRpcmVjdGl2ZXNFbmRNYXJrZXIpIHRoaXMuZGlyZWN0aXZlc0VuZE1hcmtlciA9IHRydWU7XG4gICAgdGhpcy5yYW5nZSA9IHZhbHVlUmFuZ2UgPyBbdmFsdWVSYW5nZS5zdGFydCwgdmFsdWVSYW5nZS5lbmRdIDogbnVsbDtcbiAgICB0aGlzLnNldFNjaGVtYSgpO1xuICAgIHRoaXMuYW5jaG9ycy5fY3N0QWxpYXNlcyA9IFtdO1xuICAgIHBhcnNlQ29udGVudHModGhpcywgY29udGVudHMpO1xuICAgIHRoaXMuYW5jaG9ycy5yZXNvbHZlTm9kZXMoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMucHJldHR5RXJyb3JzKSB7XG4gICAgICBmb3IgKGNvbnN0IGVycm9yIG9mIHRoaXMuZXJyb3JzKSBpZiAoZXJyb3IgaW5zdGFuY2VvZiBZQU1MRXJyb3IpIGVycm9yLm1ha2VQcmV0dHkoKTtcblxuICAgICAgZm9yIChjb25zdCB3YXJuIG9mIHRoaXMud2FybmluZ3MpIGlmICh3YXJuIGluc3RhbmNlb2YgWUFNTEVycm9yKSB3YXJuLm1ha2VQcmV0dHkoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3ROb25EZWZhdWx0VGFncygpIHtcbiAgICByZXR1cm4gbGlzdFRhZ05hbWVzKHRoaXMuY29udGVudHMpLmZpbHRlcih0ID0+IHQuaW5kZXhPZihkZWZhdWx0VGFnUHJlZml4KSAhPT0gMCk7XG4gIH1cblxuICBzZXRUYWdQcmVmaXgoaGFuZGxlLCBwcmVmaXgpIHtcbiAgICBpZiAoaGFuZGxlWzBdICE9PSAnIScgfHwgaGFuZGxlW2hhbmRsZS5sZW5ndGggLSAxXSAhPT0gJyEnKSB0aHJvdyBuZXcgRXJyb3IoJ0hhbmRsZSBtdXN0IHN0YXJ0IGFuZCBlbmQgd2l0aCAhJyk7XG5cbiAgICBpZiAocHJlZml4KSB7XG4gICAgICBjb25zdCBwcmV2ID0gdGhpcy50YWdQcmVmaXhlcy5maW5kKHAgPT4gcC5oYW5kbGUgPT09IGhhbmRsZSk7XG4gICAgICBpZiAocHJldikgcHJldi5wcmVmaXggPSBwcmVmaXg7ZWxzZSB0aGlzLnRhZ1ByZWZpeGVzLnB1c2goe1xuICAgICAgICBoYW5kbGUsXG4gICAgICAgIHByZWZpeFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudGFnUHJlZml4ZXMgPSB0aGlzLnRhZ1ByZWZpeGVzLmZpbHRlcihwID0+IHAuaGFuZGxlICE9PSBoYW5kbGUpO1xuICAgIH1cbiAgfVxuXG4gIHRvSlMoe1xuICAgIGpzb24sXG4gICAganNvbkFyZyxcbiAgICBtYXBBc01hcCxcbiAgICBvbkFuY2hvcixcbiAgICByZXZpdmVyXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGFuY2hvck5vZGVzID0gT2JqZWN0LnZhbHVlcyh0aGlzLmFuY2hvcnMubWFwKS5tYXAobm9kZSA9PiBbbm9kZSwge1xuICAgICAgYWxpYXM6IFtdLFxuICAgICAgYWxpYXNDb3VudDogMCxcbiAgICAgIGNvdW50OiAxXG4gICAgfV0pO1xuICAgIGNvbnN0IGFuY2hvcnMgPSBhbmNob3JOb2Rlcy5sZW5ndGggPiAwID8gbmV3IE1hcChhbmNob3JOb2RlcykgOiBudWxsO1xuICAgIGNvbnN0IGN0eCA9IHtcbiAgICAgIGFuY2hvcnMsXG4gICAgICBkb2M6IHRoaXMsXG4gICAgICBpbmRlbnRTdGVwOiAnICAnLFxuICAgICAga2VlcDogIWpzb24sXG4gICAgICBtYXBBc01hcDogdHlwZW9mIG1hcEFzTWFwID09PSAnYm9vbGVhbicgPyBtYXBBc01hcCA6ICEhdGhpcy5vcHRpb25zLm1hcEFzTWFwLFxuICAgICAgbWFwS2V5V2FybmVkOiBmYWxzZSxcbiAgICAgIG1heEFsaWFzQ291bnQ6IHRoaXMub3B0aW9ucy5tYXhBbGlhc0NvdW50LFxuICAgICAgc3RyaW5naWZ5IC8vIFJlcXVpcmluZyBkaXJlY3RseSBpbiBQYWlyIHdvdWxkIGNyZWF0ZSBjaXJjdWxhciBkZXBlbmRlbmNpZXNcblxuICAgIH07XG4gICAgY29uc3QgcmVzID0gdG9KUyh0aGlzLmNvbnRlbnRzLCBqc29uQXJnIHx8ICcnLCBjdHgpO1xuICAgIGlmICh0eXBlb2Ygb25BbmNob3IgPT09ICdmdW5jdGlvbicgJiYgYW5jaG9ycykgZm9yIChjb25zdCB7XG4gICAgICBjb3VudCxcbiAgICAgIHJlc1xuICAgIH0gb2YgYW5jaG9ycy52YWx1ZXMoKSkgb25BbmNob3IocmVzLCBjb3VudCk7XG4gICAgcmV0dXJuIHR5cGVvZiByZXZpdmVyID09PSAnZnVuY3Rpb24nID8gYXBwbHlSZXZpdmVyKHJldml2ZXIsIHtcbiAgICAgICcnOiByZXNcbiAgICB9LCAnJywgcmVzKSA6IHJlcztcbiAgfVxuXG4gIHRvSlNPTihqc29uQXJnLCBvbkFuY2hvcikge1xuICAgIHJldHVybiB0aGlzLnRvSlMoe1xuICAgICAganNvbjogdHJ1ZSxcbiAgICAgIGpzb25BcmcsXG4gICAgICBtYXBBc01hcDogZmFsc2UsXG4gICAgICBvbkFuY2hvclxuICAgIH0pO1xuICB9XG5cbiAgdG9TdHJpbmcoKSB7XG4gICAgaWYgKHRoaXMuZXJyb3JzLmxlbmd0aCA+IDApIHRocm93IG5ldyBFcnJvcignRG9jdW1lbnQgd2l0aCBlcnJvcnMgY2Fubm90IGJlIHN0cmluZ2lmaWVkJyk7XG4gICAgY29uc3QgaW5kZW50U2l6ZSA9IHRoaXMub3B0aW9ucy5pbmRlbnQ7XG5cbiAgICBpZiAoIU51bWJlci5pc0ludGVnZXIoaW5kZW50U2l6ZSkgfHwgaW5kZW50U2l6ZSA8PSAwKSB7XG4gICAgICBjb25zdCBzID0gSlNPTi5zdHJpbmdpZnkoaW5kZW50U2l6ZSk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJcXFwiaW5kZW50XFxcIiBvcHRpb24gbXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXIsIG5vdCBcIi5jb25jYXQocykpO1xuICAgIH1cblxuICAgIHRoaXMuc2V0U2NoZW1hKCk7XG4gICAgY29uc3QgbGluZXMgPSBbXTtcbiAgICBsZXQgaGFzRGlyZWN0aXZlcyA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMudmVyc2lvbikge1xuICAgICAgbGV0IHZkID0gJyVZQU1MIDEuMic7XG5cbiAgICAgIGlmICh0aGlzLnNjaGVtYS5uYW1lID09PSAneWFtbC0xLjEnKSB7XG4gICAgICAgIGlmICh0aGlzLnZlcnNpb24gPT09ICcxLjAnKSB2ZCA9ICclWUFNTDoxLjAnO2Vsc2UgaWYgKHRoaXMudmVyc2lvbiA9PT0gJzEuMScpIHZkID0gJyVZQU1MIDEuMSc7XG4gICAgICB9XG5cbiAgICAgIGxpbmVzLnB1c2godmQpO1xuICAgICAgaGFzRGlyZWN0aXZlcyA9IHRydWU7XG4gICAgfVxuXG4gICAgY29uc3QgdGFnTmFtZXMgPSB0aGlzLmxpc3ROb25EZWZhdWx0VGFncygpO1xuICAgIHRoaXMudGFnUHJlZml4ZXMuZm9yRWFjaCgoe1xuICAgICAgaGFuZGxlLFxuICAgICAgcHJlZml4XG4gICAgfSkgPT4ge1xuICAgICAgaWYgKHRhZ05hbWVzLnNvbWUodCA9PiB0LmluZGV4T2YocHJlZml4KSA9PT0gMCkpIHtcbiAgICAgICAgbGluZXMucHVzaChcIiVUQUcgXCIuY29uY2F0KGhhbmRsZSwgXCIgXCIpLmNvbmNhdChwcmVmaXgpKTtcbiAgICAgICAgaGFzRGlyZWN0aXZlcyA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGhhc0RpcmVjdGl2ZXMgfHwgdGhpcy5kaXJlY3RpdmVzRW5kTWFya2VyKSBsaW5lcy5wdXNoKCctLS0nKTtcblxuICAgIGlmICh0aGlzLmNvbW1lbnRCZWZvcmUpIHtcbiAgICAgIGlmIChoYXNEaXJlY3RpdmVzIHx8ICF0aGlzLmRpcmVjdGl2ZXNFbmRNYXJrZXIpIGxpbmVzLnVuc2hpZnQoJycpO1xuICAgICAgbGluZXMudW5zaGlmdCh0aGlzLmNvbW1lbnRCZWZvcmUucmVwbGFjZSgvXi9nbSwgJyMnKSk7XG4gICAgfVxuXG4gICAgY29uc3QgY3R4ID0ge1xuICAgICAgYW5jaG9yczogT2JqZWN0LmNyZWF0ZShudWxsKSxcbiAgICAgIGRvYzogdGhpcyxcbiAgICAgIGluZGVudDogJycsXG4gICAgICBpbmRlbnRTdGVwOiAnICcucmVwZWF0KGluZGVudFNpemUpLFxuICAgICAgc3RyaW5naWZ5IC8vIFJlcXVpcmluZyBkaXJlY3RseSBpbiBub2RlcyB3b3VsZCBjcmVhdGUgY2lyY3VsYXIgZGVwZW5kZW5jaWVzXG5cbiAgICB9O1xuICAgIGxldCBjaG9tcEtlZXAgPSBmYWxzZTtcbiAgICBsZXQgY29udGVudENvbW1lbnQgPSBudWxsO1xuXG4gICAgaWYgKHRoaXMuY29udGVudHMpIHtcbiAgICAgIGlmICh0aGlzLmNvbnRlbnRzIGluc3RhbmNlb2YgTm9kZSkge1xuICAgICAgICBpZiAodGhpcy5jb250ZW50cy5zcGFjZUJlZm9yZSAmJiAoaGFzRGlyZWN0aXZlcyB8fCB0aGlzLmRpcmVjdGl2ZXNFbmRNYXJrZXIpKSBsaW5lcy5wdXNoKCcnKTtcbiAgICAgICAgaWYgKHRoaXMuY29udGVudHMuY29tbWVudEJlZm9yZSkgbGluZXMucHVzaCh0aGlzLmNvbnRlbnRzLmNvbW1lbnRCZWZvcmUucmVwbGFjZSgvXi9nbSwgJyMnKSk7IC8vIHRvcC1sZXZlbCBibG9jayBzY2FsYXJzIG5lZWQgdG8gYmUgaW5kZW50ZWQgaWYgZm9sbG93ZWQgYnkgYSBjb21tZW50XG5cbiAgICAgICAgY3R4LmZvcmNlQmxvY2tJbmRlbnQgPSAhIXRoaXMuY29tbWVudDtcbiAgICAgICAgY29udGVudENvbW1lbnQgPSB0aGlzLmNvbnRlbnRzLmNvbW1lbnQ7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9uQ2hvbXBLZWVwID0gY29udGVudENvbW1lbnQgPyBudWxsIDogKCkgPT4gY2hvbXBLZWVwID0gdHJ1ZTtcbiAgICAgIGNvbnN0IGJvZHkgPSBzdHJpbmdpZnkodGhpcy5jb250ZW50cywgY3R4LCAoKSA9PiBjb250ZW50Q29tbWVudCA9IG51bGwsIG9uQ2hvbXBLZWVwKTtcbiAgICAgIGxpbmVzLnB1c2goYWRkQ29tbWVudChib2R5LCAnJywgY29udGVudENvbW1lbnQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGluZXMucHVzaChzdHJpbmdpZnkodGhpcy5jb250ZW50cywgY3R4KSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY29tbWVudCkge1xuICAgICAgaWYgKCghY2hvbXBLZWVwIHx8IGNvbnRlbnRDb21tZW50KSAmJiBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXSAhPT0gJycpIGxpbmVzLnB1c2goJycpO1xuICAgICAgbGluZXMucHVzaCh0aGlzLmNvbW1lbnQucmVwbGFjZSgvXi9nbSwgJyMnKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpICsgJ1xcbic7XG4gIH1cblxufVxuXG5fZGVmaW5lUHJvcGVydHkoRG9jdW1lbnQsIFwiZGVmYXVsdHNcIiwgZG9jdW1lbnRPcHRpb25zKTtcblxuZXhwb3J0IHsgRG9jdW1lbnQgfTtcbiIsImltcG9ydCB7IExvZ0xldmVsIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2UkMSB9IGZyb20gJy4vY3N0L3BhcnNlLmpzJztcbmV4cG9ydCB7IHBhcnNlIGFzIHBhcnNlQ1NUIH0gZnJvbSAnLi9jc3QvcGFyc2UuanMnO1xuaW1wb3J0IHsgRG9jdW1lbnQgfSBmcm9tICcuL2RvYy9Eb2N1bWVudC5qcyc7XG5leHBvcnQgeyBEb2N1bWVudCB9IGZyb20gJy4vZG9jL0RvY3VtZW50LmpzJztcbmltcG9ydCB7IFlBTUxTZW1hbnRpY0Vycm9yIH0gZnJvbSAnLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgd2FybiB9IGZyb20gJy4vbG9nLmpzJztcbmV4cG9ydCB7IGRlZmF1bHRPcHRpb25zLCBzY2FsYXJPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zLmpzJztcbmV4cG9ydCB7IHZpc2l0IH0gZnJvbSAnLi92aXNpdC5qcyc7XG5cbmZ1bmN0aW9uIHBhcnNlQWxsRG9jdW1lbnRzKHNyYywgb3B0aW9ucykge1xuICBjb25zdCBzdHJlYW0gPSBbXTtcbiAgbGV0IHByZXY7XG5cbiAgZm9yIChjb25zdCBjc3REb2Mgb2YgcGFyc2UkMShzcmMpKSB7XG4gICAgY29uc3QgZG9jID0gbmV3IERvY3VtZW50KHVuZGVmaW5lZCwgbnVsbCwgb3B0aW9ucyk7XG4gICAgZG9jLnBhcnNlKGNzdERvYywgcHJldik7XG4gICAgc3RyZWFtLnB1c2goZG9jKTtcbiAgICBwcmV2ID0gZG9jO1xuICB9XG5cbiAgcmV0dXJuIHN0cmVhbTtcbn1cbmZ1bmN0aW9uIHBhcnNlRG9jdW1lbnQoc3JjLCBvcHRpb25zKSB7XG4gIGNvbnN0IGNzdCA9IHBhcnNlJDEoc3JjKTtcbiAgY29uc3QgZG9jID0gbmV3IERvY3VtZW50KGNzdFswXSwgbnVsbCwgb3B0aW9ucyk7XG5cbiAgaWYgKGNzdC5sZW5ndGggPiAxICYmIExvZ0xldmVsLmluZGV4T2YoZG9jLm9wdGlvbnMubG9nTGV2ZWwpID49IExvZ0xldmVsLkVSUk9SKSB7XG4gICAgY29uc3QgZXJyTXNnID0gJ1NvdXJjZSBjb250YWlucyBtdWx0aXBsZSBkb2N1bWVudHM7IHBsZWFzZSB1c2UgWUFNTC5wYXJzZUFsbERvY3VtZW50cygpJztcbiAgICBkb2MuZXJyb3JzLnVuc2hpZnQobmV3IFlBTUxTZW1hbnRpY0Vycm9yKGNzdFsxXSwgZXJyTXNnKSk7XG4gIH1cblxuICByZXR1cm4gZG9jO1xufVxuZnVuY3Rpb24gcGFyc2Uoc3JjLCByZXZpdmVyLCBvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zID09PSB1bmRlZmluZWQgJiYgcmV2aXZlciAmJiB0eXBlb2YgcmV2aXZlciA9PT0gJ29iamVjdCcpIHtcbiAgICBvcHRpb25zID0gcmV2aXZlcjtcbiAgICByZXZpdmVyID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgY29uc3QgZG9jID0gcGFyc2VEb2N1bWVudChzcmMsIG9wdGlvbnMpO1xuICBkb2Mud2FybmluZ3MuZm9yRWFjaCh3YXJuaW5nID0+IHdhcm4oZG9jLm9wdGlvbnMubG9nTGV2ZWwsIHdhcm5pbmcpKTtcblxuICBpZiAoZG9jLmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgaWYgKExvZ0xldmVsLmluZGV4T2YoZG9jLm9wdGlvbnMubG9nTGV2ZWwpID49IExvZ0xldmVsLkVSUk9SKSB0aHJvdyBkb2MuZXJyb3JzWzBdO2Vsc2UgZG9jLmVycm9ycyA9IFtdO1xuICB9XG5cbiAgcmV0dXJuIGRvYy50b0pTKHtcbiAgICByZXZpdmVyXG4gIH0pO1xufVxuZnVuY3Rpb24gc3RyaW5naWZ5KHZhbHVlLCByZXBsYWNlciwgb3B0aW9ucykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnKSBvcHRpb25zID0gb3B0aW9ucy5sZW5ndGg7XG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnbnVtYmVyJykge1xuICAgIGNvbnN0IGluZGVudCA9IE1hdGgucm91bmQob3B0aW9ucyk7XG4gICAgb3B0aW9ucyA9IGluZGVudCA8IDEgPyB1bmRlZmluZWQgOiBpbmRlbnQgPiA4ID8ge1xuICAgICAgaW5kZW50OiA4XG4gICAgfSA6IHtcbiAgICAgIGluZGVudFxuICAgIH07XG4gIH1cblxuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IHtcbiAgICAgIGtlZXBVbmRlZmluZWRcbiAgICB9ID0gb3B0aW9ucyB8fCByZXBsYWNlciB8fCB7fTtcbiAgICBpZiAoIWtlZXBVbmRlZmluZWQpIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICByZXR1cm4gbmV3IERvY3VtZW50KHZhbHVlLCByZXBsYWNlciwgb3B0aW9ucykudG9TdHJpbmcoKTtcbn1cblxuZXhwb3J0IHsgcGFyc2UsIHBhcnNlQWxsRG9jdW1lbnRzLCBwYXJzZURvY3VtZW50LCBzdHJpbmdpZnkgfTtcbiIsImltcG9ydCB7IE5vdGljZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgcGFyc2VEb2N1bWVudCB9IGZyb20gXCJ5YW1sXCI7XG5pbXBvcnQgeyBSZXBsYWNlbWVudCB9IGZyb20gXCIuL1RhZ1wiO1xuXG5leHBvcnQgY2xhc3MgRmlsZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihhcHAsIGZpbGVuYW1lLCB0YWdQb3NpdGlvbnMsIGhhc0Zyb250TWF0dGVyKSB7XG4gICAgICAgIHRoaXMuYXBwID0gYXBwO1xuICAgICAgICB0aGlzLmZpbGVuYW1lID0gZmlsZW5hbWU7XG4gICAgICAgIHRoaXMuYmFzZW5hbWUgPSBmaWxlbmFtZS5zcGxpdChcIi9cIikucG9wKCk7XG4gICAgICAgIHRoaXMudGFnUG9zaXRpb25zID0gdGFnUG9zaXRpb25zO1xuICAgICAgICB0aGlzLmhhc0Zyb250TWF0dGVyID0gISFoYXNGcm9udE1hdHRlcjtcbiAgICB9XG5cbiAgICAvKiogQHBhcmFtIHtSZXBsYWNlbWVudH0gcmVwbGFjZSAqL1xuICAgIGFzeW5jIHJlbmFtZWQocmVwbGFjZSkge1xuICAgICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHRoaXMuZmlsZW5hbWUpO1xuICAgICAgICBjb25zdCBvcmlnaW5hbCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgIGxldCB0ZXh0ID0gb3JpZ2luYWw7XG5cbiAgICAgICAgZm9yIChjb25zdCB7IHBvc2l0aW9uOiB7IHN0YXJ0LCBlbmQgfSwgdGFnIH0gb2YgdGhpcy50YWdQb3NpdGlvbnMpIHtcbiAgICAgICAgICAgIGlmICh0ZXh0LnNsaWNlKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkgIT09IHRhZykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1zZyA9IGBGaWxlICR7dGhpcy5maWxlbmFtZX0gaGFzIGNoYW5nZWQ7IHNraXBwaW5nYDtcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKG1zZyk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihtc2cpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZGVidWcodGV4dC5zbGljZShzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpLCB0YWcpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRleHQgPSByZXBsYWNlLmluU3RyaW5nKHRleHQsIHN0YXJ0Lm9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5oYXNGcm9udE1hdHRlcilcbiAgICAgICAgICAgIHRleHQgPSB0aGlzLnJlcGxhY2VJbkZyb250TWF0dGVyKHRleHQsIHJlcGxhY2UpO1xuXG4gICAgICAgIGlmICh0ZXh0ICE9PSBvcmlnaW5hbCkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KGZpbGUsIHRleHQpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHBhcmFtIHtSZXBsYWNlbWVudH0gcmVwbGFjZSAqL1xuICAgIHJlcGxhY2VJbkZyb250TWF0dGVyKHRleHQsIHJlcGxhY2UpIHtcbiAgICAgICAgY29uc3QgW2VtcHR5LCBmcm9udE1hdHRlcl0gPSB0ZXh0LnNwbGl0KC9eLS0tXFxyPyRcXG4/L20sIDIpO1xuXG4gICAgICAgIC8vIENoZWNrIGZvciB2YWxpZCwgbm9uLWVtcHR5LCBwcm9wZXJseSB0ZXJtaW5hdGVkIGZyb250IG1hdHRlclxuICAgICAgICBpZiAoZW1wdHkgIT09IFwiXCIgfHwgIWZyb250TWF0dGVyLnRyaW0oKSB8fCAhZnJvbnRNYXR0ZXIuZW5kc1dpdGgoXCJcXG5cIikpXG4gICAgICAgICAgICByZXR1cm4gdGV4dDtcblxuICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZURvY3VtZW50KGZyb250TWF0dGVyKTtcbiAgICAgICAgaWYgKHBhcnNlZC5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zdCBlcnJvciA9IGBZQU1MIGlzc3VlIHdpdGggJHt0aGlzLmZpbGVuYW1lfTogJHtwYXJzZWQuZXJyb3JzWzBdfWA7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTsgbmV3IE5vdGljZShlcnJvciArIFwiOyBza2lwcGluZyBmcm9udG1hdHRlclwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gICAgICAgIGZvciAoY29uc3Qge2tleToge3ZhbHVlOnByb3B9fSBvZiBwYXJzZWQuY29udGVudHMuaXRlbXMpIHtcbiAgICAgICAgICAgIGlmICghL150YWdzPyQvaS50ZXN0KHByb3ApKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBwYXJzZWQuZ2V0KHByb3AsIHRydWUpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IGZpZWxkID0gbm9kZS50b0pTT04oKTtcbiAgICAgICAgICAgIGlmICghZmllbGQgfHwgIWZpZWxkLmxlbmd0aCkgY29udGludWU7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGZpZWxkID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSBmaWVsZC5zcGxpdCgvKFxccyosXFxzKnxeXFxzK3xcXHMrJCkvKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhZnRlciA9IHJlcGxhY2UuaW5BcnJheShwYXJ0cywgdHJ1ZSkuam9pbihcIlwiKTtcbiAgICAgICAgICAgICAgICBpZiAoZmllbGQgIT0gYWZ0ZXIpIHsgcGFyc2VkLnNldChwcm9wLCBhZnRlcik7IGNoYW5nZWQgPSB0cnVlOyB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZmllbGQpKSB7XG4gICAgICAgICAgICAgICAgcmVwbGFjZS5pbkFycmF5KGZpZWxkKS5mb3JFYWNoKCh2LCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZFtpXSAhPT0gdilcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGUuc2V0KGksIHYpOyBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hhbmdlZCA/IHRleHQucmVwbGFjZShmcm9udE1hdHRlciwgcGFyc2VkLnRvU3RyaW5nKCkpIDogdGV4dDtcbiAgICB9XG59XG4iLCJpbXBvcnQge2NvbmZpcm19IGZyb20gXCJzbWFsbHRhbGtcIjtcbmltcG9ydCB7UHJvZ3Jlc3N9IGZyb20gXCIuL3Byb2dyZXNzXCI7XG5pbXBvcnQge3ZhbGlkYXRlZElucHV0fSBmcm9tIFwiLi92YWxpZGF0aW9uXCI7XG5pbXBvcnQge05vdGljZSwgcGFyc2VGcm9udE1hdHRlclRhZ3N9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHtUYWcsIFJlcGxhY2VtZW50fSBmcm9tIFwiLi9UYWdcIjtcbmltcG9ydCB7RmlsZX0gZnJvbSBcIi4vRmlsZVwiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVuYW1lVGFnKGFwcCwgdGFnTmFtZSkge1xuICAgIGNvbnN0IG5ld05hbWUgPSBhd2FpdCBwcm9tcHRGb3JOZXdOYW1lKHRhZ05hbWUpO1xuICAgIGlmIChuZXdOYW1lID09PSBmYWxzZSkgcmV0dXJuOyAgLy8gYWJvcnRlZFxuXG4gICAgaWYgKCFuZXdOYW1lIHx8IG5ld05hbWUgPT09IHRhZ05hbWUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBOb3RpY2UoXCJVbmNoYW5nZWQgb3IgZW1wdHkgdGFnOiBObyBjaGFuZ2VzIG1hZGUuXCIpO1xuICAgIH1cblxuICAgIGNvbnN0XG4gICAgICAgIG9sZFRhZyAgPSBuZXcgVGFnKHRhZ05hbWUpLFxuICAgICAgICBuZXdUYWcgID0gbmV3IFRhZyhuZXdOYW1lKSxcbiAgICAgICAgcmVwbGFjZSA9IG5ldyBSZXBsYWNlbWVudChvbGRUYWcsIG5ld1RhZyksXG4gICAgICAgIGNsYXNoaW5nID0gcmVwbGFjZS53aWxsTWVyZ2VUYWdzKFxuICAgICAgICAgICAgYWxsVGFncyhhcHApLnJldmVyc2UoKSAgIC8vIGZpbmQgbG9uZ2VzdCBjbGFzaCBmaXJzdFxuICAgICAgICApLFxuICAgICAgICBzaG91bGRBYm9ydCA9IGNsYXNoaW5nICYmXG4gICAgICAgICAgICBhd2FpdCBzaG91bGRBYm9ydER1ZVRvQ2xhc2goY2xhc2hpbmcsIG9sZFRhZywgbmV3VGFnKVxuICAgICAgICA7XG5cbiAgICBpZiAoc2hvdWxkQWJvcnQpIHJldHVybjtcblxuICAgIGNvbnN0IHRhcmdldHMgPSBhd2FpdCBmaW5kVGFyZ2V0cyhhcHAsIG9sZFRhZyk7XG4gICAgaWYgKCF0YXJnZXRzKSByZXR1cm47XG5cbiAgICBjb25zdCBwcm9ncmVzcyA9IG5ldyBQcm9ncmVzcyhgUmVuYW1pbmcgdG8gIyR7bmV3TmFtZX0vKmAsIFwiUHJvY2Vzc2luZyBmaWxlcy4uLlwiKTtcbiAgICBsZXQgcmVuYW1lZCA9IDA7XG4gICAgYXdhaXQgcHJvZ3Jlc3MuZm9yRWFjaCh0YXJnZXRzLCBhc3luYyAodGFyZ2V0KSA9PiB7XG4gICAgICAgIHByb2dyZXNzLm1lc3NhZ2UgPSBcIlByb2Nlc3NpbmcgXCIgKyB0YXJnZXQuYmFzZW5hbWU7XG4gICAgICAgIGlmIChhd2FpdCB0YXJnZXQucmVuYW1lZChyZXBsYWNlKSkgcmVuYW1lZCsrO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBOb3RpY2UoYE9wZXJhdGlvbiAke3Byb2dyZXNzLmFib3J0ZWQgPyBcImNhbmNlbGxlZFwiIDogXCJjb21wbGV0ZVwifTogJHtyZW5hbWVkfSBmaWxlKHMpIHVwZGF0ZWRgKTtcbn1cblxuZnVuY3Rpb24gYWxsVGFncyhhcHApIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0VGFncygpKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbmRUYXJnZXRzKGFwcCwgdGFnKSB7XG4gICAgY29uc3QgdGFyZ2V0cyA9IFtdO1xuICAgIGNvbnN0IHByb2dyZXNzID0gbmV3IFByb2dyZXNzKGBTZWFyY2hpbmcgZm9yICR7dGFnfS8qYCwgXCJNYXRjaGluZyBmaWxlcy4uLlwiKTtcbiAgICBhd2FpdCBwcm9ncmVzcy5mb3JFYWNoKFxuICAgICAgICBhcHAubWV0YWRhdGFDYWNoZS5nZXRDYWNoZWRGaWxlcygpLFxuICAgICAgICBmaWxlbmFtZSA9PiB7XG4gICAgICAgICAgICBsZXQgeyBmcm9udG1hdHRlciwgdGFncyB9ID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Q2FjaGUoZmlsZW5hbWUpIHx8IHt9O1xuICAgICAgICAgICAgdGFncyA9ICh0YWdzIHx8IFtdKS5maWx0ZXIodCA9PiB0LnRhZyAmJiB0YWcubWF0Y2hlcyh0LnRhZykpLnJldmVyc2UoKTsgLy8gbGFzdCBwb3NpdGlvbnMgZmlyc3RcbiAgICAgICAgICAgIGNvbnN0IGZtdGFncyA9IChwYXJzZUZyb250TWF0dGVyVGFncyhmcm9udG1hdHRlcikgfHwgW10pLmZpbHRlcih0YWcubWF0Y2hlcyk7XG4gICAgICAgICAgICBpZiAodGFncy5sZW5ndGggfHwgZm10YWdzLmxlbmd0aClcbiAgICAgICAgICAgICAgICB0YXJnZXRzLnB1c2gobmV3IEZpbGUoYXBwLCBmaWxlbmFtZSwgdGFncywgZm10YWdzLmxlbmd0aCkpO1xuICAgICAgICB9XG4gICAgKTtcbiAgICBpZiAoIXByb2dyZXNzLmFib3J0ZWQpXG4gICAgICAgIHJldHVybiB0YXJnZXRzO1xufVxuXG5hc3luYyBmdW5jdGlvbiBwcm9tcHRGb3JOZXdOYW1lKHRhZ05hbWUpIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gYXdhaXQgdmFsaWRhdGVkSW5wdXQoXG4gICAgICAgICAgICBgUmVuYW1pbmcgIyR7dGFnTmFtZX0gKGFuZCBhbnkgc3ViLXRhZ3MpYCwgXCJFbnRlciBuZXcgbmFtZSAobXVzdCBiZSBhIHZhbGlkIE9ic2lkaWFuIHRhZyk6XFxuXCIsXG4gICAgICAgICAgICB0YWdOYW1lLFxuICAgICAgICAgICAgXCJbXlxcdTIwMDAtXFx1MjA2RlxcdTJFMDAtXFx1MkU3RichXFxcIiMkJSYoKSorLC46Ozw9Pj9AXmB7fH1+XFxcXFtcXFxcXVxcXFxcXFxcXFxcXHNdK1wiLFxuICAgICAgICAgICAgXCJPYnNpZGlhbiB0YWcgbmFtZVwiXG4gICAgICAgICk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTsgIC8vIHVzZXIgY2FuY2VsbGVkXG4gICAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzaG91bGRBYm9ydER1ZVRvQ2xhc2goW29yaWdpbiwgY2xhc2hdLCBvbGRUYWcsIG5ld1RhZykge1xuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGNvbmZpcm0oXG4gICAgICAgICAgICBcIldBUk5JTkc6IE5vIFVuZG8hXCIsXG4gICAgICAgICAgICBgUmVuYW1pbmcgPGNvZGU+JHtvbGRUYWd9PC9jb2RlPiB0byA8Y29kZT4ke25ld1RhZ308L2NvZGU+IHdpbGwgbWVyZ2UgJHtcbiAgICAgICAgICAgICAgICAob3JpZ2luLmNhbm9uaWNhbCA9PT0gb2xkVGFnLmNhbm9uaWNhbCkgP1xuICAgICAgICAgICAgICAgICAgICBgdGhlc2UgdGFnc2AgOiBgbXVsdGlwbGUgdGFnc1xuICAgICAgICAgICAgICAgICAgICBpbnRvIGV4aXN0aW5nIHRhZ3MgKHN1Y2ggYXMgPGNvZGU+JHtvcmlnaW59PC9jb2RlPlxuICAgICAgICAgICAgICAgICAgICBtZXJnaW5nIHdpdGggPGNvZGU+JHtjbGFzaH08L2NvZGU+KWBcbiAgICAgICAgICAgIH0uXG5cbiAgICAgICAgICAgIFRoaXMgPGI+Y2Fubm90PC9iPiBiZSB1bmRvbmUuICBEbyB5b3Ugd2lzaCB0byBwcm9jZWVkP2BcbiAgICAgICAgKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxufVxuIiwiaW1wb3J0IHtNZW51LCBOb3RpY2UsIFBsdWdpbiwgU2NvcGV9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHtyZW5hbWVUYWcsIGZpbmRUYXJnZXRzfSBmcm9tIFwiLi9yZW5hbWluZ1wiO1xuaW1wb3J0IHtUYWd9IGZyb20gXCIuL1RhZ1wiO1xuXG5mdW5jdGlvbiBvbkVsZW1lbnQoZWwsIGV2ZW50LCBzZWxlY3RvciwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBlbC5vbihldmVudCwgc2VsZWN0b3IsIGNhbGxiYWNrLCBvcHRpb25zKVxuICAgIHJldHVybiAoKSA9PiBlbC5vZmYoZXZlbnQsIHNlbGVjdG9yLCBjYWxsYmFjaywgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRhZ1dyYW5nbGVyIGV4dGVuZHMgUGx1Z2luIHtcbiAgICBvbmxvYWQoKXtcbiAgICAgICAgdGhpcy5yZWdpc3RlcihcbiAgICAgICAgICAgIG9uRWxlbWVudChkb2N1bWVudCwgXCJjb250ZXh0bWVudVwiLCBcIi50YWctcGFuZS10YWdcIiwgdGhpcy5vbk1lbnUuYmluZCh0aGlzKSwge2NhcHR1cmU6IHRydWV9KVxuICAgICAgICApO1xuICAgIH1cblxuICAgIG9uTWVudShlLCB0YWdFbCkge1xuICAgICAgICBpZiAoIWUub2JzaWRpYW5fY29udGV4dG1lbnUpIHtcbiAgICAgICAgICAgIGUub2JzaWRpYW5fY29udGV4dG1lbnUgPSBuZXcgTWVudSh0aGlzLmFwcCk7XG4gICAgICAgICAgICBzZXRJbW1lZGlhdGUoKCkgPT4gbWVudS5zaG93QXRQb3NpdGlvbih7eDogZS5wYWdlWCwgeTogZS5wYWdlWX0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0XG4gICAgICAgICAgICB0YWdOYW1lID0gdGFnRWwuZmluZChcIi50YWctcGFuZS10YWctdGV4dFwiKS50ZXh0Q29udGVudCxcbiAgICAgICAgICAgIGlzSGllcmFyY2h5ID0gdGFnRWwucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50LmZpbmQoXCIuY29sbGFwc2UtaWNvblwiKSxcbiAgICAgICAgICAgIHNlYXJjaFBsdWdpbiA9IHRoaXMuYXBwLmludGVybmFsUGx1Z2lucy5nZXRQbHVnaW5CeUlkKFwiZ2xvYmFsLXNlYXJjaFwiKSxcbiAgICAgICAgICAgIHNlYXJjaCA9IHNlYXJjaFBsdWdpbiAmJiBzZWFyY2hQbHVnaW4uaW5zdGFuY2UsXG4gICAgICAgICAgICBxdWVyeSA9IHNlYXJjaCAmJiBzZWFyY2guZ2V0R2xvYmFsU2VhcmNoUXVlcnkoKSxcbiAgICAgICAgICAgIHJhbmRvbSA9IHRoaXMuYXBwLnBsdWdpbnMucGx1Z2luc1tcInNtYXJ0LXJhbmRvbS1ub3RlXCJdLFxuICAgICAgICAgICAgbWVudSA9IGUub2JzaWRpYW5fY29udGV4dG1lbnUuYWRkSXRlbShpdGVtKFwicGVuY2lsXCIsIFwiUmVuYW1lICNcIit0YWdOYW1lLCAoKSA9PiB0aGlzLnJlbmFtZSh0YWdOYW1lKSkpO1xuXG4gICAgICAgIG1lbnUucmVnaXN0ZXIoXG4gICAgICAgICAgICBvbkVsZW1lbnQoZG9jdW1lbnQsIFwia2V5ZG93blwiLCBcIipcIiwgZSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGUua2V5PT09XCJFc2NhcGVcIikge1xuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIG1lbnUuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIHtjYXB0dXJlOiB0cnVlfSlcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoc2VhcmNoKSB7XG4gICAgICAgICAgICBtZW51LmFkZFNlcGFyYXRvcigpLmFkZEl0ZW0oXG4gICAgICAgICAgICAgICAgaXRlbShcIm1hZ25pZnlpbmctZ2xhc3NcIiwgXCJOZXcgc2VhcmNoIGZvciAjXCIrdGFnTmFtZSwgKCkgPT4gc2VhcmNoLm9wZW5HbG9iYWxTZWFyY2goXCJ0YWc6XCIgKyB0YWdOYW1lKSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgICAgICAgICBtZW51LmFkZEl0ZW0oXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0oXCJzaGVldHMtaW4tYm94XCIsIFwiUmVxdWlyZSAjXCIrdGFnTmFtZStcIiBpbiBzZWFyY2hcIiAgLCAoKSA9PiBzZWFyY2gub3Blbkdsb2JhbFNlYXJjaChxdWVyeStcIiB0YWc6XCIgICsgdGFnTmFtZSkpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1lbnUuYWRkSXRlbShcbiAgICAgICAgICAgICAgICBpdGVtKFwiY3Jvc3NlZC1zdGFyXCIgLCBcIkV4Y2x1ZGUgI1wiK3RhZ05hbWUrXCIgZnJvbSBzZWFyY2hcIiwgKCkgPT4gc2VhcmNoLm9wZW5HbG9iYWxTZWFyY2gocXVlcnkrXCIgLXRhZzpcIiArIHRhZ05hbWUpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyYW5kb20pIHtcbiAgICAgICAgICAgIG1lbnUuYWRkU2VwYXJhdG9yKCkuYWRkSXRlbShcbiAgICAgICAgICAgICAgICBpdGVtKFwiZGljZVwiLCBcIk9wZW4gcmFuZG9tIG5vdGVcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRzID0gYXdhaXQgZmluZFRhcmdldHModGhpcy5hcHAsIG5ldyBUYWcodGFnTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICByYW5kb20ub3BlblJhbmRvbU5vdGUodGFyZ2V0cy5tYXAoZj0+Zi5maWxlbmFtZSkpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnRyaWdnZXIoXCJ0YWctd3JhbmdsZXI6Y29udGV4dG1lbnVcIiwgbWVudSwgdGFnTmFtZSwge3NlYXJjaCwgcXVlcnksIGlzSGllcmFyY2h5fSk7XG5cbiAgICAgICAgaWYgKGlzSGllcmFyY2h5KSB7XG4gICAgICAgICAgICBjb25zdFxuICAgICAgICAgICAgICAgIHRhZ1BhcmVudCA9IHRhZ05hbWUuc3BsaXQoXCIvXCIpLnNsaWNlKDAsIC0xKS5qb2luKFwiL1wiKSxcbiAgICAgICAgICAgICAgICB0YWdWaWV3ID0gdGhpcy5sZWFmVmlldyh0YWdFbC5tYXRjaFBhcmVudChcIi53b3Jrc3BhY2UtbGVhZlwiKSksXG4gICAgICAgICAgICAgICAgdGFnQ29udGFpbmVyID0gdGFnUGFyZW50ID8gdGFnVmlldy50YWdEb21zW1wiI1wiICsgdGFnUGFyZW50LnRvTG93ZXJDYXNlKCldOiB0YWdWaWV3LnJvb3RcbiAgICAgICAgICAgIDtcbiAgICAgICAgICAgIGZ1bmN0aW9uIHRvZ2dsZShjb2xsYXBzZSkge1xuICAgICAgICAgICAgICAgIGZvcihjb25zdCB0YWcgb2YgdGFnQ29udGFpbmVyLmNoaWxkcmVuKSB0YWcuc2V0Q29sbGFwc2VkKGNvbGxhcHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1lbnUuYWRkU2VwYXJhdG9yKClcbiAgICAgICAgICAgIC5hZGRJdGVtKGl0ZW0oXCJ2ZXJ0aWNhbC10aHJlZS1kb3RzXCIsIFwiQ29sbGFwc2UgdGFncyBhdCB0aGlzIGxldmVsXCIsICgpID0+IHRvZ2dsZSh0cnVlICkpKVxuICAgICAgICAgICAgLmFkZEl0ZW0oaXRlbShcImV4cGFuZC12ZXJ0aWNhbGx5XCIgICwgXCJFeHBhbmQgdGFncyBhdCB0aGlzIGxldmVsXCIgICwgKCkgPT4gdG9nZ2xlKGZhbHNlKSkpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsZWFmVmlldyhjb250YWluZXJFbCkge1xuICAgICAgICBsZXQgdmlldztcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLml0ZXJhdGVBbGxMZWF2ZXMoKGxlYWYpID0+IHtcbiAgICAgICAgICAgIGlmIChsZWFmLmNvbnRhaW5lckVsID09PSBjb250YWluZXJFbCkgeyB2aWV3ID0gbGVhZi52aWV3OyByZXR1cm4gdHJ1ZTsgfVxuICAgICAgICB9KVxuICAgICAgICByZXR1cm4gdmlldztcbiAgICB9XG5cblxuICAgIGFzeW5jIHJlbmFtZSh0YWdOYW1lKSB7XG4gICAgICAgIGNvbnN0IHNjb3BlID0gbmV3IFNjb3BlO1xuICAgICAgICB0aGlzLmFwcC5rZXltYXAucHVzaFNjb3BlKHNjb3BlKTtcbiAgICAgICAgdHJ5IHsgYXdhaXQgcmVuYW1lVGFnKHRoaXMuYXBwLCB0YWdOYW1lKTsgfVxuICAgICAgICBjYXRjaCAoZSkgeyBjb25zb2xlLmVycm9yKGUpOyBuZXcgTm90aWNlKFwiZXJyb3I6IFwiICsgZSk7IH1cbiAgICAgICAgdGhpcy5hcHAua2V5bWFwLnBvcFNjb3BlKHNjb3BlKTtcbiAgICB9XG5cbn1cblxuZnVuY3Rpb24gaXRlbShpY29uLCB0aXRsZSwgY2xpY2spIHtcbiAgICByZXR1cm4gaSA9PiBpLnNldEljb24oaWNvbikuc2V0VGl0bGUodGl0bGUpLm9uQ2xpY2soY2xpY2spO1xufVxuXG4iXSwibmFtZXMiOlsiY3VycmlmeSIsInN0b3JlIiwicXVlcnkiLCJOb3RpY2UiLCJOb2RlIiwiQ29sbGVjdGlvbiIsIkFsaWFzIiwiaW50SWRlbnRpZnkiLCJzZXQiLCJpbnRSZXNvbHZlIiwiaW50U3RyaW5naWZ5IiwiRG9jdW1lbnQiLCJEb2N1bWVudCQxIiwicGFyc2UkMSIsInBhcnNlRnJvbnRNYXR0ZXJUYWdzIiwiUGx1Z2luIiwiTWVudSIsIlNjb3BlIl0sIm1hcHBpbmdzIjoiOzs7O0FBRUEsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEtBQUs7QUFDbEI7QUFDQSxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQzNDLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQzlDLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUNqRCxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQ3BELElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFF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QUFDO0FBQ3JDLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUNkLEdBQUcsTUFBTTtBQUNULElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekM7QUFDQSxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLEVBQUU7QUFDNUIsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzVFLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUM7QUFDbEMsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7QUFDNUIsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsT0FBTztBQUNULElBQUksVUFBVTtBQUNkLElBQUksR0FBRztBQUNQLEdBQUcsQ0FBQztBQUNKLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMsVUFBVSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUU7QUFDakMsRUFBRSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsSUFBSSxNQUFNLEdBQUcsQ0FBQyxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQzVELEVBQUUsTUFBTTtBQUNSLElBQUksVUFBVTtBQUNkLElBQUksR0FBRztBQUNQLEdBQUcsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdEIsRUFBRSxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQzlEO0FBQ0EsRUFBRSxL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LE9BQU8sTUFBTSxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUU7QUFDOUIsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2Y7QUFDQSxRQUFRLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN0QixVQUFVLEtBQUssR0FBRztBQUNsQixZQUFZLEdBQUcsSUFBSSxJQUFJLENBQUM7QUFDeEIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQSxVQUFVLEtBQUssR0FBRztBQUNsQixZQUFZLEdBQUcsSUFBSSxNQUFNLENBQUM7QUFDMUIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQSxVQUFVLEtBQUssR0FBRztBQUNsQixZQUFZLEdBQUcsSUFBSSxJQUFJLENBQUM7QUFDeEIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQSxVQUFVLEtBQUssR0FBRztBQUNsQixZQUFZLEdBQUcsSUFBSSxNQUFNLENBQUM7QUFDMUIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQSxVQUFVLEtBQUssR0FBRztBQUNsQixZQUFZLEdBQUcsSUFBSSxJQUFJLENBQUM7QUFDeEIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQSxVQUFVLEtBQUssR0FBRztBQUNsQixZQUFZLEdBQUcsSUFBSSxJQUFJLENBQUM7QUFDeEIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQSxVQUFVLEtBQUssR0FBRztBQUNsQixZQUFZLEdBQUcsSUFBSSxJQUFJLENBQUM7QUFDeEIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQSxVQUFVLEtBQUssR0FBRztBQUNsQixZQUFZLEdBQUcsSUFBSSxJQUFJLENBQUM7QUFDeEIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQSxVQUFVLEtBQUssR0FBRztBQUNsQixZQUFZLEdBQUcsSUFBSSxJQUFJLENBQUM7QUFDeEIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQSxVQUFVLEtBQUssR0FBRztBQUNsQixZQUFZLEdBQUcsSUFBSSxRQUFRLENBQUM7QUFDNUIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQSxVQUFVLEtB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QyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZELElBQUksSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2RixHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUNsQjtBQUNBLEVBQUUsSUFBSSxJQUFJLFlBQVksTUFBTSxFQUFFO0FBQzlCLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDckIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNsRSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNyRixHQUFHLE1BQU07QUFDVCxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFDZixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxJQUFJLEdBQUcsWUFBWSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDdkUsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ2YsSUFBSSxNQUFNLElBQUksR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLFdBQVcsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUks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QUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUM3RCxRQUFRLElBQUksRUFBRSxLQUFLLFNBQVMsRUFBRSxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQzVFLE9BQU87QUFDUCxLQUFLLE1BQU0sSUFBSSxHQUFHLFlBQVksR0FBRyxFQUFFO0FBQ25DLE1BQU0sS0FBSyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFO0FBQzlDLFFBQVEsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QixRQUFRLE1BQU0sRUFBRSxHQUFHLFlBQVksQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNyRCxRQUFRLElBQUksRUFBRSxLQUFLLFNBQVMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQy9FLE9BQU87QUFDUCxLQUFLLE1BQU0sSUFBSSxHQUFHLFlBQVksR0FBRyxFQUFFO0FBQ25DLE1BQU0sS0FBSyxNQUFNLEVBQUUsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ3hDLFFBQVEsTUFBTSxFQUFFLEdBQUcsWUFBWSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3RELFFBQVEsSUFBSSxFQUFFLEtBQUssU0FBUyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsS0FBSyxF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
