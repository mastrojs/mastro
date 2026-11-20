import assert from "node:assert/strict";
import { test } from "node:test";

import { Mastro, type Context, type Middleware, type RouteParams } from "./index.ts";

type User = { name: string };
const user: Middleware<{ user: User }> = (req, ctx) => {
  return ctx.fetchNext(req, { user: { name: "Alice" } });
};
const greeting: Middleware<{ greeting: string }, Context<unknown[], { user: User }>> = (
  req,
  ctx,
) => {
  return ctx.fetchNext(req, { greeting: `Hello ${ctx.locals.user.name}` });
};

test("Type for Mastro.use: chained middleware retains locals, extras, params and mode narrowing", async () => {
  const handler = new Mastro<[string]>()
    .use(user)
    .use(greeting)
    .use<{ user: User }>((req, ctx) => {
      const name: string = ctx.locals.user.name;
      if (ctx.mode === "server") {
        const environment: "development" | "production" = ctx.environment;
        void environment;
      } else {
        const pregenerate: boolean = ctx.onlyPregenerate;
        void pregenerate;
      }
      if (false) {
        // @ts-expect-error Known locals retain their types when written.
        ctx.fetchNext(req, { user: "wrong type" });
        // @ts-expect-error Middleware cannot write undeclared variables.
        ctx.fetchNext(req, { other: true });
        // @ts-expect-error Locals are shallow readonly.
        ctx.locals.user = { name: "Bob" };
        // @ts-expect-error The locals container cannot be replaced either.
        ctx.locals = { user: { name: "Bob" }, greeting: "Hi" };
      }
      return ctx.fetchNext(req, { user: { name } });
    })
    .get("/posts/:id", (_req, ctx) => {
      assert.ok(!("set" in ctx));
      const id: string = ctx.params.id;
      const extra: string = ctx.extras[0];
      if (false) {
        // @ts-expect-error Only route parameters are available.
        ctx.params.other;
        // @ts-expect-error Routes cannot mutate locals.
        ctx.locals.user = { name: "Bob" };
      }
      return new Response(`${ctx.locals.greeting}/${id}/${extra}`);
    })
    .createHandler();
  const response = await handler(new Request("https://example.com/posts/42"), "extra");
  assert.equal(await response.text(), "Hello Alice/42/extra");
});

test("Type for fetchNext: rejects overwrites that do not match the declared local type", async () => {
  const app = new Mastro()
    .use<{ value: number }>((req, ctx) => {
      return ctx.fetchNext(req, { value: 42 });
    })
    .use<{ value: number }>((req, ctx) => {
      if (false) {
        // @ts-expect-error A known number cannot be replaced by a string.
        ctx.fetchNext(req, { value: "text" });
        // @ts-expect-error A present value must match the schema's declared type.
        ctx.fetchNext(req, { value: undefined });
      }
      return ctx.fetchNext(req, { value: 43 });
    })
    .get("/", (_req, ctx) => new Response(ctx.locals.value.toFixed()));
  assert.equal(await (await app.createHandler()(new Request("https://example.com/"))).text(), "43");
});

test("Type for Mastro.use: accepts one middleware and retains locals and extras types", () => {
  const first: Middleware<{ value: number }> = (req, ctx) => ctx.fetchNext(req, { value: 42 });
  const second: Middleware<{ value: number }, Context<unknown[], { value: number }>> = (req, ctx) =>
    ctx.fetchNext(req, { value: ctx.locals.value + 1 });
  const app = new Mastro<[string]>().use(first);
  app.use(second).get("/", (_req, ctx) => {
    const value: number = ctx.locals.value;
    const extra: string = ctx.extras[0];
    return new Response(`${value.toFixed()}/${extra}`);
  });

  if (false) {
    const middlewares = [first, second];
    const empty: Middleware[] = [];
    // @ts-expect-error A middleware argument is required.
    new Mastro().use();
    // @ts-expect-error Locals cannot be added without registering a middleware.
    new Mastro().use<{ value: number }>();
    // @ts-expect-error Register multiple middleware with separate use calls.
    new Mastro().use(first, second);
    // @ts-expect-error Middleware arrays cannot be passed directly.
    new Mastro().use(middlewares);
    // @ts-expect-error Middleware arrays cannot be spread into a single use call.
    new Mastro().use(...middlewares);
    // @ts-expect-error Empty arrays cannot supply the required middleware argument.
    new Mastro().use(...empty);
  }
});

