import { assertEquals } from "jsr:@std/assert";
import { contentTypeFromExt, extFromContentType } from "./mediaTypes.ts";

Deno.test("contentTypeFromExt", () => {
  assertEquals(contentTypeFromExt("json"), "application/json; charset=UTF-8");
  assertEquals(contentTypeFromExt("html"), "text/html; charset=UTF-8");
  assertEquals(contentTypeFromExt("txt"), "text/plain; charset=UTF-8");
  assertEquals(contentTypeFromExt("foo"), undefined);
  assertEquals(contentTypeFromExt("file.json"), undefined);
  assertEquals(contentTypeFromExt("mp4"), "video/mp4");
  assertEquals(contentTypeFromExt("exe"), "application/x-msdos-program");
  assertEquals(contentTypeFromExt(""), undefined);
});

Deno.test("extFromContentType", () => {
  assertEquals(extFromContentType("application/JSON"), "json");
  assertEquals(extFromContentType("text/html; charset=UTF-8"), "html");
  assertEquals(extFromContentType(""), undefined);
  assertEquals(extFromContentType(null), undefined);
});
