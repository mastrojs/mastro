#!/usr/bin/env node

//@ts-check

/**
 * This script initializes an empty Mastro project.
 *
 * This is an npm package until JSR has a way to create a "bin" field in the generated package.json
 * See https://github.com/jsr-io/jsr-npm/issues/76
 * and https://gitlab.com/soapbox-pub/xjsr/-/issues/2
 */

import { exec } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Readable } from "node:stream";

/**
 * @param {string} path
 * @param {ReadableStream<Uint8Array<ArrayBuffer>>} data
 * @returns {Promise<void>}
 */
const writeFile = (path, data) => {
  if (typeof Deno === "object") {
    return Deno.writeFile(path, data);
  } else {
    return new Promise((resolve, reject) =>
      // @ts-ignore
      Readable.fromWeb(data)
        .pipe(createWriteStream(path))
        .on("finish", resolve)
        .on("error", reject)
    );
  }
}

/**
 * @param {string} cmd
 * @returns {Promise<{code: number; stdout: string; stderr: string;}>}
 */
const execCmd = (cmd) =>
  new Promise((resolve) =>
    exec(cmd, (error, stdout, stderr) =>
      resolve({
        code: error ? (error.code || -1) : 0,
        stdout,
        stderr,
      }))
  );

const isDeno = typeof Deno === "object";
const repoName = `template-basic-${isDeno ? "deno" : "node"}`;
const repoUrl = `https://github.com/mastrojs/${repoName}/archive/refs/heads/main.zip`;
const zipFilePromise = fetch(repoUrl);

const rl = createInterface({ input: stdin, output: stdout, crlfDelay: Infinity });
const dir = await rl.question("What folder should we create for your new project?\n");
rl.close();
stdin.destroy();

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

Enter the newly created folder with: %ccd ${dir}${isDeno ? "" : "\n\nThen install dependencies with: pnpm install\n"}
%cThen start the dev server with: %c${isDeno ? "deno task" : "pnpm run"} start`,
      codeStyle,
      "",
      codeStyle,
    );
  }
}
