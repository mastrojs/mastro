import assert from "node:assert/strict";
import { test } from "node:test";

import { html } from "../core/html.ts";
import { Mastro } from "../core/mastro.ts";
import { chainMiddlewares, type Middleware } from "../middleware.ts";
import { loadRoutes } from "../servers/fileRouter.ts";
import { logger } from "./logger.ts";

for (const environment of ["development", "production"] as const) {
  test(`${environment} success logging preserves the response`, async (t) => {
    const log = t.mock.method(console, "info", () => {});
    const original = new Response("article", { headers: { "X-Route": "article" } });
    const routeName = "routes/posts/[slug].server.ts";
    const routes = await loadRoutes([{ name: routeName, pathname: "/posts/:slug" }], async () => ({
      GET: () => original,
    }));
    const response = await new Mastro({ routes, middlewares: [logger] }).createHandler({
      environment,
    })(new Request("https://example.com/posts/hello?preview=1"));

    assert.equal(response, original);
    assert.equal(response.headers.get("X-Route"), "article");
    assert.equal(response.bodyUsed, false);
    assert.equal(await response.text(), "article");
    if (environment === "development") {
      assert.equal(log.mock.callCount(), 1);
      assert.deepEqual(log.mock.calls[0]!.arguments, [
        "GET /posts/hello?preview=1 => 200",
        routeName,
      ]);
    } else {
      assert.equal(log.mock.callCount(), 0);
    }
  });
}

test("development logs successful middleware responses without a route name", async (t) => {
  const log = t.mock.method(console, "info", () => {});
  const original = new Response("created", { status: 201 });
  const response = await new Mastro({ middlewares: [logger, () => original] }).createHandler({
    environment: "development",
  })(new Request("https://example.com/", { method: "POST" }));

  assert.equal(response, original);
  assert.equal(response.bodyUsed, false);
  assert.equal(log.mock.callCount(), 1);
  assert.deepEqual(log.mock.calls[0]!.arguments, ["POST / => 201", ""]);
});

test("logger preserves returned 404 and 405 responses", async (t) => {
  const log = t.mock.method(console, "warn", () => {});
  for (const status of [404, 405]) {
    const original = new Response("route response", { status, headers: { Allow: "GET" } });
    const response = await new Mastro({ middlewares: [logger] })
      .get("/", () => original)
      .createHandler()(new Request("https://example.com/"));
    assert.equal(response, original);
    assert.equal(response.headers.get("Allow"), "GET");
    assert.equal(await response.text(), "route response");
  }
  assert.equal(log.mock.callCount(), 0);
});

test("development warns for 404 and 405 without changing the response", async (t) => {
  const log = t.mock.method(console, "warn", () => {});
  for (const status of [404, 405]) {
    const original = new Response("route response", { status });
    const response = await new Mastro({ middlewares: [logger] })
      .get("/", () => original)
      .createHandler({ environment: "development" })(new Request("https://example.com/"));
    assert.equal(response, original);
    assert.ok(log.mock.calls.at(-1)!.arguments[0].includes(`GET / => ${status}`));
  }
  assert.equal(log.mock.callCount(), 2);
});

test("favicon suppression applies to missing icons, but not server errors", async (t) => {
  const warnings = t.mock.method(console, "warn", () => {});
  const errors = t.mock.method(console, "error", () => {});
  for (const status of [404, 500]) {
    const original = new Response("favicon response", { status });
    const response = await new Mastro({ middlewares: [logger] })
      .get("/favicon.ico", () => original)
      .createHandler({ environment: "development" })(
      new Request("https://example.com/favicon.ico"),
    );
    assert.equal(response, original);
  }
  assert.equal(warnings.mock.callCount(), 0);
  assert.equal(errors.mock.callCount(), 1);
  assert.ok(errors.mock.calls[0]!.arguments[0].includes("GET /favicon.ico => 500"));
});

for (const failure of [undefined, null, false, 0, ""]) {
  test(`development preserves diagnostics for a thrown ${String(failure)} value`, async (t) => {
    const log = t.mock.method(console, "error", () => {});
    const response = await new Mastro({ middlewares: [logger] })
      .get("/", () => {
        throw failure;
      })
      .createHandler({ environment: "development" })(new Request("https://example.com/"));
    assert.equal(response.status, 500);
    assert.equal(await response.text(), `500 Internal Server Error\n\n${String(failure)}`);
    assert.equal(log.mock.callCount(), 1);
    assert.equal(log.mock.calls[0]!.arguments[1], failure);
  });
}

test("production logs exception stacks as JSON without exposing them in the response", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const failure = new Error("private details");
  const response = await new Mastro({ middlewares: [logger] })
    .get("/", () => {
      throw failure;
    })
    .createHandler()(new Request("https://example.com/"));
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "500 Internal Server Error");
  assert.equal(log.mock.callCount(), 1);
  assert.deepEqual(JSON.parse(log.mock.calls[0]!.arguments[0]), {
    message: String(failure),
    stack: failure.stack,
    method: "GET",
    url: "https://example.com/",
    status: 500,
  });
});

