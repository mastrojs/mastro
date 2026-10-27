import { Mastro } from '@mastrojs/mastro'
import * as Home from './handlers/Home.ts';

export const app = new Mastro()
  .get("/", Home)
  .get("/text/", (req) => new Response("Here is some plain text"))
  // Add more routes here, see https://mastrojs.github.io/docs/routing/#programmatic-router

// Wrangler is configured to serve pregenerated static files from the generated folder
// but with Deno, Mastro serves them directly from routes:
// @ts-expect-error Deno not found
const serveStaticFiles = typeof Deno === "object";

export default {
  fetch: app.createHandler({ serveStaticFiles }),
} satisfies ExportedHandler<Env>;
