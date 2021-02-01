import {confirm} from "smalltalk";
import {Progress} from "./progress";
import {validatedInput} from "./validation";
import {Notice, parseFrontMatterTags} from "obsidian";

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
                new Notice(`File ${f.filename} has changed; skipping`)
                console.error(`File ${f.filename} has changed; skipping`);
                console.debug(text.slice(start.offset, end.offset), tag)
                return;
            }
            text = text.slice(0, start.offset) + "#"+newName + text.slice(start.offset + tagName.length + 1)
        }
        if (text !== original) { await app.vault.modify(file, text); updated++; }
    })
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
            tags = tags && tags.filter(t => tagMatches(t.tag || "")).reverse() || []; // last positions first
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
