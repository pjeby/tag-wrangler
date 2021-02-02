import {confirm} from "smalltalk";
import {Progress} from "./progress";
import {validatedInput} from "./validation";
import {Notice, parseFrontMatterTags} from "obsidian";
import {parseDocument} from "yaml";

export async function renameTag(app, tagName) {
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

    const [origin, clash] = tagClashes(app, "#"+tagName, "#"+newName);
    if (clash) {
        try {
            await confirm(
                "WARNING: No Undo!",
                `Renaming <code>#${tagName}</code> to <code>#${newName}</code> will merge ${
                    (origin.toLowerCase() === "#"+tagName.toLowerCase()) ?
                        `these tags` : `multiple tags
                        into existing tags (such as <code>${origin}</code>
                        merging with <code>${clash}</code>)`
                }.

                This <b>cannot</b> be undone.  Do you wish to proceed?`
            );
        } catch(e) {
            return;
        }
    }

    const filesToRename = await tagPositions(app, "#"+tagName);
    if (!filesToRename) return;

    const progress = new Progress(`Renaming to ${newName}/*`, "Processing files...");
    const replaceTags = tagReplacer(tagName, newName);

    let updated = 0;
    await progress.forEach(filesToRename, async (f) => {
        progress.message = "Processing " + f.filename.split("/").pop();
        const file = app.vault.getAbstractFileByPath(f.filename);
        const original = await app.vault.read(file);
        if (progress.aborted) return;
        let text = original;
        for(const { position: {start, end}, tag} of f) {
            if (text.slice(start.offset, end.offset) !== tag) {
                new Notice(`File ${f.filename} has changed; skipping`)
                console.error(`File ${f.filename} has changed; skipping`);
                console.debug(text.slice(start.offset, end.offset), tag)
                return;
            }
            text = text.slice(0, start.offset) + "#"+newName + text.slice(start.offset + tagName.length + 1)
        }
        if (f.fmtags) {
            const [empty, original] = text.split(/---\r?\n/, 2);
            if (empty === "" && original.trim() !== "" && original.endsWith("\n")) {
                const parsed = parseDocument(original);
                let changed = false;
                for (const prop of ["tag", "tags"] ) {
                    const node = parsed.get(prop, true);
                    if (!node) continue;
                    const field = node.toJSON();
                    if (!field || !field.length) continue;
                    if (typeof field === "string") {
                        const parts = field.split(/(\s*,\s*|^\s+|\s+$)/);
                        const after = replaceTags(parts, true).join("");
                        if (field != after) { parsed.set(prop, after); changed = true; }
                    } else if (Array.isArray(field)) {
                        replaceTags(field).forEach((v,i) => {
                            if ( field[i] !== v ) node.set(i,v); changed = true;
                        });
                    }
                }
                if (changed) text = text.replace(original, parsed.toString());
            }
        }
        if (text !== original) { await app.vault.modify(file, text); updated++; }
    })
    return new Notice(`Operation ${progress.aborted ? "cancelled" : "complete"}: ${updated} file(s) updated`);
}

function tagClashes(app, oldTag, newTag) {
    // Renaming to change case doesn't lose info, so ignore it
    if (oldTag.toLowerCase() === newTag.toLowerCase()) return [];

    const tagMatches = tagMatcher(oldTag);
    const tags = Object.keys(app.metadataCache.getTags()).reverse();
    const clashes = new Set(tags.map(s => s.toLowerCase()));

    for (const tag of tags) {
        if (tagMatches(tag)) {
            const changed = newTag + tag.slice(oldTag.length);
            if (clashes.has(changed.toLowerCase())) return [tag, changed];
        }
    }
    return [];
}

function tagMatcher(tagName) {
    tagName = tagName.toLowerCase();
    const prefix = tagName + "/";
    return function (tag) {
        tag = tag.toLowerCase()
        return tag == tagName || tag.startsWith(prefix);
    }
}

async function tagPositions(app, tagName) {
    const tagMatches = tagMatcher(tagName), result = [];
    const progress = new Progress(`Searching for ${tagName}/*`, "Matching files...");
    await progress.forEach(
        app.metadataCache.getCachedFiles(),
        n => {
            let { frontmatter, tags } = app.metadataCache.getCache(n);
            tags = (tags || []).filter(t => t.tag && tagMatches(t.tag)).reverse(); // last positions first
            tags.filename = n;
            tags.fmtags = (parseFrontMatterTags(frontmatter) || []).filter(tagMatches);
            tags.frontmatter = frontmatter;
            if (tags.length || tags.fmtags.length)
                result.push(tags);
        }
    );
    if (!progress.aborted)
        return result;
}

function tagReplacer(tagName, newName) {
    tagName = tagName.toLowerCase();
    const tagPath = tagName+"/", hashTag = "#"+tagName, hashPath = "#"+tagPath;
    return function(tags, skipOdd) {
        return tags.map((t,i) => {
            const lc = t.toLowerCase();
            if (skipOdd && (i & 1)) return t;  // leave odd entries alone
            if (lc === tagName) return newName;
            if (lc === hashTag) return "#" + newName;
            if (lc.startsWith(tagPath)) return newName+t.slice(tagName.length);
            if (lc.startsWith(hashPath)) return newName+t.slice(hashTag.length);
            return t;
        });
    }
}
