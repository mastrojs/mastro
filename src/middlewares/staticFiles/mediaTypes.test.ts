import { assertEquals } from "jsr:@std/assert";
import { contentTypeFromExt } from "./mediaTypes.ts";

Deno.test("contentTypeFromExt", () => {
  assertEquals(contentTypeFromExt("json"), "application/json; charset=UTF-8");
  assertEquals(contentTypeFromExt("html"), "text/html; charset=UTF-8");
  assertEquals(contentTypeFromExt("css"), "text/css; charset=UTF-8");
  assertEquals(contentTypeFromExt("js"), "text/javascript; charset=UTF-8");
  assertEquals(contentTypeFromExt("txt"), "text/plain; charset=UTF-8");
  assertEquals(contentTypeFromExt("xml"), "application/xml");
  assertEquals(contentTypeFromExt("atom"), "application/atom+xml");
  assertEquals(contentTypeFromExt("exe"), "application/x-msdos-program");
  assertEquals(contentTypeFromExt("mp4"), "video/mp4");
  assertEquals(contentTypeFromExt("foo"), undefined);
  assertEquals(contentTypeFromExt("file.json"), undefined);
  assertEquals(contentTypeFromExt(""), undefined);
});
