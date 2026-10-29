import assert from "node:assert/strict";
import { test } from "node:test";
import { chainMiddlewares } from "./middleware.ts";

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

  const res = await handler(
    new Request("http://localhost/"),
    {
      mode: "generator",
      fetchUpstream: () => Promise.resolve(new Response("welcome")),
    },
  );

  assert.deepEqual(await res.text(), "Hi test user, welcome");
  assert.deepEqual(res.headers.get("Content-Disposition"), 'attachment; filename="file name.jpg"');
});
