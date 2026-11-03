import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Mastro } from "./core/mastro.ts";
import { generate } from "./generator.ts";
import { createApp } from "./servers/server.ts";

test("generate: programmatic router with createApp", async (t) => {
  const outFolder = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(outFolder, { recursive: true, force: true }));

  const infos = t.mock.method(console, "info", () => {});
  const warnings = t.mock.method(console, "warn", () => {});
  const errors = t.mock.method(console, "error", () => {});
  const app = createApp()
    .get("/", (req, ...extra) => {
      assert.deepEqual(extra, []);
      return new Response("home");
    })
    .get("/notfound", () => new Response("oops", { status: 404 }))
    .get("/error", () => {
      throw Error("thrown route error");
    })
    .get("/reject", () => Promise.reject(Error("rejected route error")));

  const success = await generate(app, { outFolder });
  const diagnostics = [...warnings.mock.calls, ...errors.mock.calls]
    .map((call) => call.arguments.join(" "))
    .join("\n");

  assert.equal(success, false, "Generation must report failed routes");
  assert.equal(infos.mock.callCount(), 1);
  assert.deepEqual(infos.mock.calls[0]!.arguments, ["GET / => 200", "/"]);
  assert.equal(await readFile(join(outFolder, "index.html"), "utf8"), "home");
  const files = await readdir(outFolder);
  assert.ok(!files.includes("notfound"), "A 404 response must not produce a file");
  assert.ok(!files.includes("error"), "A throwing route must not produce a file");
  assert.ok(!files.includes("reject"), "A rejected route must not produce a file");
  assert.match(diagnostics, /GET \/notfound => 404/);
  assert.match(diagnostics, /GET \/error => 500/);
  assert.match(diagnostics, /thrown route error/);
  assert.match(diagnostics, /GET \/reject => 500/);
  assert.match(diagnostics, /rejected route error/);
});

const mastroCli = fileURLToPath(new URL("./cli.ts", import.meta.url));

test("generation does not alter shared middleware or intercept another app's routes", async (t) => {
  t.mock.method(console, "info", () => {});
  const outFolder = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(outFolder, { recursive: true, force: true }));
  const app = createApp().get("/", () => new Response("app A"));
  const other = createApp().get("/", () => new Response("app B"));
  const original = [...app.middlewares];

  for (let i = 0; i < 2; i++) {
    assert.equal(await generate(app, { outFolder }), true);
    assert.deepEqual(app.middlewares, original);
    assert.deepEqual(other.middlewares, original);
    assert.equal(await readFile(join(outFolder, "index.html"), "utf8"), "app A");
    const response = await other.createHandler()(new Request("https://example.com/"));
    assert.equal(await response.text(), "app B");
  }
});

test("generation adds standard middleware when staticFiles is absent", async (t) => {
  t.mock.method(console, "info", () => {});
  const errors = t.mock.method(console, "error", () => {});
  const outFolder = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(outFolder, { recursive: true, force: true }));
  let calls = 0;
  const failure = new Error("route failed");
  const app = new Mastro({
    middlewares: [
      (req, ctx) => {
        calls++;
        return ctx.fetchUpstream(req);
      },
    ],
  }).get("/", () => {
    throw failure;
  });
  const original = [...app.middlewares];

  assert.equal(await generate(app, { outFolder }), false);
  assert.deepEqual(app.middlewares, original);
  assert.equal(calls, 1);
  assert.equal(errors.mock.callCount(), 1);
  assert.equal(errors.mock.calls[0]!.arguments[1], failure);
  assert.deepEqual(await readdir(outFolder), []);
});

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
      /font-family: sans-serif;/,
    );
  });
}
