import { mkdtemp } from "fs/promises";
import { runBench, SyncPage as handler } from "./core/responses.bench.ts";
import { generate } from "./generator.ts";
import { join } from "path";
import { tmpdir } from "os";
import { Mastro } from "./core/mastro.ts";

runBench(
  "generate only one page",
  async () => {
    const app = new Mastro()
      .get("/", handler);
    const outFolder = await makeTempDir();
    await generate(app, { outFolder });

    // curiously, this speeds things up tremendously. must be a benchmarking artefact
    await new Promise((resolve) => setTimeout(resolve, 0));
  },
);

const paths = Array.from(Array(1000).keys().map((n) => `/blog/${n}/`));
runBench(
  "generate a blog",
  async () => {
    const app = new Mastro()
      .get("/", handler)
      .get("/blog/:slug/", { handler, getStaticPaths: () => paths });
    const outFolder = await makeTempDir();
    await generate(app, { outFolder });
  },
);

const makeTempDir = () => mkdtemp(join(tmpdir(), "mastro-bench-"));
