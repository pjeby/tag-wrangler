import { Dialog } from "@ophidian/core";

class ProgressDialog extends Dialog {
    progressEl = this.contentEl.createEl("progress", {value: 0, attr: {style: "width: 100%", max: 100}});
    counterEl = this.contentEl.createDiv({text: "0%"});
    setProgress(pct) {
        this.counterEl.textContent = `${pct}%`;
        this.progressEl.value = pct;
    }
    constructor(onClose) {
        super();
        this.okButton.detach();
        this.addCancelButton();
        this.onClose = onClose;
    }
}

export class Progress {
    aborted = false;

    constructor(title, message) {
        this.progress = new ProgressDialog(() => this.aborted = true)
            .setTitle(title)
            .setContent(message)
        ;
        this.progress.open();
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
            this.progress.onClose = () => null;
            this.progress.close();
        }
    }

    set title(text) { this.progress.setTitle(text); }
    set message(text) { this.progress.setContent(text); }
}
