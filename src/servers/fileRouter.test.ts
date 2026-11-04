import assert from "node:assert/strict";
import { test } from "node:test";
import { Mastro } from "../core/mastro.ts";

(globalThis.document as any) = {
  fs: {
    readDir: (path: string) => {
      assert.equal(path, "/data/hello %20");
      return ["post # %20.md"];
    },
    readTextFile: (path: string) => {
      assert.equal(path, "/data/hello %20/post # %20.md");
      return "post";
    },
    readFile: (path: string) => {
      assert.equal(path, "/data/hello %20/post # %20.md");
      return new TextEncoder().encode("post");
    },
    findFiles: () => {
      return [
        "routes/index.server.ts",
        "routes/[...slug]/test.server.ts",
        "routes/[...slug]/index.server.ts",
        "routes/.well-known/foo/bar.server.ts",
        "routes/blog/index.server.ts",
        "routes/blog/[slug].server.ts",
        "routes/blog/override.server.ts",
        "routes/blog/2026.server.ts",
        "routes/blog/About.server.ts",
        "routes/blog/.well-known/foo.server.ts",
        "routes/blog/[...slug].server.ts",
      ];
    },
  },
};

test("filesystem bridge decodes URL paths once and encodes returned filenames", async () => {
  const { readDir, readFile, readTextFile } = await import("../core/fs.ts");
  const directory = "data/hello%20%2520";
  const names: string[] = await readDir(directory);
  assert.deepEqual(names, ["post%20%23%20%2520.md"]);
  const path = directory + "/" + names[0];
  assert.equal(await readTextFile(path), "post");
  assert.equal(new TextDecoder().decode(await readFile(path)), "post");
});

test("filesystem bridge rejects parent-directory segments before calling the backend", async () => {
  const { readDir, readFile, readTextFile } = await import("../core/fs.ts");
  for (const read of [readDir, readFile, readTextFile]) {
    await assert.rejects(read("data/%2e%2e%2fsecret"), /must not include \.\. segments/);
  }
});

test("fileRouter: route precedence order", async () => {
  // Load fileRouter.ts only after `document.fs` has been patched.
  const { findRoutes, loadRoutes } = await import("./fileRouter.ts");
  const routes = await loadRoutes(await findRoutes(), () => Promise.resolve({ GET: () => {} }));

  assert.deepEqual(routes.map((r) => r.name), [
    "routes/index.server.ts",
    "routes/blog/override.server.ts",
    "routes/blog/index.server.ts",
    "routes/blog/About.server.ts",
    "routes/blog/2026.server.ts",
    "routes/blog/.well-known/foo.server.ts",
    "routes/blog/[slug].server.ts",
    "routes/blog/[...slug].server.ts",
    "routes/.well-known/foo/bar.server.ts",
    "routes/[...slug]/test.server.ts",
    "routes/[...slug]/index.server.ts",
  ]);
});

test("fileRouter: forwards extra runtime arguments", async () => {
  const { loadRoutes } = await import("./fileRouter.ts");
  type Env = { message: string };
  type Ctx = {};
  const env: Env = { message: "test msg" };
  const ctx: Ctx = {};
  const req = new Request("https://example.com/");
  const GET = (request: Request, environment: Env, context: Ctx) => {
    assert.equal(request, req);
    assert.equal(environment, env);
    assert.equal(context, ctx);
    return new Response(env.message);
  };
  const routes = await loadRoutes(
    [{ name: "routes/index.server.ts", pathname: "/" }],
    async () => ({ GET }),
  );
  const handler = new Mastro<[Env, Ctx]>({ routes }).createHandler();
  const res = await handler(req, env, ctx);

  assert.equal(res.status, 200);
  assert.equal(await res.text(), "test msg");
});
