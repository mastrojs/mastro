import assert from "node:assert/strict";
import { test } from "node:test";

import { importRegex } from "./tsToJs.ts";

const replaceImports = (code: string) => code.replace(importRegex, "$1.js$2;");

test("importRegex rewrites multiline and indented static TypeScript imports", () => {
  const code = `import {
  value,
} from "./dep.client.ts";
  import other from './dep.client.ts'
import * as dependency from
  "./dep.client.ts";
import "./dep.client.ts"
import "./already.js";
const path = "./dep.client.ts";`;
  assert.equal(
    replaceImports(code),
    `import {
  value,
} from "./dep.client.js";
  import other from './dep.client.js';
import * as dependency from
  "./dep.client.js";
import "./dep.client.js";
import "./already.js";
const path = "./dep.client.ts";`,
  );
});

test("importRegex leaves dynamic imports unchanged", () => {
  for (const code of [
    'import("./dep.client.ts");',
    'import ("./dep.client.ts");',
    'import (\n  "./dep.client.ts"\n);',
    'import\n(\n  "./dep.client.ts"\n);',
  ]) {
    assert.equal(replaceImports(code), code);
  }
});

test("importRegex leaves JavaScript imports and ordinary strings unchanged", () => {
  const code = `import { value } from "./dep.js";
const path = "./dep.client.ts";
const example = "import value from './dep.client.ts';";`;
  assert.equal(replaceImports(code), code);
});
