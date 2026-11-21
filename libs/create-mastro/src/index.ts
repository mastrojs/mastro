#!/usr/bin/env node

import { exec, type ExecOptions } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import readline, { type Key } from "node:readline";
import { createInterface } from "node:readline/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

/**
 * Constants
 */
const userAgent = process.env.npm_config_user_agent;
const runtime = (() => {
  if (userAgent?.startsWith("bun/")) {
    // the usual ways to detect Bun don't appear to work in `bun create`
    return "bun";
  } else if (process.argv[2] === "--cloudflare") {
    return "cloudflare";
  } else {
    return "node";
  }
})();
const packageManager = (() => {
  switch (userAgent?.split("/")[0]) {
    case "pnpm": return "pnpm";
    case "yarn": return "yarn";
    case "bun": return "bun";
    default: return "npm";
  }
})();
const templateOutDir = "mastro-main"; // determined by zip file
const ansiSetBlue = "\x1b[34m";
const ansiSetGrey = "\x1b[2m";
const ansiResetStyles = "\x1b[0m";

/**
 * Helper Functions
 */

const select = <T extends string>(question: string, options: T[]): Promise<T> =>
  new Promise<T>((resolve) => {
    let index = 0;

    const render = () => {
      console.clear();
      console.log(question);
      options.forEach((opt, i) => {
        console.log(i === index ? `● ${opt}` : `${ansiSetGrey}○ ${opt}${ansiResetStyles}`);
      });
    };
    render();

    process.stdin.on("keypress", (_: string, key: Key) => {
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
          return resolve(options[index]!);
        }
      }
    });
  });

const writeFile = (path: string, data: ReadableStream<Uint8Array<ArrayBuffer>>): Promise<void> =>
  pipeline(Readable.fromWeb(data as NodeReadableStream<Uint8Array>), createWriteStream(path));

const execCmd = (
  cmd: string,
  opts?: ExecOptions,
): Promise<{ code: number; stdout: string; stderr: string }> =>
  new Promise((resolve) =>
    exec(cmd, { ...opts, encoding: "utf8" }, (error, stdout, stderr) =>
      resolve({
        code: error ? (error.code || -1) : 0,
        stdout,
        stderr,
      }))
  );

const unzip = async (opts: { fetchZipPromise: Promise<Response>; zipFileName: string }) => {
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

const updateDeps = async (dir: string, cb: (dependencies: Record<string, string>) => void) => {
  const path = join(dir, "package.json");
  const json = JSON.parse(await fs.readFile(path, { encoding: "utf8" }));
  cb(json.dependencies);
  await fs.writeFile(path, JSON.stringify(json, null, 2) + "\n");
};

const updateFilesForBlog = async (dir: string) => {
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

const addSveltiaFiles = async (dir: string) => {
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

const agentsMd = `We're using the Mastro web framework.

- Use web search with \`site:mastrojs.github.io\` to look up Mastro docs.
- Use web search with \`site:developer.mozilla.org\` to look up web platform
  features. Use the APIs if they're "Baseline Widely available".
- Write semantic HTML.
- CSS
  - Never add inline CSS
  - Avoid adding classes if you can use HTML element selectors
  - Use a [two-layer approach](https://theadminbar.com/semantics-and-primitives-color-system/)
    for CSS variables (primitives like \`--blue: #0000ff\`,
    and semantics like \`--link-color: var(--blue)\`).
  - Ask the user whether they want to only have a single global
    [styles.css](routes/styles.css) file (good for smaller projects),
    or whether they want to colocate CSS files with their HTML
    in [components](components/) and if so
    [which approach they prefer](https://mastrojs.github.io/blog/2026-05-26-component-scoped-css-without-build-step/)
- Only use [client-side JavaScript](https://mastrojs.github.io/guide/interactivity-with-javascript-in-the-browser/)
  if absolutely necessary. If so, use \`<script type="module">\`.
`;

const installDeps = async (dir: string) => {
  const install = packageManager + " install";
  const { code, stdout, stderr } = await execCmd(install, { cwd: dir });
  if (code !== 0) {
    console.warn("Couldn't install dependencies", stdout, stderr);
  }
};

const loadingSpinnerUntil = async (p: Promise<unknown>) => {
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

  // set up terminal for interactive keyboard UI (e.g. with the `select` function):
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  const templateMsg = `Which template do you want to start with? ${
    ansiSetGrey}Use up/down arrow keys:${ansiResetStyles}`;
  const blogTemplate = "blog (with markdown support)";
  const template = runtime === "cloudflare"
    ? "basic"
    : await select(templateMsg, ["basic", blogTemplate]);
  const templateFetchZipPromise = template === "basic"
    ? undefined
    : fetch(`https://github.com/mastrojs/mastro/archive/refs/heads/main.zip`);

  const addSveltia = template === blogTemplate
    ? await select(
      "Do you want to add a git-based CMS? This adds a routes/admin/ folder.",
      ["No", "Add Sveltia CMS"],
    ) === "Add Sveltia CMS"
    : false;

  const zipOutDir = repoName + "-main"; // cannot be changed and is determined by the zip file
  await unzip({ fetchZipPromise, zipFileName: zipOutDir + ".zip" });
  try {
    await fs.rename(zipOutDir, dir);
  } catch (e) {
    console.error(
      (e as NodeJS.ErrnoException).code === "ENOTEMPTY"
        ? `Could not create directory ${dir}: it already exists.`
        : e,
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
    } catch {
      console.error(
        `Created folder ${dir} but failed to patch it for npm. Please use pnpm instead.`,
      );
    }
  }

  if (templateFetchZipPromise) {
    // Update dir with things from @mastrojs/mastro's `examples/blog/` folder.
    await unzip({ fetchZipPromise: templateFetchZipPromise, zipFileName: templateOutDir + ".zip" });

    if (template === blogTemplate) {
      await updateFilesForBlog(dir);
      if (addSveltia) {
        await addSveltiaFiles(dir);
      }
    }

    await fs.rm(templateOutDir, { recursive: true });
  }

  const installDepsP = "Yes" === await select("Install dependencies? (recommended)", ["Yes", "No"])
    ? installDeps(dir)
    : undefined;

  if ("Yes" === await select("Add AGENTS.md file? (optional)", ["Yes", "No"])) {
    await fs.writeFile(join(dir, "AGENTS.md"), agentsMd);
  }

  const initGit =
    "Yes" === await select("Initialize a new git repository? (optional)", ["Yes", "No"]);

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
