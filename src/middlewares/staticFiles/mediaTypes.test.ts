import assert from "node:assert/strict";
import { test } from "node:test";
import { contentTypeFromExt } from "./mediaTypes.ts";

test("contentTypeFromExt", () => {
  assert.deepEqual(contentTypeFromExt("json"), "application/json; charset=UTF-8");
  assert.deepEqual(contentTypeFromExt("html"), "text/html; charset=UTF-8");
  assert.deepEqual(contentTypeFromExt("css"), "text/css; charset=UTF-8");
  assert.deepEqual(contentTypeFromExt("js"), "text/javascript; charset=UTF-8");
  assert.deepEqual(contentTypeFromExt("txt"), "text/plain; charset=UTF-8");
  assert.deepEqual(contentTypeFromExt("xml"), "application/xml");
  assert.deepEqual(contentTypeFromExt("atom"), "application/atom+xml");
  assert.deepEqual(contentTypeFromExt("exe"), "application/x-msdos-program");
  assert.deepEqual(contentTypeFromExt("mp4"), "video/mp4");
  assert.deepEqual(contentTypeFromExt("foo"), undefined);
  assert.deepEqual(contentTypeFromExt("file.json"), undefined);
  assert.deepEqual(contentTypeFromExt(""), undefined);
});
