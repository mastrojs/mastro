import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { pathToFileURL } from "node:url";

import { Mastro } from "../mastro.ts";
import type { Middleware } from "../types/middleware.d.ts";
import { createApp, createFileRouterApp, middlewares } from "./server.ts";

const originalCwd = process.cwd();
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "mastro-server-test-"));
  process.chdir(directory);
  await mkdir("routes");
});
afterEach(async () => {
  process.chdir(originalCwd);
  await rm(directory, { recursive: true, force: true });
});

for (const factory of [createApp, createFileRouterApp]) {
  test(`${factory.name}: middleware changes stay local to an app`, async () => {
    await writeFile("routes/index.server.ts", 'export const GET = () => new Response("home");');
    const defaults = [...middlewares];
    const first = factory();
    const second = factory().get("/", () => new Response("home"));

    first.use(() => new Response("first middleware"));
    const third = factory().get("/", () => new Response("home"));

    assert.deepEqual(middlewares, defaults);
    const cases = [
      [first, "first middleware"],
      [second, "home"],
      [third, "home"],
    ] as const;
    for (const [app, expected] of cases) {
      const response = await app.createHandler({ environment: "production" })(
        new Request("https://example.com/"),
      );
      assert.equal(response.status, 200);
      assert.equal(await response.text(), expected);
    }
  });
}

for (const environment of ["development", "production"] as const) {
  test(`createFileRouterApp logger.ts: ${environment} success logging preserves the response`, async (t) => {
    const log = t.mock.method(console, "info", () => {});
    const routeName = "routes/posts/[slug].server.ts";
    await mkdir("routes/posts");
    await writeFile(
      routeName,
      `export const original = new Response("article", { headers: { "X-Route": "article" } });
       export const GET = () => original;`,
    );
    const { original } = await import(pathToFileURL(join(directory, routeName)).href);
    const response = await createFileRouterApp().createHandler({ environment })(
      new Request("https://example.com/posts/hello?preview=1"),
    );

    assert.equal(response, original);
    assert.equal(response.headers.get("X-Route"), "article");
    assert.equal(response.bodyUsed, false);
    assert.equal(await response.text(), "article");
    if (environment === "development") {
      assert.equal(log.mock.callCount(), 1);
      assert.deepEqual(log.mock.calls[0]!.arguments, [
        "GET /posts/hello?preview=1 => 200",
        routeName,
      ]);
    } else {
      assert.equal(log.mock.callCount(), 0);
    }
  });
}

for (const failure of [undefined, null, false, 0, ""]) {
  test(`createApp logger.ts: development preserves diagnostics for a thrown ${String(failure)} value`, async (t) => {
    const log = t.mock.method(console, "error", () => {});
    const response = await createApp()
      .get("/", () => {
        throw failure;
      })
      .createHandler({ environment: "development" })(new Request("https://example.com/"));
    assert.equal(response.status, 500);
    assert.equal(await response.text(), `500 Internal Server Error\n\n${String(failure)}`);
    assert.equal(log.mock.callCount(), 1);
    assert.equal(log.mock.calls[0]!.arguments[1], failure);
  });
}

test("createApp logger.ts: production logs exception stacks as JSON without exposing them in the response", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const failure = new Error("private details");
  const response = await createApp()
    .get("/", () => {
      throw failure;
    })
    .createHandler({ environment: "production" })(new Request("https://example.com/"));
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "500 Internal Server Error");
  assert.equal(log.mock.callCount(), 1);
  assert.deepEqual(JSON.parse(log.mock.calls[0]!.arguments[0]), {
    message: String(failure),
    stack: failure.stack,
    method: "GET",
    url: "https://example.com/",
    status: 500,
  });
});

