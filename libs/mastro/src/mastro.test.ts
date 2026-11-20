import assert from "node:assert/strict";
import { test } from "node:test";

import { Mastro, type HttpMethod } from "./mastro.ts";
import type { Handler, Route } from "./types/mastro.d.ts";
import type { Middleware } from "./types/middleware.d.ts";

test("Mastro: apps own their middleware arrays", async () => {
  if (false) {
    // @ts-expect-error Middleware is registered with .use(), not constructor options.
    new Mastro({ middlewares: [] });
  }
  const first = new Mastro();
  const second = new Mastro().get("/", () => new Response("second"));

  first.use(() => new Response("first middleware"));
  const third = new Mastro().get("/", () => new Response("third"));

  assert.equal(second.getMiddlewares().length, 0);
  const cases = [
    [first, "first middleware"],
    [second, "second"],
    [third, "third"],
  ] as const;
  for (const [app, expected] of cases) {
    const response = await app.createHandler()(new Request("https://example.com/"));
    assert.equal(await response.text(), expected);
  }
});

test("Mastro: constructor routes load before programmatic routes", async () => {
  const route: Route = {
    name: "loaded",
    method: "GET",
    pattern: new URLPattern({ pathname: "/" }),
    handler: () =>
      new Response("loaded", {
        status: 202,
        statusText: "Accepted",
        headers: { "Content-Length": "6", ETag: '"loaded"' },
      }),
  };
  for (const routes of [[route], Promise.resolve([route])]) {
    const app = new Mastro({ routes }).get("/", () => new Response("programmatic"));
    assert.deepEqual(
      (await app.getRoutes()).map((r) => r.name),
      ["loaded", "/"],
    );
    const handler = app.createHandler();
    const response = await handler(new Request("https://example.com/"));
    assert.equal(await response.text(), "loaded");
    const head = await handler(new Request("https://example.com/", { method: "HEAD" }));
    assert.equal(head.status, response.status);
    assert.equal(head.statusText, response.statusText);
    assert.deepEqual([...head.headers], [...response.headers]);
    assert.equal(head.body, null);
  }
});

test("Mastro: concurrent requests keep their own parameters and extra arguments", async () => {
  const handler = new Mastro<[string]>()
    .use(async (req, ctx) => {
      await Promise.resolve(); // make first request yield
      assert.deepEqual(ctx.extras, [new URL(req.url).pathname]);
      return ctx.fetchNext(req);
    })
    .get("/:name", async (_req, { extras: [extra], params }) => {
      await Promise.resolve();
      assert.deepEqual(params, { name: extra.slice(1) });
      return new Response(extra);
    })
    .createHandler();

  const responses = await Promise.all(
    ["/first", "/second"].map((path) => handler(new Request("https://example.com" + path), path)),
  );
  assert.deepEqual(await Promise.all(responses.map((res) => res.text())), ["/first", "/second"]);
});

test("Mastro: programmatic routes expose selected parameters without mutating requests", async () => {
  let selectedRequest: Request | undefined;
  let selectedParams: Record<string, string | undefined> | undefined;
  const respond: Handler = (req, ctx) => {
    selectedRequest = req;
    selectedParams = ctx.params;
    assert.ok(!("fetchNext" in ctx));
    if (false) {
      // @ts-expect-error The default handler context does not expose middleware forwarding.
      ctx.fetchNext;
    }
    return Response.json(ctx.params);
  };
  const handler = new Mastro()
    .post("/users/:name", respond)
    .get("/users/:id", respond)
    .addRoute("all", "/files/:path(.*)?", respond)
    .get("/plain", respond)
    .createHandler();
  const cases: Array<[string, HttpMethod, Record<string, string>]> = [
    ["/users/42", "GET", { id: "42" }],
    ["/users/hello%20world", "GET", { id: "hello%20world" }],
    ["/users/alice", "POST", { name: "alice" }],
    ["/files/one/two", "PUT", { path: "one/two" }],
    ["/plain", "GET", {}],
  ];

  for (const [path, method, expected] of cases) {
    const response = await handler(
      Object.freeze(new Request("https://example.com" + path, { method })),
    );
    assert.equal(response.status, 200, `${method} ${path}`);
    assert.deepEqual(await response.json(), expected, `${method} ${path}`);
    if (method === "GET") {
      const request = Object.freeze(new Request("https://example.com" + path, { method: "HEAD" }));
      const head = await handler(request);
      assert.equal(head.status, 200);
      assert.equal(head.body, null);
      assert.equal(selectedRequest, request);
      assert.equal(request.method, "HEAD");
      assert.deepEqual(selectedParams, expected);
    }
  }
});

