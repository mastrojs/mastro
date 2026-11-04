import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

import {
  filePath,
  type FilePath,
  findFiles,
  readDir,
  readFile,
  readJsonFiles,
  readTextFile,
  urlPath,
} from "./fs.ts";

test("filePath decodes URL paths, urlPath preserves filename characters", () => {
  const path: FilePath = filePath("/assets/./hello%20%23%3F%2520-%C3%BC.txt");
  assert.equal(path, "assets/./hello #?%20-ü.txt");
  assert.equal(urlPath(path), "assets/./hello%20%23%3F%2520-%C3%BC.txt");
  assert.equal(filePath("/assets//./file.txt"), "assets//./file.txt");
  assert.equal(filePath(urlPath(path)), path);
  assert.equal(filePath("/hello%20world/"), "hello world/");
  assert.equal(filePath("///hello%20world/"), "hello world/");
  assert.equal(filePath("/%2fhello.txt"), "hello.txt");
  assert.equal(filePath("/"), ".");
  assert.throws(() => filePath("/%FF"), URIError);
  assert.throws(() => filePath("/100%.txt"), URIError);

  assert.equal(filePath("/a%5Cb/c/"), sep === "\\" ? "a/b/c/" : "a\\b/c/");
  assert.equal(filePath("/file..name.txt"), "file..name.txt");
  assert.equal(filePath("/%252e%252e/file.txt"), "%2e%2e/file.txt");

  // These checks are compile-time only: runtime strings cannot carry a brand.
  if (false) {
    // @ts-expect-error A FilePath must not be URL-decoded twice.
    filePath(path);
    // @ts-expect-error URL encoding requires a decoded FilePath.
    urlPath("/assets/file.txt");
    // @ts-expect-error Plain strings must be converted before use as FilePaths.
    const unconverted: FilePath = "/assets/file.txt";
  }
});

test("filesystem reads reject decoded parent-directory segments", async () => {
  for (const path of ["../secret", "data/../secret", "data/..", "/data/%2e%2e/secret", "data/%2e%2e%2fsecret"]) {
    assert.throws(() => filePath(path), /must not include \.\. segments/);
    for (const read of [readFile, readTextFile, readDir]) {
      await assert.rejects(read(path), /must not include \.\. segments/);
    }
  }
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
    const { filePath, findFiles, urlPath } = await import(${JSON.stringify(new URL("./fs.ts", import.meta.url).href)});
    for (const path of ['/a%5Cb/../c/', 'data%5c..%5csecret', 'data\\\\..\\\\secret']) {
      assert.throws(() => filePath(path), /must not include \\.\\. segments/);
    }
    assert.equal(filePath('routes\\\\nested\\\\hello%20world.txt'), 'routes/nested/hello world.txt');
    assert.equal(filePath('%5C%5Cserver%5Cshare%5Cfile.txt'), 'server/share/file.txt');
    for (const path of ['C:/secret', '/C:%5csecret', './C:secret', '././C:secret', './/./C:secret']) {
      assert.throws(() => filePath(path), /must be relative/);
    }
    const paths = await findFiles('routes/**/*');
    assert.deepEqual(paths, ['routes/nested/hello%2520.txt']);
    assert.equal(filePath(paths[0]), 'routes/nested/hello%20.txt');
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
