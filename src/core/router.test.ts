import { assertEquals } from "jsr:@std/assert";

// deno-lint-ignore no-explicit-any
(globalThis.document as any) = {
  fs: {
    findFiles: () => {
      return [
        "/routes/index.server.ts",
        "/routes/[...slug]/test.server.ts",
        "/routes/[...slug]/index.server.ts",
        "/routes/blog/index.server.ts",
        "/routes/blog/[slug].server.ts",
        "/routes/blog/override.server.ts",
      ];
    },
  }
}

Deno.test("route precedence order", async () => {
  // load router.ts only after `document.fs` has been patched.
  const { routes } = await import("./router.ts");

  assertEquals(routes.map(r => r.filePath), [
    "/routes/index.server.ts",
    "/routes/blog/override.server.ts",
    "/routes/blog/index.server.ts",
    "/routes/blog/[slug].server.ts",
    "/routes/[...slug]/test.server.ts",
    "/routes/[...slug]/index.server.ts",
  ]);
});
