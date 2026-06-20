// Source of mediaTypes.json: https://github.com/denoland/std/blob/9145d20d86f897d21afc3cfda0f0219e79fd02c1/media_types/vendor/db.ts
// Copyright 2018-2026 the Deno authors. MIT license.
// transformed with:
// JSON.stringify(Object.keys(types).reduce((acc, key) => { const { extensions, charset, source } = types[key]; if (extensions && (source === "iana" || !source)) { acc[key] = { extensions, charset } } return acc; }, {}))
import db from "./mediaTypes.json" with { type: "json" };

const types: Record<string, string | undefined> = {};
for (const [type, mime] of Object.entries(db)) {
  const charset = "charset" in mime ? mime.charset : (type.startsWith("text/") ? "UTF-8" : null);
  for (const ext of mime.extensions) {
    types[ext] = type + (charset ? `; charset=${charset}` : "");
  }
}

/**
 * Returns the `Content-Type` header value for a given file extension. For example:
 * `extensionToContentType("html") === "text/html; charset=UTF-8"`;
 */
export const contentTypeFromExt = (ext: string) => types[ext.toLowerCase()];
