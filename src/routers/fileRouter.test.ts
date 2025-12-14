import { assertEquals } from "jsr:@std/assert";

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
    },
  },
};

Deno.test("fileRouter: route precedence order", async () => {
  // load router.ts only after `document.fs` has been patched.
  const { getFileBasedRoutes } = await import("./fileRouter.ts");
  const routes = await getFileBasedRoutes(() => Promise.resolve({ GET: () => {} }));

  assertEquals(routes.map((r) => r.name), [
    "/routes/index.server.ts",
    "/routes/blog/override.server.ts",
    "/routes/blog/index.server.ts",
    "/routes/blog/[slug].server.ts",
    "/routes/[...slug]/test.server.ts",
    "/routes/[...slug]/index.server.ts",
  ]);
});