test("createApp logger.ts: still maps missing-file exceptions to 404", async (t) => {
  const log = t.mock.method(console, "warn", () => {});
  const failure = Object.assign(new Error("private file path"), { code: "ENOENT" });
  const response = await createApp()
    .get("/", () => {
      throw failure;
    })
    .createHandler({ environment: "production" })(new Request("https://example.com/"));
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "404 Not Found\n\n");
  assert.equal(log.mock.callCount(), 1);
  assert.ok(log.mock.calls[0]!.arguments[0].includes("GET / => 404"));
  assert.equal(log.mock.calls[0]!.arguments[1], failure);
});

for (const source of ["route", "middleware"] as const) {
  test(`createApp logger.ts: logs and preserves a returned 503 from ${source}`, async (t) => {
    const log = t.mock.method(console, "error", () => {});
    let processed = false;
    const processResponse: Middleware = async (req, ctx) => {
      const response = await ctx.fetchNext(req);
      processed = true;
      return response;
    };
    const original = new Response("temporarily unavailable", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Retry-After": "60", "Content-Type": "text/plain" },
    });
    const unavailable = () => original;
    const req = new Request("https://example.com/");
    const app = withMiddlewares(
      processResponse,
      ...(source === "middleware" ? [unavailable] : []),
    ).get("/", unavailable);
    const response = await app.createHandler({ environment: "production" })(req);

    assert.equal(response, original);
    assert.equal(response.status, 503);
    assert.equal(response.statusText, "Service Unavailable");
    assert.equal(response.headers.get("Retry-After"), "60");
    assert.equal(response.headers.get("Content-Type"), "text/plain");
    assert.equal(response.bodyUsed, false);
    assert.equal(await response.text(), "temporarily unavailable");
    assert.equal(processed, true);
    assert.equal(log.mock.callCount(), 1);
    const { arguments: args } = log.mock.calls[0]!;
    assert.deepEqual(JSON.parse(args[0]), {
      message: "HTTP 503",
      method: "GET",
      url: req.url,
      status: 503,
    });
  });
}

test("createFileRouterApp logger.ts: invalid file-route responses identify the route and the missing conversion", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  await writeFile(
    "routes/index.server.ts",
    `
    import { html } from ${JSON.stringify(new URL("../core/html.ts", import.meta.url).href)};
    export const GET = () => html\`<h1>Forgot htmlToResponse</h1>\`;
  `,
  );
  const handler = createFileRouterApp().createHandler({ environment: "development" });
  const response = await handler(new Request("http://localhost/"));

  assert.equal(response.status, 500);
  const message =
    "GET handler in routes/index.server.ts must return a Response object. Did you forget `htmlToResponse`?";
  assert.ok((await response.text()).includes(message));
  assert.equal(log.mock.callCount(), 1);
  assert.equal(log.mock.calls[0]!.arguments[1].message, message);
});

for (const factory of [createApp, createFileRouterApp]) {
  for (const syncOrAsync of ["sync", "async"]) {
    test(`${factory.name} logger.ts: preserves the original ${syncOrAsync} route error and stack`, async (t) => {
      const log = t.mock.method(console, "error", () => {});
      await writeFile(
        "routes/index.server.ts",
        `
        export let original;
        export const GET = ${syncOrAsync === "async" ? "async" : ""} () => {
          original = new Error("route failed");
          throw original;
        };
      `,
      );
      const route = await import(pathToFileURL(join(directory, "routes/index.server.ts")).href);
      const app = factory().use((req, ctx) => ctx.fetchNext(req));
      if (factory === createApp) app.get("/", route.GET);
      const response = await app.createHandler({ environment: "development" })(
        new Request("http://localhost/"),
      );
      const original = route.original as Error;

      assert.equal(response.status, 500);
      assert.ok(original);
      assert.equal(original.message, "route failed");
      assert.match(original.stack!.split("\n")[1]!, /index\.server\.ts:/);
      assert.equal(await response.text(), `500 Internal Server Error\n\n${original.stack}`);
      assert.equal(log.mock.callCount(), 1);
      assert.equal(log.mock.calls[0]!.arguments[1], original);
    });
  }
}

