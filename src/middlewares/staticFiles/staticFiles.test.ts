import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import type { Middleware, ServerContext } from "../../middleware.ts";
import { staticFiles } from "./staticFiles.ts";

const { handler } = staticFiles as Exclude<Middleware, Function>;

const originalCwd = process.cwd();
const contents = "hello ü\n";
const modified = new Date("2026-01-02T03:04:05.500Z");
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "mastro-static-files-test-"));
  process.chdir(directory);
  await mkdir("routes");
  await writeFile("routes/file.txt", contents);
  await utimes("routes/file.txt", modified, modified);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(directory, { recursive: true, force: true });
});

const context = (environment: "development" | "production" = "production"): ServerContext<[]> => ({
  mode: "server",
  environment,
  extra: [],
  fetchUpstream: () => assert.fail("Static file requests must not fall through"),
});

const request = (init?: RequestInit, hostname = "example.com") =>
  new Request(`https://${hostname}/file.txt`, init);

for (const method of ["GET", "HEAD"]) {
  test(`staticFiles: ${method} with a matching ETag returns 304`, async () => {
    const initial = await handler(request(), context());
    const etag = initial.headers.get("ETag");
    assert.ok(etag);
    await initial.text();

    const response = await handler(
      request({
        method,
        headers: { "If-None-Match": etag },
      }),
      context(),
    );

    assert.equal(response.status, 304);
    assert.equal(response.body, null);
    assert.equal(response.headers.get("ETag"), etag);
    assert.equal(response.headers.get("Last-Modified"), modified.toUTCString());
  });
}

test("staticFiles: date validation uses whole seconds and serves newer files", async () => {
  // HTTP dates lose the fixture's fractional seconds; an unchanged file must still match.
  const cached = await handler(
    request({ headers: { "If-Modified-Since": modified.toUTCString() } }),
    context(),
  );
  assert.equal(cached.status, 304);
  assert.equal(cached.body, null);

  const changed = await handler(
    request({
      headers: { "If-Modified-Since": new Date(modified.getTime() - 1000).toUTCString() },
    }),
    context(),
  );
  assert.equal(changed.status, 200);
  assert.equal(await changed.text(), contents);
});

test("staticFiles: nonmatching ETag takes precedence over If-Modified-Since", async () => {
  const response = await handler(
    request({
      headers: {
        "If-None-Match": '"different"',
        "If-Modified-Since": modified.toUTCString(),
      },
    }),
    context(),
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), contents);
});

test("staticFiles: HEAD returns GET metadata without a body", async () => {
  const get = await handler(request(), context());
  const head = await handler(request({ method: "HEAD" }), context());

  assert.equal(get.status, 200);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("Content-Length"), String(Buffer.byteLength(contents)));
  assert.deepEqual([...head.headers], [...get.headers]);
  assert.equal(head.body, null);
  assert.equal(await get.text(), contents);
});

test("staticFiles: localhost responses and cache hits require revalidation", async () => {
  const initial = await handler(request(undefined, "localhost"), context("development"));
  const etag = initial.headers.get("ETag")!;
  assert.equal(initial.headers.get("Cache-Control"), "max-age=0");
  await initial.text();

  const cached = await handler(
    request({ headers: { "If-None-Match": etag } }, "localhost"),
    context("development"),
  );
  assert.equal(cached.status, 304);
  assert.equal(cached.headers.get("Cache-Control"), "max-age=0");
  assert.equal(cached.body, null);
});

test("staticFiles: changing a file invalidates its ETag", async () => {
  const initial = await handler(request(), context());
  const etag = initial.headers.get("ETag")!;
  await initial.text();
  await writeFile("routes/file.txt", "updated contents");
  const later = new Date(modified.getTime() + 2000);
  await utimes("routes/file.txt", later, later);

  const response = await handler(request({ headers: { "If-None-Match": etag } }), context());
  assert.equal(response.status, 200);
  assert.notEqual(response.headers.get("ETag"), etag);
  assert.equal(await response.text(), "updated contents");
});