test("Type for fetchNext: patches reject undeclared keys in literals, variables and empty schemas", () => {
  const empty: Middleware = (req, ctx) => {
    if (false) {
      // @ts-expect-error An empty schema does not accept arbitrary object properties.
      ctx.fetchNext(req, { value: "text" });
      const patch = { value: "text" };
      // @ts-expect-error Variables cannot bypass the empty schema either.
      ctx.fetchNext(req, patch);
    }
    return ctx.fetchNext(req);
  };
  const count: Middleware<{ count: number; label: string }> = (req, ctx) => {
    if (false) {
      const patch = { count: 1, label: "count", user: "wrong type" };
      // @ts-expect-error A valid field cannot smuggle in undeclared overwrites.
      ctx.fetchNext(req, patch);
      // @ts-expect-error Every required field must be included, not just a nonempty patch.
      ctx.fetchNext(req, { count: 1 });
    }
    return ctx.fetchNext(req, { count: 1, label: "count" });
  };
  void empty;
  void count;
});

test("Type for fetchNext: union patches cannot hide undeclared overwrites from other locals", async () => {
  type Patch = { added: boolean; value: string } | { added: boolean; other: number };
  const overwrite: Middleware<{ added: boolean }> = (req, ctx) => {
    const getPatch = (): Patch => ({ added: true, value: "wrong" });
    const getMixedPatch = (): Patch | { added: boolean } => getPatch();
    if (false) {
      // @ts-expect-error Keys present in only one union variant are still undeclared.
      ctx.fetchNext(req, getPatch());
      // @ts-expect-error A valid variant cannot hide invalid variants of the same patch.
      ctx.fetchNext(req, getMixedPatch());
    }
    return ctx.fetchNext(req, { added: true });
  };
  const handler = new Mastro()
    .use<{ value: number }>((req, ctx) => ctx.fetchNext(req, { value: 42 }))
    .use(overwrite)
    .get("/", (_req, ctx) => new Response(ctx.locals.value.toFixed()))
    .createHandler();
  const response = await handler(new Request("https://example.com/"));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "42");
});

test("Type for fetchNext: empty output schemas reject keys hidden in union patches", () => {
  const middleware: Middleware = (req, ctx) => {
    const getPatch = (): { value: string } | { other: number } => ({ value: "wrong" });
    const getOptionalPatch = (): { value?: string } | { other?: number } => getPatch();
    if (false) {
      // @ts-expect-error An empty schema cannot accept any union variant's keys.
      ctx.fetchNext(req, getPatch());
      // @ts-expect-error Optional keys in union variants are still undeclared.
      ctx.fetchNext(req, getOptionalPatch());
    }
    return ctx.fetchNext(req);
  };
  void middleware;
});

