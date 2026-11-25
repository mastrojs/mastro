import assert from "node:assert/strict";
import { test } from "node:test";

import { htmlResponse, jsonResponse, mapIterable, sseResponse } from "./responses.ts";

test("htmlResponse", async () => {
  for (const headers of customHeaders) {
    const res = htmlResponse("<p>hi</p>", 201, headers);
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("X-Custom"), "value");
    assert.equal(res.headers.get("Content-Type"), "text/html; charset=utf-8");
    assert.equal(await res.text(), "<p>hi</p>");
  }
});

test("jsonResponse", async () => {
  for (const headers of customHeaders) {
    const res = jsonResponse({ message: "hi" }, 201, headers);
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("X-Custom"), "value");
    assert.equal(res.headers.get("Content-Type"), "application/json");
    assert.deepEqual(await res.json(), { message: "hi" });
  }
});

test("sseResponse", async () => {
  for (const headers of customHeaders) {
    const res = sseResponse(
      mapIterable(generator(), (n) => ({ number: n })),
      headers,
    );
    assert.equal(res.headers.get("X-Custom"), "value");
    assert.equal(res.headers.get("Content-Type"), "text/event-stream");
    assert.equal(
      await res.text(),
      'data: {"number":1}\n\ndata: {"number":2}\n\ndata: {"number":3}\n\n',
    );
  }
});

const customHeaders: (Record<string, string> | Headers)[] = [
  { "X-Custom": "value" },
  new Headers({ "X-Custom": "value" }),
];

async function* generator() {
  yield 1;
  yield 2;
  yield 3;
}
