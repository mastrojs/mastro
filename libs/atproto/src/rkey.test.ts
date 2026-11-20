import assert from "node:assert/strict";
import { test } from "node:test";

import { anyFromPath, extractDate, tidFromPath } from "./rkey.ts";

test("extractDate", () => {
  assert.deepStrictEqual(extractDate("/2026-05-26-component-scoped-css/"), "2026-05-26");
  assert.deepStrictEqual(extractDate("2026-05-26-component-scoped-css"), "2026-05-26");
  assert.deepStrictEqual(extractDate("/blog/2026-05-26/component-scoped-css/"), "2026-05-26");
  assert.deepStrictEqual(extractDate("/2026/05/26/foobar-baz/"), "2026-05-26");
  assert.deepStrictEqual(extractDate("2026/05/26/foobar-baz"), "2026-05-26");

  assert.deepStrictEqual(extractDate("/posts/foo/"), undefined);
  assert.deepStrictEqual(extractDate("/foo"), undefined);
});

test("tidFromPath: date path matches createTid", () => {
  assert.deepStrictEqual(tidFromPath("/2026-05-26-component-scoped-css/"), "3mmpoqlvc22er");
});

test("tidFromPath: non-date path matches createTid", () => {
  assert.deepStrictEqual(tidFromPath("/posts/foo/"), "3wnfep4ezvzar");
});

test("anyFromPath: simple path", () => {
  assert.deepStrictEqual(anyFromPath("/my-post"), "my-post");
});

test("anyFromPath: path with trailing slash", () => {
  assert.deepStrictEqual(anyFromPath("/my-post/"), "my-post");
});

test("anyFromPath: slashes stripped from path segments", () => {
  assert.deepStrictEqual(anyFromPath("/posts/my-post"), "posts-my-post");
});

test("anyFromPath: dots and tildes preserved", () => {
  assert.deepStrictEqual(anyFromPath("/my-post.html"), "my-post.html");
});

test("anyFromPath: special characters stripped", () => {
  assert.deepStrictEqual(anyFromPath("/my post!"), "mypost");
});

test("anyFromPath: truncates at 512 chars", () => {
  assert.deepStrictEqual(anyFromPath("/" + "a".repeat(600)).length, 512);
});
