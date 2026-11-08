import assert from "node:assert/strict";
import { test } from "node:test";

import { Mastro } from "../core/mastro.ts";

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
const { getParams } = await import("../core/responses.ts");

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
  const GET = (request: Request, environment: Env, context: Ctx) => {
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
  const cases: Array<[string, string, Record<string, string | undefined>]> = [
    ["routes/plain/index.server.ts", "/plain/", {}],
    ["routes/html/index.html.server.js", "/html/", {}],
    ["routes/nested/alias/(alias).server.ts", "/nested/alias/", {}],
    ["routes/js/(js).server.js", "/js/", {}],
    [
      "routes/users/[user]/[slug].server.ts",
      "/users/alice/hello%20world",
      { user: "alice", slug: "hello%20world" },
    ],
    ["routes/files/[...path].server.ts", "/files", { path: undefined }],
    ["routes/files/[...path].server.ts", "/files/", { path: "" }],
    ["routes/files/[...path].server.ts", "/files/one/two", { path: "one/two" }],
  ];
  t.mock.method((document as any).fs, "findFiles", () => [...new Set(cases.map(([name]) => name))]);
  let params: Record<string, string | undefined> | undefined;
  const routes = await loadRoutes(await findRoutes(), async () => ({
    GET: (req: Request) => {
      params = getParams(req);
      return new Response();
    },
  }));
  const handler = new Mastro({ routes }).createHandler();

  for (const [name, path, expected] of cases) {
    const route = routes.find((r) => r.name === name)!;
    const req = new Request("https://example.com" + path);
    assert.ok(route.pattern.test(req.url), `${name} matches ${path}`);
    params = undefined;
    const res = await handler(req);
    assert.equal(res.status, 200, `${name}: ${path}`);
    assert.deepEqual(params, expected, `${name}: ${path}`);
  }
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
    await (await allRoutes[0]!.handler(new Request("https://example.com/"))).text(),
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
