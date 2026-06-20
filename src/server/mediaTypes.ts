/*
Source of mediaTypes.json is https://github.com/denoland/std/blob/9145d20d86f897d21afc3cfda0f0219e79fd02c1/media_types/vendor/db.ts
Copyright 2018-2026 the Deno authors. MIT license.
but was transformed with:

JSON.stringify(Object.keys(db).reduce((acc, type) => {
  const { extensions, charset, source } = db[type];
  if (extensions && (source === "iana" || !source)) {
    const cs = charset || (type.startsWith("text/") ? "UTF-8" : null);
    for (const ext of extensions) {
      const current = acc[ext];
      if (!current || current === "application/octet-stream" || current === "application/mp4") {
        acc[ext] = type + (cs ? `; charset=${cs}` : "");
      }
    }
  }
  return acc;
}, {}))
*/
import types from "./mediaTypes.json" with { type: "json" };

/**
 * Returns the `Content-Type` header value for a given file extension. For example:
 * `extensionToContentType("html") === "text/html; charset=UTF-8"`;
 */
export const contentTypeFromExt = (ext: string): string | undefined =>
  types[ext.toLowerCase() as keyof typeof types];
