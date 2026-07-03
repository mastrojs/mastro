import { assertEquals } from "jsr:@std/assert";
import type { HttpMethod } from "./common.ts";
import { Mastro } from "./programmaticRouter.ts";

Deno.test("programmaticRouter", async () => {
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

  assertEquals(await access("/"), "root");
  assertEquals(await access("/foo"), { status: 405 });
  assertEquals(await access("/bar"), { status: 404 });
  assertEquals(await access("/blog/mypost/"), "blog detail");
  assertEquals(await access("/test/"), "GET handler");
  assertEquals(await access("/users"), "got users");
  assertEquals(await access("/users", "POST"), "posted users");
  assertEquals(await access("/all"), "All");
  assertEquals(await access("/all", "POST"), "All");

  const middlewareHandler = new Mastro()
    .middleware([
      async (req, ctx) => {
        const response = await ctx.fetchNext(req);
        return new Response(`${await response.text()} first`);
      },
      async (req, ctx) => {
        const response = await ctx.fetchNext(req);
        return new Response(`${await response.text()} second`);
      },
    ])
    .get("/", () => new Response("root"))
    .createHandler();

  assertEquals(
    await (await middlewareHandler(new Request("http://localhost/"))).text(),
    "root first second",
  );
});
