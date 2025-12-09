import { assertEquals } from "jsr:@std/assert";
import type { HttpMethod } from "./common.ts";
import { Mastro } from "./programmaticRouter.ts";

Deno.test("programmaticRouter", async () => {
  const handler = new Mastro()
    .get("/", () => new Response("root"))
    .post("/foo", () => new Response("posted"))
    .get("/blog/", () => new Response("blog index"))
    .get("/blog/:slug/", () => new Response("blog detail"))
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
});
