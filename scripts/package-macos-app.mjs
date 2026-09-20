#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { releaseMetadata } from "./release-metadata.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const version = process.env.CODEX_TASKBOARD_RELEASE_VERSION || packageJson.version;
const { productName, appName, rawDmgName, buildDmgName } = releaseMetadata(packageJson.version, `v${version}`);
const designDirectory = path.join(projectRoot, "src-tauri", "dmg");
const bundleRoot = path.join(projectRoot, "src-tauri", "target", "universal-apple-darwin", "release", "bundle");
const appDirectory = path.join(bundleRoot, "macos");
const appPath = path.join(appDirectory, appName);
const dmgDirectory = path.join(bundleRoot, "dmg");
const dmgPath = path.join(dmgDirectory, buildDmgName);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`);
}

run(process.execPath, [path.join(projectRoot, "scripts", "sign-macos-app.mjs"), appPath]);
run("/usr/bin/SetFile", ["-a", "E", appPath]);
// Tauri's initial DMG predates the App signature; recreate it from the signed App.
await rm(path.join(dmgDirectory, rawDmgName), { force: true });
await rm(path.join(appDirectory, rawDmgName), { force: true });
await rm(dmgPath, { force: true });
await mkdir(dmgDirectory, { recursive: true });

const pythonBin = process.env.PYTHON || "python3";
const iconPath = path.join(dmgDirectory, "icon.icns");
const fallbackIcon = path.join(projectRoot, "src-tauri", "icons", "icon.icns");
const volIcon = existsSync(iconPath) ? iconPath : fallbackIcon;

run(pythonBin, [
  path.join(designDirectory, "build-dmg.py"),
  "--app", appPath,
  "--output", dmgPath,
  "--volname", productName,
  "--background", path.join(designDirectory, "background.tiff"),
  "--icon", volIcon,
  "--window-size", "752", "436",
  "--app-pos", "212", "140",
  "--drop-link-pos", "537", "140",
  "--icon-size", "160",
  "--text-size", "16",
]);
run("/usr/bin/codesign", ["--force", "--timestamp=none", "--sign", "-", dmgPath]);
run("/usr/bin/codesign", ["--verify", "--strict", "--verbose=2", dmgPath]);
console.log(`Created ad-hoc signed DMG: ${dmgPath}`);
