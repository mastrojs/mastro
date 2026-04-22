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
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import readline from "node:readline";
import { createInterface } from "node:readline/promises";
import { Readable } from "node:stream";

/**
 * Constants
 */
const userAgent = process.env.npm_config_user_agent;
const runtime = (() => {
  if (typeof Deno === "object") {
    return "deno";
  } else if (userAgent?.startsWith("bun/")) {
    // the usual ways to detect Bun don't appear to work in `bun create`
    return "bun";
  } else if (process.argv[2] === "--cloudflare") {
    return "cloudflare";
  } else {
    return "node";
  }
})();
const packageManager = (() => {
  if (runtime === "deno") return "deno";
  switch (userAgent?.split("/")[0]) {
    case "pnpm":
      return "pnpm";
    case "yarn":
      return "yarn";
    case "bun":
      return "bun";
    default:
      return "npm";
  }
})();
const templateOutDir = "mastro-main"; // determined by zip file
const ansiSetBlue = "\x1b[34m";
const ansiResetStyles = "\x1b[0m";

/**
 * Helper Functions
 */

/**
 * @template {string} T
 * @param {string} question
 * @param {T[]} options
 * @returns {Promise<T>}
 */
const select = async (question, options) =>
  new Promise((resolve) => {
    let index = 0;

    const render = () => {
      console.clear();
      console.log(question);
      options.forEach((opt, i) => {
        console.log(i === index ? `● ${opt}` : `\x1b[2m○ ${opt}${ansiResetStyles}`);
      });
    };
    render();

    process.stdin.on("keypress", (_, key) => {
      switch (key.name) {
        case "c": {
          if (key.ctrl) {
            console.clear();
            process.exit();
          }
          return;
        }
        case "up": {
          index = (index - 1 + options.length) % options.length;
          return render();
        }
        case "down": {
          index = (index + 1) % options.length;
          return render();
        }
        case "return": {
          console.clear();
          process.stdin.removeAllListeners("keypress");
          return resolve(options[index]);
        }
      }
    });
  });

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
};

/**
 * @param {string} cmd
 * @param {import("node:child_process").ExecOptions} [opts]
 * @returns {Promise<{code: number; stdout: string; stderr: string;}>}
 */
const execCmd = (cmd, opts) =>
  new Promise((resolve) =>
    exec(cmd, { ...opts, encoding: "utf8" }, (error, stdout, stderr) =>
      resolve({
        code: error ? (error.code || -1) : 0,
        stdout,
        stderr,
      }))
  );

/**
 * @param { {fetchZipPromise: Promise<Response>; zipFileName: string } } opts
 */
const unzip = async (opts) => {
  const { fetchZipPromise, zipFileName } = opts;
  const res = await fetchZipPromise;
  if (!res.ok || !res.body) {
    throw Error(`fetchZipPromise had status ${res.status}`);
  }
  await writeFile(zipFileName, res.body);

  // FreeBSD tar (preinstalled on macOS and >= Win10) handles also zip files
  const cmd = process.platform === "linux" ? "unzip " : "tar -xf ";
  const { code, stdout, stderr } = await execCmd(cmd + zipFileName);
  const unzipSuccess = code === 0;
  if (!unzipSuccess) {
    console.log(stdout);
    console.error(stderr);
  }
  await fs.rm(zipFileName, { force: true, recursive: true });

  if (!unzipSuccess) {
    process.exit(-1);
  }
};

/**
 * Depending on runtime, updates `deno.json` or `package.json`
 *
 * @param { string } dir
 * @param { (dependencies: Record<string, string>) => void } cb
 */
const updateDeps = async (dir, cb) => {
  const path = join(dir, runtime === "deno" ? "deno.json" : "package.json");
  const json = JSON.parse(await fs.readFile(path, { encoding: "utf8" }));
  cb(json[runtime === "deno" ? "imports" : "dependencies"]);
  await fs.writeFile(path, JSON.stringify(json, null, 2) + "\n");
};

/**
 * @param { string } dir
 */
const updateFilesForBlog = async (dir) => {
  await Promise.all(["components", "data", "routes"].map(async (folder) => {
    await fs.rm(join(dir, folder), { recursive: true, force: true });
    return fs.rename(join(templateOutDir, "examples", "blog", folder), join(dir, folder));
  }));
  await updateDeps(dir, (deps) => {
    deps["@mastrojs/markdown"] = ["npm", "bun"].includes(packageManager)
      ? "npm:@jsr/mastrojs__markdown@^0"
      : "jsr:@mastrojs/markdown@^0";
  });
};

/**
 * @param { string } dir
 */
