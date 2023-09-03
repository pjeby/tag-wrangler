import {Progress} from "./progress";
import {Prompt, Confirm} from "@ophidian/core";
import {Notice, parseFrontMatterAliases, parseFrontMatterTags} from "obsidian";
import {Tag, Replacement} from "./Tag";
import {File} from "./File";

export async function renameTag(app, tagName, toName=tagName) {
    const newName = await promptForNewName(tagName, toName);
    if (newName === false) return;  // aborted

    if (!newName || newName === tagName) {
        return new Notice("Unchanged or empty tag: No changes made.");
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

    return new Notice(`Operation ${progress.aborted ? "cancelled" : "complete"}: ${renamed} file(s) updated`);
}

function allTags(app) {
    return Object.keys(app.metadataCache.getTags());
}

export async function findTargets(app, tag) {
    const targets = [];
    const progress = new Progress(`Searching for ${tag}/*`, "Matching files...");
    await progress.forEach(
        app.metadataCache.getCachedFiles(),
        filename => {
            let { frontmatter, tags } = app.metadataCache.getCache(filename) || {};
            tags = (tags || []).filter(t => t.tag && tag.matches(t.tag)).reverse(); // last positions first
            const fmtags = (parseFrontMatterTags(frontmatter) || []).filter(tag.matches);
            const aliasTags = (parseFrontMatterAliases(frontmatter) || []).filter(Tag.isTag).filter(tag.matches);
            if (tags.length || fmtags.length || aliasTags.length)
                targets.push(new File(app, filename, tags, fmtags.length + aliasTags.length));
        }
    );
    if (!progress.aborted)
        return targets;
}

async function promptForNewName(tagName, newName=tagName) {
    return await new Prompt()
        .setTitle(`Renaming #${tagName} (and any sub-tags)`)
        .setContent("Enter new name (must be a valid Obsidian tag name):\n")
        .setPattern("[^\u2000-\u206F\u2E00-\u2E7F'!\"#$%&()*+,.:;<=>?@^`{|}~\\[\\]\\\\\\s]+")
        .onInvalidEntry(t => new Notice(`"${t}" is not a valid Obsidian tag name`))
        .setValue(newName)
        .prompt()
    ;
}

async function shouldAbortDueToClash([origin, clash], oldTag, newTag) {
    return !await new Confirm()
        .setTitle("WARNING: No Undo!")
        .setContent(
            activeWindow.createEl("p", undefined, el => { el.innerHTML =
                `Renaming <code>${oldTag}</code> to <code>${newTag}</code> will merge ${
                    (origin.canonical === oldTag.canonical) ?
                        `these tags` : `multiple tags
                        into existing tags (such as <code>${origin}</code>
                        merging with <code>${clash}</code>)`
                }.<br><br>
                This <b>cannot</b> be undone.  Do you wish to proceed?`;
            })
        )
        .setup(c => c.okButton.addClass("mod-warning"))
        .confirm()
    ;
}
