#!/usr/bin/env node

import fs from "node:fs/promises";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import readline from "node:readline";
import { createInterface } from "node:readline/promises";

import {
  ansiResetStyles,
  ansiSetBlue,
  ansiSetGrey,
  context,
  execCmd,
  installDeps,
  loadingSpinnerUntil,
  select,
  unzip,
} from "./helpers.ts";
import { addSveltiaFiles, agentsMd, updateFilesForBlog } from "./templates.ts";

const main = async () => {
  const { packageManager, runtime, zipOutDir } = context;

  const fetchZipPromise = fetch(`https://github.com/mastrojs/mastro/archive/refs/heads/main.zip`);

  const rl = createInterface({ input: stdin, output: stdout, crlfDelay: Infinity });
  const dir = await rl.question("What name should we use for your new project folder?\n");
  if (!dir) return process.exit();

  // set up terminal for interactive keyboard UI (e.g. with the `select` function):
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  const templateMsg =
    "Which template do you want to start with? " +
    `${ansiSetGrey}Use up/down arrow keys:${ansiResetStyles}`;
  const blogTemplate = "blog (with markdown support)";
  const template =
    runtime === "cloudflare" ? "basic" : await select(templateMsg, ["basic", blogTemplate]);

  const addSveltia =
    template === blogTemplate
      ? (await select("Do you want to add a git-based CMS? This adds a routes/admin/ folder.", [
          "No",
          "Add Sveltia CMS",
        ])) === "Add Sveltia CMS"
      : false;

  await unzip({ fetchZipPromise, zipFileName: zipOutDir + ".zip" });
  try {
    await fs.rename(join(zipOutDir, "examples", `basic-${runtime}`), dir);
  } catch (e: any) {
    const msg =
      e.code === "ENOTEMPTY" ? `Could not create directory ${dir}: it already exists.` : e;
    console.error(msg);
    await fs.rm(zipOutDir, { recursive: true });
    process.exit(-1);
  }

  try {
    if (template === blogTemplate) {
      await updateFilesForBlog(context, dir);
      if (addSveltia) {
        await addSveltiaFiles(dir);
      }
    }
  } finally {
    await fs.rm(zipOutDir, { recursive: true });
  }

  const installDepsP =
    "Yes" === (await select("Install dependencies? (recommended)", ["Yes", "No"]))
      ? installDeps(context, dir)
      : undefined;

  if ("Yes" === (await select("Add AGENTS.md file? (optional)", ["Yes", "No"]))) {
    await fs.writeFile(join(dir, "AGENTS.md"), agentsMd);
  }

  const initGit =
    "Yes" === (await select("Initialize a new git repository? (optional)", ["Yes", "No"]));

  if (installDepsP) {
    await loadingSpinnerUntil(installDepsP);
  }

  if (initGit) {
    const cmd = "git init -b main && git add . && git commit -m 'Initial commit'";
    const { code, stdout, stderr } = await execCmd(cmd, { cwd: dir });
    if (code !== 0) console.warn("Couldn't initialize git repo", stdout, stderr);
  }

  const startInstr = `${packageManager} run ${runtime === "cloudflare" ? "dev" : "start"}`;
  console.log(`
Success!

Enter the newly created folder with: ${ansiSetBlue}cd ${dir}${ansiResetStyles}
Then start the dev server with: ${ansiSetBlue}${startInstr}${ansiResetStyles}`);

  rl.close();
  stdin.destroy();
};
await main();
