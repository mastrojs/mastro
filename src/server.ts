import { Mastro } from "./mastro.ts";
import { createFileRouter } from "./middlewares/fileRouter.ts";
import { fingerprintAssets } from "./middlewares/fingerprintAssets.ts";
import { staticFiles } from "./middlewares/staticFiles/staticFiles.ts";
import { tsToJs } from "./middlewares/tsToJs.ts";

export const createFileRouterApp = (): Mastro => {
  const app = new Mastro();
  app.middlewares = [ fingerprintAssets, tsToJs, staticFiles, createFileRouter() ];
  return app;
}
