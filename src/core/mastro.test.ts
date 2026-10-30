import assert from "node:assert/strict";
import { test } from "node:test";

import { Mastro, type Handler, type HttpMethod } from "./mastro.ts";

test("programmaticRouter", async () => {
  const handler = new Mastro()
    .get("/", () => new Response("root"))
    .post("/foo", () => new Response("posted"))
    .get("/blog/", () => new Response("blog index"))
    .get("/blog/:slug/", () => new Response("blog detail"))
    .get("/test/", { handler: () => new Response("GET handler") })
    .get("/users", () => new Response("got users"))
    .post("/users", () => new Response("posted users"))
    .addRoute("all", "/all", { handler: () => new Response("All") })
    .createHandler();

  const access = async (path: string, method: HttpMethod = "GET") => {
    const res = await handler(new Request("http://localhost" + path, { method }));
    const text = await res.text();
    return res.ok ? text : { status: res.status };
  };

  assert.deepEqual(await access("/"), "root");
  assert.deepEqual(await access("/foo"), { status: 405 });
  assert.deepEqual(await access("/bar"), { status: 404 });
  assert.deepEqual(await access("/blog/mypost/"), "blog detail");
  assert.deepEqual(await access("/test/"), "GET handler");
  assert.deepEqual(await access("/users"), "got users");
  assert.deepEqual(await access("/users", "POST"), "posted users");
  assert.deepEqual(await access("/all"), "All");
  assert.deepEqual(await access("/all", "POST"), "All");

  const middlewareHandler = new Mastro({
    middlewares: [
      async (req, ctx) => {
        const response = await ctx.fetchUpstream(req);
        return new Response(`${await response.text()} first`);
      },
      async (req, ctx) => {
        const response = await ctx.fetchUpstream(req);
        return new Response(`${await response.text()} second`);
      },
    ],
  })
    .get("/", () => new Response("root"))
    .createHandler();

  assert.deepEqual(
    await (await middlewareHandler(new Request("http://localhost/"))).text(),
    "root second first",
  );
});

test("typed extra arguments reach handlers through middleware without leaking between requests", async () => {
  type Env = { message: string };
  type Ctx = { seen: string[] };
  const handler: Handler<[Env, Ctx]> = new Mastro<[Env, Ctx]>({
    middlewares: [
      async (req, ctx) => {
        await Promise.resolve();
        assert.equal(ctx.mode, "server");
        const [env, runtimeCtx] = ctx.extra;
        assert.equal(typeof env.message, "string");
        runtimeCtx.seen.push("middleware");
        const response = await ctx.fetchUpstream(new Request(new URL("/text/", req.url)));
        return new Response(`${await response.text()} middleware`);
      },
    ],
  })
    .get("/text/", (req, env, ctx) => {
      ctx.seen.push(req.url);
      return new Response(env.message);
    })
    .createHandler();

  const first = { seen: [] as string[] };
  const second = { seen: [] as string[] };
  const responses = await Promise.all([
    handler(new Request("https://example.com/first"), { message: "first" }, first),
    handler(new Request("https://example.com/second"), { message: "second" }, second),
  ]);
  assert.deepEqual(await Promise.all(responses.map((response) => response.text())), [
    "first middleware",
    "second middleware",
  ]);
  assert.deepEqual(first.seen, ["middleware", "https://example.com/text/"]);
  assert.deepEqual(second.seen, ["middleware", "https://example.com/text/"]);
});

test("default handlers forward unknown extra arguments", async () => {
  const env = { message: "hello" };
  const ctx = {};
  const handler = new Mastro()
    .get("/", (req, ...extra) => {
      assert.equal(req.url, "https://example.com/");
      assert.deepEqual(extra, [env, ctx, 123]);
      return new Response("ok");
    })
    .createHandler();
  assert.equal((await handler(new Request("https://example.com/"), env, ctx, 123)).status, 200);
});

// These assertions are checked by TypeScript and never executed.
function handlerTypes() {
  type Env = { message: string };
  type Ctx = { waitUntil(promise: Promise<unknown>): void };
  const app = new Mastro<[Env, Ctx]>({
    middlewares: [
      (req, ctx) => {
        if (ctx.mode === "server") {
          const [env, executionContext] = ctx.extra;
          executionContext.waitUntil(Promise.resolve(env.message));
          // @ts-expect-error The tuple preserves the environment type.
          env.missing;
        } else {
          const extra: [] = ctx.extra;
        }
        return ctx.fetchUpstream(req);
      },
    ],
  });
  const typedHandler: Handler<[Env, Ctx]> = (req, env, ctx) => {
    ctx.waitUntil(Promise.resolve(req.url));
    return new Response(env.message);
  };
  app
    .get("/", typedHandler)
    .post("/", { handler: typedHandler })
    .put("/", typedHandler)
    .delete("/", typedHandler)
    .addRoute("all", "/all", typedHandler);
  app.get("/request-only", (req) => new Response(req.url));
  app.post("/options", {
    handler: async (req, env, ctx) => {
      ctx.waitUntil(Promise.resolve(req.url));
      return new Response(env.message);
    },
  });
  new Mastro<[Env, Ctx]>({ routes: app.getRoutes() }).get("/loaded", (req, env, ctx) => {
    ctx.waitUntil(Promise.resolve(req.url));
    return new Response(env.message);
  });
  // @ts-expect-error The environment must match Env.
  app.get("/bad", (req, env: number) => new Response(String(env)));
  const handler = app.createHandler();
  const req = new Request("https://example.com/");
  const ctx: Ctx = { waitUntil() {} };
  handler(req, { message: "hello" }, ctx);
  // @ts-expect-error Runtime arguments are required.
  handler(req);
  // @ts-expect-error The context argument is required.
  handler(req, { message: "hello" });
  // @ts-expect-error Runtime arguments must have the right types and order.
  handler(req, ctx, { message: "hello" });
  new Mastro().get("/", (req, env) => {
    // @ts-expect-error Unknown extra arguments require narrowing.
    return new Response(env.message);
  });
}