test("logger still maps missing-file exceptions to 404", async (t) => {
  const log = t.mock.method(console, "warn", () => {});
  const failure = Object.assign(new Error("private file path"), { code: "ENOENT" });
  const response = await new Mastro({ middlewares: [logger] })
    .get("/", () => {
      throw failure;
    })
    .createHandler()(new Request("https://example.com/"));
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "404 Not Found\n\n");
  assert.equal(log.mock.callCount(), 1);
  assert.ok(log.mock.calls[0]!.arguments[0].includes("GET / => 404"));
  assert.equal(log.mock.calls[0]!.arguments[1], failure);
});

for (const source of ["route", "middleware", "upstream"] as const) {
  test(`logger logs and preserves a returned 503 from ${source}`, async (t) => {
    const log = t.mock.method(console, "error", () => {});
    let processed = false;
    const processResponse: Middleware = async (req, ctx) => {
      const response = await ctx.fetchUpstream(req);
      processed = true;
      return response;
    };
    const original = new Response("temporarily unavailable", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Retry-After": "60", "Content-Type": "text/plain" },
    });
    const unavailable = () => original;
    const req = new Request("https://example.com/");
    let response: Response;
    if (source === "upstream") {
      response = await chainMiddlewares([logger, processResponse])(req, {
        mode: "server",
        environment: "production",
        extra: [],
        fetchUpstream: unavailable,
      });
    } else {
      const app = new Mastro({
        middlewares: [logger, processResponse, ...(source === "middleware" ? [unavailable] : [])],
      }).get("/", unavailable);
      response = await app.createHandler()(req);
    }

    assert.equal(response, original);
    assert.equal(response.status, 503);
    assert.equal(response.statusText, "Service Unavailable");
    assert.equal(response.headers.get("Retry-After"), "60");
    assert.equal(response.headers.get("Content-Type"), "text/plain");
    assert.equal(response.bodyUsed, false);
    assert.equal(await response.text(), "temporarily unavailable");
    assert.equal(processed, true);
    assert.equal(log.mock.callCount(), 1);
    const { arguments: args } = log.mock.calls[0]!;
    assert.deepEqual(JSON.parse(args[0]), {
      message: "HTTP 503",
      method: "GET",
      url: req.url,
      status: 503,
    });
  });
}

test("logging a 5xx response does not depend on reading its body", async (t) => {
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
  const handler = new Mastro({ middlewares: [logger] }).get("/", () => original).createHandler();

  const response = await handler(new Request("https://example.com/"));
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
  test(`${environment} handles an arbitrary response with an attached error`, async (t) => {
    const log = t.mock.method(console, "error", () => {});
    const failure = new Error("original error");
    const original = Object.assign(
      new Response("original body", {
        status: 503,
        headers: { "Retry-After": "60" },
      }),
      { error: failure },
    );
    const response = await new Mastro({ middlewares: [logger] })
      .get("/", () => original)
      .createHandler({ environment })(new Request("https://example.com/"));

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

test("a failed development body read becomes a generic 500 response", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const originalError = new Error("original error");
  const bodyError = new Error("body stream failed");
  const original = Object.assign(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(bodyError);
        },
      }),
      { status: 503 },
    ),
    { error: originalError },
  );
  const response = await new Mastro({ middlewares: [logger] })
    .get("/", () => original)
    .createHandler({ environment: "development" })(new Request("https://example.com/"));

  assert.equal(response.status, 500);
  assert.equal(await response.text(), "500 Internal Server Error");
  assert.ok("error" in response);
  assert.equal(response.error, bodyError);
  assert.equal(log.mock.callCount(), 1);
  assert.equal(log.mock.calls[0]!.arguments[1], originalError);
});

test("invalid file-route responses identify the route and the missing conversion", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const routes = await loadRoutes(
    [{ name: "routes/index.server.ts", pathname: "/" }],
    async () => ({ GET: () => html`<h1>Forgot htmlToResponse</h1>` }),
  );
  const handler = new Mastro({ routes, middlewares: [logger] }).createHandler();
  const response = await handler(new Request("http://localhost/"));

  assert.equal(response.status, 500);
  const message =
    "GET handler in routes/index.server.ts must return a Response object. Did you forget `htmlToResponse`?";
  assert.ok((await response.text()).includes(message));
  assert.equal(log.mock.callCount(), 1);
  assert.equal(log.mock.calls[0]!.arguments[1].message, message);
});

for (const asynchronous of [false, true]) {
  test(`logger preserves the original ${asynchronous ? "async" : "sync"} route error and stack`, async (t) => {
    const log = t.mock.method(console, "error", () => {});
    let original: Error | undefined;
    const GET = () => {
      const fail = () => {
        original = new Error("route failed");
        throw original;
      };
      if (asynchronous) return Promise.resolve().then(fail);
      return fail();
    };
    const routes = await loadRoutes(
      [{ name: "routes/index.server.ts", pathname: "/" }],
      async () => ({ GET }),
    );
    const handler = new Mastro({
      routes,
      middlewares: [logger, (req, ctx) => ctx.fetchUpstream(req)],
    }).createHandler();
    const response = await handler(new Request("http://localhost/"));

    assert.equal(response.status, 500);
    assert.ok(original);
    assert.match(original.stack!.split("\n")[1]!, /logger\.test\.ts:/);
    assert.equal(await response.text(), `500 Internal Server Error\n\n${original.stack}`);
    assert.equal(log.mock.callCount(), 1);
    assert.equal(log.mock.calls[0]!.arguments[1], original);
  });
}
