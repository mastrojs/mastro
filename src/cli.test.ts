import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { cp, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("CLI generate: fails on missing server file", async () => {
  await runCli("generate", {}, async (_cwd, result) => {
    assert.equal(result.status, 1, result.stderr);
    assert.ok(
      result.stderr.includes(
        "No `server.ts` or `server.js` found in the project directory root.\n" +
          "Create one containing `export const app = new Mastro()` or similar.",
      ),
      result.stderr,
    );
  });
});

for (const name of ["basic-node", "basic-bun"]) {
  test(`CLI generate: ${name} example`, async () => {
    await runCli("generate", { example: name }, async (cwd, result) => {
      assert.equal(result.status, 0, result.stdout + result.stderr);

      const html = await readFile(join(cwd, "generated/index.html"), "utf8");
      assert.match(html, /<title>Hello World<\/title>/);
      assert.match(html, /<h1>Hello World<\/h1>/);
      assert.match(html, /<p>Welcome!<\/p>/);
      assert.match(html, /href="\/styles\.css"/);
      assert.match(
        await readFile(join(cwd, "generated/styles.css"), "utf8"),
        /font-family: sans-serif;/,
      );
    });
  });
}

const runCli = async (
  command: string,
  options: {
    args?: string[];
    example?: string;
    setup?: (cwd: string) => Promise<void>;
  },
  run: (cwd: string, result: SpawnSyncReturns<string>) => Promise<void>,
) => {
  const cwd = await mkdtemp(join(tmpdir(), "mastro-test-"));
  try {
    if (options.example) {
      const example = fileURLToPath(new URL(`../examples/${options.example}/`, import.meta.url));
      await cp(example, cwd, {
        recursive: true,
        filter: (source) => !["node_modules", "generated"].includes(basename(source)),
      });
      // Reuse installed workspace dependencies without copying pnpm's relative symlinks.
      await symlink(join(example, "node_modules"), join(cwd, "node_modules"), "junction");
    }
    await options.setup?.(cwd);

    const result = spawnSync(process.execPath, [mastroPath, command, ...(options.args ?? [])], {
      cwd,
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.ifError(result.error);
    await run(cwd, result);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
};

const mastroPath = fileURLToPath(new URL("./cli.ts", import.meta.url));
