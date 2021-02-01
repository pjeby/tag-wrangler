import builder from "obsidian-rollup-presets";

export default builder()
.apply(c => c.output.sourcemap = "inline")
.assign({input: "src/plugin.js"})
.withInstall(__dirname)
.build();
