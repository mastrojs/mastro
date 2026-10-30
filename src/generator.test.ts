import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { generate } from "./generator.ts";
import { createApp } from "./servers/server.ts";

test("generate: programmatic router with createApp", async (t) => {
  const outFolder = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(outFolder, { recursive: true, force: true }));

  const warnings = t.mock.method(console, "warn", () => {});
  const errors = t.mock.method(console, "error", () => {});
  const app = createApp()
    .get("/", () => new Response("home"))
    .get("/notfound", () => new Response("oops", { status: 404 }))
    .get("/error", () => { throw Error("thrown route error") })
    .get("/reject", () => Promise.reject(Error("rejected route error")));

  const success = await generate(app, { outFolder });
  const diagnostics = [...warnings.mock.calls, ...errors.mock.calls]
    .map((call) => call.arguments.join(" "))
    .join("\n");

  assert.equal(success, false, "Generation must report failed routes");
  assert.equal(await readFile(join(outFolder, "index.html"), "utf8"), "home");
  const files = await readdir(outFolder);
  assert.ok(!files.includes("error"), "A throwing route must not produce a file");
  assert.ok(!files.includes("reject"), "A rejected route must not produce a file");
  assert.match(diagnostics, /WARNING: skipped path \/notfound since it returned HTTP 404:/);
  assert.match(diagnostics, /ERROR: failed to generate path \/error/);
  assert.match(diagnostics, /thrown route error/);
  assert.match(diagnostics, /ERROR: failed to generate path \/reject/);
  assert.match(diagnostics, /rejected route error/);
});

const mastroCli = fileURLToPath(new URL("./cli.ts", import.meta.url));

test("generator: fails on missing server file", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [mastroCli, "generate"], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  });

  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  assert.ok(
    result.stderr.includes("No `server.ts` or `server.js` file found in the project directory."),
    result.stderr,
  );
});

for (const name of ["basic-node", "basic-bun"]) {
  test(`generator: generates the ${name} example`, async (t) => {
    const cwd = await mkdtemp(join(tmpdir(), "mastro-test-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));

    const example = fileURLToPath(new URL(`../examples/${name}/`, import.meta.url));
    await cp(example, cwd, {
      recursive: true,
      filter: (source) => !["node_modules", "generated"].includes(basename(source)),
    });
    // Reuse installed workspace dependencies without copying pnpm's relative symlinks.
    await symlink(join(example, "node_modules"), join(cwd, "node_modules"), "junction");

    const result = spawnSync(process.execPath, [mastroCli, "generate"], {
      cwd,
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);

    const html = await readFile(join(cwd, "generated/index.html"), "utf8");
    assert.match(html, /<title>Hello World<\/title>/);
    assert.match(html, /<h1>Hello World<\/h1>/);
    assert.match(html, /<p>Welcome!<\/p>/);
    assert.match(html, /href="\/styles\.css"/);
    assert.match(
      await readFile(join(cwd, "generated/styles.css"), "utf8"),
      /font-family: sans-serif;/
    );
  });
}
