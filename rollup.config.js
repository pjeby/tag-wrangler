import builder from "obsidian-rollup-presets";
export default builder().assign({input: "src/plugin.js"}).withInstall(__dirname).build();