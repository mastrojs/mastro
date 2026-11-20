import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { html } from "./core/html.ts";
import { asset, htmlToResponse } from "./core/responses.ts";
import { generate } from "./generator.ts";
import { Mastro } from "./mastro.ts";
import {
  createApp,
  createFileRouterApp,
  middlewares as defaultMiddlewares,
} from "./servers/server.ts";
import type { Context, Middleware } from "./types/middleware.d.ts";

test("generate: programmatic router with createApp", async (t) => {
  await withTestEnvironment(t, async (outFolder, warnings, errors) => {
    let finalized = false;
    const app = createApp()
      .get("/", (req, { extras }) => {
        assert.deepEqual(extras, []);
        return new Response("home");
      })
      .get("/notfound", () => new Response("oops", { status: 404 }));
    app.use({
      name: "set finalized=true in afterGenerate",
      handler: (req, ctx) => ctx.fetchNext(req),
      afterGenerate: () => {
        finalized = true;
      },
    });

    assert.equal(await generate(app, { outFolder }), true, "A 404 must not fail generation");
    assert.deepEqual(await readdir(outFolder), ["index.html"]);
    assert.match(warnings.join("\n"), /GET \/notfound => 404/);
    assert.deepEqual(errors, []);
    assert.equal(finalized, true);

    finalized = false;
    app
      .get("/error", () => {
        throw Error("thrown route error");
      })
      .get("/reject", () => Promise.reject(Error("rejected route error")));

    const success = await generate(app, { outFolder });
    const diagnostics = [...warnings, ...errors].join("\n");

    assert.equal(success, false, "Generation must report failed routes");
    assert.equal(finalized, false, "Failed generation must not run afterGenerate");
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
});

test("generator: middleware locals are fresh per page and hooks receive generation options", async (t) => {
  await withTestEnvironment(t, async (outFolder) => {
    const contexts = new Set();
    let enumerated = false;
    let finalized = false;
    const middleware: Middleware<{ title: string }, Context<[string]>> = {
      name: "titles",
      handler: (req, ctx) => {
        assert.equal(ctx.mode, "generator");
        assert.deepEqual(ctx.locals, {});
        assert.deepEqual(ctx.params, {});
        assert.ok(!contexts.has(ctx.locals));
        contexts.add(ctx.locals);
        if (false) {
          // @ts-expect-error Generated requests also expose read-only incoming locals.
          ctx.locals.visited = true;
        }
        return ctx.fetchNext(req, { title: ctx.extras[0] + new URL(req.url).pathname });
      },
      getStaticPaths: (ctx) => {
        const extras: readonly [string] = ctx.extras;
        const mode: "generator" = ctx.mode;
        if (false) {
          // @ts-expect-error Hooks preserve the context's declared extras.
          const invalid: readonly [number] = ctx.extras;
          // @ts-expect-error Hooks only receive generator settings.
          ctx.environment;
          // @ts-expect-error Hooks do not receive request-specific locals.
          ctx.locals;
          // @ts-expect-error Hooks cannot forward requests.
          ctx.fetchNext;
        }
        assert.equal(mode, "generator");
        assert.deepEqual(extras, ["page"]);
        assert.ok(!("locals" in ctx));
        enumerated = true;
        return [];
      },
      afterGenerate: (ctx) => {
        const extras: readonly [string] = ctx.extras;
        if (false) {
          // @ts-expect-error Hooks preserve the context's declared extras.
          const invalid: readonly [number] = ctx.extras;
        }
        assert.deepEqual(extras, ["page"]);
        assert.equal(ctx.outFolder, outFolder);
        assert.ok(!("params" in ctx));
        finalized = true;
      },
    };
    const app = createApp<[string]>()
      .use(middleware)
      .get("/:name", {
        getStaticPaths: () => ["/first.html", "/second.html"],
        handler: (_req, ctx) => {
          assert.ok(!("fetchNext" in ctx));
          if (false) {
            // @ts-expect-error Generated route contexts cannot forward either.
            ctx.fetchNext;
          }
          assert.equal(typeof ctx.params.name, "string");
          return new Response(ctx.locals.title);
        },
      });
    if (false) {
      // @ts-expect-error Generation extras must match the app's declared element types.
      void generate(app, { extras: [42] });
      // @ts-expect-error Generation extras must match the app's declared tuple length.
      void generate(app, { extras: ["page", "extra"] });
    }
    assert.equal(await generate(app, { outFolder, extras: ["page"] }), true);
    assert.equal(await readFile(join(outFolder, "first.html"), "utf8"), "page/first.html");
    assert.equal(await readFile(join(outFolder, "second.html"), "utf8"), "page/second.html");
    assert.equal(contexts.size, 2);
    assert.equal(enumerated, true);
    assert.equal(finalized, true);
  });
});

test("generator: programmatic routes generate their declared static paths", async (t) => {
  await withTestEnvironment(t, async (outFolder) => {
    const requestedPaths: string[] = [];
    let enumerations = 0;
    const app = new Mastro()
      .use({ name: "staticFiles", handler: (req, ctx) => ctx.fetchNext(req) })
      .get("/posts/:slug/", {
        getStaticPaths: async () => {
          enumerations++;
          return ["/posts/hello/", "/posts/hello%20world/"];
        },
        handler: (req, { params }) => {
          const path = new URL(req.url).pathname;
          requestedPaths.push(path);
          return new Response(`/posts/${params.slug}/`);
        },
      });

    assert.equal(await generate(app, { baseUrl: "https://example.com/", outFolder }), true);
    assert.equal(enumerations, 1);
    assert.deepEqual(requestedPaths, ["/posts/hello/", "/posts/hello%20world/"]);
    assert.deepEqual((await readdir(join(outFolder, "posts"))).sort(), ["hello", "hello world"]);
    assert.equal(
      await readFile(join(outFolder, "posts", "hello", "index.html"), "utf8"),
      "/posts/hello/",
    );
    assert.equal(
      await readFile(join(outFolder, "posts", "hello world", "index.html"), "utf8"),
      "/posts/hello%20world/",
    );
  });
});

test("generator: generates GET and ALL routes and skips other methods", async (t) => {
  await withTestEnvironment(t, async (outFolder) => {
    const app = new Mastro()
      .use({ name: "staticFiles", handler: (req, ctx) => ctx.fetchNext(req) })
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
});

for (const factory of [createApp, createFileRouterApp]) {
  test(`generate: ${factory.name} pregenerated-page lifecycle`, async (t) => {
    await withTestEnvironment(
      t,
      async (cwd) => {
        await mkdir(join(cwd, "routes", "about"), { recursive: true });
        await mkdir(join(cwd, "routes", "posts", "[slug]"), { recursive: true });
        await mkdir(join(cwd, "routes", "live"), { recursive: true });
        await writeFile(join(cwd, "routes", "styles.css"), "body {}");
        await writeFile(
          join(cwd, "routes", "about", "index.server.ts"),
          `
        export const pregenerate = true;
        export let calls = 0;
        export const GET = () => new Response('about ' + ++calls);
      `,
        );
        await writeFile(
          join(cwd, "routes", "posts", "[slug]", "index.server.ts"),
          `
        export const pregenerate = true;
        export let calls = 0;
        export let enumerations = 0;
        export const getStaticPaths = () => {
          enumerations++;
          return ['/posts/built/'];
        };
        export const GET = () => new Response('post ' + ++calls);
      `,
        );
        await writeFile(
          join(cwd, "routes", "live", "[slug].server.ts"),
          `
        export let calls = 0;
        export const getStaticPaths = () => {
          throw new Error('Ordinary routes must not enumerate paths during pregeneration');
        };
        export const GET = () => new Response('live ' + ++calls);
      `,
        );

        const about = await import(pathToFileURL(join(cwd, "routes/about/index.server.ts")).href);
        const posts = await import(
          pathToFileURL(join(cwd, "routes/posts/[slug]/index.server.ts")).href
        );
        const live = await import(pathToFileURL(join(cwd, "routes/live/[slug].server.ts")).href);

        const app = factory();
        if (factory === createApp) {
          app.get("/about/", { handler: about.GET, pregenerate: about.pregenerate });
          app.get("/posts/:slug/", {
            handler: posts.GET,
            pregenerate: posts.pregenerate,
            getStaticPaths: posts.getStaticPaths,
          });
          app.get("/live/:slug", { handler: live.GET, getStaticPaths: live.getStaticPaths });
        }
        let production = app.createHandler({ environment: "production" });
        const request = (path: string) => new Request("https://example.com" + path);
        const pages = [
          ["/about/", "generated/about/index.html", about, "about"],
          ["/posts/built/", "generated/posts/built/index.html", posts, "post"],
        ] as const;

        // Missing build output must not trigger an on-demand render in production.
        for (const [path, , route] of pages) {
          const response = await production(request(path));
          assert.equal(response.status, 404, path);
          assert.match(await response.text(), /only-pregenerate/);
          assert.equal(route.calls, 0, path);
        }

        assert.equal(await generate(app, { onlyPregenerate: true }), true);
        assert.equal(posts.enumerations, 1);
        assert.equal(live.calls, 0, "Ordinary routes must not render during pregeneration");
        assert.deepEqual((await readdir("generated")).sort(), ["about", "posts", "styles.css"]);
        assert.deepEqual(await readdir("generated/posts"), ["built"]);
        assert.equal(await readFile("generated/styles.css", "utf8"), "body {}");

        // Simulate server startup after the build, with a fresh module-level directory check.
        const { staticFiles } = await import(
          `./middlewares/staticFiles/staticFiles.ts?startup=${encodeURIComponent(cwd)}`
        );
        const server = new Mastro({ routes: app.getRoutes() });
        for (const middleware of app.getMiddlewares()) {
          server.use(middleware.name === "staticFiles" ? staticFiles : middleware);
        }
        production = server.createHandler({ environment: "production" });

        for (const [path, file, route, name] of pages) {
          assert.equal(route.calls, 1, path);
          assert.equal(await readFile(file, "utf8"), name + " 1");
          const cached = await production(request(path));
          assert.equal(cached.status, 200, path);
          assert.equal(await cached.text(), name + " 1");
          assert.equal(route.calls, 1, "Production must serve the generated file");
        }

        const missing = await production(request("/posts/not-generated/"));
        assert.equal(missing.status, 404);
        await missing.text();
        assert.equal(posts.calls, 1, "Unlisted paths must not render in production");

        const dynamic = await production(request("/live/example"));
        assert.equal(dynamic.status, 200);
        assert.equal(await dynamic.text(), "live 1");
        assert.equal(live.calls, 1, "Ordinary routes must remain available on demand");

        const development = app.createHandler({ environment: "development" });
        for (const [path, , route, name] of pages) {
          const fresh = await development(request(path));
          assert.equal(fresh.status, 200, path);
          assert.equal(await fresh.text(), name + " 2");
          assert.equal(route.calls, 2, "Development must invoke the live handler");
        }
      },
      { changeCwd: true },
    );
  });
}

test("generator: dynamic programmatic routes require explicit static paths", async (t) => {
  await withTestEnvironment(t, async (outFolder) => {
    for (const pathname of [
      "/posts/:slug/",
      "/files/*",
      "/posts/:id(\\d+)/",
      "/posts{/archive}?",
    ] as const) {
      let calls = 0;
      const app = new Mastro()
        .use({ name: "staticFiles", handler: (req, ctx) => ctx.fetchNext(req) })
        .get(pathname, () => {
          calls++;
          return new Response("page");
        });

      await assert.rejects(
        generate(app, { outFolder }),
        /should provide a getStaticPaths function/,
      );
      assert.equal(calls, 0);
    }
  });
});

test("generate: file routes can read files using encoded URLPattern slugs", async (t) => {
  await withTestEnvironment(t, async (cwd) => {
    const name = "hello(1) # %20 ü";
    await mkdir(join(cwd, "data", "posts"), { recursive: true });
    await mkdir(join(cwd, "routes", "posts", "[slug]"), { recursive: true });
    await mkdir(join(cwd, "routes", name), { recursive: true });
    await writeFile(join(cwd, "data", "posts", name + ".md"), "post content");
    await writeFile(
      join(cwd, "routes", name, "index.server.ts"),
      'export const GET = () => new Response("fixed route");',
    );
    await writeFile(
      join(cwd, "routes", "posts", "[slug]", "index.server.ts"),
      `
      import { readTextFile } from ${JSON.stringify(new URL("./core/fs.ts", import.meta.url).href)};
      export const getStaticPaths = () => ['/posts/' + encodeURIComponent(${JSON.stringify(name)}) + '/'];
      export const GET = async (req) => {
        const { slug } = new URLPattern({ pathname: '/posts/:slug/' }).exec(req.url).pathname.groups;
        return new Response(await readTextFile('data/posts/' + slug + '.md'));
      };
    `,
    );
    const script = `
      import assert from 'node:assert/strict';
      import { generate } from ${JSON.stringify(new URL("./generator.ts", import.meta.url).href)};
      import { createFileRouterApp } from ${JSON.stringify(new URL("./servers/server.ts", import.meta.url).href)};
      const app = createFileRouterApp();
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
      await readFile(join(cwd, "generated", "posts", name, "index.html"), "utf8"),
      "post content",
    );
    assert.equal(await readFile(join(cwd, "generated", name, "index.html"), "utf8"), "fixed route");
  });
});

test("generator: encodes filesystem names and decodes generated output exactly once", async (t) => {
  await withTestEnvironment(t, async (cwd) => {
    await mkdir(join(cwd, "routes", "assets"), { recursive: true });
    const asset = "hello # %20 ü.css";
    const client = "hello # %20 ü.client";
    await writeFile(join(cwd, "routes", "assets", asset), "body { color: red; }");
    await writeFile(
      join(cwd, "routes", "assets", client + ".ts"),
      'const value: string = "hello";',
    );

    const script = `
      import assert from 'node:assert/strict';
      import { generate } from ${JSON.stringify(new URL("./generator.ts", import.meta.url).href)};
      import { createApp } from ${JSON.stringify(new URL("./servers/server.ts", import.meta.url).href)};
      const app = createApp()
        .get('/hello%20world/', () => new Response('page'))
        .get('/download', () => new Response('download', {
          headers: { 'Content-Disposition': 'filename="file%20%2520.txt"' }
        }))
        .get('/downloads/report', () => new Response('nested download', {
          headers: { 'Content-Disposition': 'filename="file%20%2520.txt"' }
        }));
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
    assert.equal(
      await readFile(join(cwd, "generated", "hello world", "index.html"), "utf8"),
      "page",
    );
    assert.equal(await readFile(join(cwd, "generated", "file %20.txt"), "utf8"), "download");
    assert.equal(
      await readFile(join(cwd, "generated", "downloads", "file %20.txt"), "utf8"),
      "nested download",
    );
  });
});

test("generate: fingerprints static and route assets before rendering pages in one build", async (t) => {
  await withTestEnvironment(
    t,
    async () => {
      await mkdir("routes/_assets", { recursive: true });
      await writeFile("routes/_assets/static.css", "hello");
      let includeRouteAsset = true;
      let assetCalls = 0;
      const page = () => htmlToResponse(html`${asset("static.css")} ${asset("route.css")}`);
      // This middleware enumerates a page before either source of assets.
      const app = new Mastro().use({
        name: "error page",
        getStaticPaths: () => ["/404.html"],
        handler: (req, ctx) =>
          new URL(req.url).pathname === "/404.html" ? page() : ctx.fetchNext(req),
      });
      for (const middleware of defaultMiddlewares) app.use(middleware);
      app
        .get("/_assets/route.css", {
          getStaticPaths: () => (includeRouteAsset ? ["/_assets/route.css"] : []),
          handler: () => {
            assetCalls++;
            return new Response("world");
          },
        })
        .get("/", page);
      assert.equal(await generate(app), true);
      assert.equal(assetCalls, 1, "Route assets must be generated only once");
      for (const file of ["generated/index.html", "generated/404.html"]) {
        assert.equal(
          await readFile(file, "utf8"),
          "/_assets/static-2cf24dba.css /_assets/route-486ea462.css",
        );
      }
      assert.equal(await readFile("generated/_assets/static-2cf24dba.css", "utf8"), "hello");
      assert.equal(await readFile("generated/_assets/route-486ea462.css", "utf8"), "world");
      await assert.rejects(readFile("generatedAssets.json"), { code: "ENOENT" });

      includeRouteAsset = false;
      await writeFile("routes/_assets/static.css", "world");
      assert.equal(await generate(app), true);
      assert.equal(assetCalls, 1);
      assert.equal(
        await readFile("generated/index.html", "utf8"),
        "/_assets/static-486ea462.css /_assets/route.css",
        "A subsequent build must update changed hashes and forget removed assets",
      );
      assert.deepEqual(await readdir("generated/_assets"), ["static-486ea462.css"]);
    },
    { changeCwd: true },
  );
});

test("generate: writes fingerprinted assets and their URL mapping for production serving", async (t) => {
  await withTestEnvironment(t, async (cwd) => {
    await mkdir(join(cwd, "routes", "_assets", "nested folder"), { recursive: true });
    await writeFile(
      join(cwd, "routes", "index.server.ts"),
      'export const GET = () => new Response("home");',
    );
    const assets = [
      ["plain", "plain-2cf24dba"],
      ["nested.dir/plain", "nested.dir/plain-2cf24dba"],
      ["styles.css", "styles-2cf24dba.css"],
      ["hello world.css", "hello world-2cf24dba.css"],
      ['hello # %20 ü; " 世界.css', 'hello # %20 ü; " 世界-2cf24dba.css'],
    ];
    for (const [name] of assets) {
      const path = join(cwd, "routes", "_assets", "nested folder", name!);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "hello");
    }

    const script = `
      import assert from 'node:assert/strict';
      import { readFile } from 'node:fs/promises';
      import { generate } from ${JSON.stringify(new URL("./generator.ts", import.meta.url).href)};
      import { createApp } from ${JSON.stringify(new URL("./servers/server.ts", import.meta.url).href)};
      const app = createApp();
      assert.equal(await generate(app, { onlyPregenerate: true }), true);
      const hashes = JSON.parse(await readFile('generatedAssets.json', 'utf8'));
      for (const [name, expected] of ${JSON.stringify(assets)}) {
        const encodedName = name.split('/').map(encodeURIComponent).join('/');
        const key = 'nested%20folder/' + encodedName;
        const hashedPath = hashes[key];
        assert.equal(hashedPath, '/_assets/nested%20folder/' + expected.split('/').map(encodeURIComponent).join('/'));
        assert.equal(await readFile('generated' + decodeURIComponent(hashedPath), 'utf8'), 'hello');
      }
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd,
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);

    // A fresh process must load the persisted mapping and generated directory at startup.
    const serveScript = `
      import assert from 'node:assert/strict';
      import { readFile } from 'node:fs/promises';
      import { asset } from ${JSON.stringify(new URL("./core/responses.ts", import.meta.url).href)};
      import { createApp, createFileRouterApp } from ${JSON.stringify(new URL("./servers/server.ts", import.meta.url).href)};
      const hashes = JSON.parse(await readFile('generatedAssets.json', 'utf8'));
      for (const factory of [createApp, createFileRouterApp]) {
        const handler = factory().createHandler({ environment: 'production' });
        for (const [name] of ${JSON.stringify(assets)}) {
          const key = 'nested%20folder/' + name.split('/').map(encodeURIComponent).join('/');
          const hashedPath = hashes[key];
          assert.equal(asset(key), hashedPath);
          const response = await handler(new Request('https://example.com' + asset(key)));
          assert.equal(response.status, 200, factory.name + ': ' + hashedPath);
          assert.equal(await response.text(), 'hello', factory.name + ': ' + hashedPath);
        }
      }
    `;
    const serving = spawnSync(process.execPath, ["--input-type=module", "-e", serveScript], {
      cwd,
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.ifError(serving.error);
    assert.equal(serving.status, 0, serving.stdout + serving.stderr);
  });
});

test("generator: rejects ambiguous URL paths from middleware", async (t) => {
  await withTestEnvironment(t, async (outFolder) => {
    for (const path of [
      "/file#name.txt",
      "/file?name.txt",
      "/file%name.txt",
      "/folder\\file.txt",
    ]) {
      const app = new Mastro().use({
        name: "staticFiles",
        getStaticPaths: () => [path],
        handler: () => new Response("file"),
      });
      await assert.rejects(
        generate(app, { outFolder }),
        path.includes("%") ? URIError : /encoded URL paths/,
      );
    }
  });
});

test("generate: does not alter shared middleware or intercept another app's routes", async (t) => {
  await withTestEnvironment(t, async (outFolder) => {
    const app = createApp().get("/", () => new Response("app A"));
    const other = createApp().get("/", () => new Response("app B"));
    const handler = other.createHandler({ environment: "production" });
    const original = app.getMiddlewares();

    for (let i = 0; i < 2; i++) {
      assert.equal(await generate(app, { outFolder }), true);
      assert.deepEqual(app.getMiddlewares(), original);
      assert.deepEqual(other.getMiddlewares(), original);
      assert.equal(await readFile(join(outFolder, "index.html"), "utf8"), "app A");
      for (const otherHandler of [handler, other.createHandler({ environment: "production" })]) {
        const response = await otherHandler(new Request("https://example.com/"));
        assert.equal(response.status, 200);
        assert.equal(await response.text(), "app B");
      }
      const otherOutFolder = join(outFolder, "other");
      assert.equal(await generate(other, { outFolder: otherOutFolder }), true);
      assert.equal(await readFile(join(otherOutFolder, "index.html"), "utf8"), "app B");
    }
  });
});

test("generate: adds standard middleware when staticFiles is absent", async (t) => {
  await withTestEnvironment(t, async (outFolder, _warnings, errors) => {
    let calls = 0;
    const failure = new Error("route failed");
    const app = new Mastro()
      .use((req, ctx) => {
        calls++;
        return ctx.fetchNext(req);
      })
      .get("/", () => {
        throw failure;
      });
    const original = app.getMiddlewares();

    assert.equal(await generate(app, { outFolder }), false);
    assert.deepEqual(app.getMiddlewares(), original);
    assert.equal(calls, 1);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /GET \/ => 500/);
    assert.ok(errors[0]!.includes(String(failure)));
    assert.deepEqual(await readdir(outFolder), []);
  });
});

const withTestEnvironment = async (
  t: TestContext,
  run: (directory: string, warnings: string[], errors: string[]) => Promise<void>,
  { changeCwd = false } = {},
) => {
  const directory = await mkdtemp(join(tmpdir(), "mastro-test-"));
  const previousCwd = process.cwd();
  const warnings: string[] = [];
  const errors: string[] = [];
  const info = t.mock.method(console, "info", () => {});
  const warn = t.mock.method(console, "warn", (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  });
  const error = t.mock.method(console, "error", (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });
  try {
    if (changeCwd) process.chdir(directory);
    await run(directory, warnings, errors);
  } finally {
    if (changeCwd) process.chdir(previousCwd);
    info.mock.restore();
    warn.mock.restore();
    error.mock.restore();
    await rm(directory, { recursive: true, force: true });
  }
};
