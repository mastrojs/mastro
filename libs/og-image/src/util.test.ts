import assert from "node:assert/strict";
import { test } from "node:test";

import { softHyphen, toLines } from "./util.ts";

const lineWidth = 900;
const measureText = (text: string) => ({ width: 30 * text.length });

test("toLines", () => {
  assert.deepStrictEqual(toLines("Hello World", lineWidth, measureText), ["Hello World"]);
  assert.deepStrictEqual(
    toLines("The simplest web framework and site generator yet.", lineWidth, measureText),
    ["The simplest web framework", "and site generator yet."],
  );
  assert.deepStrictEqual(toLines("Hello\n\nWorld", lineWidth, measureText), [
    "Hello",
    "",
    "",
    "World",
  ]);
});

test("toLines single soft-hyphen", () => {
  assert.deepStrictEqual(
    toLines(
      `How are long words hyphen${softHyphen}ated? Hopefully where they should?`,
      lineWidth,
      measureText,
    ),
    ["How are long words hyphen-", "ated? Hopefully where they", "should?"],
  );
});

test("toLines double soft-hyphen 1", () => {
  assert.deepStrictEqual(
    toLines(
      `How are longer words hy${softHyphen}phen${softHyphen}ated? Where they should?`,
      lineWidth,
      measureText,
    ),
    ["How are longer words hy-", "phenated? Where they should?"],
  );
});

test("toLines double soft-hyphen 2", () => {
  assert.deepStrictEqual(
    toLines(
      `How are long words hy${softHyphen}phen${softHyphen}ated? Where they should?`,
      lineWidth,
      measureText,
    ),
    ["How are long words hyphen-", "ated? Where they should?"],
  );
});

test("toLines soft-hyphens with very long word", () => {
  assert.deepStrictEqual(
    toLines(
      `How are words hy${softHyphen}phenatedThat${softHyphen}NeedEvenMore${softHyphen}Space${softHyphen}Still`,
      lineWidth,
      measureText,
    ),
    ["How are words hy-", "phenatedThatNeedEvenMore-", "SpaceStill"],
  );
});

test("toLines syllable longer than line width", () => {
  const longSyllable = "a".repeat(31);
  assert.deepStrictEqual(toLines(`Short ${longSyllable}${softHyphen}b`, lineWidth, measureText), [
    "Short",
    longSyllable + "b",
  ]);
});
