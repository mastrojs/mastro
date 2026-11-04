import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Mastro } from "../../core/mastro.ts";
import { staticFiles } from "./staticFiles.ts";

test("static files do not expose reserved source files through query strings or URL encoding", async (t) => {
  const cwd = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), "mastro-static-test-"));
  t.after(async () => {
    process.chdir(cwd);
    await rm(directory, { recursive: true, force: true });
  });
  process.chdir(directory);
  await mkdir("routes");
  const handler = new Mastro({ middlewares: [staticFiles] }).createHandler();

  for (const suffix of ["server.ts", "server.js", "client.ts"]) {
    const name = `private.${suffix}`;
    await writeFile(join("routes", name), "secret source");
    for (const path of [name, `${name}?download=1`, name.replaceAll(".", "%2e")]) {
      const response = await handler(new Request(`https://example.com/${path}`));
      const body = await response.text();
      assert.equal(response.status, 404, path);
      assert.ok(!body.includes("secret source"), path);
    }
  }
});
