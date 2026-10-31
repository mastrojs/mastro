import assert from "node:assert/strict";
import { test } from "node:test";

import { Mastro, type HttpMethod } from "./mastro.ts";

test("concurrent requests keep their own extra arguments", async () => {
  const handler = new Mastro<[string]>({
    middlewares: [
      async (req, ctx) => {
        await Promise.resolve(); // make first request yield
        assert.deepEqual(ctx.extra, [new URL(req.url).pathname]);
        return ctx.fetchUpstream(req);
      },
    ],
  })
    .get("/:name", (req, extra) => new Response(extra))
    .createHandler();

  const responses = await Promise.all(
    ["/first", "/second"].map((path) => handler(new Request("https://example.com" + path), path)),
  );
  assert.deepEqual(await Promise.all(responses.map((res) => res.text())), ["/first", "/second"]);
});

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
    const req = new Request("http://localhost" + path, { method });
    const res = await handler(req);
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

  const extra0 = { message: "root" };
  const extra1 = {};
  const middlewareHandler = new Mastro<[typeof extra0, typeof extra1]>({
    middlewares: [
      async (req, ctx) => {
        assert.equal(ctx.extra[0], extra0);
        assert.equal(ctx.extra[1], extra1);
        const response = await ctx.fetchUpstream(req);
        return new Response(`${await response.text()} first`);
      },
      async (req, ctx) => {
        assert.equal(ctx.extra[0], extra0);
        assert.equal(ctx.extra[1], extra1);
        const response = await ctx.fetchUpstream(req);
        return new Response(`${await response.text()} second`);
      },
    ],
  })
    .get("/", (req, ex0, ex1) => {
      assert.equal(ex0, extra0);
      assert.equal(ex1, extra1);
      return new Response(ex0.message);
    })
    .createHandler();

  const req = new Request("http://localhost/");
  assert.deepEqual(
    await (await middlewareHandler(req, extra0, extra1)).text(),
    "root second first",
  );
});
