import assert from "node:assert/strict";
import { test } from "node:test";
import { Mastro, type HttpMethod } from "./mastro.ts";

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

  const middlewareHandler = new Mastro()
    .addMiddlewares(
      async (req, ctx) => {
        const response = await ctx.fetchUpstream(req);
        return new Response(`${await response.text()} first`);
      },
      async (req, ctx) => {
        const response = await ctx.fetchUpstream(req);
        return new Response(`${await response.text()} second`);
      },
    )
    .get("/", () => new Response("root"))
    .createHandler();

  assert.deepEqual(
    await (await middlewareHandler(new Request("http://localhost/"))).text(),
    "root second first",
  );
});
