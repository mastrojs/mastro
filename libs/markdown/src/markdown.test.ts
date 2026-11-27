import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { test } from "node:test";

import { unsafeInnerHtml } from "@mastrojs/mastro";

import {
  markdownPlainToHtml,
  markdownToHtml,
  readMarkdownFiles,
  serveMarkdownFolder,
} from "./markdown.ts";

test("markdownToHtml", async () => {
  assert.deepEqual(await markdownToHtml("hi *there*"), {
    content: new String("<p>hi <em>there</em></p>"),
    meta: {},
  });

  assert.deepEqual(await markdownToHtml("---\ntitle: go\n---\nhi *there*"), {
    content: new String("<p>hi <em>there</em></p>"),
    meta: { title: "go" },
  });
});

test("markdownToHtml parses YAML scalars without converting dates to objects", async () => {
  const { content, meta } = await markdownToHtml(`---
title: my title
count: 3
draft: false
date: 2026-11-21
tags: [one, two]
---
hi *there*`);

  assert.deepEqual(content, new String("<p>hi <em>there</em></p>"));
  assert.deepEqual(meta, {
    title: "my title",
    count: 3,
    draft: false,
    date: "2026-11-21",
    tags: ["one", "two"],
  });
});

test("markdownToHtml handles frontmatter delimiters", async () => {
  const cases = [
    {
      input: "---\ntitle: hello\n---\nBody",
      meta: { title: "hello" },
      content: "<p>Body</p>",
    },
    { input: "---\n---\nBody", meta: {}, content: "<p>Body</p>" },
    { input: "---\n\n---\nBody", meta: {}, content: "<p>Body</p>" },
    { input: "---\n  \n---\nBody", meta: {}, content: "<p>Body</p>" },
    { input: "---\n---", meta: {}, content: "" },
    {
      input: "---\ntitle: hello\n---",
      meta: { title: "hello" },
      content: "",
    },
  ] as const;
  for (const newline of ["\n", "\r\n", "\r"]) {
    for (const { input, meta, content } of cases) {
      assert.deepEqual(
        await markdownToHtml(input.replaceAll("\n", newline)),
        { content: unsafeInnerHtml(content), meta },
        input,
      );
    }
  }

  for (const input of [
    "---\ntitle: hello\n---oops\nBody",
    "---\ntitle: hello\n----\nBody",
    "----\ntitle: hello\n---\nBody",
    "---\ntitle: hello\nBody",
    "Intro\n---\ntitle: hello\n---\nBody",
  ]) {
    const expected = { content: markdownPlainToHtml(input), meta: {} };
    assert.deepEqual(await markdownToHtml(input), expected, input);
  }
});

test("serveMarkdownFolder", async (t) => {
  const directory = await mkdtemp(join(process.cwd(), ".mastro-markdown-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "nested/post"), { recursive: true });
  const files = [
    { file: "index.md", path: "/", title: "Home" },
    { file: "post.md", path: "/post/", title: "Post" },
    { file: "nested/post/index.md", path: "/nested/post/", title: "Nested" },
  ];
  for (const { file, title } of files) {
    await writeFile(join(directory, file), `---\ntitle: ${title}\n---\n${title}`);
  }

  const folder = basename(directory);
  await readMarkdownFiles(`${folder}/**/*.md`);
  for (const suffix of ["", "/", "///"]) {
    const { GET, getStaticPaths } = serveMarkdownFolder(
      { folder: folder + suffix },
      ({ content, meta }, req) =>
        new Response(
          JSON.stringify({ content: String(content), meta, path: new URL(req.url).pathname }),
        ),
    );

    assert.deepEqual((await getStaticPaths()).sort(), files.map(({ path }) => path).sort());
    for (const { path, title } of files) {
      const response = await GET(new Request(`https://example.com${path}`));
      assert.deepEqual(
        await response.json(),
        { content: `<p>${title}</p>`, meta: { title }, path },
        path,
      );
    }

    await assert.rejects(GET(new Request("https://example.com/post")), { name: "NotFound" });
    await assert.rejects(GET(new Request("https://example.com/missing/")), { code: "ENOENT" });
  }

  await unlink(join(directory, "index.md"));
  const { GET } = serveMarkdownFolder({ folder }, ({ content }) => new Response(String(content)));
  const response = await GET(new Request("https://example.com/"));
  assert.equal(await response.text(), "<p>Home</p>");
});
