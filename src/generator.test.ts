import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
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
  assert.equal(infos.mock.callCount(), 0, "Successful generator requests are not logged");
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

test("generator: programmatic routes generate their declared static paths", async (t) => {
  t.mock.method(console, "info", () => {});
  const outFolder = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(outFolder, { recursive: true, force: true }));
  const requestedPaths: string[] = [];
  let enumerations = 0;
  const app = new Mastro({
    middlewares: [{ name: "staticFiles", handler: (req, ctx) => ctx.fetchUpstream(req) }],
  }).get("/posts/:slug/", {
    getStaticPaths: async () => {
      enumerations++;
      return ["/posts/hello/", "/posts/hello%20world/"];
    },
    handler: (req) => {
      const path = new URL(req.url).pathname;
      requestedPaths.push(path);
      return new Response(path);
    },
  });

  assert.equal(await generate(app, { outFolder }), true);
  assert.equal(enumerations, 1);
  assert.deepEqual(requestedPaths, ["/posts/hello/", "/posts/hello%20world/"]);
  assert.deepEqual((await readdir(join(outFolder, "posts"))).sort(), ["hello", "hello world"]);
  assert.equal(await readFile(join(outFolder, "posts", "hello", "index.html"), "utf8"), "/posts/hello/");
  assert.equal(
    await readFile(join(outFolder, "posts", "hello world", "index.html"), "utf8"),
    "/posts/hello%20world/",
  );
});

test("generator: generates GET and ALL routes and skips other methods", async (t) => {
  t.mock.method(console, "info", () => {});
  const outFolder = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(outFolder, { recursive: true, force: true }));
  const app = new Mastro({
    middlewares: [{ name: "staticFiles", handler: (req, ctx) => ctx.fetchUpstream(req) }],
  })
    .get("/", () => new Response("home"))
    .addRoute("all", "/all.html", (req) => new Response(req.method))
    .post("/submit.html", () => new Response("submitted"))
    .post("/posts/:slug/", () => new Response("created"))
    .put("/update.html", {
      getStaticPaths: () => {
        assert.fail("Non-GET routes must not enumerate static paths");
      },
      handler: () => new Response("updated"),
    });

  assert.equal(await generate(app, { outFolder }), true);
  assert.deepEqual((await readdir(outFolder)).sort(), ["all.html", "index.html"]);
  assert.equal(await readFile(join(outFolder, "index.html"), "utf8"), "home");
  assert.equal(await readFile(join(outFolder, "all.html"), "utf8"), "GET");
});

test("generator: dynamic programmatic routes require explicit static paths", async (t) => {
  const outFolder = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(outFolder, { recursive: true, force: true }));

  for (const pathname of ["/posts/:slug/", "/files/*", "/posts/:id(\\d+)/", "/posts{/archive}?"]) {
    let calls = 0;
    const app = new Mastro({
      middlewares: [{ name: "staticFiles", handler: (req, ctx) => ctx.fetchUpstream(req) }],
    }).get(pathname, () => {
      calls++;
      return new Response("page");
    });

    await assert.rejects(generate(app, { outFolder }), /should provide a getStaticPaths function/);
    assert.equal(calls, 0);
  }
});

