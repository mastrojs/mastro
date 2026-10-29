import assert from "node:assert/strict";
import { test } from "node:test";

(globalThis.document as any) = {
  fs: {
    findFiles: () => {
      return [
        "routes/index.server.ts",
        "routes/[...slug]/test.server.ts",
        "routes/[...slug]/index.server.ts",
        "routes/.well-known/foo/bar.server.ts",
        "routes/blog/index.server.ts",
        "routes/blog/[slug].server.ts",
        "routes/blog/override.server.ts",
      ];
    },
    readTextFile: () => {
      const e: any = Error("File not found");
      e.code = "ENOENT";
      throw e;
    },
  },
};

test("fileRouter: route precedence order", async () => {
  // load router.ts only after `document.fs` has been patched.
  const { loadRoutes } = await import("./fileRouter.ts");
  const routes = await loadRoutes(undefined, () => Promise.resolve({ GET: () => {} }));

  assert.deepEqual(routes.map((r) => r.name), [
    "routes/index.server.ts",
    "routes/blog/override.server.ts",
    "routes/blog/index.server.ts",
    "routes/blog/[slug].server.ts",
    "routes/.well-known/foo/bar.server.ts",
    "routes/[...slug]/test.server.ts",
    "routes/[...slug]/index.server.ts",
  ]);
});