// Keep the defaults intact while adding middleware before the router.
const withMiddlewares = (...middlewares: Middleware[]) =>
  middlewares.reduce((app, middleware) => app.use(middleware), createApp());

for (const factory of [createApp, createFileRouterApp]) {
  test(`${factory.name}: paths beneath static files fall through to routing`, async (t) => {
    t.mock.method(console, "info", () => {});
    t.mock.method(console, "warn", () => {});
    await writeFile("routes/logo.svg", "<svg/>");
    await mkdir("routes/[file]");
    await writeFile(
      "routes/[file]/metadata.server.ts",
      'export const GET = () => new Response("metadata");',
    );
    const app = factory();
    if (factory === createApp) app.get("/logo.svg/metadata", () => new Response("metadata"));
    const handler = app.createHandler({ environment: "development" });

    const matched = await handler(new Request("http://localhost/logo.svg/metadata"));
    assert.equal(matched.status, 200);
    assert.equal(await matched.text(), "metadata");

    const missing = await handler(new Request("http://localhost/logo.svg/missing"));
    assert.equal(missing.status, 404);
    await missing.text();
  });

  test(`${factory.name}: client JavaScript fallthrough preserves POST bodies`, async (t) => {
    t.mock.method(console, "info", () => {});
    const echo = async (req: Request) => new Response(await req.text());
    const paths = ["/present.client.js", "/missing.client.js"] as const;
    await writeFile("routes/present.client.ts", 'const value: string = "asset";');
    for (const path of paths) {
      await writeFile(
        `routes${path}.server.ts`,
        `export const POST = async (req: Request) => new Response(await req.text());`,
      );
    }
    const app = factory();
    if (factory === createApp) {
      for (const path of paths) app.post(path, echo);
    }
    const handler = app.createHandler({ environment: "development" });
    for (const path of paths) {
      const body = "POST payload ü";
      const response = await handler(
        new Request(`http://localhost${path}`, { method: "POST", body }),
      );
      assert.equal(response.status, 200, path);
      assert.equal(await response.text(), body, path);
    }
  });

  test(`${factory.name}: serves routes and logs static and transformed assets`, async (t) => {
    const log = t.mock.method(console, "info", () => {});
    await writeFile("routes/index.server.ts", 'export const GET = () => new Response("home");');
    await writeFile("routes/styles.css", "body {}");
    await writeFile("routes/demo.client.ts", 'import "./dep.client.ts"');
    const app = factory();
    if (factory === createApp) app.get("/", () => new Response("home"));
    const handler = app.createHandler({ environment: "development" });
    const home = await handler(new Request("https://example.com/"));
    assert.equal(home.status, 200);
    assert.equal(await home.text(), "home");
    const asset = await handler(new Request("https://example.com/styles.css"));
    assert.equal(asset.status, 200);
    assert.equal(await asset.text(), "body {}");
    const js = await handler(new Request("https://example.com/demo.client.js"));
    assert.equal(js.status, 200);
    assert.equal(js.headers.get("Content-Type"), "text/javascript; charset=utf-8");
    assert.equal(await js.text(), 'import "./dep.client.js";');
    assert.equal(js.headers.get("Content-Length"), null);
    assert.deepEqual(
      log.mock.calls.slice(1).map((call) => call.arguments),
      [
        ["GET /styles.css => 200", ""],
        ["GET /demo.client.js => 200", ""],
      ],
    );
  });

  test(`${factory.name}: transformed JavaScript preserves HEAD and cache response metadata`, async (t) => {
    t.mock.method(console, "info", () => {});
    await writeFile("routes/index.server.ts", 'export const GET = () => new Response("home");');
    await writeFile(
      "routes/demo.client.ts",
      'import "./dep.client.ts";\nconst value: string = "hello";',
    );
    const handler = factory().createHandler({ environment: "development" });
    const url = "http://localhost/demo.client.js";
    const initial = await handler(new Request(url));
    assert.equal(initial.status, 200);
    assert.equal(initial.headers.get("Content-Type"), "text/javascript; charset=utf-8");
    const etag = initial.headers.get("ETag");
    assert.ok(etag);
    const body = await initial.text();
    assert.match(body, /import "\.\/dep\.client\.js";/);
    assert.match(body, /const value\s*= "hello";/);

    const head = await handler(new Request(url, { method: "HEAD" }));
    assert.equal(head.status, 200);
    assert.equal(head.body, null);
    assert.deepEqual([...head.headers], [...initial.headers]);

    for (const method of ["GET", "HEAD"]) {
      const cached = await handler(
        new Request(url, { method, headers: { "If-None-Match": etag } }),
      );
      assert.equal(cached.status, 304);
      assert.equal(cached.body, null);
      assert.equal(cached.headers.get("ETag"), etag);
      assert.equal(cached.headers.get("Content-Type"), null);
      assert.equal(cached.headers.get("Content-Length"), null);
      assert.equal(cached.headers.get("Accept-Ranges"), null);
    }
  });

  test(`${factory.name}: transformation failures become logged error responses`, async (t) => {
    const errors = t.mock.method(console, "error", () => {});
    await writeFile("routes/index.server.ts", 'export const GET = () => new Response("home");');
    await writeFile("routes/broken.client.ts", "const privateValue: string = ;");
    const handler = factory().createHandler({ environment: "development" });
    const response = await handler(new Request("http://localhost/broken.client.js"));

    assert.equal(response.status, 500);
    assert.ok((await response.text()).length > 0);
    assert.ok(errors.mock.callCount() > 0);
  });

  test(`${factory.name}: production skips malformed TypeScript and serves generated JavaScript`, async (t) => {
    await writeFile("routes/index.server.ts", 'export const GET = () => new Response("home");');
    await writeFile("routes/broken.client.ts", "const privateValue: string = ;");
    const handler = factory().createHandler({ environment: "production" });
    const url = "https://example.com/broken.client.js";
    const missing = await handler(new Request(url));
    assert.equal(missing.status, 404);
    assert.ok(!(await missing.text()).includes("privateValue"));

    // simulate build
    await mkdir("generated");
    await writeFile("generated/broken.client.js", 'const value = "built";');

    // Restart the serving middleware after the build so its startup check sees generated/
    const { staticFiles } = await import(
      `../middlewares/staticFiles/staticFiles.ts?startup=${encodeURIComponent(directory)}`
    );
    const app = factory();
    const server = new Mastro({ routes: app.getRoutes() });
    for (const middleware of app.getMiddlewares()) {
      // replace staticFiles middleware with newly loaded one
      server.use(middleware.name === "staticFiles" ? staticFiles : middleware);
    }

    const production = server.createHandler({ environment: "production" });
    const built = await production(new Request(url));
    assert.equal(built.status, 200);
    assert.equal(built.headers.get("Content-Type"), "text/javascript; charset=UTF-8");
    assert.equal(await built.text(), 'const value = "built";');
    const head = await production(new Request(url, { method: "HEAD" }));
    assert.equal(head.status, 200);
    assert.equal(head.body, null);
    assert.deepEqual([...head.headers], [...built.headers]);
    const cached = await production(
      new Request(url, { headers: { "If-None-Match": built.headers.get("ETag")! } }),
    );
    assert.equal(cached.status, 304);
    assert.equal(cached.body, null);
    assert.equal(cached.headers.get("Content-Type"), null);
  });

  test(`${factory.name} staticFiles.ts: private source files stay private regardless of casing`, async (t) => {
    t.mock.method(console, "info", () => {});
    t.mock.method(console, "warn", () => {});
    await writeFile("routes/index.server.ts", 'export const GET = () => new Response("home");');
    await mkdir("generated");
    const suffixes = [
      "server.ts",
      "SERVER.ts",
      "server.TS",
      "SERVER.TS",
      "server.js",
      "SERVER.js",
      "server.JS",
      "SERVER.JS",
      "client.ts",
      "CLIENT.ts",
      "client.TS",
      "CLIENT.TS",
    ];
    for (const folder of ["routes", "generated"]) {
      for (const suffix of suffixes) {
        // Real files in each casing also exercise the check on case-sensitive filesystems.
        await writeFile(`${folder}/private.${suffix}`, "// secret source");
      }
    }
    const { staticFiles } = await import(
      `../middlewares/staticFiles/staticFiles.ts?startup=${encodeURIComponent(directory)}`
    );
    for (const environment of ["development", "production"] as const) {
      const app = factory();
      const server = new Mastro({ routes: app.getRoutes() });
      for (const middleware of app.getMiddlewares()) {
        server.use(middleware.name === "staticFiles" ? staticFiles : middleware);
      }
      const handler = server.createHandler({ environment });
      for (const suffix of suffixes) {
        const name = `private.${suffix}`;
        for (const path of [name, `${name}?download=1`, name.replaceAll(".", "%2e")]) {
          const response = await handler(new Request(`https://example.com/${path}`));
          assert.equal(response.status, 404, `${environment}: ${path}`);
          assert.ok(!(await response.text()).includes("secret source"), `${environment}: ${path}`);
        }
      }
    }
  });
}

