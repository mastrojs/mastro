import assert from "node:assert/strict";
import { test } from "node:test";
import { findFiles, readJsonFiles } from "./fs.ts";

test("findFiles", async () => {
  assert.deepEqual(await findFiles("*"), [
    "LICENSE",
    "README.md",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
  ]);

  assert.deepEqual(await findFiles("/etc/*"), []);

  assert.rejects(() => findFiles("../*"));

  assert.rejects(() => findFiles("foo/../../bar/*"));
});

test("readJsonFiles", async () => {
  const arr = await readJsonFiles<{ name: string }>("*.json");
  assert.deepEqual(arr.length, 2);
  assert.deepEqual(arr[0]?.path, "package.json");
  assert.deepEqual(arr[0]?.slug, "package");
  assert.deepEqual(arr[0]?.data.name, "@mastrojs/mastro");
});
