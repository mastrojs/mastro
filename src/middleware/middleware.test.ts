import { assertEquals } from "jsr:@std/assert";
import { chainMiddlewares } from "./middleware.ts";

Deno.test("chainMiddlewares", async () => {
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

  const res = await handler(
    new Request("http://localhost/"),
    {
      mode: "generator",
      fetchUpstream: () => Promise.resolve(new Response("welcome")),
    },
  );

  assertEquals(await res.text(), "Hi test user, welcome");
  assertEquals(res.headers.get("Content-Disposition"), 'attachment; filename="file name.jpg"');
});
