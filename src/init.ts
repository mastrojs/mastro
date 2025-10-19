/**
 * This script initializes an empty Mastro project. Usage:
 * Deno: `deno run -A jsr:@mastrojs/mastro@0.4.0/init` or
 * Node.js: `npx xjsr @mastrojs/mastro/init`.
 * @module
 */

import { exec } from "node:child_process";
import fs from "node:fs/promises";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { writeFile } from "./node/writeFile.ts";

const repoName = `template-basic-${typeof Deno === "object" ? "deno" : "node"}`;
const repoUrl = `https://github.com/mastrojs/${repoName}/archive/refs/heads/main.zip`;
const zipFilePromise = fetch(repoUrl);

const rl = createInterface({ input: stdin, output: stdout, crlfDelay: Infinity });
const dir = await rl.question("What folder should we create for your new project?\n");
rl.close();
stdin.destroy();

const execCmd = (
  cmd: string,
): Promise<{ code: number; stdout: string; stderr: string }> =>
  new Promise((resolve) =>
    exec(cmd, (error, stdout, stderr) =>
      resolve({
        code: error ? (error.code || -1) : 0,
        stdout,
        stderr,
      }))
  );

if (dir) {
  const outDir = repoName + "-main"; // this cannot be changed and is determined by the zip file
  const zipFileName = outDir + ".zip";
  const res = await zipFilePromise;
  if (res.ok && res.body) {
    await writeFile(zipFileName, res.body);
  }

  // unzip using the tar command (should work on unix and Windows 10 and later)
  const { code, stdout, stderr } = await execCmd(`tar -xf ${zipFileName}`);
  const unzipSuccess = code === 0;
  if (!unzipSuccess) {
    console.log(stdout);
    console.error(stderr);
  }
  await fs.rm(zipFileName, { force: true, recursive: true });

  if (unzipSuccess) {
    await fs.rename(outDir, dir);

    const codeStyle = "color: blue";
    console.log(
      `
Success!

Enter your project directory using %ccd ${dir}
%cThen start the dev server with: %cdeno task start`,
      codeStyle,
      "",
      codeStyle,
    );
  }
}
