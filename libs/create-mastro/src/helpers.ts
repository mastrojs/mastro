import { exec, type ExecOptions } from "node:child_process";
import fs from "node:fs/promises";
import { join } from "node:path";
import type { Key } from "node:readline";

export type CliContext = typeof context;

export const ansiSetBlue = "\x1b[34m";
export const ansiSetGrey = "\x1b[2m";
export const ansiResetStyles = "\x1b[0m";

const userAgent = process.env.npm_config_user_agent;

const getRuntime = (): "bun" | "cloudflare" | "node" => {
  if (userAgent?.startsWith("bun/")) {
    return "bun"; // the usual ways to detect Bun don't appear to work in `bun create`
  } else if (process.argv[2] === "--cloudflare") {
    return "cloudflare";
  } else {
    return "node";
  }
};

const getPackageManager = (): "pnpm" | "yarn" | "bun" | "npm" => {
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
};

export const context = {
  packageManager: getPackageManager(),
  runtime: getRuntime(),
  zipOutDir: "mastro-main" as const, // cannot be changed and is determined by the zip file
};

export const select = <T extends string>(question: string, options: T[]): Promise<T> =>
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

export const execCmd = (
  cmd: string,
  opts?: ExecOptions,
): Promise<{ code: number; stdout: string; stderr: string }> =>
  new Promise((resolve) =>
    exec(cmd, { ...opts, encoding: "utf8" }, (error, stdout, stderr) =>
      resolve({ code: error ? error.code || -1 : 0, stdout, stderr }),
    ),
  );

export const unzip = async (opts: { fetchZipPromise: Promise<Response>; zipFileName: string }) => {
  const { fetchZipPromise, zipFileName } = opts;
  const res = await fetchZipPromise;
  if (!res.ok || !res.body) {
    throw Error(`fetchZipPromise had status ${res.status}`);
  }
  await fs.writeFile(zipFileName, res.body);

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

export const updateDeps = async (
  dir: string,
  cb: (dependencies: Record<string, string>) => void,
) => {
  const path = join(dir, "package.json");
  const json = JSON.parse(await fs.readFile(path, { encoding: "utf8" }));
  cb(json.dependencies);
  await fs.writeFile(path, JSON.stringify(json, null, 2) + "\n");
};

export const installDeps = async (ctx: CliContext, dir: string) => {
  const install = ctx.packageManager + " install";
  const { code, stdout, stderr } = await execCmd(install, { cwd: dir });
  if (code !== 0) {
    console.warn("Couldn't install dependencies", stdout, stderr);
  }
};

export const loadingSpinnerUntil = async (p: Promise<unknown>) => {
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
