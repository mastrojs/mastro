import { fingerprintAssets } from "./middlewares/fingerprintAssets.ts";
import { staticFiles } from "./middlewares/staticFiles/staticFiles.ts";
import { tsToJs } from "./middlewares/tsToJs.ts";

export const defaultMiddlewares = [fingerprintAssets, tsToJs, staticFiles];
