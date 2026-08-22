import { staticFiles } from "./middlewares/staticFiles/staticFiles.ts";
import { tsToJs } from "./middlewares/tsToJs.ts";

export const defaultMiddlewares = [tsToJs, staticFiles];
