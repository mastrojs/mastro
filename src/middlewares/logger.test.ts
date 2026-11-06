import assert from "node:assert/strict";
import { test } from "node:test";

import type { Middleware, ServerContext } from "../middleware.ts";
import { logger } from "./logger.ts";

const { handler } = logger as Exclude<Middleware, Function>;

const context = (
  response: Response,
  environment: "development" | "production",
): ServerContext<[]> => ({
  mode: "server",
  environment,
  extra: [],
  fetchUpstream: () => response,
});

test("logger: development logs successful middleware responses without a route name", async (t) => {
  const log = t.mock.method(console, "info", () => {});
  const original = new Response("created", { status: 201 });
  const response = await handler(
    new Request("https://example.com/", { method: "POST" }),
    context(original, "development"),
  );

  assert.equal(response, original);
  assert.equal(response.bodyUsed, false);
  assert.equal(log.mock.callCount(), 1);
  assert.deepEqual(log.mock.calls[0]!.arguments, ["POST / => 201", ""]);
});

test("logger: preserves returned 404 and 405 responses", async (t) => {
  const log = t.mock.method(console, "warn", () => {});
  for (const status of [404, 405]) {
    const original = new Response("route response", { status, headers: { Allow: "GET" } });
    const response = await handler(
      new Request("https://example.com/"),
      context(original, "production"),
    );
    assert.equal(response, original);
    assert.equal(response.headers.get("Allow"), "GET");
    assert.equal(await response.text(), "route response");
  }
  assert.equal(log.mock.callCount(), 0);
});

test("logger: development warns for 404 and 405 without changing the response", async (t) => {
  const log = t.mock.method(console, "warn", () => {});
  for (const status of [404, 405]) {
    const original = new Response("route response", { status });
    const response = await handler(
      new Request("https://example.com/"),
      context(original, "development"),
    );
    assert.equal(response, original);
    assert.ok(log.mock.calls.at(-1)!.arguments[0].includes(`GET / => ${status}`));
  }
  assert.equal(log.mock.callCount(), 2);
});

test("logger: favicon suppression applies to missing icons, but not server errors", async (t) => {
  const warnings = t.mock.method(console, "warn", () => {});
  const errors = t.mock.method(console, "error", () => {});
  for (const status of [404, 500]) {
    const original = new Response("favicon response", { status });
    const response = await handler(
      new Request("https://example.com/favicon.ico"),
      context(original, "development"),
    );
    assert.equal(response, original);
  }
  assert.equal(warnings.mock.callCount(), 0);
  assert.equal(errors.mock.callCount(), 1);
  assert.ok(errors.mock.calls[0]!.arguments[0].includes("GET /favicon.ico => 500"));
});

test("logger: logging a 5xx response does not depend on reading its body", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const failure = new Error("body stream failed");
  const original = new Response(
    new ReadableStream({
      start(controller) {
        controller.error(failure);
      },
    }),
    { status: 503 },
  );
  const response = await handler(
    new Request("https://example.com/"),
    context(original, "production"),
  );
  assert.equal(response, original);
  assert.equal(response.bodyUsed, false);
  assert.equal(log.mock.callCount(), 1);
  assert.deepEqual(JSON.parse(log.mock.calls[0]!.arguments[0]), {
    message: "HTTP 503",
    method: "GET",
    url: "https://example.com/",
    status: 503,
  });
  await assert.rejects(response.text(), (error) => error === failure);
});

for (const environment of ["development", "production"] as const) {
  test(`logger: ${environment} handles an arbitrary response with an attached error`, async (t) => {
    const log = t.mock.method(console, "error", () => {});
    const failure = new Error("original error");
    const original = Object.assign(
      new Response("original body", {
        status: 503,
        headers: { "Retry-After": "60" },
      }),
      { error: failure },
    );
    const response = await handler(
      new Request("https://example.com/"),
      context(original, environment),
    );

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Retry-After"), "60");
    if (environment === "development") {
      assert.equal(await response.text(), `original body\n\n${failure.stack}`);
      assert.equal(log.mock.calls[0]!.arguments[1], failure);
    } else {
      assert.equal(response, original);
      assert.equal(response.bodyUsed, false);
      assert.equal(await response.text(), "original body");
      assert.equal(JSON.parse(log.mock.calls[0]!.arguments[0]).stack, failure.stack);
    }
    assert.equal(log.mock.callCount(), 1);
  });
}
