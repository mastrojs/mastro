import assert from "node:assert/strict";
import { test } from "node:test";

import { unsafeInnerHtml } from "@mastrojs/mastro";

import { markdownPlainToHtml, markdownToHtml } from "./markdown.ts";

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
