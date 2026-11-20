import assert from "node:assert/strict";
import { test } from "node:test";

import { Mastro } from "./mastro.ts";
import { chainMiddlewares } from "./middleware.ts";
import type { Context, Middleware } from "./types/middleware.d.ts";

test("chainMiddlewares: forwards requests and processes responses through middleware", async () => {
  const handler = chainMiddlewares(
    [
      (req, ctx) => {
        req.headers.set("X-USER", "test user");
        return ctx.fetchNext(req);
      },
      async (req, ctx) => {
        const response = await ctx.fetchNext(req);
        const { headers } = response;
        headers.set("Content-Disposition", 'attachment; filename="file name.jpg"');
        return new Response(`Hi ${req.headers.get("X-USER")}, ${await response.text()}`, {
          headers,
        });
      },
    ],
    () => new Response("welcome"),
  );

  const res = await handler(new Request("http://localhost/"), {
    mode: "generator",
    onlyPregenerate: false,
    extras: [],
    locals: {},
    params: {},
  });

  assert.deepEqual(await res.text(), "Hi test user, welcome");
  assert.deepEqual(res.headers.get("Content-Disposition"), 'attachment; filename="file name.jpg"');
});

test("chainMiddlewares: an explicit terminal receives the request context without middleware forwarding", async () => {
  const terminal = (_req: Request, ctx: Context) => {
    assert.ok(!("fetchNext" in ctx));
    return Response.json(ctx.locals);
  };
  const handler = chainMiddlewares([(req, ctx) => ctx.fetchNext(req)], terminal);
  const context = {
    mode: "server" as const,
    environment: "production" as const,
    extras: [],
    locals: { user: "Alice" },
    params: {},
  };
  for (const run of [handler, chainMiddlewares([], terminal)]) {
    const response = await run(new Request("https://example.com/"), context);
    assert.deepEqual(await response.json(), { user: "Alice" });
  }
});

for (const source of ["route", "middleware", "terminal"] as const) {
  for (const asynchronous of [false, true]) {
    test(`fetchNext: returns a response for ${asynchronous ? "async" : "sync"} ${source} errors`, async () => {
      const failure = new Error("original failure");
      const fail = () => {
        if (asynchronous) return Promise.reject(failure);
        throw failure;
      };
      let observed = false;
      const inspect: Middleware = async (req, ctx) => {
        const res = await ctx.fetchNext(req);
        assert.equal(res.status, 500);
        assert.ok("error" in res);
        assert.equal(res.error, failure);
        assert.equal(await res.clone().text(), "500 Internal Server Error");
        observed = true;
        return res;
      };
      const req = new Request("https://example.com/");
      const res =
        source === "terminal"
          ? await chainMiddlewares([inspect], fail)(req, {
              mode: "server",
              environment: "production",
              extras: [],
              locals: {},
              params: {},
            })
          : await new Mastro()
              .use(inspect)
              .use(source === "middleware" ? fail : (req, ctx) => ctx.fetchNext(req))
              .get("/", fail)
              .createHandler()(req);
      assert.equal(observed, true);
      assert.ok("error" in res);
      assert.equal(res.error, failure);
      assert.equal(await res.text(), "500 Internal Server Error");
    });
  }
}

test("chainMiddlewares: custom middleware can handle error responses without the default logger", async () => {
  const failure = new Error("route failed");
  const handler = new Mastro()
    .use(async (req, ctx) => {
      const res = await ctx.fetchNext(req);
      assert.ok("error" in res);
      assert.equal(res.error, failure);
      return res.ok ? res : new Response("Please try again", { status: 503 });
    })
    .get("/", () => {
      throw failure;
    })
    .createHandler();
  const res = await handler(new Request("https://example.com/"));
  assert.equal(res.status, 503);
  assert.equal(await res.text(), "Please try again");
});

test("chainMiddlewares: invalid middleware returns are normalized even at the outermost boundary", async () => {
  // @ts-expect-error Simulate a middleware that forgot to return a response.
  const broken: Middleware = () => undefined;
  const handler = new Mastro().use(broken).createHandler();
  const res = await handler(new Request("https://example.com/"));
  assert.equal(res.status, 500);
  assert.ok("error" in res);
  assert.ok(res.error instanceof Error);
  assert.match(res.error.message, /Function 'broken' did not return a Response object/);
});