test("Type for middleware: outputs must match their declarations and preserve existing locals", async () => {
  type Count = { value: number };
  type Text = { value: string };
  type Label = { label: string };
  const number: Middleware<Count> = (req, ctx) => ctx.fetchNext(req, { value: 1 });
  const text: Middleware<Text> = (req, ctx) => ctx.fetchNext(req, { value: "oops" });
  const object: Middleware<Text> = { name: "text", handler: text };
  const update: Middleware<Count, Context<unknown[], Count>> = (req, ctx) =>
    ctx.fetchNext(req, { value: new URL(req.url).search ? 2 : ctx.locals.value });
  const conflict: Middleware<Text | Label> = (req, ctx) => {
    const patch: Text | Label = new URL(req.url).search ? { value: "oops" } : { label: "kept" };
    if (false) {
      // @ts-expect-error Disjoint output variants are conservatively rejected when forwarding.
      ctx.fetchNext(req, patch);
    }
    return new Response("not forwarded");
  };
  if (false) {
    // @ts-expect-error A string-producing function cannot promise a number.
    const incompatibleFunction: Middleware<Count> = text;
    // @ts-expect-error Object middleware must respect its declared output types too.
    const incompatibleObject: Middleware<Count> = object;
    // @ts-expect-error Explicit use generics cannot relabel function middleware outputs.
    new Mastro().use<Count>(text);
    // @ts-expect-error Explicit use generics cannot relabel object middleware outputs.
    new Mastro().use<Count>(object);
    // @ts-expect-error Every output variant must preserve existing locals, not just one.
    new Mastro().use(number).use(conflict);
  }
  const handler = new Mastro()
    .use(number)
    .use(update)
    .get("/", (_req, ctx) => new Response(ctx.locals.value.toFixed()))
    .createHandler();
  for (const [search, expected] of [
    ["", "1"],
    ["?update", "2"],
  ]) {
    const response = await handler(new Request(`https://example.com/${search}`));
    assert.equal(await response.text(), expected);
  }
});

test("Type for fetchNext: required outputs must be supplied; optional outputs may be omitted", async () => {
  const declared: Middleware<{ value: number }> = (req, ctx) => {
    if (new URL(req.url).search) return new Response("denied", { status: 401 });
    if (false) {
      // @ts-expect-error Required outputs need a patch.
      ctx.fetchNext(req);
      // @ts-expect-error An empty patch does not supply the required output.
      ctx.fetchNext(req, {});
      const optional: { value?: number } = {};
      // @ts-expect-error An optional field cannot satisfy a required output.
      ctx.fetchNext(req, optional);
      // @ts-expect-error Outputs are not declared as incoming values by default.
      ctx.locals.value;
    }
    return ctx.fetchNext(req, { value: 42 });
  };
  const readOnly: Middleware<{}, Context<unknown[], { value: number }>> = (req, ctx) => {
    const value: number = ctx.locals.value;
    assert.equal(value, 42);
    if (false) {
      // @ts-expect-error Reading a local does not declare it as an output.
      ctx.fetchNext(req, { value });
    }
    return ctx.fetchNext(req);
  };
  const conflicting: Middleware<{ value: string }> = (req, ctx) =>
    ctx.fetchNext(req, { value: "text" });
  const undefinedOutput: Middleware<{ value: undefined }> = (req, ctx) =>
    ctx.fetchNext(req, { value: undefined });
  const optionalOutput: Middleware<{ value?: number }> = (req, ctx) =>
    ctx.fetchNext(req, { value: undefined });
  if (false) {
    // @ts-expect-error An explicitly declared update must respect an existing local's type too.
    new Mastro().use(declared).use(conflicting);
    // @ts-expect-error A required number cannot be overwritten by declaring an undefined output.
    new Mastro().use(declared).use(undefinedOutput);
    // @ts-expect-error Optional outputs could erase an existing required local with undefined.
    new Mastro().use(declared).use(optionalOutput);
  }
  const handler = new Mastro()
    .use(declared)
    .use(readOnly)
    .get("/", (_req, ctx) => {
      const value: number = ctx.locals.value;
      return Response.json({ value });
    })
    .createHandler();
  assert.deepEqual(await (await handler(new Request("https://example.com/"))).json(), {
    value: 42,
  });
  const denied = await handler(new Request("https://example.com/?deny"));
  assert.equal(denied.status, 401);
  assert.equal(await denied.text(), "denied");
  const optional: Middleware<{ value?: number }> = (req, ctx) => {
    const variant = new URL(req.url).searchParams.get("variant");
    if (variant === "value") return ctx.fetchNext(req, { value: 7 });
    if (variant === "empty") return ctx.fetchNext(req, {});
    return ctx.fetchNext(req);
  };
  const optionalHandler = new Mastro()
    .use(optional)
    .get("/", (_req, ctx) => {
      if (false) {
        // @ts-expect-error Explicitly optional declarations require checks.
        const value: number = ctx.locals.value;
      }
      return Response.json({ value: ctx.locals.value });
    })
    .createHandler();
  for (const [variant, expected] of [
    ["omitted", {}],
    ["empty", {}],
    ["value", { value: 7 }],
  ] as const) {
    const response = await optionalHandler(new Request(`https://example.com/?variant=${variant}`));
    assert.deepEqual(await response.json(), expected);
  }
});

