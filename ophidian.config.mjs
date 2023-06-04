import Builder from "@ophidian/build";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const manifest = require("./manifest.json");
import dotenv from "dotenv";
const { parsed: env } = dotenv.config();

const applyDefinePredicate = createApplyDefinePredicate(env);

new Builder("src/plugin.js")
    .apply(applyDefinePredicate)
    .withWatch(new URL("", import.meta.url).pathname)
    .assign({ loader: { ".png": "dataurl" } })
    .withSass()
    .withInstall(manifest.id)
    .build();

function createInjectCfg(prop, value) {
    return (c) => (c[prop] = value);
}
function createApplyDefinePredicate(env) {
    if (!env) return noop;
    const envEntries = Object.entries(env).map(([k, v]) => {
        return ["process.env." + k, JSON.stringify(v)];
    });
    const _prefixedDefineConfig = Object.fromEntries(envEntries);

    const applyDefinePredicate = createInjectCfg(
        "define",
        _prefixedDefineConfig
    );
    return applyDefinePredicate;
}
function noop() {}
