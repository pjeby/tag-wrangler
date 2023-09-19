const tagBody = /^#[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s]+$/;

export class Tag {
    constructor(name) {
        const
            hashed = this.tag = Tag.toTag(name),
            canonical = this.canonical = hashed.toLowerCase(),
            canonical_prefix = this.canonical_prefix = canonical + "/";
        this.name = hashed.slice(1);
        this.matches = function (text) {
            text = text.toLowerCase();
            return text == canonical || text.startsWith(canonical_prefix);
        };
    }
    toString() { return this.tag; }

    static isTag(s) { return tagBody.test(s); }

    static toTag(name) {
        while (name.startsWith("##")) name = name.slice(1);
        return name.startsWith("#") ? name : "#"+name;
    }

    static canonical(name) {
        return Tag.toTag(name).toLowerCase();
    }
}

export class Replacement {

    constructor(fromTag, toTag) {
        const cache =  Object.assign(
            Object.create(null), {
                [fromTag.tag]:  toTag.tag,
                [fromTag.name]: toTag.name,
            }
        );

        this.inString = function(text, pos = 0) {
            return text.slice(0, pos) + toTag.tag + text.slice(pos + fromTag.tag.length);
        }

        this.inArray = (tags, skipOdd, isAlias) => {
            return tags.map((t, i) => {
                if (skipOdd && (i & 1)) return t;   // leave odd entries (separators) alone
                // Obsidian allows spaces as separators within array elements
                if (!t || typeof t !== "string") return t;
                // Skip non-tag parts
                if (isAlias) {
                    if (!t.startsWith("#") || !Tag.isTag(t)) return t;
                } else if (/[ ,\n]/.test(t)) {
                    return this.inArray(t.split(/([, \n]+)/), true).join("");
                }
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

        }
    }
}


