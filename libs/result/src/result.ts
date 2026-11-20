import type { StandardSchemaV1 } from "./standard-schema.ts";

/**
 * `Result<T, E>` (sometimes known as `Either<T, E>`) is a generic type that is either something
 * of type `T` in case of success, or of type `E` (usually an `AppError`) in case of failure.
 *
 * `Result<T, E>` is generic in both arguments. Thus instead of `AppError`, you can also use a
 * custom type, in which case you have to use your own `CustomErr` constructor as well.
 *
 * Use a Result for failures which are both expected and recoverable (e.g. IO).
 *
 * Usage:
 * ```ts
 * const res = Math.random()
 *   ? Ok("here is our result")
 *   : Err("Oh noes");
 *
 * if (res.ok) {
 *   console.info(res.val);
 * } else {
 *   console.error(res.error);
 * }
 * ```
 */
export type Result<T, E extends { ok: undefined } = AppError> = { ok: true; val: T } | E;

/**
 * Type used to represent some kind of error or failure,
 * for example the result of a non-OK HTTP response.
 *
 * Just like `Response`, this can be used as the return type for
 * both HTTP client (i.e. `fetch` wrapper), and server (i.e. routes), responses.
 */
export interface AppError<S extends string = string> {
  /** The Error that caused this AppError, if any. */
  cause?: Error;
  /** Short English debug string, ideally a string literal */
  error: S;
  /** List of schema validation issues found, if any */
  issues?: ReadonlyArray<StandardSchemaV1.Issue>;
  /** Human-readable message, potentially localized */
  message?: string;
  /** just here for TypeScript to distinguish the different `Result<T>` types */
  ok: undefined;
  /** HTTP status code, if available */
  statusCode?: number;
}

/**
 * Ok constructor
 */
export const Ok = <T>(val: T): { ok: true; val: T } => ({ ok: true, val });

/**
 * AppError constructor
 */
export const Err = <S extends string = string>(
  /** Short English debug string, ideally a string literal */
  error: S,
  /** HTTP status code, if available */
  statusCode?: number,
  /** Human-readable message, potentially localized */
  message?: string,
  /** The Error or schema validation failure that caused this AppError, if any. */
  cause?: Error | StandardSchemaV1.FailureResult,
): AppError<S> => {
  const rest = cause instanceof Error ? { cause } : { issues: cause?.issues };
  return { error, message, ok: undefined, statusCode, ...rest };
};

/**
 * Takes a `Promise<T>` that may throw/reject and converts it to a `Result<T>`.
 */
export const catchPromise = async <T>(promise: Promise<T>): Promise<Result<T>> => {
  try {
    return Ok(await promise);
  } catch (e) {
    return toAppError(e);
  }
};

/**
 * Converts an unknown object (presumably an `Error`) into an `AppError`.
 */
export const toAppError = (e: unknown): AppError<string> => {
  const cause = e instanceof Error ? e : undefined;
  return Err(`${e}`, undefined, undefined, cause);
};
