import assert from "node:assert/strict";
import { test } from "node:test";

import { docChanged, type Document } from "./document.ts";

const publishedAt = new Date("2026-08-01T12:00:00.000Z");

const baseOldDoc = (): Record<string, unknown> => ({
  title: "Hello world",
  description: "Summary",
  textContent: "Plain text",
  publishedAt: publishedAt.toISOString(),
});

const baseNewDoc = (): Document => ({
  title: "Hello world",
  url: new URL("https://example.com/posts/hello"),
  publishedAt,
  description: "Summary",
  textContent: "Plain text",
});

test("docChanged: identical document", () => {
  assert.strictEqual(docChanged(baseOldDoc(), baseNewDoc()), false);
});

test("docChanged: string field changed", () => {
  assert.strictEqual(
    docChanged(baseOldDoc(), { ...baseNewDoc(), title: "Updated title" }),
    true,
  );
});

test("docChanged: publishedAt changed", () => {
  assert.strictEqual(
    docChanged(baseOldDoc(), { ...baseNewDoc(), publishedAt: new Date("2026-08-02T12:00:00.000Z") }),
    true,
  );
});

test("docChanged: deep-equal extra fields unchanged", () => {
  const content = { $type: "site.standard.content.html", html: "<p>Hi</p>" };
  const tags = ["mastro", "atproto"];
  assert.strictEqual(
    docChanged(
      { ...baseOldDoc(), content: { ...content }, tags: [...tags] },
      { ...baseNewDoc(), content, tags },
    ),
    false,
  );
});

test("docChanged: deep-equal extra fields changed or added", () => {
  assert.strictEqual(
    docChanged(
      { ...baseOldDoc(), tags: ["mastro"] },
      { ...baseNewDoc(), tags: ["mastro", "atproto"] },
    ),
    true,
  );
  assert.strictEqual(
    docChanged(baseOldDoc(), { ...baseNewDoc(), content: { html: "<p>New</p>" } }),
    true,
  );
});
