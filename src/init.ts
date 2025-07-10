/**
 * This script initializes an empty Mastro project for deno.
 * Usage: deno run --allow-write jsr:@mastrojs/mastro@0.0.7/init
 * @module
 */

import * as path from "@std/path";

const dir = prompt("What folder should we create for your new project?");

if (dir) {
  await Deno.mkdir(path.join(dir, "components"), { recursive: true });
  await Deno.mkdir(path.join(dir, "routes"));
  await Deno.writeTextFile(path.join(dir, "deno.json"), String.raw`{
  "tasks": {
    "start": "deno serve --watch=. --allow-env --allow-read jsr:@mastrojs/mastro@0.0.7/server",
    "generate": "deno eval \"import 'mastro/generate';\""
  },
  "imports": {
    "mastro": "jsr:@mastrojs/mastro@0.0.7"
  }
}
`);
  await Deno.writeTextFile(path.join(dir, "routes", "index.server.ts"), String.raw`import { html, htmlToResponse } from "mastro";

export const GET = () =>
  htmlToResponse(
    html${"`"}
      <!doctype html>
      <title>${dir}</title>
      <h1>${dir}</h1>
    ${"`"}
  );
`)
  const codeStyle = "color: blue";
  console.log(`
Success!

Enter your project directory using %ccd ${dir}
%cThen start the dev server with: %cdeno task start`
  , codeStyle, "", codeStyle);
}
