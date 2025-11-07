/**
 * Maps over an `AsyncIterable`, just like you'd map over an array.
 */
export async function * mapIterable<T, R> (
  iter: AsyncIterable<T>,
  callback: (val: T) => R,
): AsyncIterable<R> {
  for await (const val of iter) {
    yield callback(val)
  }
}
