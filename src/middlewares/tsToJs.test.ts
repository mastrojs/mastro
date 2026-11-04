import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Mastro } from "../core/mastro.ts";
import { tsToJs } from "./tsToJs.ts";

test("transformed JavaScript does not retain the source Content-Length", async () => {
  const cwd = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), "mastro-ts-to-js-"));
  try {
    await mkdir(join(directory, "routes"));
    await writeFile(join(directory, "routes", "demo.client.ts"), 'import "./dep.client.ts"');
    process.chdir(directory);

    const handler = new Mastro({ middlewares: [tsToJs] }).createHandler();
    const response = await handler(new Request("http://localhost/demo.client.js"));

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'import "./dep.client.js";');
    assert.equal(response.headers.get("Content-Length"), null);
  } finally {
    process.chdir(cwd);
    await rm(directory, { recursive: true, force: true });
  }
});
