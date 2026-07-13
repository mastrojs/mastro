import { assertEquals, assertRejects } from "jsr:@std/assert";
import { findFiles, readJsonFiles } from "./fs.ts";

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

Deno.test("readJsonFiles", async () => {
  const arr = await readJsonFiles<{ name: string }>("*.json");
  assertEquals(arr.length, 1);
  assertEquals(arr[0].path, "deno.json");
  assertEquals(arr[0].slug, "deno");
  assertEquals(arr[0].data.name, "@mastrojs/mastro");
});
