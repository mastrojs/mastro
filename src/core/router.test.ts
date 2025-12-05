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
    readTextFile: () => {
      const e: any = Error("File not found");
      e.code = "ENOENT";
      throw e;
    }
  }
}

Deno.test("route precedence order", async () => {
  // load router.ts only after `document.fs` has been patched.
  const { getRoutes } = await import("./router.ts");
  const routes = await getRoutes();

  // swalled errors from loading non-existing modules
  routes.forEach(r => (r.module as Promise<unknown>).catch(() => {}));

  assertEquals(routes.map(r => r.name), [
    "/routes/index.server.ts",
    "/routes/blog/override.server.ts",
    "/routes/blog/index.server.ts",
    "/routes/blog/[slug].server.ts",
    "/routes/[...slug]/test.server.ts",
    "/routes/[...slug]/index.server.ts",
  ]);
});
