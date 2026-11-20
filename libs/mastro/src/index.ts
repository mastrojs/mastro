/**
 * `@mastrojs/mastro` is the main entry point and exports
 * all functions runnable in both Deno/Node.js/Bun and the browser
 * (i.e. the VSCode extension environment).
 * @module
 */

export * from "./core/fs.ts";
export * from "./core/html.ts";
export * from "./core/responses.ts";
export * from "./mastro.ts";

export type { Handler, Route, RouteParams } from "./types/mastro.d.ts";
export type { Context, Middleware, MiddlewareContext } from "./types/middleware.d.ts";
