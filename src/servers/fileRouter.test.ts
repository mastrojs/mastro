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
      ];
    },
  },
};

test("fileRouter: route precedence order", async () => {
  // Load fileRouter.ts only after `document.fs` has been patched.
  const { findRoutes, loadRoutes } = await import("./fileRouter.ts");
  const routes = await loadRoutes(await findRoutes(), () => Promise.resolve({ GET: () => {} }));

  assert.deepEqual(routes.map((r) => r.name), [
    "routes/index.server.ts",
    "routes/blog/override.server.ts",
    "routes/blog/index.server.ts",
    "routes/blog/[slug].server.ts",
    "routes/.well-known/foo/bar.server.ts",
    "routes/[...slug]/test.server.ts",
    "routes/[...slug]/index.server.ts",
  ]);
});

test("fileRouter: forwards extra runtime arguments", async () => {
  const { loadRoutes } = await import("./fileRouter.ts");
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
