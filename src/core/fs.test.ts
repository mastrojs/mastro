import { assertEquals, assertRejects } from "jsr:@std/assert";
import { findFiles } from "./fs.ts";

Deno.test("findFiles", async () => {
  assertEquals(await findFiles("*"), [
    "LICENSE",
    "README.md",
    "deno.json",
    "deno.lock",
  ]);

  assertEquals(await findFiles("/etc/*"), []);

  assertRejects(() => findFiles("../*"));

  assertRejects(() => findFiles("foo/../../bar/*"));
});
