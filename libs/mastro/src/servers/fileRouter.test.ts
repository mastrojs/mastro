import assert from "node:assert/strict";
import { test } from "node:test";

import { Mastro } from "../mastro.ts";
import type { Context, Middleware } from "../types/middleware.d.ts";

(globalThis.document as any) = {
  fs: {
    findFiles: () => {
      return [
        "routes/index.server.ts",
        "routes/[...slug]/test.server.ts",
        "routes/[...slug]/index.server.ts",
        "routes/.well-known/foo/bar.server.ts",
        "routes/blog/index.server.ts",
        "routes/blog/[slug].server.ts",
        "routes/blog/override.server.ts",
        "routes/blog/2026.server.ts",
        "routes/blog/About.server.ts",
        "routes/blog/.well-known/foo.server.ts",
        "routes/blog/[...slug].server.ts",
      ];
    },
  },
};

// Both modules initialize fs.ts, which must capture the document.fs mock above.
const { findRoutes, loadRoutes } = await import("./fileRouter.ts");

test("fileRouter: route precedence order", async () => {
  const routes = await loadRoutes(await findRoutes(), () => Promise.resolve({ GET: () => {} }));

  assert.deepEqual(
    routes.map((r) => r.name),
    [
      "routes/index.server.ts",
      "routes/blog/override.server.ts",
      "routes/blog/index.server.ts",
      "routes/blog/About.server.ts",
      "routes/blog/2026.server.ts",
      "routes/blog/.well-known/foo.server.ts",
      "routes/blog/[slug].server.ts",
      "routes/blog/[...slug].server.ts",
      "routes/.well-known/foo/bar.server.ts",
      "routes/[...slug]/test.server.ts",
      "routes/[...slug]/index.server.ts",
    ],
  );
});

test("fileRouter: forwards extra runtime arguments", async () => {
  type Env = { message: string };
  type Ctx = {};
  const env: Env = { message: "test msg" };
  const ctx: Ctx = {};
  const req = new Request("https://example.com/");
  const GET = (request: Request, { extras: [environment, context] }: Context<[Env, Ctx]>) => {
    assert.equal(request, req);
    assert.equal(environment, env);
    assert.equal(context, ctx);
    return new Response(env.message);
  };
  const routes = await loadRoutes(
    [{ name: "routes/index.server.ts", pathname: "/" }],
    async () => ({ GET }),
  );
  const handler = new Mastro<[Env, Ctx]>({ routes }).createHandler();
  const res = await handler(req, env, ctx);

  assert.equal(res.status, 200);
  assert.equal(await res.text(), "test msg");
});

test("fileRouter: converts filenames to matching patterns and dispatches parameters", async (t) => {
  const cases: Array<{
    filePath: string;
    reqPath: string;
    expectedParams: Record<string, string | undefined>;
    nonMatchPaths?: string[];
  }> = [
    { filePath: "routes/plain/index.server.ts", reqPath: "/plain/", expectedParams: {} },
    { filePath: "routes/html/index.html.server.js", reqPath: "/html/", expectedParams: {} },
    {
      filePath: "routes/nested/alias/(alias).server.ts",
      reqPath: "/nested/alias/",
      expectedParams: {},
    },
    { filePath: "routes/js/(js).server.js", reqPath: "/js/", expectedParams: {} },
    {
      filePath: "routes/users/[user]/[slug].server.ts",
      reqPath: "/users/alice/hello%20world",
      expectedParams: { user: "alice", slug: "hello%20world" },
    },
    {
      filePath: "routes/files/[...path].server.ts",
      reqPath: "/files",
      expectedParams: { path: undefined },
    },
    {
      filePath: "routes/files/[...path].server.ts",
      reqPath: "/files/",
      expectedParams: { path: "" },
    },
    {
      filePath: "routes/files/[...path].server.ts",
      reqPath: "/files/one/two",
      expectedParams: { path: "one/two" },
    },
    {
      filePath: "routes/items/[id].json.server.ts",
      reqPath: "/items/123.json",
      expectedParams: { id: "123" },
      nonMatchPaths: ["/items/123", "/items/123.xml"],
    },
    {
      filePath: "routes/posts/[slug].json.server.js",
      reqPath: "/posts/hello.json",
      expectedParams: { slug: "hello" },
      nonMatchPaths: ["/posts/hello"],
    },
    {
      filePath: "routes/json-files/[...path].json.server.ts",
      reqPath: "/json-files/one/two.json",
      expectedParams: { path: "one/two" },
      nonMatchPaths: ["/json-files/one/two"],
    },
    {
      filePath: "routes/copies/[id](copy)*.server.ts",
      reqPath: "/copies/123(copy)*",
      expectedParams: { id: "123" },
      nonMatchPaths: ["/copies/123copy", "/copies/123(copy)extra"],
    },
  ];
  t.mock.method((document as any).fs, "findFiles", () => cases.map((c) => c.filePath));
  let params: Record<string, string | undefined> | undefined;
  const routes = await loadRoutes(await findRoutes(), async () => ({
    GET: (req: Request, ctx: Context) => {
      params = ctx.params;
      return new Response();
    },
  }));
  const handler = new Mastro({ routes }).createHandler();

  for (const { filePath, reqPath, expectedParams, nonMatchPaths = [] } of cases) {
    const route = routes.find((r) => r.name === filePath)!;
    const req = new Request("https://example.com" + reqPath);
    assert.ok(route.pattern.test(req.url), `${filePath} matches ${reqPath}`);
    params = undefined;
    const res = await handler(req);
    assert.equal(res.status, 200, `${filePath}: ${reqPath}`);
    assert.deepEqual(params, expectedParams, `${filePath}: ${reqPath}`);
    for (const nonMatchPath of nonMatchPaths) {
      const missing = await handler(new Request("https://example.com" + nonMatchPath));
      assert.equal(missing.status, 404, `${filePath}: ${nonMatchPath}`);
    }
  }
});