const addSveltiaFiles = async (dir) => {
  const sveltiaConfig =
    `# yaml-language-server: $schema=https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json

backend:
  name: github
  repo: user/repo

media_folder: /routes/media
public_folder: /media

collections:
  - name: posts
    label: Posts
    folder: /data/posts
    fields:
      - { label: Title, name: title, widget: string }
      - { label: Body, name: body, widget: markdown }
`;

  const sveltiaIndexHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>Sveltia CMS</title>
  </head>
  <body>
    <!--
    You can also pin a version like https://unpkg.com/@sveltia/cms@0.129.2/dist/sveltia-cms.js
    or instead of loading from unpkg.com, download the file and save it in your routes folder.
    -->
    <script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"></script>
  </body>
</html>
`;
  await fs.mkdir(join(dir, "routes", "admin"));
  await Promise.all([
    fs.writeFile(join(dir, "routes", "admin", "config.yml"), sveltiaConfig),
    fs.writeFile(join(dir, "routes", "admin", "index.html"), sveltiaIndexHtml),
    fs.appendFile(
      join(dir, "README.md"),
      "\n\n## Sveltia CMS\n\nOpen <http://localhost:8000/admin/> in your browser.\n",
    ),
  ]);
};

/**
 * @param { string } dir
 */
const installDeps = async (dir) => {
  const install = packageManager + " install";
  const { code, stdout, stderr } = await execCmd(install, { cwd: dir });
  if (code !== 0) {
    console.warn("Couldn't install dependencies", stdout, stderr);
  }
};

/**
 * @param { Promise<unknown> } p
 */
const loadingSpinnerUntil = async (p) => {
  const chars = "-\\|/";
  let i = 0;
  const id = setInterval(() => {
    console.clear();
    console.log(chars[i]);
    i = i === chars.length - 1 ? 0 : i + 1;
  }, 500);
  try {
    await p;
  } finally {
    clearInterval(id);
    console.clear();
  }
};

/**
 * Main function
 */
const main = async () => {
  const repoName = `template-basic-${runtime}`;
  const fetchZipPromise = fetch(
    `https://github.com/mastrojs/${repoName}/archive/refs/heads/main.zip`,
  );

  const rl = createInterface({ input: stdin, output: stdout, crlfDelay: Infinity });
  const dir = await rl.question("What name should we use for your new project folder?\n");
  if (!dir) return process.exit();
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  /** @type {Array<"basic" | "blog">} */
  const templateChoices = runtime === "cloudflare" ? ["basic"] : ["basic", "blog"];
  const template = await select("Which template do you want to start with?", templateChoices);
  const templateFetchZipPromise = template === "basic"
    ? undefined
    : fetch(`https://github.com/mastrojs/mastro/archive/refs/heads/main.zip`);

  const addSveltia = template === "blog"
    ? await select(
      "Do you want to add a git-based CMS? This adds a routes/admin/ folder.",
      ["No", "Add Sveltia CMS"],
    ) === "Add Sveltia CMS"
    : false;

  const zipOutDir = repoName + "-main"; // cannot be changed and is determined by the zip file
  await unzip({ fetchZipPromise, zipFileName: zipOutDir + ".zip" });
  try {
    await fs.rename(zipOutDir, dir);
  } catch (/** @type {any} */ e) {
    console.error(
      e.code === "ENOTEMPTY" ? `Could not create directory ${dir}: it already exists.` : e,
    );
    await fs.rm(zipOutDir, { recursive: true });
    process.exit(-1);
  }

  if (packageManager === "npm") {
    // otherwise it's already correct from the template repo
    try {
      await updateDeps(dir, (dependencies) => {
        dependencies["@mastrojs/mastro"] = "npm:@jsr/mastrojs__mastro@^0";
      });
      await fs.writeFile(join(dir, ".npmrc"), "@jsr:registry=https://npm.jsr.io");
    } catch (e) {
      console.error(
        `Created folder ${dir} but failed to patch it for npm. Please use pnpm instead.`,
      );
    }
  }

  if (templateFetchZipPromise) {
    // Update dir with things from @mastrojs/mastro's `examples/blog/` folder.
    await unzip({ fetchZipPromise: templateFetchZipPromise, zipFileName: templateOutDir + ".zip" });

    if (template === "blog") {
      await updateFilesForBlog(dir);
      if (addSveltia) {
        await addSveltiaFiles(dir);
      }
    }

    await fs.rm(templateOutDir, { recursive: true });
  }

  const installDepsP = runtime !== "deno" &&
      "Yes" === await select("Install dependencies? (recommended)", ["Yes", "No"])
    ? installDeps(dir)
    : undefined;

  const initGit =
    "Yes" === await select("Initialize a new git repository? (optional)", ["Yes", "No"]);

  if (installDepsP) {
    await loadingSpinnerUntil(installDepsP);
  }

  if (initGit) {
    const cmd = "git init && git add . && git commit -m 'Initial commit'";
    const { code, stdout, stderr } = await execCmd(cmd, { cwd: dir });
    if (code !== 0) console.warn("Couldn't initialize git repo", stdout, stderr);
  }

  const startInstr = runtime === "deno" ? "deno task start" : `${packageManager} run start`;
  console.log(`
Success!

Enter the newly created folder with: ${ansiSetBlue}cd ${dir}${ansiResetStyles}
Then start the dev server with: ${ansiSetBlue}${startInstr}${ansiResetStyles}`);

  rl.close();
  stdin.destroy();
};
await main();