test("Type for Mastro.use: required updates explicitly preserve existing values and their declared types", async () => {
  const initial: Middleware<{ value: number | string }> = (req, ctx) =>
    ctx.fetchNext(req, { value: "seed" });
  const update: Middleware<
    { value: number | string },
    Context<unknown[], { value: number | string }>
  > = (req, ctx) => ctx.fetchNext(req, { value: new URL(req.url).search ? 7 : ctx.locals.value });
  const handler = new Mastro()
    .use(initial)
    .use(update)
    .get("/", (_req, ctx) => {
      const value: number | string = ctx.locals.value;
      if (false) {
        // @ts-expect-error Updates retain the existing local's declared union type.
        const number: number = ctx.locals.value;
      }
      return Response.json({ value });
    })
    .createHandler();
  assert.deepEqual(await (await handler(new Request("https://example.com/"))).json(), {
    value: "seed",
  });
  assert.deepEqual(await (await handler(new Request("https://example.com/?update"))).json(), {
    value: 7,
  });
});

test("Type for Mastro.use: updating a union discriminator does not narrow untouched locals", async () => {
  type State = { kind: "number"; value: number } | { kind: "text"; value: string };
  const initial: Middleware<State> = (req, ctx) => {
    const state: State = new URL(req.url).search
      ? { kind: "number", value: 42 }
      : { kind: "text", value: "hello" };
    return ctx.fetchNext(req, state);
  };
  const setKind: Middleware<{ kind: "number" }> = (req, ctx) =>
    ctx.fetchNext(req, { kind: "number" });
  const handler = new Mastro()
    .use(initial)
    .use(setKind)
    .get("/", (_req, ctx) => {
      if (false) {
        // @ts-expect-error Changing kind does not replace the existing string value with a number.
        ctx.locals.value.toFixed();
      }
      return Response.json(ctx.locals);
    })
    .createHandler();

  for (const [search, value] of [
    ["", "hello"],
    ["?number", 42],
  ] as const) {
    const response = await handler(new Request(`https://example.com/${search}`));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { kind: "number", value });
  }
});

test("RouteParams: colon parameters infer multiple names", async () => {
  if (false) {
    // @ts-expect-error Route parameter types require an absolute pathname.
    type InvalidParams = RouteParams<"users/:id">;
    // @ts-expect-error Route registration requires a leading slash.
    new Mastro().addRoute("GET", "users/:id", () => new Response());
    // @ts-expect-error HTTP method helpers require a leading slash too.
    new Mastro().get("users/:id", () => new Response());
  }
  const handler = new Mastro()
    .get("/users/:userId/posts/:postId/", (_req, ctx) => {
      const userId: string = ctx.params.userId;
      const postId: string = ctx.params.postId;
      if (false) {
        // @ts-expect-error Only the named parameters are available.
        ctx.params.other;
      }
      return new Response(`${userId}/${postId}`);
    })
    .createHandler();
  assert.equal(
    await (await handler(new Request("https://example.com/users/alice/posts/42/"))).text(),
    "alice/42",
  );
});

