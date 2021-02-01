import { progress } from "smalltalk";

export class Progress {

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
        const area = this.dialog.querySelector(".content-area").childNodes[0].textContent = text;
    }

    get message() {
        return this.dialog.querySelector(".content-area").childNodes[0].textContent;
    }
}
