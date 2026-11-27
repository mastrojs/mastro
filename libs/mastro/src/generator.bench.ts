import { mkdtemp, rm } from "fs/promises";
import assert from "node:assert/strict";
//@ts-expect-error node:bench is only defined in types for node v27
import { after } from "node:bench";
import { tmpdir } from "os";
import { join } from "path";

import { generate } from "./generator.ts";
import { createApp } from "./servers/server.ts";
import { runBench, SyncPage as handler } from "./shared.bench.helpers.ts";

const tempRoot = await mkdtemp(join(tmpdir(), "mastro-bench-"));

runBench("generate only one page", {
  fn: async () => {
    const app = createApp().get("/", handler);
    const outFolder = await makeTempDir();
    return generate(app, { outFolder });
  },
  validate: (success) => assert.equal(success, true),
});

runBench("generate a blog", {
  fn: async () => {
    const app = createApp()
      .get("/", handler)
      .get("/blog/:slug/", { handler, getStaticPaths: () => paths });
    const outFolder = await makeTempDir();
    return generate(app, { outFolder });
  },
  validate: (success) => assert.equal(success, true),
});
const paths = Array.from(
  Array(1000)
    .keys()
    .map((n) => `/blog/${n}/`),
);

const makeTempDir = () => mkdtemp(join(tempRoot, "mastro-bench-"));

after(() => rm(tempRoot, { recursive: true, force: true }));
