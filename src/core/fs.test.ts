import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

import { findFiles, readDir, readFile, readJsonFiles, readTextFile } from "./fs.ts";
import { urlPathToFilePath, type FilePath } from "./fsHelpers.ts";

test("urlPathToFilePath decodes URL paths and preserves filesystem characters", () => {
  const path: FilePath = urlPathToFilePath("/assets/./hello%20%23%3F%2520-%C3%BC.txt");
  assert.equal(path, "assets/./hello #?%20-ü.txt");
  assert.equal(urlPathToFilePath("/assets//./file.txt"), "assets//./file.txt");
  assert.equal(urlPathToFilePath("/hello%20world/"), "hello world/");
  assert.equal(urlPathToFilePath("///hello%20world/"), "hello world/");
  assert.equal(urlPathToFilePath("/%2fhello.txt"), "hello.txt");
  assert.equal(urlPathToFilePath("/"), ".");
  assert.equal(urlPathToFilePath(""), ".");
  assert.throws(() => urlPathToFilePath("/%FF"), URIError);
  assert.throws(() => urlPathToFilePath("/100%.txt"), URIError);

  assert.equal(urlPathToFilePath("/a%5Cb/c/"), sep === "\\" ? "a/b/c/" : "a\\b/c/");
  assert.equal(urlPathToFilePath("/file..name.txt"), "file..name.txt");
  assert.equal(urlPathToFilePath("/%252e%252e/file.txt"), "%2e%2e/file.txt");

  // These checks are compile-time only: runtime strings cannot carry a brand.
  if (false) {
    // @ts-expect-error A FilePath must not be URL-decoded twice.
    urlPathToFilePath(path);
    // @ts-expect-error Plain strings must be converted before use as FilePaths.
    const unconverted: FilePath = "/assets/file.txt";
  }
});

test("filesystem reads reject decoded parent-directory segments", async () => {
  for (const path of [
    "../secret",
    "data/../secret",
    "data/..",
    "/data/%2e%2e/secret",
    "data/%2e%2e%2fsecret",
  ]) {
    assert.throws(() => urlPathToFilePath(path), /must not include \.\. segments/);
    for (const read of [readFile, readTextFile, readDir]) {
      await assert.rejects(read(path), /must not include \.\. segments/);
    }
  }
});

test("readDir accepts empty and slash paths for the project root", async () => {
  const expected = await readDir(".");
  assert.ok(expected.includes("package.json"));
  assert.deepEqual(await readDir(""), expected);
  assert.deepEqual(await readDir("/"), expected);
});

test("filesystem helpers exchange URL paths and decode exactly once when reading", async (t) => {
  const dir = await mkdtemp(join(process.cwd(), ".mastro-fs-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "nested %20"));
  await writeFile(join(dir, "nested %20", "hello # %20 ü.json"), '{"name":"test"}');
  const base = relative(process.cwd(), dir).replaceAll("\\", "/");
  const nested = `${base}/nested%20%2520`;
  const expected = `${nested}/hello%20%23%20%2520%20%C3%BC.json`;

  const paths: string[] = await findFiles(`${base}/**/*.json`);
  assert.deepEqual(paths, [expected]);
  assert.deepEqual(await readDir("/" + nested), ["hello%20%23%20%2520%20%C3%BC.json"]);
  assert.equal(await readTextFile("/" + paths[0]!), '{"name":"test"}');
  assert.equal(new TextDecoder().decode(await readFile(paths[0]!)), '{"name":"test"}');
  await assert.rejects(readFile(`${base}/%FF`), URIError);
  const files = await readJsonFiles(`${base}/**/*.json`);
  assert.equal(files[0]?.path, expected);
  assert.equal(files[0]?.slug, "hello%20%23%20%2520%20%C3%BC");
});

test("Windows filesystem paths use forward slashes without decoding filesystem names", () => {
  const script = `
    import assert from 'node:assert/strict';
    import { mock } from 'node:test';
    mock.module('node:path', { namedExports: { sep: '\\\\' } });
    mock.module('node:fs/promises', { namedExports: {
      glob: async function* () {
        yield { isFile: () => true, parentPath: process.cwd() + '\\\\routes\\\\nested', name: 'hello%20.txt' };
      }
    }});
    const { findFiles } = await import(${JSON.stringify(new URL("./fs.ts", import.meta.url).href)});
    const { urlPathToFilePath } = await import(${JSON.stringify(new URL("./fsHelpers.ts", import.meta.url).href)});
    for (const path of ['/a%5Cb/../c/', 'data%5c..%5csecret', 'data\\\\..\\\\secret']) {
      assert.throws(() => urlPathToFilePath(path), /must not include \\.\\. segments/);
    }
    assert.equal(urlPathToFilePath('routes\\\\nested\\\\hello%20world.txt'), 'routes/nested/hello world.txt');
    assert.equal(urlPathToFilePath('%5C%5Cserver%5Cshare%5Cfile.txt'), 'server/share/file.txt');
    for (const path of ['C:/secret', '/C:%5csecret', './C:secret', '././C:secret', './/./C:secret']) {
      assert.throws(() => urlPathToFilePath(path), /must be relative/);
    }
    const paths = await findFiles('routes/**/*');
    assert.deepEqual(paths, ['routes/nested/hello%2520.txt']);
    assert.equal(urlPathToFilePath(paths[0]), 'routes/nested/hello%20.txt');
  `;
  const result = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", "--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

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
  await assert.rejects(findFiles("foo/.."), /must not include \.\. segments/);
});

test("readJsonFiles", async () => {
  const arr = await readJsonFiles<{ name: string }>("*.json");
  assert.deepEqual(arr.length, 2);
  assert.deepEqual(arr[0]?.path, "package.json");
  assert.deepEqual(arr[0]?.slug, "package");
  assert.deepEqual(arr[0]?.data.name, "@mastrojs/mastro");
});
