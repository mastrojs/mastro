/**
 * This module is the main entry point and exports
 * all functions runnable in both Deno and the browser.
 * @module
 */

export * from "./fs.ts";
export * from "./html.ts";
export * from "./markdown.ts";
export * from "./responses.ts";
export { getParams, matchRoute, routes } from "./router.ts";