test("RouteParams: parameter suffix types match runtime keys", async () => {
  const handler = new Mastro()
    .get("/users/:userId/files/:file.tar.gz", (_req, ctx) => {
      const userId: string = ctx.params.userId;
      const file: string = ctx.params.file;
      if (false) {
        // @ts-expect-error The suffix is not part of the parameter name.
        ctx.params["file.tar.gz"];
        // @ts-expect-error Unrelated parameters are still rejected.
        ctx.params.other;
      }
      return new Response(`${userId}/${file}`);
    })
    .createHandler();
  const res = await handler(new Request("https://example.com/users/alice/files/report.tar.gz"));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "alice/report");
});

test("RouteParams: parameter @ suffixes use optional string values", async () => {
  const handler = new Mastro()
    .get("/:file@raw", (_req, ctx) => {
      const file: string | undefined = ctx.params.file;
      if (false) {
        // @ts-expect-error The suffix is not a guaranteed parameter name.
        const invented: string = ctx.params["file@raw"];
      }
      return Response.json({ file });
    })
    .createHandler();
  const res = await handler(new Request("https://example.com/report@raw"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { file: "report" });
});

test("RouteParams: parameter modifiers match required, optional and repeated runtime values", async () => {
  const handler = new Mastro()
    .get("/users/:id?", (_req, ctx) => {
      const id: string | undefined = ctx.params.id;
      if (false) {
        // @ts-expect-error Optional parameters need a presence check.
        const required: string = ctx.params.id;
        // @ts-expect-error The modifier is not part of the parameter name.
        ctx.params["id?"];
        // @ts-expect-error Unrelated parameters are still rejected.
        ctx.params.other;
      }
      return Response.json({ id });
    })
    .get("/users/:id?/files/:file.json", (_req, ctx) => {
      const id: string | undefined = ctx.params.id;
      const file: string = ctx.params.file;
      return Response.json({ id, file });
    })
    .get("/many/:id+", (_req, ctx) => {
      const id: string = ctx.params.id;
      if (false) {
        // @ts-expect-error The repetition modifier is not part of the parameter name.
        ctx.params["id+"];
      }
      return Response.json({ id });
    })
    .get("/any/:id*", (_req, ctx) => {
      const id: string | undefined = ctx.params.id;
      if (false) {
        // @ts-expect-error Zero repetitions leave the parameter undefined.
        const required: string = ctx.params.id;
        // @ts-expect-error The repetition modifier is not part of the parameter name.
        ctx.params["id*"];
      }
      return Response.json({ id });
    })
    .createHandler();
  for (const [path, expected] of [
    ["/users", {}],
    ["/users/42", { id: "42" }],
    ["/users/files/report.json", { file: "report" }],
    ["/users/42/files/report.json", { id: "42", file: "report" }],
    ["/many/one", { id: "one" }],
    ["/many/one/two", { id: "one/two" }],
    ["/any", {}],
    ["/any/one", { id: "one" }],
    ["/any/one/two", { id: "one/two" }],
  ] as const) {
    const res = await handler(new Request(`https://example.com${path}`));
    assert.equal(res.status, 200, path);
    assert.deepEqual(await res.json(), expected, path);
  }
  assert.equal((await handler(new Request("https://example.com/many"))).status, 404);
});

test("RouteParams: complex parameter patterns use optional string values", async () => {
  const handler = new Mastro()
    .get("/files/*", (_req, ctx) => {
      const params: Record<string, string | undefined> = ctx.params;
      const path: string | undefined = ctx.params["0"];
      void path;
      if (false) {
        // @ts-expect-error Complex patterns do not guarantee named parameters.
        const required: string = ctx.params.id;
      }
      return Response.json(params);
    })
    .createHandler();
  const res = await handler(new Request("https://example.com/files/one/two"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { "0": "one/two" });
});