test("Mastro: dispatches programmatic routes and chains middleware", async () => {
  const handler = new Mastro()
    .get("/", () => new Response("root"))
    .post("/foo", () => new Response("posted"))
    .get("/blog/", () => new Response("blog index"))
    .get("/blog/:slug/", () => new Response("blog detail"))
    .get("/test/", { handler: () => new Response("GET handler") })
    .get("/users", () => new Response("got users"))
    .post("/users", () => new Response("posted users"))
    .get("/head", () => assert.fail("GET must not override HEAD"))
    .addRoute("HEAD", "/head", () => new Response("ignored"))
    .get("/all-head", () => assert.fail("GET must not override all for HEAD"))
    .addRoute("all", "/all-head", () => new Response("ignored"))
    .addRoute("all", "/all", { handler: () => new Response("All") })
    .createHandler();

  const access = async (path: string, method: HttpMethod = "GET") => {
    const req = new Request("http://localhost" + path, { method });
    const res = await handler(req);
    const text = await res.text();
    return res.ok ? text : { status: res.status };
  };

  assert.deepEqual(await access("/"), "root");
  assert.deepEqual(await access("/foo"), { status: 405 });
  assert.deepEqual(await access("/foo", "HEAD"), { status: 405 });
  assert.deepEqual(await access("/bar"), { status: 404 });
  assert.deepEqual(await access("/bar", "HEAD"), { status: 404 });
  assert.deepEqual(await access("/", "POST"), { status: 405 });
  assert.deepEqual(await access("/", "OPTIONS"), { status: 405 });
  assert.deepEqual(await access("/", "HEAD"), "");
  assert.deepEqual(await access("/head", "HEAD"), "");
  assert.deepEqual(await access("/all-head", "HEAD"), "");
  assert.deepEqual(await access("/blog/mypost/"), "blog detail");
  assert.deepEqual(await access("/test/"), "GET handler");
  assert.deepEqual(await access("/users"), "got users");
  assert.deepEqual(await access("/users", "POST"), "posted users");
  assert.deepEqual(await access("/all"), "All");
  assert.deepEqual(await access("/all", "POST"), "All");
  assert.deepEqual(await access("/all", "HEAD"), "");

  const extra0 = { message: "root" };
  const extra1 = {};
  const middlewareHandler = new Mastro<[typeof extra0, typeof extra1]>()
    .use(async (req, ctx) => {
      assert.equal(ctx.extras[0], extra0);
      assert.equal(ctx.extras[1], extra1);
      const response = await ctx.fetchNext(req);
      return new Response(`${await response.text()} first`);
    })
    .use(async (req, ctx) => {
      assert.equal(ctx.extras[0], extra0);
      assert.equal(ctx.extras[1], extra1);
      const response = await ctx.fetchNext(req);
      return new Response(`${await response.text()} second`);
    })
    .get("/", (req, { extras: [ex0, ex1] }) => {
      assert.equal(ex0, extra0);
      assert.equal(ex1, extra1);
      return new Response(ex0.message);
    })
    .createHandler();

  const req = new Request("http://localhost/");
  assert.deepEqual(
    await (await middlewareHandler(req, extra0, extra1)).text(),
    "root second first",
  );
});

test("Mastro: use mutates the same app, including after route registration", async () => {
  const app = new Mastro().get("/", () => new Response("home"));
  const returned = app.use(async (req, ctx) => {
    const response = await ctx.fetchNext(req);
    return new Response(`${await response.text()} middleware`);
  });
  assert.equal(returned, app);
  assert.equal(app.getMiddlewares().length, 1);

  const typed = app
    .use<{ user: { name: string } }>((req, ctx) => ctx.fetchNext(req, { user: { name: "Alice" } }))
    .use<{ greeting: string }>((req, ctx) =>
      ctx.fetchNext(req, { greeting: `Hello ${ctx.locals.user.name}` }),
    )
    .get("/greeting", (_req, ctx) => new Response(ctx.locals.greeting));
  assert.equal(typed, app);
  const handler = app.createHandler();
  for (const [path, expected] of [
    ["/", "home middleware"],
    ["/greeting", "Hello Alice middleware"],
  ]) {
    const response = await handler(new Request(`https://example.com${path}`));
    assert.equal(await response.text(), expected);
  }
});

test("Mastro: locals are fresh per request and forwarding patches have independent snapshots", async () => {
  const branches: Middleware<{ value: string }> = async (req, ctx) => {
    assert.deepEqual(ctx.locals, {});
    const first = ctx.fetchNext(req, { value: "first" });
    const second = ctx.fetchNext(req, { value: "second" });
    assert.deepEqual(ctx.locals, {});
    return Response.json(await Promise.all([first, second].map(async (res) => (await res).text())));
  };
  const handler = new Mastro()
    .use(branches)
    .get("/", async (_req, ctx) => {
      await Promise.resolve();
      return new Response(ctx.locals.value);
    })
    .createHandler();
  const responses = await Promise.all([
    handler(new Request("https://example.com/")),
    handler(new Request("https://example.com/")),
  ]);
  for (const response of responses) assert.deepEqual(await response.json(), ["first", "second"]);
});
