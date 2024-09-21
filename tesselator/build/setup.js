import path from "path";
import fs from "fs";
import json5 from "json5";
import { execSync } from "child_process";
/**
 * Loads and parses a JSON5 configuration file from a given path.
 * @param {string} filePath - The path to the configuration file.
 * @returns {object} - Parsed configuration object.
 * @throws {Error} - If the file is not found or cannot be parsed.
 */
const loadConfig = (filePath) => {
    try {
        const configData = fs.readFileSync(filePath, "utf-8");
        return json5.parse(configData);
    }
    catch (error) {
        throw new Error(`Failed to load config file at ${filePath}: ${error.message}`);
    }
};
/**
 * Checks if a directory exists and, if so, runs npm install in that directory.
 * @param {string} directoryPath - The path to the directory.
 * @throws {Error} - If dependency installation fails.
 */
const installDependencies = (directoryPath) => {
    if (fs.existsSync(directoryPath)) {
        console.log("Installing dependencies in:", directoryPath);
        try {
            execSync("npm install", { cwd: directoryPath, stdio: "inherit" });
        }
        catch (error) {
            throw new Error(`Failed to install dependencies in ${directoryPath}: ${error.message}`);
        }
    }
    else {
        console.warn(`Directory not found: ${directoryPath}. Please run 'npm install' manually.`);
    }
};
/**
 * Main function to load the configuration and handle dependency installation.
 */
const main = () => {
    const rootDir = process.env.ROOT_DIR;
    if (!rootDir) {
        throw new Error("The ROOT_DIR environment variable is not defined.");
    }
    const configPath = path.resolve(rootDir, "config.json");
    const config = loadConfig(configPath);
    const dataPath = config.regolith?.dataPath;
    if (!dataPath) {
        throw new Error("data path not found in config.json");
    }
    const tesselatorPath = path.resolve(rootDir, dataPath, "tesselator");
    installDependencies(tesselatorPath);
};
// Run the main function
main();
//# sourceMappingURL=setup.js.map