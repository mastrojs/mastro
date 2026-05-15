/**
 * Convert a TypeScript string to JavaScript by running it through `stripTypeScriptTypes` (Node.js)
 * and `ts-blank-space` (Deno and Bun), and then changing imports ending with `.ts` to end in `.js`.
 *
 * Since browsers don't understand TypeScript and static file servers generally
 * don't serve `.ts` files with `content-type: text/javascript`, we need to run this
 * function on `.client.ts` files, to convert them to `.client.js` files.
 */
export const tsToJs = async (code: string): Promise<string> => {
  const tsBlankSpace = ["npm", "ts-blank-space"].join(":");
  // @ts-expect-error no type definitions for Bun
  const { stripTypeScriptTypes } = typeof Deno === "object" || typeof Bun === "object"
    ? await import(tsBlankSpace).then((m) => ({ stripTypeScriptTypes: m.default }))
    : await import("node:module");
  const js: string = stripTypeScriptTypes(code);
  return js.replace(
    importRegex,
    (match, quote, semicolon) => match.slice(0, semicolon ? -5 : -4) + `.js${quote};`,
  );
};

const importRegex = /^import .*\.ts("|')(;)?$/gm;
