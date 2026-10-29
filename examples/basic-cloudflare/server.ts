import { Mastro } from "@mastrojs/mastro";
import { loadRoutes } from "@mastrojs/mastro/temp";
// TODO: generate .routes.ts containing { routeFiles: [], loader: (name) => import(`./routes/${name.slice(7, -10)}.server.${name.slice(-2)}`) }
import { routes } from "./.routes.ts";
export const app = new Mastro([], loadRoutes(routes));


export default {
  fetch: app.createHandler(),
} satisfies ExportedHandler<Env>;
