import assert from "node:assert/strict";
import { test } from "node:test";

import { markdownToHtml } from "./markdown.ts";

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
