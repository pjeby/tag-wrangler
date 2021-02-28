import { Notice } from "obsidian";
import { parseDocument } from "yaml";
import { Replacement } from "./Tag";

export class File {

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
                new Notice(msg);
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
            console.error(error); new Notice(error + "; skipping frontmatter");
            return;
        }

        let changed = false;
        for (const prop of ["tag", "tags"]) {
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
