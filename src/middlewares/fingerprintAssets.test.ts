import assert from "node:assert/strict";
import { test } from "node:test";

import { chainMiddlewares } from "../middleware.ts";
import { fingerprintAssets } from "./fingerprintAssets.ts";

for (const [path, filename] of [
  ["/_assets/plain", "plain-2cf24dba"],
  ["/_assets/nested.dir/plain", "plain-2cf24dba"],
  ["/_assets/styles.css", "styles-2cf24dba.css"],
] as const) {
  test(`fingerprinting preserves the asset path for ${path}`, async () => {
    const handler = chainMiddlewares([fingerprintAssets]);
    const response = await handler(new Request("http://127.0.0.1" + path), {
      mode: "generator",
      onlyPregenerate: true,
      extra: [],
      fetchUpstream: () => new Response("hello"),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Disposition"), `attachment; filename=${filename}`);
    assert.equal(await response.text(), "hello");
  });
}
