# @mastrojs/result

An extremely simple `Result` type. Return either an `Ok` or `Err` instead of throwing an exception.

Exceptions in TypeScript are not type-safe, and it's often hard to know whether a function can throw or not. For an introduction of the concept, see e.g. [Using Results in TypeScript](https://imhoff.blog/posts/using-results-in-typescript).


Inspired by Rust's `Result<T, E>` type (known as `Either` in some functional languages), this implementation is even more minimal than [ts-results](https://github.com/vultix/ts-results) (which is also unmaintained). If you're looking for a more object-oriented alternative, see [neverthrow](https://npmx.dev/package/neverthrow). Unlike the `[data, error]` approach (used e.g. in Go), you don't risk getting the tuple index wrong.


## Install

    pnpm add @mastrojs/result


## Usage

```ts
import { Ok, Err, type Result } from "@mastrojs/result";

const go = (): Result<number> =>
  Math.random()
    ? Ok(3)
    : Err("Oh noes");

const res = go();
if (res.ok) {
  console.info(res.val);
} else {
  console.error(res.error);
}
```

For all exported functions and their documentation, see the [source](src/result.ts).

The string literal in `AppError.error` can be used to keep track of known errors:

```ts
// e has type `AppError<"timeout" | "crash">`
const e = Math.random() ? Err("timeout") : Err("crash");
```


### Custom error type

`Result<T, E>` is generic in both arguments. `E` defaults to `AppError`, but you can also use a custom error type (as long as it has a field `ok: undefined`), in which case you have to bring your own `MyErr` constructor like:

```ts
type MyError = {
  ok: undefined;
  // custom fields here, for example:
  errors: string[];
};

export const MyErr = (errors: string[]) => {
  return { ok: undefined, errors };
}

// usage:
const go = (): Result<number, MyError> =>
  Math.random()
    ? Ok(3)
    : MyErr(["Oh noes", "more things wrong"]);
```
