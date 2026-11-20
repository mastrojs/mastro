import assert from "node:assert/strict";
import { test } from "node:test";

import { MagickFormat } from "@imagemagick/magick-wasm";

import { transformImage } from "./images.ts";

test("transformImage", async () => {
  const img = await transformImage("test-images/blue-marble.jpg", {
    format: MagickFormat.WebP,
    transform: (image) => image.resize(300, 300),
  });
  assert(img instanceof Uint8Array);
});
