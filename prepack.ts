// @ts-check
/// <reference types="node" />

import { execFileSync as execFile } from "node:child_process";
import {
  copyFileSync as cpFile,
  cpSync as cp,
  existsSync as exists,
  mkdirSync as mkdir,
  rmSync as rm,
  writeFileSync as writeFile,
} from "node:fs";
import { basename } from "node:path";

// This script expects to be run from e.g. libs/mastro/
// pnpm runs `prepack` from the package's directory, so this works.
// pnpm also automatically adds the workspace LICENSE when packing.

rm("dist", { recursive: true, force: true });
mkdir("dist");

cp("src", "dist/src", { recursive: true });
if (exists("src/types")) cp("src/types", "dist/dist/types", { recursive: true });
cpFile("package.json", "dist/package.json");
if (basename(process.cwd()) === "mastro") {
  cpFile(new URL("./README.md", import.meta.url), "dist/README.md");
} else {
  cpFile("README.md", "dist/README.md");
}
writeFile("dist/tsconfig.json", JSON.stringify({ extends: "../../../tsconfig.base.json" }));

execFile("tsc", ["-p", "dist/tsconfig.json"], { stdio: "inherit" });
