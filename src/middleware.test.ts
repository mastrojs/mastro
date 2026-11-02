import assert from "node:assert/strict";
import { test } from "node:test";

import { Mastro } from "./core/mastro.ts";
import { chainMiddlewares, type Middleware } from "./middleware.ts";

test("chainMiddlewares", async () => {
  const handler = chainMiddlewares([
    (req, ctx) => {
      req.headers.set("X-USER", "test user");
      return ctx.fetchUpstream(req);
    },
    async (req, ctx) => {
      const response = await ctx.fetchUpstream(req);
      const { headers } = response;
      headers.set("Content-Disposition", 'attachment; filename="file name.jpg"');
      return new Response(`Hi ${req.headers.get("X-USER")}, ${await response.text()}`, { headers });
    },
  ]);

  const res = await handler(new Request("http://localhost/"), {
    mode: "generator",
    onlyPregenerate: false,
    extra: [],
    fetchUpstream: () => Promise.resolve(new Response("welcome")),
  });

  assert.deepEqual(await res.text(), "Hi test user, welcome");
  assert.deepEqual(res.headers.get("Content-Disposition"), 'attachment; filename="file name.jpg"');
});

for (const source of ["route", "middleware", "upstream"] as const) {
  for (const asynchronous of [false, true]) {
    test(`fetchUpstream returns a response for ${asynchronous ? "async" : "sync"} ${source} errors`, async () => {
      const failure = new Error("original failure");
      const fail = () => {
        if (asynchronous) return Promise.reject(failure);
        throw failure;
      };
      let observed = false;
      const inspect: Middleware = async (req, ctx) => {
        const res = await ctx.fetchUpstream(req);
        assert.equal(res.status, 500);
        assert.ok("error" in res);
        assert.equal(res.error, failure);
        assert.equal(await res.clone().text(), "500 Internal Server Error");
        observed = true;
        return res;
      };
      const req = new Request("https://example.com/");
      const res =
        source === "upstream"
          ? await chainMiddlewares([inspect])(req, {
              mode: "server",
              environment: "production",
              extra: [],
              fetchUpstream: fail,
            })
          : await new Mastro({ middlewares: [inspect, ...(source === "middleware" ? [fail] : [])] })
              .get("/", fail)
              .createHandler()(req);
      assert.equal(observed, true);
      assert.ok("error" in res);
      assert.equal(res.error, failure);
      assert.equal(await res.text(), "500 Internal Server Error");
    });
  }
}

test("custom middleware can handle error responses without the default logger", async () => {
  const failure = new Error("route failed");
  const handler = new Mastro({
    middlewares: [
      async (req, ctx) => {
        const res = await ctx.fetchUpstream(req);
        assert.ok("error" in res);
        assert.equal(res.error, failure);
        return res.ok ? res : new Response("Please try again", { status: 503 });
      },
    ],
  })
    .get("/", () => {
      throw failure;
    })
    .createHandler();
  const res = await handler(new Request("https://example.com/"));
  assert.equal(res.status, 503);
  assert.equal(await res.text(), "Please try again");
});

test("invalid middleware returns are normalized even at the outermost boundary", async () => {
  // @ts-expect-error Simulate a middleware that forgot to return a response.
  const broken: Middleware = () => undefined;
  const handler = new Mastro({ middlewares: [broken] }).createHandler();
  const res = await handler(new Request("https://example.com/"));
  assert.equal(res.status, 500);
  assert.ok("error" in res);
  assert.ok(res.error instanceof Error);
  assert.match(res.error.message, /Function 'broken' did not return a Response object/);
});