for (const factory of [createApp, createFileRouterApp]) {
  test(`${factory.name} staticFiles.ts, tsToJs.ts: encoded assets, malformed URLs and traversal`, async (t) => {
    t.mock.method(console, "info", () => {});
    t.mock.method(console, "warn", () => {});
    await writeFile("routes/index.server.ts", 'export const GET = () => new Response("home");');
    await mkdir("routes/assets");
    const asset = "hello # %20 ü.css";
    const client = "hello # %20 ü.client.js";
    await writeFile(join("routes/assets", asset), "body { color: red; }");
    await writeFile(
      join("routes/assets", client.slice(0, -3) + ".ts"),
      'const value: string = "hello";',
    );
    await writeFile("secret.client.ts", 'const secret = "outside routes";');
    const app = factory();
    const handler = app.createHandler({ environment: "development" });
    const response = await handler(
      new Request("https://example.com/assets/" + encodeURIComponent(asset)),
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "body { color: red; }");
    const js = await handler(
      new Request("https://example.com/assets/" + encodeURIComponent(client)),
    );
    assert.equal(js.status, 200);
    assert.equal(js.headers.get("Content-Type"), "text/javascript; charset=utf-8");
    assert.match(await js.text(), /const value\s*= "hello";/);
    for (const path of ["/%FF", "/%FF.client.js", "/%2e%2e%2fsecret.client.js"]) {
      const invalid = await handler(new Request("https://example.com" + path));
      assert.equal(invalid.status, 400, path);
      await invalid.text();
    }
    const productionClient = await app.createHandler({ environment: "production" })(
      new Request("https://example.com/assets/" + encodeURIComponent(client)),
    );
    assert.equal(productionClient.status, 404);
    await productionClient.text();
  });
}

test("createFileRouterApp: reads files using encoded URLPattern slugs", async (t) => {
  t.mock.method(console, "info", () => {});
  const name = "hello # %20 ü";
  await mkdir("data/posts", { recursive: true });
  await mkdir("routes/posts/[slug]", { recursive: true });
  await writeFile(join("data/posts", name + ".md"), "post content");
  await writeFile(
    "routes/posts/[slug]/index.server.ts",
    `
    import { readTextFile } from ${JSON.stringify(new URL("../core/fs.ts", import.meta.url).href)};
    export const GET = async (req) => {
      const { slug } = new URLPattern({ pathname: '/posts/:slug/' }).exec(req.url).pathname.groups;
      return new Response(await readTextFile('data/posts/' + slug + '.md'));
    };
  `,
  );
  const handler = createFileRouterApp().createHandler({ environment: "development" });
  const response = await handler(
    new Request("https://example.com/posts/" + encodeURIComponent(name) + "/"),
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "post content");
});