test("file routes can read files using encoded URLPattern slugs", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const name = "hello # %20 ü";
  await mkdir(join(cwd, "data", "posts"), { recursive: true });
  await mkdir(join(cwd, "routes", "posts", "[slug]"), { recursive: true });
  await mkdir(join(cwd, "routes", name), { recursive: true });
  await writeFile(join(cwd, "data", "posts", name + ".md"), "post content");
  await writeFile(join(cwd, "routes", name, "index.server.ts"),
    'export const GET = () => new Response("fixed route");');
  await writeFile(join(cwd, "routes", "posts", "[slug]", "index.server.ts"), `
    import { readTextFile } from ${JSON.stringify(new URL("./core/fs.ts", import.meta.url).href)};
    export const getStaticPaths = () => ['/posts/' + encodeURIComponent(${JSON.stringify(name)}) + '/'];
    export const GET = async (req) => {
      const { slug } = new URLPattern({ pathname: '/posts/:slug/' }).exec(req.url).pathname.groups;
      return new Response(await readTextFile('data/posts/' + slug + '.md'));
    };
  `);
  const script = `
    import assert from 'node:assert/strict';
    import { generate } from ${JSON.stringify(new URL("./generator.ts", import.meta.url).href)};
    import { createFileRouterApp } from ${JSON.stringify(new URL("./servers/server.ts", import.meta.url).href)};
    const app = createFileRouterApp();
    const response = await app.createHandler()(new Request('http://localhost/posts/' + encodeURIComponent(${JSON.stringify(name)}) + '/'));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'post content');
    assert.equal(await generate(app), true);
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd, encoding: "utf8", timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(await readFile(join(cwd, "generated", "posts", name, "index.html"), "utf8"), "post content");
  assert.equal(await readFile(join(cwd, "generated", name, "index.html"), "utf8"), "fixed route");
});

test("generator: encodes filesystem names and decodes generated output exactly once", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, "routes", "assets"), { recursive: true });
  const asset = "hello # %20 ü.css";
  const client = "hello # %20 ü.client";
  await writeFile(join(cwd, "routes", "assets", asset), "body { color: red; }");
  await writeFile(join(cwd, "routes", "assets", client + ".ts"), 'const value: string = "hello";');
  await writeFile(join(cwd, "secret.client.ts"), 'const secret = "outside routes";');

  const script = `
    import assert from 'node:assert/strict';
    import { generate } from ${JSON.stringify(new URL("./generator.ts", import.meta.url).href)};
    import { createApp } from ${JSON.stringify(new URL("./servers/server.ts", import.meta.url).href)};
    const app = createApp()
      .get('/hello%20world/', () => new Response('page'))
      .get('/download', () => new Response('download', {
        headers: { 'Content-Disposition': 'filename="file %20.txt"' }
      }));
    const handler = app.createHandler();
    const assetUrl = '/assets/' + encodeURIComponent(${JSON.stringify(asset)});
    const response = await handler(new Request('http://localhost' + assetUrl));
    assert.equal(await response.text(), 'body { color: red; }');
    const invalid = await handler(new Request('http://localhost/%FF'));
    assert.equal(invalid.status, 400);
    const invalidClient = await handler(new Request('http://localhost/%FF.client.js'));
    assert.equal(invalidClient.status, 400);
    const clientUrl = '/assets/' + encodeURIComponent(${JSON.stringify(client + ".js")});
    const productionClient = await handler(new Request('http://127.0.0.1' + clientUrl));
    assert.equal(productionClient.status, 404);
    const traversal = await handler(new Request('http://localhost/%2e%2e%2fsecret.client.js'));
    assert.equal(traversal.status, 400);
    assert.equal(await generate(app), true);
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(
    await readFile(join(cwd, "generated", "assets", asset), "utf8"),
    "body { color: red; }",
  );
  assert.match(
    await readFile(join(cwd, "generated", "assets", client + ".js"), "utf8"),
    /const value\s*= "hello";/,
  );
  assert.equal(await readFile(join(cwd, "generated", "hello world", "index.html"), "utf8"), "page");
  assert.equal(await readFile(join(cwd, "generated", "file %20.txt"), "utf8"), "download");
});

test("generator: rejects ambiguous URL paths from middleware", async (t) => {
  t.mock.method(console, "info", () => {});
  const outFolder = await mkdtemp(join(tmpdir(), "mastro-test-"));
  t.after(() => rm(outFolder, { recursive: true, force: true }));
  for (const path of ["/file#name.txt", "/file?name.txt", "/file%name.txt", "/folder\\file.txt"]) {
    const app = new Mastro({
      middlewares: [
        {
          name: "staticFiles",
          getStaticPaths: () => [path],
          handler: () => new Response("file"),
        },
      ],
    });
    await assert.rejects(generate(app, { outFolder }), path.includes("%") ? URIError : /encoded URL paths/);
  }
});

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
