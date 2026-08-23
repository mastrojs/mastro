import { SyncPage } from "./core/responses.bench.ts";
import { generate } from "./generator.ts";
import { createFileRouter } from "./middleware/middlewares/fileRouter.ts";

Deno.bench({
  name: "generate only one page",
  async fn() {
    const middlewares = [
      createFileRouter({ routes: [
        {
          name: "home",
          method: "GET" as const,
          pattern: new URLPattern({ pathname: "/" }),
          handler: SyncPage,
        },
      ]}),
    ];
    const outFolder = await Deno.makeTempDir();
    await generate({ outFolder, middlewares });

    // curiously, this speeds things up tremendously. must be a benchmarking artefact
    await new Promise((resolve) => setTimeout(resolve, 0));
  },
});

const paths = Array.from(Array(1000).keys().map((n) => `/blog/${n}/`));
Deno.bench({
  name: "generate a blog",
  async fn() {
    const middlewares = [
      createFileRouter({ routes: [
        {
          name: "home",
          method: "GET" as const,
          pattern: new URLPattern({ pathname: "/" }),
          handler: SyncPage,
        },
        {
          name: "blog",
          method: "GET" as const,
          pattern: new URLPattern({ pathname: "/blog/:slug/" }),
          handler: SyncPage,
          getStaticPaths: () => paths,
        },
      ]}),
    ];
    const outFolder = await Deno.makeTempDir();
    await generate({ outFolder, middlewares });
  },
});