test("fileRouter: passes middleware locals and matched params to file handlers", async () => {
  const middleware: Middleware<{ message: string }> = (req, ctx) => {
    return ctx.fetchNext(req, { message: "hello" });
  };
  const GET = (_req: Request, ctx: Context<unknown[], { message: string }>) => {
    assert.ok(!("fetchNext" in ctx));
    if (false) {
      // @ts-expect-error File routes cannot forward to another handler.
      ctx.fetchNext;
    }
    return new Response(`${ctx.locals.message} ${ctx.params.name}`);
  };
  const routes = await loadRoutes(
    [{ name: "routes/[name].server.ts", pathname: "/:name" }],
    async () => ({ GET }),
  );
  const response = await new Mastro({ routes }).use(middleware).createHandler()(
    new Request("https://example.com/Alice"),
  );
  assert.equal(await response.text(), "hello Alice");
});

test("fileRouter: loads function method exports and lets ALL replace specific methods", async () => {
  const GET = () => new Response("get");
  const POST = () => new Response("post");
  const ALL = () => new Response("all");
  const files = [{ name: "routes/index.server.ts", pathname: "/" }];

  const routes = await loadRoutes(files, async () => ({ GET, POST, PUT: "not a handler" }));
  assert.deepEqual(
    routes.map((r) => r.method),
    ["GET", "POST"],
  );

  const allRoutes = await loadRoutes(files, async () => ({ ALL, GET, POST }));
  assert.deepEqual(
    allRoutes.map((r) => r.method),
    ["all"],
  );
  assert.equal(
    await (
      await new Mastro({ routes: allRoutes }).createHandler()(new Request("https://example.com/"))
    ).text(),
    "all",
  );
});

test("fileRouter: filename punctuation matches literally", async (t) => {
  const cases: Array<[string, string, string[]]> = [
    ["routes/downloads/file(1).server.ts", "/downloads/file(1)", ["/downloads/file1"]],
    ["routes/reports/(draft)/index.server.js", "/reports/(draft)/", ["/reports/draft/"]],
    ["routes/assets/a*b.server.ts", "/assets/a*b", ["/assets/ab", "/assets/aSECRETb"]],
    ["routes/downloads/open(.server.js", "/downloads/open(", ["/downloads/open"]],
    ["routes/downloads/close).server.ts", "/downloads/close)", ["/downloads/close"]],
    [
      "routes/reports/(draft)/[slug].server.ts",
      "/reports/(draft)/latest",
      ["/reports/draft/latest"],
    ],
  ];
  t.mock.method((document as any).fs, "findFiles", () => cases.map(([name]) => name));
  const routes = await loadRoutes(await findRoutes(), async (name) => ({
    GET: () => new Response(name),
  }));
  const handler = new Mastro({ routes }).createHandler();

  for (const [name, path, nonmatches] of cases) {
    const response = await handler(new Request("https://example.com" + path));
    assert.equal(response.status, 200, path);
    assert.equal(await response.text(), name, path);
    for (const nonmatch of nonmatches) {
      const missing = await handler(new Request("https://example.com" + nonmatch));
      assert.equal(missing.status, 404, nonmatch);
    }
  }
});
