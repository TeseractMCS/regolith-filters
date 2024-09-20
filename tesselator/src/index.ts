import JSON5 from "json5";
import path from "path";
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { esbuildDecorators } from "esbuild-decorators";
import { ParseModule } from "./util/ParseModule.js";
import { randomUUID } from "crypto";
import { Manifest } from "./util/interface/Manifest.js";
import { PluginData } from "./util/interface/PluginData.js";

const settings = process.argv[2] ? JSON.parse(process.argv[2]) : {};
// Change the current working directory to the root directory where config.json exists; this file is supposed to always exist, as the filter is running inside .regolith/tmp folder
process.chdir("../../");
// Get the regolith config file and parse it to JSON
const regolithConfig = JSON5.parse(readFileSync("config.json").toString());
/**
 * .regolith data path
 */
const regolithPath = "./.regolith";
/**
 * .regolith temp path
 */
const regolithTmp = "./.regolith/tmp";
/**
 * Path to the script source files
 */
const srcPath = regolithConfig.regolith.dataPath;
/**
 * Path to behavior and assets files, also where teseract.plugin.json file is located
 */
const resourcesPath = path.join(srcPath, "../resources");
// Get the teseract.plugin.json file and parse it to JSON using JSON5
const teseractPlugin: PluginData = JSON5.parse(
    readFileSync(path.join(resourcesPath, "teseract.plugin.json")).toString(),
);
const BPManifest: Manifest = JSON5.parse(
    readFileSync(
        path.join(resourcesPath, "/behavior/manifest.json"),
    ).toString(),
);
for (const dependency of teseractPlugin.modules) {
    const { name, version } = ParseModule(dependency);
    if (BPManifest.dependencies.find((dep) => dep.module_name == name)) {
        console.warn(
            `Module ${name}@${version} is already present in the manifest, and won't be overriden`,
        );
    } else {
        BPManifest.dependencies.unshift({
            module_name: name,
            version: version,
        });
    }
}
const RPManifest: Manifest = JSON5.parse(
    readFileSync(path.join(resourcesPath, "/assets/manifest.json")).toString(),
);
BPManifest.dependencies.unshift({
    uuid: RPManifest.header.uuid,
    version: RPManifest.header.version,
});
const scriptModule = BPManifest.modules.find(
    (module) => module.type == "script",
);
if (scriptModule) {
    console.warn(
        `Scripting module is already present in the manifest, and won't be overriden. WARNING: This may cause entrypoint file to differ from entry point auto-generated by sculk-loom.`,
    );
} else {
    BPManifest.modules.push({
        type: "script",
        language: "javascript",
        entry: "scripts/index.js",
        uuid: randomUUID(),
        version: teseractPlugin.version,
    });
}

writeFileSync(
    path.join(regolithTmp, "/RP/manifest.json"),
    JSON.stringify(RPManifest, null, 5),
);
writeFileSync(
    path.join(regolithTmp, "/BP/manifest.json"),
    JSON.stringify(BPManifest, null, 5),
);
class Tesselator {
    private static index: string;
    static writeIndex() {
        mkdirSync(regolithTmp + "/BP/scripts");
        writeFileSync(regolithTmp + "/data/index.ts", this.index);
    }
    static build() {
        process.chdir(regolithTmp);
        console.info(process.cwd());
        build({
            entryPoints: ["data/index.ts"],
            bundle: true,
            minify: settings.minify ?? false,
            outfile: "BP/scripts/index.js",
            platform: "node",
            target: "es2020",
            external: [
                "@minecraft/server",
                "@minecraft/server-ui",
                ...teseractPlugin.external,
            ],
            allowOverwrite: true,
            format: "esm",
            logLevel: "info",
            tsconfig: "../../tsconfig.json",
            plugins: [
                esbuildDecorators({
                    tsconfig: "../../tsconfig.json",
                    cwd: process.cwd(),
                }),
            ],
            treeShaking: false,
        })
            .catch((error) => {
                throw error;
            })
            .then(() => {
                this.injectIndex();
            });
    }
    static injectIndex() {
        const code = readFileSync("BP/scripts/index.js").toString();
        let injectedCode = "";
        if (!code.includes("var __classPrivateFieldSet =")) {
            injectedCode += `var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};`;
        }
        if (!code.includes("var __classPrivateFieldGet =")) {
            injectedCode += `var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};`;
        }
        if (!code.includes("var __decorate =")) {
            injectedCode += `var __decorate = function(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};`;
        }
        if (!code.includes("var __metadata =")) {
            injectedCode += `var __metadata = function(k, v) { if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v); };`;
        }
        writeFileSync("BP/scripts/index.js", injectedCode + code);
    }
    static readPluginData() {
        const {
            entryPoints,
            name,
            id,
            description,
            version,
            external,
            authors,
        } = teseractPlugin;
        if (entryPoints.length == 0) {
            throw new Error("No entry points specified!");
        }
        const indexImports = [
            `import { Teseract } from "@teseractmcs/server-api";`,
        ];
        const indexInitializers = [];
        for (const entry of entryPoints) {
            const defaultImp = entry.match(/[^/]+$/g);
            indexImports.push(`import ${defaultImp} from "${entry}";`);
            indexInitializers.push(
                `Teseract.registerPlugin(new ${defaultImp}(), "${id}");`,
            );
        }
        this.index =
            indexImports.join("\n") + "\n\n" + indexInitializers.join("\n");
    }
    static start() {
        this.readPluginData();
        this.writeIndex();
        this.build();
    }
}
Tesselator.start();
