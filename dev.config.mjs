import Builder, {
    addWatch as manufactureWatchFilesPluginItem,
} from "@ophidian/build";
import { copy } from "esbuild-plugin-copy";
import { ensureFile } from "fs-extra";

import sassPlugin from "esbuild-plugin-sass";
import { basename, dirname, join, resolve } from "path";
import copyNewer from "copy-newer";
import dotenv from "dotenv";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const {
    parsed: { OBSIDIAN_TEST_VAULT },
} = dotenv.config({ path: "./.env" });

const manifest = require("./manifest.json");

// uses outfile as the source of output directory search
const copyManifestPluginItem = manufactureCopyPluginItem({
    assets: [{ from: ["manifest*"], to: ["manifest.json"] }],
});
const copyScssPluginItem = manufactureCopyPluginItem({
    assets: [{ from: ["main.css"], to: ["styles.css"] }],
});
const sassPluginItem = sassPlugin();
const installToDevVaultPluginItem = manufactureHotReloadPluginItem(
    manifest.id,
    true
);

new Builder("src/plugin.js")
    .apply(
        createPluginsUpdaterPredicate([
            manufactureWatchFilesPluginItem(
                new URL("", import.meta.url).pathname
            ),
        ])
    )
    .assign({ loader: { ".png": "dataurl" } })
    .apply(createPluginsUpdaterPredicate([copyManifestPluginItem]))
    .apply(createPluginsUpdaterPredicate([sassPluginItem, copyScssPluginItem]))
    .apply(createPluginsUpdaterPredicate([installToDevVaultPluginItem]))
    .build();

function manufactureCopyPluginItemDefaultConfig() {
    return {
        verbose: false,
        assets: [{ from: "", to: "" }],
    };
}
function manufactureCopyPluginItem(
    copyConfig = manufactureCopyPluginItemDefaultConfig()
) {
    const pluginItem = copy({
        ...manufactureCopyPluginItemDefaultConfig(),
        ...copyConfig,
    });
    return pluginItem;
}

function createPluginsUpdaterPredicate(plugins) {
    return function (c) {
        c.plugins.push(...plugins.filter(Boolean));
        return this;
    };
}

function manufactureHotReloadPluginItem(
    pluginName = "plugin-installer",
    hotreload
) {
    if (OBSIDIAN_TEST_VAULT) {
        const destinationVaultPluginDir = join(
            OBSIDIAN_TEST_VAULT,
            ".obsidian/plugins",
            basename(pluginName)
        );
        return {
            name: "plugin-installer",
            setup(build) {
                build.onEnd(async () => {
                    const srcBuildDir =
                        build.initialOptions.outdir ??
                        dirname(build.initialOptions.outfile);
                    await copyNewer(
                        "{main.js,styles.css,manifest.json}",
                        destinationVaultPluginDir,
                        {
                            verbose: true,
                            cwd: srcBuildDir,
                        }
                    );
                    if (hotreload) {
                        await ensureFile(
                            destinationVaultPluginDir + "/.hotreload"
                        );
                    }
                });
            },
        };
    }
    return null;
}
